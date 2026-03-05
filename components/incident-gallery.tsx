"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, MapPin } from "lucide-react"
import { useAppState } from "@/hooks/use-app-state"
import { useIncidents } from "@/hooks/use-incidents"
import { getCountryFlag } from "@/lib/country-flag"
import { getCategoryInfo } from "@/lib/types"
import type { Incident } from "@/lib/types"
import DomeGallery from "@/components/DomeGallery"
import PixelCard from "@/components/PixelCard"

// ── Category colour map for PixelCard ──────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  crime:          "#e54d42,#c0392b,#922b21",
  disaster:       "#e8903e,#ca6f1e,#a04000",
  fire:           "#d66038,#e74c3c,#ff6b35",
  infrastructure: "#c9b23e,#d4ac0d,#a09000",
  unrest:         "#9b5de5,#7d3c98,#6c3483",
  custom:         "#6b7280,#4b5563,#374151",
}

const CATEGORY_VARIANTS: Record<string, "default" | "blue" | "yellow" | "pink"> = {
  crime: "pink", disaster: "default", fire: "pink",
  infrastructure: "yellow", unrest: "default", custom: "default",
}

// ── Types ──────────────────────────────────────────────────────────────────
interface EnrichedIncident extends Incident {
  flag: string
}

// ── Main component ─────────────────────────────────────────────────────────
export function IncidentGallery() {
  const { showGallery, setShowGallery, setPendingShareTarget } = useAppState()
  const { incidents } = useIncidents()

  const [enriched, setEnriched] = useState<EnrichedIncident[]>([])

  // Increment each time gallery opens to force a clean DomeGallery remount.
  // This prevents stale useGesture listeners from accumulating (fixes issues 3 & 7).
  const [galleryKey, setGalleryKey] = useState(0)
  const prevShowGallery = useRef(false)

  useEffect(() => {
    if (showGallery && !prevShowGallery.current) {
      // Gallery just opened: bump key + scrub any stale scroll-lock from prior session
      setGalleryKey(k => k + 1)
      document.body.classList.remove("dg-scroll-lock")
    }
    prevShowGallery.current = showGallery
  }, [showGallery])

  // Fetch country flags for all visible incidents
  useEffect(() => {
    if (!showGallery || incidents.length === 0) return
    let cancelled = false

    Promise.all(
      incidents.map(async (inc) => ({
        ...inc,
        flag: await getCountryFlag(inc.lat, inc.lng),
      }))
    ).then((result) => {
      if (!cancelled) setEnriched(result)
    })

    return () => { cancelled = true }
  }, [showGallery, incidents])

  const closeGallery = useCallback(() => {
    // Always clean up scroll-lock before closing so topbar stays interactive
    document.body.classList.remove("dg-scroll-lock")
    setShowGallery(false)
  }, [setShowGallery])

  const handleSelect = useCallback((inc: Incident) => {
    closeGallery()
    setPendingShareTarget({ id: inc.id, lat: inc.lat, lng: inc.lng })
  }, [closeGallery, setPendingShareTarget])

  // Called by DomeGallery when a tile is clicked (issue 6)
  const handleItemClick = useCallback((incidentIndex: number) => {
    const inc = enriched[incidentIndex]
    if (inc) handleSelect(inc)
  }, [enriched, handleSelect])

  // Build DomeGallery image list from ALL incidents (photo + no-photo)
  // so text-only incidents also appear in the dome sphere (issue 4).
  const domeImages = enriched.map((inc, idx) => ({
    src: inc.photoUrls?.[0] ?? "",
    alt: `${getCategoryInfo(inc.category).label} — ${inc.description}`,
    incidentIndex: idx,
  }))

  // renderItem: wraps EVERY dome tile in a PixelCard for the sparkle effect
  // (issue 5). Text-only incidents show incident data (issue 4). Clicking
  // still propagates to the parent item__image div's onClick → handleItemClick.
  const renderItem = useCallback(
    ({ src, alt, incidentIndex }: { src: string; alt: string; incidentIndex: number }) => {
      const inc = enriched[incidentIndex]
      if (!inc) {
        return src
          ? <img src={src} draggable={false} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
          : <div className="absolute inset-0 bg-white/5" />
      }

      const cat = getCategoryInfo(inc.category)
      const variant = CATEGORY_VARIANTS[inc.category] ?? "default"
      const colors = CATEGORY_COLORS[inc.category]
      const hasPhoto = !!(inc.photoUrls && inc.photoUrls.length > 0)

      return (
        <PixelCard
          variant={variant}
          colors={colors}
          gap={8}
          speed={25}
          noFocus
          className="!absolute !inset-0 !h-full !w-full !rounded-none !border-0"
        >
          {hasPhoto ? (
            // Photo tile: image fills the card; pixel sparkle plays on top
            <img
              src={src}
              draggable={false}
              alt={alt}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            // Text-only tile: render incident metadata (issue 4)
            <div className="relative z-10 flex h-full w-full flex-col items-start justify-end p-2 text-left">
              {/* Country flag badge */}
              <div className="absolute right-1.5 top-1.5 text-sm leading-none">
                {inc.flag}
              </div>

              {/* Category badge */}
              <span
                className="mb-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                style={{
                  background: cat.color + "25",
                  color: cat.color,
                  border: `1px solid ${cat.color}50`,
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: cat.color }} />
                {cat.label}
              </span>

              <p className="line-clamp-3 text-[10px] font-medium leading-snug text-white/90">
                {inc.description || cat.label}
              </p>

              <div className="mt-1 flex items-center gap-0.5 text-[9px] text-white/40">
                <MapPin className="h-2 w-2 shrink-0" />
                <span className="truncate">{inc.lat.toFixed(2)}, {inc.lng.toFixed(2)}</span>
              </div>
            </div>
          )}
        </PixelCard>
      )
    },
    [enriched]
  )

  return (
    // mode="wait" ensures the exiting DomeGallery fully unmounts before a new
    // instance can mount — prevents doubled useGesture listeners (issues 3 & 7).
    <AnimatePresence mode="wait">
      {showGallery && (
        <motion.div
          key="gallery-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex flex-col bg-black/95 backdrop-blur-xl"
        >
          {/* ── Header ── */}
          <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
            <div>
              <h2 className="text-base font-semibold text-white">
                World Incidents
              </h2>
              <p className="text-xs text-white/40">
                {enriched.length} active report{enriched.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              onClick={closeGallery}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
              aria-label="Close gallery"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ── Dome (all incidents — photo & text alike) ── */}
          {enriched.length > 0 ? (
            <div className="relative min-h-0 flex-1">
              <DomeGallery
                key={galleryKey}
                images={domeImages}
                overlayBlurColor="#000000"
                grayscale={false}
                fit={0.48}
                segments={enriched.length < 10 ? 20 : 35}
                onItemClick={handleItemClick}
                renderItem={renderItem}
              />
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <span className="text-5xl">🌍</span>
              <p className="text-sm text-white/40">No active incidents worldwide right now.</p>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
