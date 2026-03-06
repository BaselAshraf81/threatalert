"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useAppState } from "@/hooks/use-app-state"
import { MapPin, X } from "lucide-react"
import StarBorder from "@/components/StarBorder"

export function ReportFAB() {
  const { pinPlacementMode, setPinPlacementMode, setReportLocation } = useAppState()
  const [showHint, setShowHint] = useState(false)

  // Show the long-press hint once on first load, then never again
  useEffect(() => {
    const seen = localStorage.getItem("threatalert_hint_seen")
    if (!seen) {
      const t = setTimeout(() => {
        setShowHint(true)
        setTimeout(() => {
          setShowHint(false)
          localStorage.setItem("threatalert_hint_seen", "1")
        }, 4000)
      }, 2500)
      return () => clearTimeout(t)
    }
  }, [])

  const handleTap = () => {
    setShowHint(false)
    localStorage.setItem("threatalert_hint_seen", "1")
    if (pinPlacementMode) {
      setPinPlacementMode(false)
      setReportLocation(null)
    } else {
      setPinPlacementMode(true)
    }
  }

  return (
    <div className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-3 z-[100] flex flex-col items-end gap-2.5 sm:bottom-6 sm:right-4 md:right-6 rounded-full">
      {/* Long-press hint tooltip */}
      <AnimatePresence>
        {showHint && !pinPlacementMode && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            className="pointer-events-none flex items-center gap-1.5 rounded-xl border border-border/50 bg-card/90 px-3 py-2 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur-xl"
          >
            {/* Finger press icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
              <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2"/><path d="M10 10.5a2 2 0 0 0-2-2 2 2 0 0 0-2 2V18a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4v-5a2 2 0 0 0-2-2 2 2 0 0 0-2 2"/>
            </svg>
            Hold map to drop pin at exact spot
          </motion.div>
        )}
      </AnimatePresence>

      {/* FIX: background lives on the inner motion.button (children), not on
          StarBorder — identical pattern to the top-bar "ThreatAlert Beta"
          pill. The opaque button surface fully covers .inner-content so the
          gradient orbs only show as a thin shimmer at the 1px padding edge. */}
      <StarBorder
        as="div"
        color={pinPlacementMode ? "#888888" : "#e54d42"}
        speed="5s"
        thickness={1.5}
        className="rounded-full"
        style={{ display: "block" }}
      >
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleTap}
          className={`flex h-12 items-center gap-2 rounded-full px-5 text-sm font-semibold text-primary-foreground shadow-xl transition-all sm:h-14 sm:px-6 ${
            pinPlacementMode
              ? "bg-secondary text-foreground hover:bg-secondary/80"
              : "bg-primary hover:bg-primary/90"
          }`}
          style={pinPlacementMode ? {} : { boxShadow: "0 4px 30px rgba(229, 77, 66, 0.35)" }}
          aria-label={pinPlacementMode ? "Cancel report" : "Report an incident"}
        >
          <AnimatePresence mode="wait" initial={false}>
            {pinPlacementMode ? (
              <motion.span
                key="cancel"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                className="flex items-center gap-2"
              >
                <X className="h-5 w-5" />
                Cancel
              </motion.span>
            ) : (
              <motion.span
                key="report"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                className="flex items-center gap-2"
              >
                <MapPin className="h-4 w-4" />
                Report
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </StarBorder>
    </div>
  )
}
