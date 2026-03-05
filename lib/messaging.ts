/**
 * Firebase Cloud Messaging helpers.
 *
 * getToken() requires a VAPID key. Get yours from:
 *   Firebase Console → Project Settings → Cloud Messaging → Web Push certificates → Generate key pair
 * Then set NEXT_PUBLIC_FIREBASE_VAPID_KEY in .env.local.
 */

import { getMessaging, getToken, deleteToken, isSupported } from "firebase/messaging"
import { collection, addDoc, deleteDoc, doc, Timestamp } from "firebase/firestore"
import { app, db } from "./firebase"

export type PushSubscribeOptions = {
  lat: number
  lng: number
  radiusKm: number
  threshold: number
  worldwide: boolean
  includeUnverified: boolean
}

export type SubscribeResult =
  | { ok: true; tokenPreview: string }
  | { ok: false; reason: "unsupported" | "denied" | "no_vapid_key" | "sw_error" | "firestore_error" | "error"; message: string }

// localStorage keys — store subscription state so the UI knows on next load
const LS_SUB_DOC_ID = "threatalert_sub_doc_id"
const LS_SUB_TOKEN  = "threatalert_sub_token"

function clearSubscriptionStorage() {
  localStorage.removeItem(LS_SUB_DOC_ID)
  localStorage.removeItem(LS_SUB_TOKEN)
}

/**
 * Returns the Firebase messaging SW registration, registering it if necessary.
 * Extracted so both subscribe and unsubscribe share the same SW-resolution logic.
 */
async function getMessagingSW(): Promise<ServiceWorkerRegistration> {
  const registrations = await navigator.serviceWorker.getRegistrations()
  let swReg = registrations.find((r) =>
    r.active?.scriptURL.includes("firebase-messaging-sw.js") ||
    r.installing?.scriptURL.includes("firebase-messaging-sw.js") ||
    r.waiting?.scriptURL.includes("firebase-messaging-sw.js")
  )
  if (!swReg) {
    swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js")
  }
  // Wait for the SW to become active before handing it to FCM
  if (!swReg.active) {
    await new Promise<void>((resolve) => {
      const sw = swReg!.installing ?? swReg!.waiting
      if (!sw) { resolve(); return }
      sw.addEventListener("statechange", function handler() {
        if (sw.state === "activated") { sw.removeEventListener("statechange", handler); resolve() }
      })
    })
  }
  return swReg
}

/**
 * Silently checks whether the user already has an active push subscription.
 * Returns the stored subscriber doc ID if the subscription is still valid.
 * Does NOT trigger any permission prompts.
 */
export async function getSubscriptionStatus(): Promise<{ subscribed: true; docId: string } | { subscribed: false }> {
  if (typeof window === "undefined") return { subscribed: false }

  const docId = localStorage.getItem(LS_SUB_DOC_ID)
  const storedToken = localStorage.getItem(LS_SUB_TOKEN)
  if (!docId || !storedToken) return { subscribed: false }

  try {
    const supported = await isSupported()
    if (!supported) { clearSubscriptionStorage(); return { subscribed: false } }

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
    if (!vapidKey) return { subscribed: false }

    if (Notification.permission !== "granted") { clearSubscriptionStorage(); return { subscribed: false } }

    const swReg = await getMessagingSW()
    const messaging = getMessaging(app)
    const currentToken = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg })

    if (!currentToken || currentToken !== storedToken) {
      // Token rotated or the browser revoked the subscription
      clearSubscriptionStorage()
      return { subscribed: false }
    }

    return { subscribed: true, docId }
  } catch {
    return { subscribed: false }
  }
}

/**
 * Full push notification subscription flow:
 * 1. Check browser support
 * 2. Request Notification permission
 * 3. Ensure the Firebase messaging service worker is registered and active
 * 4. Get FCM token (requires VAPID key)
 * 5. Save subscriber record to Firestore — failure is now fatal so the UI
 *    never shows "Notifications enabled!" when the record was not actually saved
 */
export async function subscribeToPush(opts: PushSubscribeOptions): Promise<SubscribeResult> {
  // 1. Check browser support
  if (typeof window === "undefined" || !("Notification" in window)) {
    return { ok: false, reason: "unsupported", message: "Browser does not support notifications." }
  }

  const supported = await isSupported()
  if (!supported) {
    return { ok: false, reason: "unsupported", message: "Firebase Messaging is not supported in this browser." }
  }

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  if (!vapidKey) {
    return {
      ok: false,
      reason: "no_vapid_key",
      message: "NEXT_PUBLIC_FIREBASE_VAPID_KEY is not set. Add it to .env.local.",
    }
  }

  // 2. Request permission
  let permission = Notification.permission
  if (permission === "default") {
    permission = await Notification.requestPermission()
  }
  if (permission !== "granted") {
    return { ok: false, reason: "denied", message: "Notification permission was denied." }
  }

  // 3. Register / find the Firebase messaging SW
  let swRegistration: ServiceWorkerRegistration
  try {
    swRegistration = await getMessagingSW()
  } catch (err) {
    return { ok: false, reason: "sw_error", message: `Service worker error: ${String(err)}` }
  }

  // 4. Get FCM token
  let token: string
  try {
    const messaging = getMessaging(app)
    token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swRegistration })
    if (!token) throw new Error("getToken returned empty")
  } catch (err) {
    return { ok: false, reason: "error", message: `Could not get FCM token: ${String(err)}` }
  }

  // 5. Save subscriber to Firestore — failure is now fatal
  try {
    const docRef = await addDoc(collection(db, "subscribers"), {
      type: "fcm",
      token,
      lat: opts.lat,
      lng: opts.lng,
      radiusKm: opts.worldwide ? 40075 : opts.radiusKm, // 40075 ≈ Earth circumference km
      threshold: opts.threshold,
      worldwide: opts.worldwide,
      includeUnverified: opts.includeUnverified,
      createdAt: Timestamp.now(),
    })
    // Persist doc ID and token so we can restore UI state on next load
    // and target the correct document on unsubscribe
    localStorage.setItem(LS_SUB_DOC_ID, docRef.id)
    localStorage.setItem(LS_SUB_TOKEN, token)
  } catch (err) {
    return {
      ok: false,
      reason: "firestore_error",
      message: `Subscription could not be saved. Check Firestore rules. (${String(err)})`,
    }
  }

  return { ok: true, tokenPreview: token.slice(0, 8) + "…" }
}

/**
 * Removes the user's push subscription:
 * - Deletes the subscriber document from Firestore (rules allow delete: true)
 * - Revokes the FCM token so the device stops receiving push frames
 * - Clears localStorage so the UI resets to the "Enable" state
 */
export async function unsubscribeFromPush(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (typeof window === "undefined") return { ok: false, message: "Not in a browser context." }

  const docId = localStorage.getItem(LS_SUB_DOC_ID)

  // Delete the Firestore subscriber doc (best-effort; don't block on failure)
  if (docId) {
    try {
      await deleteDoc(doc(db, "subscribers", docId))
    } catch (err) {
      console.warn("Could not delete subscriber doc:", err)
    }
  }

  // Revoke the FCM token in the browser
  try {
    const supported = await isSupported()
    if (supported && Notification.permission === "granted") {
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
      if (vapidKey) {
        const messaging = getMessaging(app)
        await deleteToken(messaging)
      }
    }
  } catch (err) {
    console.warn("Could not revoke FCM token:", err)
  }

  clearSubscriptionStorage()
  return { ok: true }
}
