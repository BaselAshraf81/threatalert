/**
 * Firebase Cloud Messaging helpers.
 *
 * getToken() requires a VAPID key. Get yours from:
 *   Firebase Console → Project Settings → Cloud Messaging → Web Push certificates → Generate key pair
 * Then set NEXT_PUBLIC_FIREBASE_VAPID_KEY in .env.local.
 */

import { getMessaging, getToken, isSupported } from "firebase/messaging"
import { collection, addDoc, Timestamp } from "firebase/firestore"
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
  | { ok: false; reason: "unsupported" | "denied" | "no_vapid_key" | "sw_error" | "error"; message: string }

/**
 * Full push notification subscription flow:
 * 1. Check browser support
 * 2. Request Notification permission
 * 3. Ensure the service worker is registered
 * 4. Get FCM token (requires VAPID key)
 * 5. Save subscriber record to Firestore
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

  // 3. Find or register the Firebase messaging SW specifically.
  //    We must NOT hand getToken() the generic PWA sw.js — it has no Firebase
  //    messaging handler and PushManager.subscribe will abort with "no active SW".
  let swRegistration: ServiceWorkerRegistration | undefined
  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    swRegistration = registrations.find((r) =>
      r.active?.scriptURL.includes("firebase-messaging-sw.js") ||
      r.installing?.scriptURL.includes("firebase-messaging-sw.js") ||
      r.waiting?.scriptURL.includes("firebase-messaging-sw.js")
    )
    if (!swRegistration) {
      swRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js")
    }
    // Wait for the SW to become active before handing it to FCM
    if (!swRegistration.active) {
      await new Promise<void>((resolve) => {
        const sw = swRegistration!.installing ?? swRegistration!.waiting
        if (!sw) { resolve(); return }
        sw.addEventListener("statechange", function handler() {
          if (sw.state === "activated") { sw.removeEventListener("statechange", handler); resolve() }
        })
      })
    }
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

  // 5. Save subscriber to Firestore
  try {
    await addDoc(collection(db, "subscribers"), {
      type: "fcm",
      token,
      lat: opts.lat,
      lng: opts.lng,
      radiusKm: opts.worldwide ? 40075 : opts.radiusKm, // 40075 = Earth circumference km
      threshold: opts.threshold,
      worldwide: opts.worldwide,
      includeUnverified: opts.includeUnverified,
      createdAt: Timestamp.now(),
    })
  } catch (err) {
    // Non-fatal: the token was obtained; Firestore write failed
    console.error("Failed to save subscriber:", err)
  }

  // Return a preview (never log or display the full token)
  return { ok: true, tokenPreview: token.slice(0, 8) + "…" }
}