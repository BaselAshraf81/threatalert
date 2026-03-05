"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { useTheme } from "next-themes"
import { motion, AnimatePresence } from "framer-motion"
import { MapPin, Navigation } from "lucide-react"
import { useIncidents } from "@/hooks/use-incidents"
import { useAppState } from "@/hooks/use-app-state"
import { getCategoryInfo } from "@/lib/types"
import type { Incident, IncidentCategory } from "@/lib/types"

// OpenStreetMap tiles - free, no API key required, generous usage limits

const DARK_TILES  = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
const LIGHT_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"

const ICON_PATHS: Record<IncidentCategory, string> = {
  crime:          `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 8v4M12 16h.01" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  disaster:       `<path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><polyline points="13 11 9 17h6l-4 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  fire:           `<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  infrastructure: `<rect x="2" y="6" width="20" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M17 14v7M7 14v7M17 3v3M7 3v3M2 14h20M2 6h20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  unrest:         `<path d="m3 11 18-5v12L3 14v-3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  custom:         `<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="currentColor"/>`,
}

const isMobile = () => typeof window !== "undefined" && window.innerWidth < 640

function createPinIcon(color: string, isPending: boolean, category: IncidentCategory): L.DivIcon {
  const mobile    = isMobile()
  const outerSize = isPending ? (mobile ? 32 : 40) : (mobile ? 42 : 52)
  const innerSize = isPending ? (mobile ? 24 : 30) : (mobile ? 30 : 38)
  const opacity   = isPending ? 0.5 : 1
  const iconSize  = isPending ? (mobile ? 12 : 14) : (mobile ? 14 : 18)
  const glow      = isPending ? 4 : (mobile ? 8 : 12)
  const ring      = isPending ? "" : `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:${outerSize+16}px;height:${outerSize+16}px;border-radius:50%;border:1.5px solid ${color}30;animation:pinPulse 3s ease-in-out infinite;"></div>`

  return L.divIcon({
    className: "threat-pin",
    html: `<div style="position:relative;width:${outerSize+20}px;height:${outerSize+20}px;opacity:${opacity};">
      ${ring}
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:${outerSize}px;height:${outerSize}px;border-radius:50%;background:radial-gradient(circle at 35% 35%,${color}40,${color}10);display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 0 ${glow}px ${color}90);">
        <div style="width:${innerSize}px;height:${innerSize}px;border-radius:50%;background:linear-gradient(145deg,${color},${color}cc);border:2px solid rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;box-shadow:inset 0 1px 2px rgba(255,255,255,0.25),0 2px 8px ${color}60;">
          <svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" style="color:rgba(255,255,255,0.95);">${ICON_PATHS[category]}</svg>
        </div>
      </div>
    </div>`,
    iconSize:   [outerSize + 20, outerSize + 20],
    iconAnchor: [(outerSize + 20) / 2, (outerSize + 20) / 2],
  })
}

function createUserIcon(): L.DivIcon {
  return L.divIcon({
    className: "user-pin",
    html: `<div style="position:relative;width:56px;height:56px;">
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:56px;height:56px;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,0.2),transparent 70%);animation:userPulse 2.5s ease-in-out infinite;"></div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:32px;height:32px;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,0.12),transparent 70%);animation:userPulse 2.5s ease-in-out infinite 0.4s;"></div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:16px;height:16px;border-radius:50%;background:linear-gradient(145deg,#60a5fa,#3b82f6);border:2.5px solid rgba(255,255,255,0.9);box-shadow:0 0 16px rgba(59,130,246,0.7),0 0 32px rgba(59,130,246,0.3);"></div>
    </div>`,
    iconSize: [56, 56], iconAnchor: [28, 28],
  })
}

