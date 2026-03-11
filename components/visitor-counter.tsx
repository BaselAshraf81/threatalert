"use client"

import { useEffect, useRef, useState } from "react"
import {
  doc,
  collection,
  runTransaction,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  Timestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Users } from "lucide-react"

// ── Config ────────────────────────────────────────────────────────────────────
// Adjust VISITOR_BASE to whatever number you want to seed the counter from.
// The real Firestore count is added on top of this value.
const VISITOR_BASE = 150

// A session is considered "online" if its heartbeat is within this window (ms).
const ONLINE_WINDOW_MS = 90_000   // 90 s
const HEARTBEAT_MS     = 30_000   // ping every 30 s
// ─────────────────────────────────────────────────────────────────────────────

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function VisitorCounter() {
  const [totalVisitors, setTotalVisitors] = useState<number | null>(null)
  const [onlineCount,   setOnlineCount]   = useState<number>(1)

  const sessionIdRef   = useRef<string | null>(null)
  const heartbeatRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Total-visitor counter ──────────────────────────────────────────────────
  useEffect(() => {
    const visitorsRef = doc(db, "stats", "visitors")
    const sessionKey  = "threatalert_visited"

    if (!sessionStorage.getItem(sessionKey)) {
      sessionStorage.setItem(sessionKey, "1")
      runTransaction(db, async (tx) => {
        const snap    = await tx.get(visitorsRef)
        const current = snap.exists() ? (snap.data().count ?? 0) : 0
        tx.set(visitorsRef, { count: current + 1 }, { merge: true })
      }).catch(() => { /* silently ignore */ })
    }

    const unsub = onSnapshot(visitorsRef, (snap) => {
      if (snap.exists()) {
        setTotalVisitors((snap.data().count ?? 0) + VISITOR_BASE)
      } else {
        setTotalVisitors(VISITOR_BASE)
      }
    })

    return () => unsub()
  }, [])

  // ── Presence / currently-online ────────────────────────────────────────────
  useEffect(() => {
    // Create a stable session ID for this tab
    if (!sessionIdRef.current) {
      sessionIdRef.current =
        sessionStorage.getItem("threatalert_session_id") ??
        (() => {
          const id = generateSessionId()
          sessionStorage.setItem("threatalert_session_id", id)
          return id
        })()
    }

    const sessionId   = sessionIdRef.current
    const presenceRef = doc(db, "presence", sessionId)

    const writeHeartbeat = () =>
      setDoc(presenceRef, { lastSeen: serverTimestamp(), sessionId }, { merge: true }).catch(() => {})

    // Write immediately, then every HEARTBEAT_MS
    writeHeartbeat()
    heartbeatRef.current = setInterval(writeHeartbeat, HEARTBEAT_MS)

    // Clean up this session on tab close
    const handleUnload = () => {
      deleteDoc(presenceRef).catch(() => {})
    }
    window.addEventListener("beforeunload", handleUnload)

    // Listen to presence collection — count docs with a recent lastSeen
    const presenceCollection = collection(db, "presence")
    const unsub = onSnapshot(presenceCollection, (snap) => {
      const cutoff = Date.now() - ONLINE_WINDOW_MS
      let active   = 0
      snap.forEach((d) => {
        const data = d.data()
        if (data.lastSeen instanceof Timestamp) {
          if (data.lastSeen.toMillis() >= cutoff) active++
        }
      })
      // Always show at least 1 (the current user)
      setOnlineCount(Math.max(active, 1))
    })

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      window.removeEventListener("beforeunload", handleUnload)
      deleteDoc(presenceRef).catch(() => {})
      unsub()
    }
  }, [])

  if (totalVisitors === null) return null

  return (
    <div className="flex items-center gap-2 rounded-full border border-border/50 bg-card/70 px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-2xl dark:bg-card/60">
      {/* Currently online dot + count */}
      <span className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-emerald-500 font-semibold">{onlineCount}</span>
        <span className="text-muted-foreground">online</span>
      </span>

      <span className="h-3 w-px bg-border/60" />

      {/* Total visitors */}
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Users className="h-3 w-3" />
        <span>{totalVisitors.toLocaleString()}</span>
      </span>
    </div>
  )
}
