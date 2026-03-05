"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import DomeGallery from "./DomeGallery"
import { GridScan } from "./GridScan"
import { useIncidents } from "@/hooks/use-incidents"
import { useAppState } from "@/hooks/use-app-state"
import { getCategoryInfo } from "@/lib/types"
import type { Incident } from "@/lib/types"

// ── Country flag emoji from ISO-3166-1 alpha-2 code ──────────────────────────
function flagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "🌍"
  return [...countryCode.toUpperCase()]
    .map(c => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join("")
}

// ── Category config ───────────────────────────────────────────────────────────
const CATEGORY_EMOJI: Record<string, string> = {
  crime: "🚨",
  disaster: "⛈️",
  fire: "🔥",
  infrastructure: "🚧",
  unrest: "📢",
  custom: "⚠️",
}

// ── Generate a styled SVG data-URL card for incidents without photos ──────────
function makeInfoCard(incident: Incident): string {
  const cat = getCategoryInfo(incident.category)
  const emoji = CATEGORY_EMOJI[incident.category] || "⚠️"
  const rawDesc = incident.description?.trim() || "No description provided."
  const loc = `${incident.lat.toFixed(3)}°, ${incident.lng.toFixed(3)}°`

  // Word-wrap description into ≤28-char lines
  const words = rawDesc.split(" ")
  const lines: string[] = []
  let cur = ""
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w
    if (candidate.length > 28) {
      if (cur) lines.push(cur)
      cur = w
    } else {
      cur = candidate
    }
  }
  if (cur) lines.push(cur)
  const descLines = lines.slice(0, 5)

  const descSvg = descLines
    .map((l, i) => `<tspan x="200" dy="${i === 0 ? 0 : 22}">${escSvg(l)}</tspan>`)
    .join("")

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0a1a"/>
      <stop offset="100%" stop-color="#12082a"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="400" height="300" fill="url(#g)" rx="20"/>

  <!-- Top accent bar -->
  <rect x="0" y="0" width="400" height="5" fill="${cat.color}" rx="2.5"/>

  <!-- Subtle grid lines -->
  <line x1="0" y1="60" x2="400" y2="60" stroke="${cat.color}" stroke-opacity="0.08" stroke-width="1"/>
  <line x1="0" y1="240" x2="400" y2="240" stroke="${cat.color}" stroke-opacity="0.08" stroke-width="1"/>

  <!-- Glow circle -->
  <circle cx="200" cy="60" r="36" fill="${cat.color}" fill-opacity="0.12"/>

  <!-- Emoji icon -->
  <text x="200" y="77" font-family="Apple Color Emoji, Segoe UI Emoji, sans-serif"
        font-size="36" text-anchor="middle">${emoji}</text>

  <!-- Category label -->
  <text x="200" y="115" font-family="system-ui, Arial, sans-serif" font-size="14"
        text-anchor="middle" fill="${cat.color}" font-weight="700" letter-spacing="1">
    ${escSvg(cat.label.toUpperCase())}
  </text>

  <!-- Description -->
  <text x="200" y="148" font-family="system-ui, Arial, sans-serif" font-size="12.5"
        text-anchor="middle" fill="#c8c8d8" line-height="1.5">
    ${descSvg}
  </text>

  <!-- Divider -->
  <line x1="40" y1="245" x2="360" y2="245" stroke="${cat.color}" stroke-opacity="0.25" stroke-width="1"/>

  <!-- Location -->
  <text x="200" y="265" font-family="system-ui, Arial, sans-serif" font-size="10.5"
        text-anchor="middle" fill="#5a5a7a">
    📍 ${escSvg(loc)}
  </text>
</svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function escSvg(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

// ── Reverse-geocode lat/lng → ISO-3166-1 alpha-2 via Nominatim ───────────────
const geocodeCache = new Map<string, string>()

async function fetchCountryCode(lat: number, lng: number): Promise<string> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`
  if (geocodeCache.has(key)) return geocodeCache.get(key)!
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=3`
    const res = await fetch(url, {
      headers: { "Accept-Language": "en", "User-Agent": "ThreatAlert/1.0" },
    })
    if (!res.ok) return "XX"
    const data = await res.json()
    const cc: string = data?.address?.country_code?.toUpperCase() ?? "XX"
    geocodeCache.set(key, cc)
    return cc
  } catch {
    return "XX"
  }
}

