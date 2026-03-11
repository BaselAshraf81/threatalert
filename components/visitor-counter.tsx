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
  Timestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAppState } from "@/hooks/use-app-state"
import { Users, MessageCircle } from "lucide-react"

// ── Config ────────────────────────────────────────────────────────────────────
const VISITOR_BASE     = 150
const ONLINE_WINDOW_MS = 90_000
const HEARTBEAT_MS     = 30_000
// ─────────────────────────────────────────────────────────────────────────────

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function VisitorCounter() {
  const { setShowChatSheet, setOnlineCount, onlineCount } = useAppState()
  const [totalVisitors, setTotalVisitors] = useState<number | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionIdRef = useRef<string | null>(null)

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
      }).catch(() => {})
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

    writeHeartbeat()
    heartbeatRef.current = setInterval(writeHeartbeat, HEARTBEAT_MS)

    const handleUnload = () => deleteDoc(presenceRef).catch(() => {})
    window.addEventListener("beforeunload", handleUnload)

    const unsub = onSnapshot(collection(db, "presence"), (snap) => {
      const cutoff = Date.now() - ONLINE_WINDOW_MS
      let active   = 0
      snap.forEach((d) => {
        const data = d.data()
        if (data.lastSeen instanceof Timestamp && data.lastSeen.toMillis() >= cutoff) active++
      })
      const count = Math.max(active, 1)
      setOnlineCount(count)
    })

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      window.removeEventListener("beforeunload", handleUnload)
      deleteDoc(presenceRef).catch(() => {})
      unsub()
    }
  }, [setOnlineCount])

  if (totalVisitors === null) return null

  return (
    <div className="flex items-center gap-0 rounded-full border border-border/50 bg-card/70 shadow-lg backdrop-blur-2xl dark:bg-card/60 overflow-hidden">
      {/* Clickable online pill → opens chat */}
      <button
        onClick={() => setShowChatSheet(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent/10 active:bg-accent/20"
        aria-label="Open live chat"
        title="Open live chat"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="font-semibold text-emerald-500">{onlineCount}</span>
        <MessageCircle className="h-3 w-3 text-emerald-500/70" />
      </button>

      <span className="h-4 w-px bg-border/50" />

      {/* Total visitors */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground">
        <Users className="h-3 w-3" />
        <span>{totalVisitors.toLocaleString()}</span>
      </div>
    </div>
  )
}
