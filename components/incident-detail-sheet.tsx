"use client"

import { useState, useEffect } from "react"
import { useAppState } from "@/hooks/use-app-state"
import { useIncidents } from "@/hooks/use-incidents"
import { getCategoryInfo } from "@/lib/types"
import { hasVoted } from "@/lib/incidents-store"
import { motion, AnimatePresence } from "framer-motion"
import {
  ShieldAlert, CloudLightning, Flame, Construction,
  Megaphone, CircleDot, MapPin, Clock, X,
  ThumbsUp, CheckCircle2, Flag, Share2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { PhotoCarousel } from "@/components/ui/photo-carousel"
import type { IncidentCategory } from "@/lib/types"

const CATEGORY_ICONS: Record<IncidentCategory, React.ReactNode> = {
  crime:          <ShieldAlert className="h-4 w-4" />,
  disaster:       <CloudLightning className="h-4 w-4" />,
  fire:           <Flame className="h-4 w-4" />,
  infrastructure: <Construction className="h-4 w-4" />,
  unrest:         <Megaphone className="h-4 w-4" />,
  custom:         <CircleDot className="h-4 w-4" />,
}

function timeAgo(ts: number): string {
  const d = Date.now() - ts
  const m = Math.floor(d / 60000)
  if (m < 1)  return "just now"
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function distanceFromUser(lat: number, lng: number, uLat: number, uLng: number): string {
  const R = 6371000
  const dLat = ((lat - uLat) * Math.PI) / 180
  const dLng = ((lng - uLng) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((uLat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  if (dist < 50)   return "right here"
  if (dist < 1000) return `${Math.round(dist)}m away`
  return `${(dist / 1000).toFixed(1)}km away`
}

// Animated counter that pops when value changes
function CountBadge({ value, active }: { value: number; active: boolean }) {
  return (
    <motion.span
      key={value}
      initial={{ scale: 1.5, opacity: 0 }}
      animate={{ scale: 1,   opacity: 1 }}
      transition={{ type: "spring", damping: 12, stiffness: 300 }}
      className={`min-w-[1.25rem] text-center text-xs font-bold tabular-nums ${active ? "text-inherit" : "text-muted-foreground"}`}
    >
      {value}
    </motion.span>
  )
}

export function IncidentDetailSheet() {
  const {
    selectedIncident: selectedIncidentRef,
    setSelectedIncident,
    userLocation,
    showToast,
    pendingShareTarget,
    setPendingShareTarget,
  } = useAppState()
  const { incidents, confirm, resolve, flag } = useIncidents()

  // Always use the live incident from the store — photoUrls are patched in
  // after upload so the app-state snapshot would be stale without this.
  const selectedIncident = selectedIncidentRef
    ? (incidents.find((i) => i.id === selectedIncidentRef.id) ?? selectedIncidentRef)
    : null
  const [isVoting, setIsVoting] = useState(false)

  // ── Auto-open when arriving via a shared link ─────────────────────────────
  useEffect(() => {
    if (!pendingShareTarget) return
    const match = incidents.find((i) => i.id === pendingShareTarget.id)
    if (match) {
      setSelectedIncident(match)
      setPendingShareTarget(null)
    }
  }, [pendingShareTarget, incidents, setSelectedIncident, setPendingShareTarget])

  const doVote = async (action: () => Promise<void>, message: string) => {
    if (!selectedIncident || hasVoted(selectedIncident.id) || isVoting) return
    setIsVoting(true)
    try {
      await action()
      showToast(message)
    } catch (error: any) {
      const errorMessage = error?.message || "Couldn't record vote — try again."
      showToast(errorMessage)
    } finally {
      setIsVoting(false)
    }
  }

  const handleShare = async () => {
    if (!selectedIncident) return
    const cat = getCategoryInfo(selectedIncident.category)

    // Build a deep link that flies to the incident and opens its sheet
    const base = typeof window !== "undefined" ? window.location.origin + window.location.pathname : ""
    const params = new URLSearchParams({
      i:   selectedIncident.id,
      lat: selectedIncident.lat.toFixed(6),
      lng: selectedIncident.lng.toFixed(6),
    })
    const deepLink = `${base}?${params.toString()}`
    const text = `${cat.label} reported on ThreatAlert: ${selectedIncident.description}`

    if (navigator.share) {
      await navigator.share({ title: "ThreatAlert incident", text, url: deepLink }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(deepLink).catch(() => {})
      showToast("Copied to clipboard")
    }
  }

  return (
    <AnimatePresence>
      {selectedIncident && (() => {
        const cat     = getCategoryInfo(selectedIncident.category)
        const voted   = hasVoted(selectedIncident.id)
        const total   = selectedIncident.confirmVotes + selectedIncident.resolveVotes + selectedIncident.flagVotes
        const thresh  = cat.threshold
        const progress = Math.min(100, Math.round((selectedIncident.confirmVotes / thresh) * 100))
        const isPending = selectedIncident.status === "pending"

        return (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[2000] bg-background/40 backdrop-blur-sm"
              onClick={() => setSelectedIncident(null)}
            />

            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[2001] mx-auto w-full max-w-lg rounded-t-2xl border-t border-border/60 bg-card shadow-2xl sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2"
            >
              <div className="max-h-[82dvh] overflow-y-auto overscroll-contain p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6">
                <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/25" />

                <Button
                  variant="ghost" size="icon"
                  onClick={() => setSelectedIncident(null)}
                  className="absolute right-3 top-3 h-7 w-7 rounded-full text-muted-foreground sm:right-4 sm:top-4"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>

                <div className="flex flex-col gap-4">

                  {/* ── Header ── */}
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: cat.color + "20", color: cat.color }}
                    >
                      {CATEGORY_ICONS[selectedIncident.category]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="font-semibold text-foreground">{cat.label}</h3>
                        {isPending ? (
                          <Badge variant="secondary" className="text-[10px] font-medium">
                            Unverified
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/40 bg-emerald-500/10 text-[10px] font-medium text-emerald-500"
                          >
                            Verified
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{timeAgo(selectedIncident.createdAt)}</span>
                        {userLocation && (
                          <>
                            <span>·</span>
                            <MapPin className="h-3 w-3" />
                            <span>
                              {distanceFromUser(
                                selectedIncident.lat, selectedIncident.lng,
                                userLocation.lat, userLocation.lng
                              )}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── Description ── */}
                  <p className="text-[15px] leading-relaxed text-foreground/90">
                    {selectedIncident.description}
                  </p>

                  {/* ── Photos ── */}
                  {selectedIncident.photoUrls && selectedIncident.photoUrls.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Photos · {selectedIncident.photoUrls.length}
                      </p>
                      <PhotoCarousel urls={selectedIncident.photoUrls} />
                    </div>
                  )}

                  {/* ── Verification progress (pending only) ── */}
                  {isPending && (
                    <div className="rounded-xl border border-border bg-secondary/30 p-3">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Verification progress</span>
                        <span className="text-xs font-semibold text-foreground">
                          {selectedIncident.confirmVotes} / {thresh} confirmations
                        </span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        Needs {Math.max(0, thresh - selectedIncident.confirmVotes)} more confirmation
                        {thresh - selectedIncident.confirmVotes !== 1 ? "s" : ""} to go live
                      </p>
                    </div>
                  )}

                  <Separator />

                  {/* ── Vote actions ── */}
                  <div>
                    <p className="mb-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Community response
                    </p>

                    <div className="grid grid-cols-3 gap-2">
                      {/* Confirm */}
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => doVote(
                          () => confirm(selectedIncident.id),
                          "Thanks — your confirmation helps verify this incident."
                        )}
                        disabled={!!voted || isVoting}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-all disabled:cursor-default ${
                          voted === "confirm"
                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-500"
                            : voted
                            ? "border-border bg-secondary/30 text-muted-foreground opacity-50"
                            : "border-border bg-secondary/50 text-foreground hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-500"
                        }`}
                      >
                        <ThumbsUp className="h-4 w-4" />
                        <span>Confirm</span>
                        <CountBadge value={selectedIncident.confirmVotes} active={voted === "confirm"} />
                      </motion.button>

                      {/* Resolved */}
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => doVote(
                          () => resolve(selectedIncident.id),
                          "Marked as resolved — thank you."
                        )}
                        disabled={!!voted || isVoting}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-all disabled:cursor-default ${
                          voted === "resolve"
                            ? "border-blue-500/40 bg-blue-500/15 text-blue-400"
                            : voted
                            ? "border-border bg-secondary/30 text-muted-foreground opacity-50"
                            : "border-border bg-secondary/50 text-foreground hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-400"
                        }`}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Resolved</span>
                        <CountBadge value={selectedIncident.resolveVotes} active={voted === "resolve"} />
                      </motion.button>

                      {/* Flag fake */}
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => doVote(
                          () => flag(selectedIncident.id),
                          "Flagged — we'll review it if enough people agree."
                        )}
                        disabled={!!voted || isVoting}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-all disabled:cursor-default ${
                          voted === "flag"
                            ? "border-rose-500/40 bg-rose-500/15 text-rose-500"
                            : voted
                            ? "border-border bg-secondary/30 text-muted-foreground opacity-50"
                            : "border-border bg-secondary/50 text-foreground hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-500"
                        }`}
                      >
                        <Flag className="h-4 w-4" />
                        <span>Fake</span>
                        <CountBadge value={selectedIncident.flagVotes ?? 0} active={voted === "flag"} />
                      </motion.button>
                    </div>

                    {/* Already voted hint */}
                    {voted && (
                      <motion.p
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 text-center text-[11px] text-muted-foreground"
                      >
                        You voted · {total} total response{total !== 1 ? "s" : ""}
                      </motion.p>
                    )}
                  </div>

                  <Separator />

                  {/* ── Footer actions ── */}
                  <div className="flex items-center justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleShare}
                      className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Share
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )
      })()}
    </AnimatePresence>
  )
}
