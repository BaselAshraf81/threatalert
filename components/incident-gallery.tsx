"use client"

import { useEffect, useState, useCallback } from "react"
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
  const { showGallery, setShowGallery, setSelectedIncident, setPendingShareTarget } = useAppState()
  const { incidents } = useIncidents()

  const [enriched, setEnriched] = useState<EnrichedIncident[]>([])

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

  const handleSelect = useCallback((inc: Incident) => {
    setShowGallery(false)
    // Use pendingShareTarget pattern so MapView flies to the incident and sheet opens
    setPendingShareTarget({ id: inc.id, lat: inc.lat, lng: inc.lng })
  }, [setShowGallery, setPendingShareTarget])

  // Split into photo vs no-photo incidents
  const photoIncidents = enriched.filter(
    (i) => i.photoUrls && i.photoUrls.length > 0
  )
  const textIncidents = enriched.filter(
    (i) => !i.photoUrls || i.photoUrls.length === 0
  )

  // Build DomeGallery image objects from photo incidents
  const domeImages = photoIncidents.map((inc) => ({
    src: inc.photoUrls![0],
    alt: `${getCategoryInfo(inc.category).label} — ${inc.description}`,
  }))

  return (
    <AnimatePresence>
      {showGallery && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
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
              onClick={() => setShowGallery(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
              aria-label="Close gallery"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ── Dome (photo incidents) ── */}
          {photoIncidents.length > 0 ? (
            <div className="relative min-h-0 flex-1">
              <DomeGallery
                images={domeImages}
                overlayBlurColor="#000000"
                grayscale={false}
                fit={0.48}
                segments={photoIncidents.length < 10 ? 20 : 35}
              />

              {/* Flag + label overlay chips — absolutely positioned over the dome */}
              {photoIncidents.map((inc, i) => {
                const cat = getCategoryInfo(inc.category)
                return (
                  <button
                    key={inc.id}
                    onClick={() => handleSelect(inc)}
                    className="sr-only"
                    aria-label={`${cat.label} in ${inc.flag} — ${inc.description}`}
                  />
                )
              })}

              {/* Clickable dome — intercept tile clicks via a transparent overlay grid */}
              <ClickablePhotoLayer
                incidents={photoIncidents}
                onSelect={handleSelect}
              />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <p className="text-sm text-white/30">No photo reports yet</p>
            </div>
          )}

          {/* ── Text-only incidents (PixelCards) ── */}
          {textIncidents.length > 0 && (
            <div className="shrink-0 border-t border-white/10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-widest text-white/30">
                Reports without photos
              </p>
              <div className="flex gap-3 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]">
                {textIncidents.map((inc) => (
                  <IncidentPixelCard
                    key={inc.id}
                    incident={inc}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {enriched.length === 0 && (
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

// ── Transparent click layer over the DomeGallery ──────────────────────────
// DomeGallery calls its own internal click handler per tile. We can't easily
// intercept that, so we show a floating info panel when the gallery signals
// a selection. Instead, we render a separate row of clickable flag badges
// below the dome so users can tap a specific incident.
function ClickablePhotoLayer({
  incidents,
  onSelect,
}: {
  incidents: EnrichedIncident[]
  onSelect: (inc: Incident) => void
}) {
  return (
    <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-center">
      <div className="flex max-w-full gap-2 overflow-x-auto px-4 pb-1">
        {incidents.map((inc) => {
          const cat = getCategoryInfo(inc.category)
          return (
            <button
              key={inc.id}
              onClick={() => onSelect(inc)}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur-md transition-colors hover:bg-white/20 active:scale-95"
              style={{ borderColor: cat.color + "60" }}
            >
              <span>{inc.flag}</span>
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: cat.color }}
              />
              <span className="max-w-[110px] truncate opacity-80">
                {inc.description || cat.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Individual PixelCard for a text-only incident ─────────────────────────
function IncidentPixelCard({
  incident,
  onSelect,
}: {
  incident: EnrichedIncident
  onSelect: (inc: Incident) => void
}) {
  const cat = getCategoryInfo(incident.category)
  const variant = CATEGORY_VARIANTS[incident.category] ?? "default"
  const colors = CATEGORY_COLORS[incident.category]

  return (
    <button
      onClick={() => onSelect(incident)}
      className="shrink-0 transition-transform active:scale-95"
      aria-label={`${cat.label} — ${incident.description}`}
    >
      <PixelCard
        variant={variant}
        colors={colors}
        gap={6}
        speed={30}
        className="!h-44 !w-36 !rounded-2xl"
        noFocus
      >
        {/* Flag badge */}
        <div className="absolute right-2 top-2 z-10 text-base leading-none">
          {incident.flag}
        </div>

        {/* Content */}
        <div className="relative z-10 flex h-full w-full flex-col items-start justify-end p-3 text-left">
          {/* Status dot */}
          <span
            className="mb-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{
              background: cat.color + "25",
              color: cat.color,
              border: `1px solid ${cat.color}50`,
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: cat.color }}
            />
            {incident.status === "active" ? "Verified" : "Pending"}
          </span>

          <p className="line-clamp-2 text-[11px] font-medium leading-snug text-white/90">
            {incident.description || cat.label}
          </p>

          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-white/40">
            <MapPin className="h-2.5 w-2.5" />
            <span className="truncate">{incident.lat.toFixed(2)}, {incident.lng.toFixed(2)}</span>
          </div>
        </div>
      </PixelCard>
    </button>
  )
}
