"use client"

import { useState } from "react"
import { useAppState } from "@/hooks/use-app-state"
import { useIncidents } from "@/hooks/use-incidents"
import { CATEGORIES } from "@/lib/types"
import { motion, AnimatePresence } from "framer-motion"
import {
  ShieldAlert,
  CloudLightning,
  Flame,
  Construction,
  Megaphone,
  CircleDot,
  Camera,
  Send,
} from "lucide-react"
import StarBorder from "@/components/StarBorder"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import type { IncidentCategory } from "@/lib/types"

const CATEGORY_ICONS: Record<IncidentCategory, React.ReactNode> = {
  crime: <ShieldAlert className="h-5 w-5" />,
  disaster: <CloudLightning className="h-5 w-5" />,
  fire: <Flame className="h-5 w-5" />,
  infrastructure: <Construction className="h-5 w-5" />,
  unrest: <Megaphone className="h-5 w-5" />,
  custom: <CircleDot className="h-5 w-5" />,
}

export function ReportSheet() {
  const {
    showReportSheet,
    setShowReportSheet,
    reportLocation,
    userLocation,
    locationStatus,
    showToast,
    setReportLocation,
    setPinPlacementMode,
  } = useAppState()
  const { report } = useIncidents()
  const [selectedCategory, setSelectedCategory] = useState<IncidentCategory | null>(null)
  const [description, setDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const location = reportLocation || userLocation
  const locationReady = !!location

  const handleSubmit = () => {
    if (!selectedCategory || !location) return

    setIsSubmitting(true)
    setTimeout(() => {
      report(selectedCategory, description || "Incident reported", location.lat, location.lng)
      setIsSubmitting(false)
      setShowSuccess(true)
      setTimeout(() => {
        setShowSuccess(false)
        setShowReportSheet(false)
        setSelectedCategory(null)
        setDescription("")
        setReportLocation(null)
        setPinPlacementMode(false)
        showToast("Incident submitted — it will appear once verified")
      }, 1200)
    }, 600)
  }

  const handleClose = () => {
    setShowReportSheet(false)
    setSelectedCategory(null)
    setDescription("")
    setReportLocation(null)
    setPinPlacementMode(false)
  }

  return (
    <Sheet open={showReportSheet} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-lg rounded-t-2xl border-t border-border/60 bg-card/90 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl backdrop-blur-2xl dark:bg-card/80 sm:px-6 sm:pt-6"
      >
        {/* Drag handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30 sm:mb-5" />

        <SheetHeader className="sr-only">
          <SheetTitle>Report an Incident</SheetTitle>
          <SheetDescription>Submit a new incident report with location and details</SheetDescription>
        </SheetHeader>

        <AnimatePresence mode="wait">
          {showSuccess ? (
            /* ── Success state ── */
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex flex-col items-center gap-4 py-8"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 10, stiffness: 200, delay: 0.1 }}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/20"
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-accent"
                >
                  <motion.path
                    d="M5 13l4 4L19 7"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                  />
                </svg>
              </motion.div>
              <p className="text-sm font-medium text-foreground">Report submitted</p>
            </motion.div>
          ) : (
            /* ── Form ── */
            <motion.div key="form" className="flex flex-col gap-4 sm:gap-5">
              <SheetHeader className="text-left">
                <SheetTitle>Report an Incident</SheetTitle>
              </SheetHeader>

              {/* Location row */}
              <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3.5 py-2.5">
                <div
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    locationReady ? "bg-accent" : "bg-muted-foreground animate-pulse"
                  }`}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  {locationReady && location ? (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                    </span>
                  ) : (
                    <span className="animate-pulse text-xs text-muted-foreground">
                      Getting your location…
                    </span>
                  )}
                </div>
                {/* shadcn Button for "Change" */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowReportSheet(false)
                    setPinPlacementMode(true)
                  }}
                  className="h-7 rounded-lg text-xs"
                >
                  Change
                </Button>
              </div>

              {/* Category picker */}
              <div>
                <p className="mb-2.5 text-sm font-medium text-muted-foreground sm:mb-3">Category</p>
                <div className="grid grid-cols-2 gap-1.5 xs:grid-cols-3 sm:gap-2">
                  {CATEGORIES.map((cat) => (
                    <motion.button
                      key={cat.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-[11px] transition-all sm:gap-1.5 sm:p-3 sm:text-xs ${
                        selectedCategory === cat.id
                          ? "border-transparent shadow-lg"
                          : "border-border bg-secondary/50 text-muted-foreground hover:bg-secondary"
                      }`}
                      style={
                        selectedCategory === cat.id
                          ? {
                              backgroundColor: cat.color + "18",
                              color: cat.color,
                              borderColor: cat.color + "40",
                              boxShadow: `0 0 20px ${cat.color}15`,
                            }
                          : undefined
                      }
                    >
                      <span style={selectedCategory === cat.id ? { color: cat.color } : undefined}>
                        {CATEGORY_ICONS[cat.id]}
                      </span>
                      <span className="text-balance text-center leading-tight">{cat.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Description — shadcn Textarea */}
              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground">
                  Description (optional)
                </p>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 280))}
                  placeholder="What's happening?"
                  rows={3}
                  className="resize-none rounded-xl border-border bg-secondary/50 focus-visible:border-accent focus-visible:ring-accent/30"
                />
                <p className="mt-1 text-right text-xs text-muted-foreground">
                  {description.length}/280
                </p>
              </div>

              {/* Photo button — shadcn Button */}
              <Button
                variant="outline"
                className="w-full justify-start gap-2 rounded-xl border-dashed text-muted-foreground"
              >
                <Camera className="h-4 w-4" />
                Add photo
              </Button>

              {/* Submit */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSubmit}
                disabled={!selectedCategory || !locationReady || isSubmitting}
                className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 sm:py-3.5"
              >
                {selectedCategory && !isSubmitting && (
                  <StarBorder
                    as="div"
                    color="#e54d42"
                    speed="4s"
                    thickness={2}
                    className="pointer-events-none absolute inset-0 rounded-xl"
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  {isSubmitting ? "Submitting..." : "Submit Report"}
                </span>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  )
}
