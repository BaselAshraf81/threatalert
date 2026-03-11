"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAppState } from "@/hooks/use-app-state"
import { MessageCircle, Send, Shield } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

// ── Anonymous name generator ──────────────────────────────────────────────────
const ADJECTIVES = [
  "Silent", "Swift", "Bold", "Calm", "Keen", "Wise", "Brave", "Dark",
  "Sharp", "Cool", "Quick", "Quiet", "Bright", "Rapid", "Stark", "Lone",
  "Iron", "Steel", "Amber", "Azure", "Crimson", "Neon", "Phantom", "Ghost",
]
const ANIMALS = [
  "Fox", "Hawk", "Wolf", "Bear", "Owl", "Lynx", "Raven", "Eagle",
  "Viper", "Shark", "Tiger", "Puma", "Falcon", "Cobra", "Badger", "Bison",
  "Jackal", "Moose", "Crane", "Heron", "Panther", "Dingo", "Osprey", "Wren",
]

function generateUsername(): string {
  const adj    = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
  const num    = Math.floor(Math.random() * 90) + 10
  return `${adj}${animal}${num}`
}

// ── Config ────────────────────────────────────────────────────────────────────
const MAX_MESSAGES     = 60
const MAX_CHAR         = 280
const RATE_LIMIT_MS    = 2000   // min ms between sends
const SESSION_KEY_NAME = "threatalert_chat_username"
// ─────────────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  text: string
  author: string
  sessionId: string
  createdAt: Timestamp | null
}

function getRelativeTime(ts: Timestamp | null): string {
  if (!ts) return "just now"
  const diffSec = Math.floor((Date.now() - ts.toMillis()) / 1000)
  if (diffSec < 5)  return "just now"
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  return `${Math.floor(diffMin / 60)}h ago`
}

export function LiveChatSheet() {
  const { showChatSheet, setShowChatSheet, onlineCount } = useAppState()
  const [messages,  setMessages]  = useState<ChatMessage[]>([])
  const [input,     setInput]     = useState("")
  const [sending,   setSending]   = useState(false)
  const [username,  setUsername]  = useState<string>("")
  const [lastSent,  setLastSent]  = useState(0)
  const [error,     setError]     = useState<string | null>(null)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sessionId   = useRef<string>(
    typeof sessionStorage !== "undefined"
      ? (sessionStorage.getItem("threatalert_session_id") ?? "anon")
      : "anon"
  )

  // Stable username for this session
  useEffect(() => {
    if (typeof sessionStorage === "undefined") return
    let name = sessionStorage.getItem(SESSION_KEY_NAME)
    if (!name) {
      name = generateUsername()
      sessionStorage.setItem(SESSION_KEY_NAME, name)
    }
    setUsername(name)
  }, [])

  // Real-time message subscription
  useEffect(() => {
    const q = query(
      collection(db, "chat"),
      orderBy("createdAt", "asc"),
      limit(MAX_MESSAGES)
    )
    const unsub = onSnapshot(q, (snap) => {
      const msgs: ChatMessage[] = []
      snap.forEach((d) => {
        const data = d.data()
        msgs.push({
          id:        d.id,
          text:      data.text      ?? "",
          author:    data.author    ?? "Anonymous",
          sessionId: data.sessionId ?? "",
          createdAt: data.createdAt ?? null,
        })
      })
      setMessages(msgs)
    })
    return () => unsub()
  }, [])

  // Auto-scroll to bottom when messages arrive and sheet is open
  useEffect(() => {
    if (showChatSheet) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80)
    }
  }, [messages, showChatSheet])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return

    if (Date.now() - lastSent < RATE_LIMIT_MS) {
      setError("Slow down a little ✌️")
      setTimeout(() => setError(null), 2000)
      return
    }
    if (text.length > MAX_CHAR) {
      setError(`Message too long (max ${MAX_CHAR} chars)`)
      return
    }

    setSending(true)
    setError(null)
    setInput("")

    try {
      await addDoc(collection(db, "chat"), {
        text,
        author:    username || "Anonymous",
        sessionId: sessionId.current,
        createdAt: serverTimestamp(),
      })
      setLastSent(Date.now())
    } catch {
      setError("Failed to send — please try again.")
      setInput(text) // restore so user doesn't lose message
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }, [input, sending, lastSent, username])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isOwnMessage = (msg: ChatMessage) => msg.sessionId === sessionId.current

  return (
    <Sheet open={showChatSheet} onOpenChange={(open) => !open && setShowChatSheet(false)}>
      <SheetContent
        side="bottom"
        className="mx-auto flex max-h-[82svh] max-w-lg flex-col rounded-t-2xl border-t border-border/60 bg-card/95 px-0 pb-0 pt-4 shadow-2xl backdrop-blur-2xl dark:bg-card/90"
      >
        {/* Drag handle */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/30" />

        <SheetHeader className="mb-2 px-4 text-left sm:px-6">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              Live Chat
            </SheetTitle>
            <div className="flex items-center gap-1.5 rounded-full border border-border/50 bg-secondary/60 px-2.5 py-1 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-semibold text-emerald-500">{onlineCount}</span>
              <span className="text-muted-foreground">online</span>
            </div>
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            Chatting as <span className="font-semibold text-foreground">{username}</span> — anonymous &amp; ephemeral
          </SheetDescription>
        </SheetHeader>

        {/* ── Message list ── */}
        <div className="scrollbar-hide flex-1 overflow-y-auto px-4 sm:px-6">
          {messages.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-center">
              <MessageCircle className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No messages yet — say hi 👋</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 py-2">
              {messages.map((msg) => {
                const own = isOwnMessage(msg)
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col gap-0.5 ${own ? "items-end" : "items-start"}`}
                  >
                    {/* Author + time */}
                    <div className={`flex items-center gap-1.5 ${own ? "flex-row-reverse" : ""}`}>
                      <span className={`text-[11px] font-semibold ${own ? "text-primary" : "text-muted-foreground"}`}>
                        {own ? "You" : msg.author}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">
                        {getRelativeTime(msg.createdAt)}
                      </span>
                    </div>
                    {/* Bubble */}
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        own
                          ? "rounded-tr-sm bg-primary text-primary-foreground"
                          : "rounded-tl-sm bg-secondary/80 text-foreground"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* ── Input area ── */}
        <div className="border-t border-border/40 bg-card/80 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
          {error && (
            <p className="mb-2 text-center text-xs text-destructive">{error}</p>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message… (Enter to send)"
              maxLength={MAX_CHAR}
              rows={1}
              className="scrollbar-hide max-h-28 min-h-[2.5rem] flex-1 resize-none rounded-xl border-border/50 bg-secondary/60 text-sm leading-relaxed focus-visible:ring-1 focus-visible:ring-primary/50"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-40"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {/* Privacy note */}
          <div className="mt-2.5 flex items-center gap-1.5">
            <Shield className="h-3 w-3 shrink-0 text-muted-foreground/50" />
            <p className="text-[10px] text-muted-foreground/50">
              Anonymous · No account needed · Be respectful
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
