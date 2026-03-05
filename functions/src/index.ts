import * as functions from "firebase-functions"
import { onRequest } from "firebase-functions/v2/https"
import * as admin from "firebase-admin"
import { createHmac } from "crypto"

admin.initializeApp()
const db = admin.firestore()

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const VALID_CATEGORIES = ["crime", "disaster", "fire", "infrastructure", "unrest", "custom"]

const CATEGORY_THRESHOLDS: Record<string, number> = {
  crime: 3, disaster: 2, fire: 2, infrastructure: 3, unrest: 4, custom: 5,
}

/** One-way hash of an IP address so we never store raw IPs. */
function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT || "threatalert-default-salt-CHANGE-ME"
  return createHmac("sha256", salt).update(ip).digest("hex").slice(0, 24)
}

/** Extract the real client IP, honouring the X-Forwarded-For header set by Firebase Hosting. */
function getClientIp(req: functions.https.Request): string {
  const xff = req.headers["x-forwarded-for"]
  if (typeof xff === "string") return xff.split(",")[0].trim()
  return req.ip || "unknown"
}

/**
 * Increment a rate-limit counter in Firestore.
 * Returns true if the request is allowed, false if the limit is exceeded.
 *
 * Key format: {action}_{ipHash}_{hourWindow}
 * We use a transaction so concurrent requests don't race.
 */
async function checkRateLimit(
  ipHash: string,
  action: string,
  maxPerHour: number
): Promise<boolean> {
  const window = Math.floor(Date.now() / 3_600_000) // current hour bucket
  const docId = `${action}_${ipHash}_${window}`
  const ref = db.collection("_ratelimit").doc(docId)

  try {
    const allowed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const count: number = snap.exists ? (snap.data()!.count as number) : 0
      if (count >= maxPerHour) return false
      tx.set(ref, { count: count + 1, action, ipHash, window }, { merge: true })
      return true
    })
    return allowed
  } catch {
    // On error, fail open (allow) — better than blocking real users on DB hiccup
    return true
  }
}