export function MapView() {
  const mapRef           = useRef<L.Map | null>(null)
  const mapContainerRef  = useRef<HTMLDivElement>(null)
  const markersRef       = useRef<Map<string, L.Marker>>(new Map())
  const userMarkerRef    = useRef<L.Marker | null>(null)
  const tileLayerRef     = useRef<L.TileLayer | null>(null)
  const hasFlownToUser   = useRef(false)

  const { incidents } = useIncidents()
  const {
    setSelectedIncident, setShowReportSheet, setReportLocation,
    userLocation, locationStatus, requestLocation,
    pinPlacementMode, setPinPlacementMode,
    pendingShareTarget, setPendingShareTarget,
  } = useAppState()

  const [mapReady,     setMapReady]     = useState(false)
  const [crosshairPos, setCrosshairPos] = useState<{ lat: number; lng: number } | null>(null)
  const { resolvedTheme } = useTheme()

  // ── Map init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: [20, 0], zoom: 2,
      zoomControl: false, attributionControl: false,
    })

    const isDark = document.documentElement.classList.contains("dark")
    tileLayerRef.current = L.tileLayer(isDark ? DARK_TILES : LIGHT_TILES, { maxZoom: 20 }).addTo(map)

    // Long-press → drop pin at exact touch/click point (power-user shortcut)
    let longPressTimer: ReturnType<typeof setTimeout>

    map.on("mousedown", (e: L.LeafletMouseEvent) => {
      longPressTimer = setTimeout(() => {
        setReportLocation({ lat: e.latlng.lat, lng: e.latlng.lng })
        setPinPlacementMode(false)
        setShowReportSheet(true)
      }, 600)
    })
    map.on("mouseup",   () => clearTimeout(longPressTimer))
    map.on("mousemove", () => clearTimeout(longPressTimer))

    const container = map.getContainer()
    let tLat = 0, tLng = 0
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const t    = e.touches[0]
      const rect = container.getBoundingClientRect()
      const pt   = map.containerPointToLatLng(L.point(t.clientX - rect.left, t.clientY - rect.top))
      tLat = pt.lat; tLng = pt.lng
      longPressTimer = setTimeout(() => {
        setReportLocation({ lat: tLat, lng: tLng })
        setPinPlacementMode(false)
        setShowReportSheet(true)
      }, 700)
    }
    container.addEventListener("touchstart", onTouchStart, { passive: true })
    container.addEventListener("touchend",   () => clearTimeout(longPressTimer))
    container.addEventListener("touchmove",  () => clearTimeout(longPressTimer), { passive: true })

    const handleResize = () => {
      // Only invalidate if map is fully initialized and has a valid pane
      if (map && map.getContainer() && map.getPane('mapPane')) {
        try {
          map.invalidateSize()
        } catch (error) {
          // Silently ignore - map not ready yet
        }
      }
    }
    
    window.addEventListener("resize", handleResize)
    mapRef.current = map
    setMapReady(true)

    return () => {
      window.removeEventListener("resize", handleResize)
      container.removeEventListener("touchstart", onTouchStart)
      map.remove()
      mapRef.current = null
      hasFlownToUser.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Update crosshair position as map moves ────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const onMove = () => {
      const c = map.getCenter()
      setCrosshairPos({ lat: c.lat, lng: c.lng })
    }

    if (pinPlacementMode) {
      // Seed immediately with current center
      onMove()
      map.on("move", onMove)
    } else {
      map.off("move", onMove)
    }

    return () => { map.off("move", onMove) }
  }, [pinPlacementMode, mapReady])

  // ── Fly to real location on first fix ────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapReady || !userLocation) return
    
    try {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng])
      } else {
        userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
          icon: createUserIcon(), interactive: false, zIndexOffset: 500,
        }).addTo(mapRef.current)
      }
      if (!hasFlownToUser.current) {
        hasFlownToUser.current = true
        // Only fly to user if we're NOT waiting to fly to a shared incident
        if (!pendingShareTarget) {
          mapRef.current.flyTo([userLocation.lat, userLocation.lng], 15, { duration: 1.4 })
        }
      }
    } catch (error) {
      console.error("Error updating user marker:", error)
    }
  }, [userLocation, mapReady])

  // ── Fly to shared incident on deep link ───────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapReady || !pendingShareTarget) return
    // Fly to the incident coordinates at a close zoom
    mapRef.current.flyTo([pendingShareTarget.lat, pendingShareTarget.lng], 16, { duration: 1.6 })
    // Mark that we've handled the initial fly-to so user location won't override it
    hasFlownToUser.current = true
  }, [pendingShareTarget, mapReady])

  // ── Theme tiles ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tileLayerRef.current || !resolvedTheme) return
    tileLayerRef.current.setUrl(resolvedTheme === "dark" ? DARK_TILES : LIGHT_TILES)
  }, [resolvedTheme])

  // ── Incident markers ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapReady) return
    const map = mapRef.current
    const currentIds = new Set(incidents.map((i: Incident) => i.id))

    try {
      markersRef.current.forEach((marker, id) => {
        if (!currentIds.has(id)) { 
          map.removeLayer(marker)
          markersRef.current.delete(id)
        }
      })
      
      incidents.forEach((incident: Incident) => {
        const cat       = getCategoryInfo(incident.category)
        const isPending = incident.status === "pending"
        if (markersRef.current.has(incident.id)) {
          const m = markersRef.current.get(incident.id)!
          m.setLatLng([incident.lat, incident.lng])
          m.setIcon(createPinIcon(cat.color, isPending, incident.category))
        } else {
          const m = L.marker([incident.lat, incident.lng], {
            icon: createPinIcon(cat.color, isPending, incident.category),
            zIndexOffset: isPending ? 100 : 200,
          }).addTo(map).on("click", () => setSelectedIncident(incident))
          markersRef.current.set(incident.id, m)
        }
      })
    } catch (error) {
      console.error("Error updating incident markers:", error)
    }
  }, [incidents, mapReady, setSelectedIncident])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const confirmPinLocation = useCallback(() => {
    if (!crosshairPos) return
    setReportLocation(crosshairPos)
    setPinPlacementMode(false)
    setShowReportSheet(true)
  }, [crosshairPos, setReportLocation, setPinPlacementMode, setShowReportSheet])

  const useMyLocation = useCallback(() => {
    if (!userLocation) return
    setReportLocation(userLocation)
    setPinPlacementMode(false)
    setShowReportSheet(true)
  }, [userLocation, setReportLocation, setPinPlacementMode, setShowReportSheet])

  const centerOnUser = () => {
    if (userLocation) {
      mapRef.current?.setView([userLocation.lat, userLocation.lng], 15, { animate: true })
    } else {
      // Request location permission again if not available
      requestLocation()
    }
  }

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainerRef} className="h-full w-full z-0" />

      {/* Vignette */}
      <div className="pointer-events-none absolute inset-0" style={{
        background: resolvedTheme === "dark"
          ? "radial-gradient(ellipse at center, transparent 50%, rgba(10,14,26,0.5) 100%)"
          : "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.08) 100%)",
      }} />

      {/* ── Pin-placement mode overlay ── */}
      <AnimatePresence>
        {pinPlacementMode && (
          <>
            {/* Edge darkening */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0"
              style={{
                background: "radial-gradient(ellipse 60% 55% at center, transparent 40%, rgba(0,0,0,0.45) 100%)",
              }}
            />

            {/* Crosshair — always centered in the viewport */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              {/* Drop shadow ring */}
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ type: "spring", damping: 18, stiffness: 280 }}
                className="relative flex items-center justify-center"
              >
                {/* Outer pulsing ring */}
                <div className="absolute h-16 w-16 rounded-full border-2 border-primary/40 animate-ping" style={{ animationDuration: "1.8s" }} />
                {/* Middle ring */}
                <div className="absolute h-10 w-10 rounded-full border-2 border-primary/60" />
                {/* Crosshair lines */}
                <div className="absolute h-px w-8 bg-primary/80 -translate-x-5" />
                <div className="absolute h-px w-8 bg-primary/80 translate-x-5" />
                <div className="absolute w-px h-8 bg-primary/80 -translate-y-5" />
                <div className="absolute w-px h-8 bg-primary/80 translate-y-5" />
                {/* Center dot */}
                <div className="h-2.5 w-2.5 rounded-full bg-primary shadow-lg" style={{ boxShadow: "0 0 12px rgba(229,77,66,0.8)" }} />
              </motion.div>
            </div>

            {/* "Move map to location" instruction — top badge */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="pointer-events-none absolute left-1/2 top-20 z-10 -translate-x-1/2 rounded-full border border-border/50 bg-card/85 px-4 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur-xl"
            >
              Move map to where it happened
            </motion.div>

            {/* Coordinates readout — just above the confirm bar */}
            {crosshairPos && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute bottom-[8.5rem] left-1/2 z-10 -translate-x-1/2 rounded-full border border-border/40 bg-card/70 px-3 py-1 text-[10px] tabular-nums text-muted-foreground backdrop-blur-lg sm:bottom-40"
              >
                {crosshairPos.lat.toFixed(5)}, {crosshairPos.lng.toFixed(5)}
              </motion.div>
            )}

            {/* Confirm bar — slides up from bottom */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="absolute inset-x-0 bottom-0 z-10 mx-auto max-w-lg px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:px-6"
            >
              <div className="flex flex-col gap-2.5 rounded-2xl border border-border/60 bg-card/90 p-4 shadow-2xl backdrop-blur-2xl dark:bg-card/80 sm:p-5">
                <div className="flex gap-2.5">
                  {/* Use my location shortcut */}
                  <button
                    onClick={useMyLocation}
                    disabled={!userLocation}
                    className="flex items-center gap-2 rounded-xl border border-border bg-secondary/60 px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-secondary disabled:opacity-40 active:scale-95"
                  >
                    <Navigation className="h-4 w-4 shrink-0 text-blue-400" />
                    <span className="hidden xs:inline">My location</span>
                    <span className="xs:hidden">Me</span>
                  </button>

                  {/* Confirm */}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={confirmPinLocation}
                    disabled={!crosshairPos}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 disabled:opacity-40 active:scale-95"
                    style={{ boxShadow: "0 4px 20px rgba(229,77,66,0.35)" }}
                  >
                    <MapPin className="h-4 w-4" />
                    Confirm location
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Styles ── */}
      <style jsx global>{`
        .threat-pin, .user-pin { background: transparent !important; border: none !important; }
        @keyframes userPulse {
          0%, 100% { transform: translate(-50%,-50%) scale(1); opacity: 0.5; }
          50%       { transform: translate(-50%,-50%) scale(2.2); opacity: 0; }
        }
        @keyframes pinPulse {
          0%, 100% { transform: translate(-50%,-50%) scale(1); opacity: 0.6; }
          50%       { transform: translate(-50%,-50%) scale(1.5); opacity: 0; }
        }
        .leaflet-container { background: var(--background) !important; font-family: inherit; }
        :is(.dark) .leaflet-tile-pane { opacity: 1.00; }
        .leaflet-control-attribution { display: none !important; }
      `}</style>

      {/* ── Status badges (shown outside placement mode) ── */}
      {!pinPlacementMode && locationStatus === "pending" && (
        <div className="absolute left-1/2 top-16 z-10 -translate-x-1/2 rounded-full border border-border/50 bg-card/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-xl">
          Locating you…
        </div>
      )}
      {!pinPlacementMode && locationStatus === "denied" && (
        <div className="absolute left-1/2 top-16 z-10 -translate-x-1/2 rounded-full border border-destructive/30 bg-card/80 px-3 py-1.5 text-xs text-destructive backdrop-blur-xl">
          Location access denied
        </div>
      )}

      {/* ── Center on me (hidden during placement) ── */}
      {!pinPlacementMode && (
        <button
          onClick={centerOnUser}
          className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-border/50 bg-card/70 text-foreground shadow-lg backdrop-blur-2xl transition-all hover:bg-card/90 active:scale-95 dark:bg-card/60 sm:bottom-6 sm:left-4 sm:h-12 sm:w-12 md:left-6"
          aria-label="Center on my location"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M2 12h4"/><path d="M18 12h4"/>
          </svg>
        </button>
      )}
    </div>
  )
}
