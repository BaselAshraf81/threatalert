import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  Timestamp,
  increment,
} from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { db, storage } from "./firebase"
import type { Incident, IncidentCategory } from "./types"
import { getCategoryInfo } from "./types"

// ─────────────────────────────────────────────────────────────────────────────
// Write strategy (resolved at module load time):
//
//  • DEV + no NEXT_PUBLIC_FUNCTIONS_URL  → direct Firestore writes (no rate-
//    limiting or vote dedup — fine for local testing)
//  • DEV + NEXT_PUBLIC_FUNCTIONS_URL set → Firebase emulator HTTP endpoints
//  • PRODUCTION                          → /api/* → Firebase Hosting rewrite
//                                          → Cloud Function HTTP endpoints
// ─────────────────────────────────────────────────────────────────────────────

const FUNCTIONS_BASE = (process.env.NEXT_PUBLIC_FUNCTIONS_URL ?? "").replace(/\/$/, "")
const USE_DIRECT_WRITES = process.env.NODE_ENV === "development" && !FUNCTIONS_BASE

// ── Read store ────────────────────────────────────────────────────────────────

let incidents: Incident[] = []
let listeners: Array<() => void> = []
let unsubscribeFirestore: (() => void) | null = null

function notify() {
  listeners.forEach((l) => l())
}

function initFirestoreListener() {
  if (unsubscribeFirestore) return
  const q = query(
    collection(db, "incidents"),
    where("status", "in", ["pending", "active"]),
    orderBy("createdAt", "desc")
  )
  unsubscribeFirestore = onSnapshot(q, (snapshot) => {
    incidents = snapshot.docs.map((d) => {
      const data = d.data()
      // Normalise: merge legacy single photoUrl into photoUrls array
      const photoUrls: string[] = data.photoUrls ?? (data.photoUrl ? [data.photoUrl] : [])
      return {
        id: d.id,
        category: data.category,
        description: data.description,
        lat: data.lat,
        lng: data.lng,
        status: data.status,
        confirmVotes: data.confirmVotes || 0,
        resolveVotes: data.resolveVotes || 0,
        flagVotes: data.flagVotes || 0,
        createdAt: data.createdAt?.toMillis() || Date.now(),
        expiresAt: data.expiresAt?.toMillis() || Date.now(),
        photoUrls,
      } as Incident
    })
    notify()
  })
}

if (typeof window !== "undefined") {
  initFirestoreListener()
}

export function getIncidents(): Incident[] { return incidents }
export function getIncidentById(id: string): Incident | undefined {
  return incidents.find((i) => i.id === id)
}

// ── HTTP helper (production + emulator) ──────────────────────────────────────

async function callApi(functionName: string, body: Record<string, unknown>): Promise<Response> {
  const url = FUNCTIONS_BASE
    ? `${FUNCTIONS_BASE}/${functionName}`
    : `/api/${functionName}`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res
}

// ── Photo upload ──────────────────────────────────────────────────────────────

/**
 * Upload up to 3 image files to Firebase Storage under incidents/<uuid>/<index>.
 * Returns an array of public download URLs.
 */
export async function uploadPhotos(incidentId: string, files: File[]): Promise<string[]> {
  const capped = files.slice(0, 3)
  const urls = await Promise.all(
    capped.map(async (file, i) => {
      const ext = file.name.split(".").pop() ?? "jpg"
      const storageRef = ref(storage, `incidents/${incidentId}/${i}.${ext}`)
      await uploadBytes(storageRef, file, { contentType: file.type })
      return getDownloadURL(storageRef)
    })
  )
  return urls
}

// ── Write: create incident ────────────────────────────────────────────────────

export async function addIncident(
  category: IncidentCategory,
  description: string,
  lat: number,
  lng: number,
  photoUrls?: string[]
): Promise<Incident> {
  const categoryInfo = getCategoryInfo(category)
  const now = Date.now()
  const ttlMs = categoryInfo.ttlHours * 60 * 60 * 1000

  let id: string

  if (USE_DIRECT_WRITES) {
    // ── Dev fallback: write directly to Firestore ──
    if (typeof window !== "undefined") {
      console.info("[dev] Writing incident directly to Firestore (no Cloud Function).")
    }
    const docRef = await addDoc(collection(db, "incidents"), {
      category,
      description: description || "Incident reported",
      lat,
      lng,
      status: "pending",
      confirmVotes: 1,
      resolveVotes: 0,
      createdAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(now + ttlMs),
      ...(photoUrls?.length ? { photoUrls } : {}),
    })
    id = docRef.id
  } else {
    // ── Production / emulator: Cloud Function HTTP endpoint ──
    const res = await callApi("createIncident", {
      category, description, lat, lng,
      ...(photoUrls?.length ? { photoUrls } : {}),
    })
    ;({ id } = await res.json())
  }

  if (typeof window !== "undefined") {
    localStorage.setItem(`voted_${id}`, "confirm")
  }

  return {
    id, category,
    description: description || "Incident reported",
    lat, lng,
    status: "pending",
    confirmVotes: 1,
    resolveVotes: 0,
    flagVotes: 0,
    createdAt: now,
    expiresAt: now + ttlMs,
    photoUrls: photoUrls ?? [],
  } as Incident
}

// ── Write: vote ───────────────────────────────────────────────────────────────

export async function voteConfirm(id: string): Promise<void> {
  if (typeof window !== "undefined" && localStorage.getItem(`voted_${id}`)) return

  if (USE_DIRECT_WRITES) {
    await updateDoc(doc(db, "incidents", id), { confirmVotes: increment(1) })
  } else {
    await callApi("vote", { incidentId: id, voteType: "confirm" })
  }

  if (typeof window !== "undefined") localStorage.setItem(`voted_${id}`, "confirm")
}

export async function voteResolve(id: string): Promise<void> {
  if (typeof window !== "undefined" && localStorage.getItem(`voted_${id}`)) return

  if (USE_DIRECT_WRITES) {
    await updateDoc(doc(db, "incidents", id), { resolveVotes: increment(1) })
  } else {
    await callApi("vote", { incidentId: id, voteType: "resolve" })
  }

  if (typeof window !== "undefined") localStorage.setItem(`voted_${id}`, "resolve")
}

export async function voteFlag(id: string): Promise<void> {
  if (typeof window !== "undefined" && localStorage.getItem(`voted_${id}`)) return

  if (USE_DIRECT_WRITES) {
    await updateDoc(doc(db, "incidents", id), { flagVotes: increment(1) })
  } else {
    await callApi("vote", { incidentId: id, voteType: "flag" })
  }

  if (typeof window !== "undefined") localStorage.setItem(`voted_${id}`, "flag")
}

export function hasVoted(id: string): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(`voted_${id}`)
}

/**
 * After an incident is created, patch its photoUrls field.
 * This is called after the photos have been uploaded to Storage.
 */
export async function patchIncidentPhotos(id: string, photoUrls: string[]): Promise<void> {
  if (!photoUrls.length) return
  if (USE_DIRECT_WRITES) {
    await updateDoc(doc(db, "incidents", id), { photoUrls })
  } else {
    await callApi("patchIncidentPhotos", { incidentId: id, photoUrls })
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.push(listener)
  return () => { listeners = listeners.filter((l) => l !== listener) }
}