/** CORS + JSON helpers */
function setCors(res: functions.Response) {
  // Restrict to the configured origin; falls back to same-origin via Firebase Hosting rewrites.
  // Set ALLOWED_ORIGIN in Firebase Function config: firebase functions:config:set app.allowed_origin="https://yourdomain.com"
  const origin = process.env.ALLOWED_ORIGIN || ""
  if (origin) {
    res.set("Access-Control-Allow-Origin", origin)
  }
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.set("Access-Control-Allow-Headers", "Content-Type")
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP endpoint: POST /api/createIncident
// ─────────────────────────────────────────────────────────────────────────────

export const createIncident = onRequest(
  { region: "us-east1", timeoutSeconds: 30 },
  async (req, res) => {
    setCors(res)
    if (req.method === "OPTIONS") { res.status(204).send(""); return }
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return }

    const ip = getClientIp(req)
    const ipHash = hashIp(ip)

    // ── Rate limit: 5 incident creations per IP per hour ──
    const allowed = await checkRateLimit(ipHash, "create", 5)
    if (!allowed) {
      res.status(429).json({ error: "Too many reports from this IP. Try again later." })
      return
    }

    // ── Validate body ──
    const { category, description, lat, lng, photoUrls } = req.body ?? {}

    if (!VALID_CATEGORIES.includes(category)) {
      res.status(400).json({ error: "Invalid category." }); return
    }
    if (typeof lat !== "number" || lat < -90 || lat > 90) {
      res.status(400).json({ error: "Invalid latitude." }); return
    }
    if (typeof lng !== "number" || lng < -180 || lng > 180) {
      res.status(400).json({ error: "Invalid longitude." }); return
    }

    // Sanitise description: strip to plain text, enforce length
    const rawDesc: string = typeof description === "string" ? description : ""
    const safeDesc = rawDesc.replace(/[<>]/g, "").trim().slice(0, 280)

    // Sanitise photoUrls: must be an array of valid https:// Firebase Storage URLs, max 3
    const safePhotoUrls: string[] = []
    if (Array.isArray(photoUrls)) {
      for (const u of photoUrls.slice(0, 3)) {
        if (
          typeof u === "string" &&
          u.startsWith("https://") &&
          (u.includes("firebasestorage.googleapis.com") || u.includes("storage.googleapis.com"))
        ) {
          safePhotoUrls.push(u)
        }
      }
    }

    // ── Write via admin SDK (bypasses Firestore rules) ──
    const CATEGORY_TTL_HOURS: Record<string, number> = {
      crime: 4, disaster: 12, fire: 6, infrastructure: 8, unrest: 6, custom: 4,
    }
    const now = Date.now()
    const ttlMs = (CATEGORY_TTL_HOURS[category] ?? 4) * 3_600_000

    const data: Record<string, unknown> = {
      category,
      description: safeDesc || "Incident reported",
      lat,
      lng,
      status: "pending",
      confirmVotes: 1,
      resolveVotes: 0,
      createdAt: admin.firestore.Timestamp.fromMillis(now),
      expiresAt: admin.firestore.Timestamp.fromMillis(now + ttlMs),
      // Store hashed IP so we can detect the creator's own duplicate vote server-side
      creatorIpHash: ipHash,
    }

    if (safePhotoUrls.length > 0) {
      data.photoUrls = safePhotoUrls
    }

    const docRef = await db.collection("incidents").add(data)

    // Record the creator's implicit confirm vote so they can't vote again
    await db.collection("votes").doc(`${ipHash}_${docRef.id}`).set({
      ipHash, incidentId: docRef.id, voteType: "confirm", createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    // Notify immediately on creation — onIncidentUpdate only fires on *updates*, so
    // subscribers with threshold=1 would never be notified if nobody votes afterward.
    await triggerNotifications(docRef.id, data)

    res.status(201).json({ id: docRef.id })
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// HTTP endpoint: POST /api/patchIncidentPhotos
// Called after photos are uploaded to Storage; patches the photoUrls field.
// ─────────────────────────────────────────────────────────────────────────────

export const patchIncidentPhotos = onRequest(
  { region: "us-east1", timeoutSeconds: 30 },
  async (req, res) => {
    setCors(res)
    if (req.method === "OPTIONS") { res.status(204).send(""); return }
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return }

    const ip = getClientIp(req)
    const ipHash = hashIp(ip)

    // Separate rate limit bucket from createIncident (10 patches/hr is generous but isolated)
    const allowed = await checkRateLimit(ipHash, "patch", 10)
    if (!allowed) {
      res.status(429).json({ error: "Rate limit exceeded." }); return
    }

    const { incidentId, photoUrls } = req.body ?? {}

    if (typeof incidentId !== "string" || !incidentId) {
      res.status(400).json({ error: "Missing incidentId." }); return
    }

    // Validate photoUrls
    const safePhotoUrls: string[] = []
    if (Array.isArray(photoUrls)) {
      for (const u of photoUrls.slice(0, 3)) {
        if (
          typeof u === "string" &&
          u.startsWith("https://") &&
          (u.includes("firebasestorage.googleapis.com") || u.includes("storage.googleapis.com"))
        ) {
          safePhotoUrls.push(u)
        }
      }
    }

    if (!safePhotoUrls.length) {
      res.status(400).json({ error: "No valid photoUrls provided." }); return
    }

    // Verify incident exists and was created by this IP
    const incidentRef = db.collection("incidents").doc(incidentId)
    const snap = await incidentRef.get()
    if (!snap.exists) {
      res.status(404).json({ error: "Incident not found." }); return
    }

    const incident = snap.data()!
    if (incident.creatorIpHash !== ipHash) {
      res.status(403).json({ error: "Not authorised to edit this incident." }); return
    }

    await incidentRef.update({ photoUrls: safePhotoUrls })
    res.status(200).json({ ok: true })
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// HTTP endpoint: POST /api/vote
// ─────────────────────────────────────────────────────────────────────────────

export const vote = onRequest(
  { region: "us-east1", timeoutSeconds: 30 },
  async (req, res) => {
    setCors(res)
    if (req.method === "OPTIONS") { res.status(204).send(""); return }
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return }

    const ip = getClientIp(req)
    const ipHash = hashIp(ip)

    // ── Rate limit: 20 vote actions per IP per hour ──
    const allowed = await checkRateLimit(ipHash, "vote", 20)
    if (!allowed) {
      res.status(429).json({ error: "Too many votes from this IP. Try again later." })
      return
    }

    // ── Validate body ──
    const { incidentId, voteType } = req.body ?? {}

    if (typeof incidentId !== "string" || !incidentId) {
      res.status(400).json({ error: "Missing incidentId." }); return
    }
    if (voteType !== "confirm" && voteType !== "resolve" && voteType !== "flag") {
      res.status(400).json({ error: "voteType must be 'confirm', 'resolve', or 'flag'." }); return
    }

    // ── Check incident exists and is open ──
    const incidentRef = db.collection("incidents").doc(incidentId)
    const incidentSnap = await incidentRef.get()
    if (!incidentSnap.exists) {
      res.status(404).json({ error: "Incident not found." }); return
    }
    const incident = incidentSnap.data()!
    if (!["pending", "active"].includes(incident.status)) {
      res.status(409).json({ error: "Incident is already resolved." }); return
    }

    // ── Server-side deduplication via votes collection ──
    const voteDocId = `${ipHash}_${incidentId}`
    const voteRef = db.collection("votes").doc(voteDocId)
    const voteSnap = await voteRef.get()
    if (voteSnap.exists) {
      res.status(409).json({ error: "Already voted on this incident." }); return
    }

    // ── Write vote record + increment counter atomically ──
    const increment = admin.firestore.FieldValue.increment(1)
    const field = voteType === "confirm" ? "confirmVotes" : voteType === "resolve" ? "resolveVotes" : "flagVotes"

    await db.runTransaction(async (tx) => {
      // Re-check dedup inside transaction to prevent race conditions
      const voteCheck = await tx.get(voteRef)
      if (voteCheck.exists) throw new Error("ALREADY_VOTED")

      tx.set(voteRef, {
        ipHash, incidentId, voteType, createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      tx.update(incidentRef, { [field]: increment })
    }).catch((err) => {
      if (err.message === "ALREADY_VOTED") {
        res.status(409).json({ error: "Already voted on this incident." })
        throw err // prevent the success response below
      }
      throw err
    })

    res.status(200).json({ ok: true })
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// Firestore trigger: promote/resolve incidents based on vote thresholds
// ─────────────────────────────────────────────────────────────────────────────

export const onIncidentUpdate = functions.firestore
  .document("incidents/{incidentId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data()
    const after = change.after.data()
    const incidentId = context.params.incidentId

    const confirmVotesChanged = before.confirmVotes !== after.confirmVotes
    const resolveVotesChanged = before.resolveVotes !== after.resolveVotes
    if (!confirmVotesChanged && !resolveVotesChanged) return null

    const threshold = CATEGORY_THRESHOLDS[after.category] || 3
    let newStatus = after.status

    if (after.status === "pending" && after.confirmVotes >= threshold) {
      newStatus = "active"
      functions.logger.info(`Incident ${incidentId} promoted to active`)
    }
    if (after.resolveVotes > after.confirmVotes) {
      newStatus = "resolved"
      functions.logger.info(`Incident ${incidentId} marked as resolved`)
    }

    if (newStatus !== after.status) {
      await change.after.ref.update({ status: newStatus })
    }

    // Determine which notification path applies — never both.
    if (newStatus === "active" && after.status === "pending") {
      // Incident just got verified: notify everyone (verified + unverified subscribers).
      // Pass the resolved status explicitly so triggerNotifications sees "active", not the
      // stale "pending" that is still in `after` before the update above is committed.
      await triggerNotifications(incidentId, { ...after, status: "active" })
    } else if (after.status === "pending" && confirmVotesChanged) {
      // Still pending but vote count changed: notify only subscribers who opted into unverified.
      await triggerNotifications(incidentId, after)
    }

    return null
  })

// ─────────────────────────────────────────────────────────────────────────────
// Scheduled: expire old incidents every hour
// ─────────────────────────────────────────────────────────────────────────────

export const expireIncidents = functions.pubsub
  .schedule("every 1 hours")
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now()
    const expired = await db.collection("incidents")
      .where("status", "in", ["pending", "active"])
      .where("expiresAt", "<=", now)
      .get()

    const batch = db.batch()
    expired.forEach((doc) => batch.update(doc.ref, { status: "resolved" }))
    if (!expired.empty) {
      await batch.commit()
      functions.logger.info(`Expired ${expired.size} incidents`)
    }
    return null
  })

// ─────────────────────────────────────────────────────────────────────────────
// Notifications helper
// ─────────────────────────────────────────────────────────────────────────────

// FCM error codes that mean the token is permanently invalid and should be removed.
const STALE_TOKEN_ERRORS = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
])

async function triggerNotifications(
  incidentId: string,
  incident: admin.firestore.DocumentData
) {
  try {
    // NOTE: This performs a full collection scan. For production scale (>10k subscribers)
    // replace with a geohash-bucketed query so only nearby subscriber docs are read.
    // See: https://firebase.google.com/docs/firestore/solutions/geoqueries
    const subscribersSnapshot = await db.collection("subscribers").get()

    type SendTask = { promise: Promise<string>; docId: string }
    const tasks: SendTask[] = []

    subscribersSnapshot.forEach((doc) => {
      const subscriber = doc.data()
      const distance = calculateDistance(incident.lat, incident.lng, subscriber.lat, subscriber.lng)

      // statusMatches: incident is verified OR subscriber explicitly wants unverified alerts.
      // `incident.status` is already the resolved status (callers pass { ...after, status: newStatus }).
      const statusMatches = subscriber.includeUnverified === true || incident.status === "active"

      if (
        statusMatches &&
        (subscriber.worldwide === true || distance <= subscriber.radiusKm) &&
        incident.confirmVotes >= subscriber.threshold &&
        subscriber.type === "fcm" &&
        subscriber.token
      ) {
        tasks.push({
          docId: doc.id,
          promise: admin.messaging().send({
            token: subscriber.token,
            // Data-only message: no top-level `notification` field so FCM does NOT
            // auto-display on Android. onBackgroundMessage in the SW handles display,
            // giving us full control over the notification data (including the deep-link URL).
            // All values must be strings per FCM spec.
            data: {
              title: getCategoryLabel(incident.category) + " Alert",
              body: incident.description,
              incidentId,
              category: incident.category,
              distance: distance.toFixed(1),
              url: `${process.env.ALLOWED_ORIGIN || "https://threatalert.live"}/?i=${incidentId}&lat=${incident.lat}&lng=${incident.lng}`,
            },
            // Required for data-only messages to wake the SW on Android
            android: { priority: "high" },
            webpush: { headers: { Urgency: "high" } },
          }),
        })
      }
    })

    const results = await Promise.allSettled(tasks.map((t) => t.promise))

    // Prune subscriber docs whose tokens are permanently invalid.
    const staleDocIds: string[] = []
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        const code: string = (result.reason as { code?: string })?.code ?? ""
        if (STALE_TOKEN_ERRORS.has(code)) {
          staleDocIds.push(tasks[i].docId)
          functions.logger.info(`Removing stale FCM token for subscriber ${tasks[i].docId}`)
        } else {
          functions.logger.warn(`FCM send failed for ${tasks[i].docId}:`, result.reason)
        }
      }
    })

    if (staleDocIds.length > 0) {
      const batch = db.batch()
      staleDocIds.forEach((id) => batch.delete(db.collection("subscribers").doc(id)))
      await batch.commit()
      functions.logger.info(`Deleted ${staleDocIds.length} stale subscriber(s)`)
    }

    const sent = results.filter((r) => r.status === "fulfilled").length
    functions.logger.info(`Sent ${sent}/${tasks.length} notifications for incident ${incidentId}`)
  } catch (error) {
    functions.logger.error("Error sending notifications:", error)
  }
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRad(deg: number) { return deg * (Math.PI / 180) }

function getCategoryLabel(category: string): string {
  return (
    { crime: "Crime / Safety", disaster: "Natural Disaster", fire: "Fire",
      infrastructure: "Infrastructure", unrest: "Civil Unrest", custom: "Incident" }[category]
    ?? "Incident"
  )
}