// ── Flag badge rendered inside a tile ────────────────────────────────────────
function FlagBadge({ countryCode }: { countryCode: string | null }) {
  if (!countryCode) return null
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)",
        borderRadius: "8px",
        padding: "3px 7px",
        fontSize: "18px",
        lineHeight: 1,
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        userSelect: "none",
      }}
    >
      {flagEmoji(countryCode)}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function IncidentGlobeGallery() {
  const { showGallery, setShowGallery, setSelectedIncident } = useAppState()
  const { incidents } = useIncidents()

  // Keep only the most recent 60 incidents (gallery has limited tiles)
  const activeIncidents = useMemo(
    () => [...incidents].sort((a, b) => b.createdAt - a.createdAt).slice(0, 60),
    [incidents]
  )

  // Build image list for DomeGallery
  const images = useMemo(
    () =>
      activeIncidents.map(inc => {
        const firstPhoto =
          inc.photoUrls?.[0] ?? (inc.photoUrl ? inc.photoUrl : null)
        return {
          src: firstPhoto ?? makeInfoCard(inc),
          alt: `${getCategoryInfo(inc.category).label} — ${inc.description?.slice(0, 60) || ""}`,
        }
      }),
    [activeIncidents]
  )

  // Country codes (fetched lazily)
  const [countryCodes, setCountryCodes] = useState<Record<number, string>>({})
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!showGallery || fetchedRef.current || activeIncidents.length === 0) return
    fetchedRef.current = true

    // Stagger requests to avoid rate-limiting Nominatim
    activeIncidents.forEach((inc, i) => {
      setTimeout(async () => {
        const cc = await fetchCountryCode(inc.lat, inc.lng)
        if (cc && cc !== "XX") {
          setCountryCodes(prev => ({ ...prev, [i]: cc }))
        }
      }, i * 120)
    })
  }, [showGallery, activeIncidents])

  // Reset fetch flag when incidents change
  useEffect(() => {
    fetchedRef.current = false
  }, [activeIncidents.length])

  // Build badge nodes for DomeGallery itemBadges prop
  const itemBadges = useMemo(
    () =>
      activeIncidents.map((_, i) =>
        countryCodes[i] ? <FlagBadge key={i} countryCode={countryCodes[i]} /> : null
      ),
    [activeIncidents, countryCodes]
  )

  const handleItemClick = useCallback(
    (srcIndex: number) => {
      const incident = activeIncidents[srcIndex]
      if (!incident) return
      setSelectedIncident(incident)
      setShowGallery(false)
    },
    [activeIncidents, setSelectedIncident, setShowGallery]
  )

  return (
    <AnimatePresence>
      {showGallery && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 3000,
            overflow: "hidden",
          }}
        >
          {/* GridScan background */}
          <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
            <GridScan
              sensitivity={0.55}
              lineThickness={1}
              linesColor="#1e1535"
              gridScale={0.1}
              scanColor="#6b9fff"
              scanOpacity={0.35}
              enablePost
              bloomIntensity={0.55}
              chromaticAberration={0.002}
              noiseIntensity={0.012}
            />
          </div>

          {/* Dark vignette overlay so the dome pops */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 1,
              background:
                "radial-gradient(ellipse at center, transparent 30%, rgba(4,2,12,0.6) 100%)",
              pointerEvents: "none",
            }}
          />

          {/* DomeGallery */}
          <div style={{ position: "absolute", inset: 0, zIndex: 2 }}>
            {images.length > 0 ? (
              <DomeGallery
                images={images}
                fit={0.8}
                minRadius={600}
                maxVerticalRotationDeg={0}
                segments={34}
                dragDampening={2}
                grayscale={false}
                overlayBlurColor="rgba(4,2,12,0)"
                onItemClick={handleItemClick}
                itemBadges={itemBadges}
              />
            ) : (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "12px",
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                <span style={{ fontSize: "48px" }}>🌍</span>
                <p style={{ fontSize: "14px", margin: 0 }}>No incidents to display</p>
              </div>
            )}
          </div>

          {/* Header bar */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              background:
                "linear-gradient(to bottom, rgba(4,2,12,0.85) 0%, transparent 100%)",
              backdropFilter: "blur(0px)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "20px" }}>🌐</span>
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.95)",
                    letterSpacing: "0.02em",
                  }}
                >
                  Global Incidents
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: "11px",
                    color: "rgba(255,255,255,0.45)",
                    marginTop: "1px",
                  }}
                >
                  {activeIncidents.length} active · drag to explore · click to view
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowGallery(false)}
              style={{
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.8)",
                width: "36px",
                height: "36px",
                backdropFilter: "blur(8px)",
              }}
              aria-label="Close gallery"
            >
              <X size={16} />
            </Button>
          </div>

          {/* Bottom hint */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              padding: "20px",
              background:
                "linear-gradient(to top, rgba(4,2,12,0.7) 0%, transparent 100%)",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "11px",
                color: "rgba(255,255,255,0.3)",
                letterSpacing: "0.04em",
              }}
            >
              Country flags appear as incidents are geocoded
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
