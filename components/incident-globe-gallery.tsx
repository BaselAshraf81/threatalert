"use client"

import { useEffect, useRef, useState, useMemo, useCallback } from "react"
import * as d3 from "d3"
import { motion, AnimatePresence } from "framer-motion"
import { X, MapPin, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GridScan } from "./GridScan"
import type { GridScanHandle } from "./GridScan"
import StarBorder from "./StarBorder"
import { useIncidents } from "@/hooks/use-incidents"
import { useAppState } from "@/hooks/use-app-state"
import { useIsMobile } from "@/hooks/use-mobile"
import { getCategoryInfo, CATEGORIES } from "@/lib/types"
import type { Incident } from "@/lib/types"

const CATEGORY_COLORS: Record<string, string> = {
  crime:          "#e54d42",
  disaster:       "#e8903e",
  fire:           "#d66038",
  infrastructure: "#c9b23e",
  unrest:         "#9b5de5",
  custom:         "#8a8a8a",
}

const CATEGORY_EMOJI: Record<string, string> = {
  crime: "🚨", disaster: "⛈️", fire: "🔥",
  infrastructure: "🚧", unrest: "📢", custom: "⚠️",
}

const TWO_PI = Math.PI * 2

// Module-level cache — persists across gallery open/close so we never re-fetch or recalculate
let _cachedLandFeatures: any = null
let _cachedDots: { lng: number; lat: number }[] = []

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// Larger hit radius on touch — fingers are less precise than cursors
const HIT_RADIUS_MOUSE = 18
const HIT_RADIUS_TOUCH = 36

export function IncidentGlobeGallery() {
  const { showGallery, setShowGallery, setSelectedIncident, setIsGlobeLoading } = useAppState()
  const { incidents } = useIncidents()
  const isMobile = useIsMobile()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const gridScanRef = useRef<GridScanHandle>(null)

  const projectionRef = useRef<d3.GeoProjection | null>(null)
  const rotationRef = useRef<[number, number]>([0, 0])
  const autoRotateRef = useRef(true)
  const landFeaturesRef = useRef<any>(null)
  const allDotsRef = useRef<{ lng: number; lat: number }[]>([])
  const incidentsRef = useRef<Incident[]>([])
  const hoveredIdxRef = useRef<number | null>(null)

  // Ref mirror of showGallery so the D3 timer callback reads current value without stale closure
  const showGalleryRef = useRef(showGallery)
  // Guard: heavy globe init runs exactly once
  const isInitializedRef = useRef(false)

  const [hoveredIncident, setHoveredIncident] = useState<{ incident: Incident; x: number; y: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [statsVisible, setStatsVisible] = useState(false)

  // Keep global loading state in sync so the globe button in the top-bar can show a spinner
  useEffect(() => { setIsGlobeLoading(isLoading) }, [isLoading, setIsGlobeLoading])

  const activeIncidents = useMemo(
    () => [...incidents].sort((a, b) => b.createdAt - a.createdAt).slice(0, 200),
    [incidents]
  )

  useEffect(() => { incidentsRef.current = activeIncidents }, [activeIncidents])

  // Keep ref in sync with React state so timer callback always sees live value
  useEffect(() => { showGalleryRef.current = showGallery }, [showGallery])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    activeIncidents.forEach(inc => { counts[inc.category] = (counts[inc.category] || 0) + 1 })
    return counts
  }, [activeIncidents])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
    gridScanRef.current?.updateLook(nx, ny)
  }, [])

  // Stats visibility — lightweight, still driven by showGallery
  useEffect(() => {
    if (!showGallery) {
      setStatsVisible(false)
      hoveredIdxRef.current = null
      setHoveredIncident(null)
      return
    }
    const t = setTimeout(() => setStatsVisible(true), 800)
    return () => clearTimeout(t)
  }, [showGallery])

  // ─── One-time globe initialization ────────────────────────────────────────
  // showGallery is intentionally NOT in the dep array.
  // The overlay is always mounted; the D3 timer skips work when invisible.
  useEffect(() => {
    if (isInitializedRef.current) return
    if (!canvasRef.current || !containerRef.current) return
    isInitializedRef.current = true

    const canvas = canvasRef.current
    const container = containerRef.current
    const ctx = canvas.getContext("2d")!

    const dpr = window.devicePixelRatio || 1
    let W = 0, H = 0, baseRadius = 0

    let pathGen = d3.geoPath().context(ctx)
    let gratGeom = d3.geoGraticule()()

    function resize() {
      const cr = container.getBoundingClientRect()
      W = cr.width; H = cr.height
      baseRadius = Math.min(W, H) * 0.38
      canvas.width = W * dpr; canvas.height = H * dpr
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`
      ctx.resetTransform()
      ctx.scale(dpr, dpr)
      if (projectionRef.current) {
        projectionRef.current.translate([W / 2, H / 2])
        pathGen = d3.geoPath().projection(projectionRef.current).context(ctx)
      }
    }

    function ptInPoly(pt: [number, number], ring: number[][]): boolean {
      const [x, y] = pt; let inside = false
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]; const [xj, yj] = ring[j]
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
      }
      return inside
    }

    function ptInFeature(pt: [number, number], feat: any): boolean {
      const g = feat.geometry
      if (g.type === "Polygon") {
        if (!ptInPoly(pt, g.coordinates[0])) return false
        for (let i = 1; i < g.coordinates.length; i++) if (ptInPoly(pt, g.coordinates[i])) return false
        return true
      }
      if (g.type === "MultiPolygon") {
        for (const poly of g.coordinates) {
          if (ptInPoly(pt, poly[0])) {
            let inHole = false
            for (let i = 1; i < poly.length; i++) if (ptInPoly(pt, poly[i])) { inHole = true; break }
            if (!inHole) return true
          }
        }
      }
      return false
    }

    function genDots(feat: any, spacing = 14): [number, number][] {
      const dots: [number, number][] = []
      const [[minLng, minLat], [maxLng, maxLat]] = d3.geoBounds(feat)
      const step = spacing * 0.08
      for (let lng = minLng; lng <= maxLng; lng += step)
        for (let lat = minLat; lat <= maxLat; lat += step)
          if (ptInFeature([lng, lat], feat)) dots.push([lng, lat])
      return dots
    }

    function render(t: number) {
      // Skip all GPU/canvas work while the overlay is invisible — zero cost
      if (!showGalleryRef.current) return

      const proj = projectionRef.current!
      pathGen.projection(proj)

      ctx.clearRect(0, 0, W, H)
      const sc = proj.scale()

      // Ocean
      ctx.beginPath()
      ctx.arc(W / 2, H / 2, sc, 0, TWO_PI)
      ctx.fillStyle = "#010d1e"
      ctx.fill()
      ctx.strokeStyle = "rgba(60,100,220,0.35)"
      ctx.lineWidth = 1.5
      ctx.stroke()

      if (!landFeaturesRef.current) return

      // Graticule
      ctx.beginPath()
      pathGen(gratGeom)
      ctx.strokeStyle = "rgba(30,60,140,0.2)"
      ctx.lineWidth = 0.5
      ctx.stroke()

      // Land fill
      ctx.beginPath()
      landFeaturesRef.current.features.forEach((f: any) => pathGen(f))
      ctx.fillStyle = "rgba(20,40,90,0.2)"
      ctx.fill()

      // Land outline
      ctx.beginPath()
      landFeaturesRef.current.features.forEach((f: any) => pathGen(f))
      ctx.strokeStyle = "rgba(60,100,200,0.3)"
      ctx.lineWidth = 0.6
      ctx.stroke()

      // Land dots — ONE beginPath/fill for ALL dots
      ctx.beginPath()
      for (const dot of allDotsRef.current) {
        const p = proj([dot.lng, dot.lat])
        if (!p || p[0] < 0 || p[0] > W || p[1] < 0 || p[1] > H) continue
        ctx.moveTo(p[0] + 0.9, p[1])
        ctx.arc(p[0], p[1], 0.9, 0, TWO_PI)
      }
      ctx.fillStyle = "rgba(80,120,230,0.5)"
      ctx.fill()

      // Incident markers
      const incs = incidentsRef.current
      const pulse = (t * 0.002) % TWO_PI
      const hovIdx = hoveredIdxRef.current

      type VP = { i: number; px: number; py: number; color: string; isHovered: boolean }
      const visible: VP[] = []
      for (let i = 0; i < incs.length; i++) {
        const p = proj([incs[i].lng, incs[i].lat])
        if (!p || p[0] < 0 || p[0] > W || p[1] < 0 || p[1] > H) continue
        visible.push({
          i, px: p[0], py: p[1],
          color: CATEGORY_COLORS[incs[i].category] || "#8a8a8a",
          isHovered: hovIdx === i,
        })
      }

      // Pass 1: outer pulse rings
      for (const { i, px, py, color, isHovered } of visible) {
        const offset = (i * 1.3) % TWO_PI
        const pv = (Math.sin(pulse + offset) + 1) / 2
        ctx.beginPath()
        ctx.arc(px, py, 5 + pv * (isHovered ? 16 : 10), 0, TWO_PI)
        ctx.strokeStyle = color
        ctx.globalAlpha = (1 - pv) * (isHovered ? 0.75 : 0.45)
        ctx.lineWidth = isHovered ? 1.5 : 1
        ctx.stroke()
      }

      // Pass 2: second pulse rings (offset phase)
      for (const { i, px, py, color, isHovered } of visible) {
        const offset = (i * 1.3) % TWO_PI
        const pv2 = (Math.sin(pulse + offset + Math.PI) + 1) / 2
        ctx.beginPath()
        ctx.arc(px, py, 4 + pv2 * (isHovered ? 22 : 14), 0, TWO_PI)
        ctx.strokeStyle = color
        ctx.globalAlpha = (1 - pv2) * (isHovered ? 0.45 : 0.2)
        ctx.lineWidth = 0.8
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      // Pass 3: glow halos
      for (const { px, py, color, isHovered } of visible) {
        ctx.beginPath()
        ctx.arc(px, py, isHovered ? 16 : 10, 0, TWO_PI)
        ctx.fillStyle = color + (isHovered ? "30" : "16")
        ctx.fill()
        if (isHovered) {
          ctx.beginPath()
          ctx.arc(px, py, 7, 0, TWO_PI)
          ctx.fillStyle = color + "44"
          ctx.fill()
        }
      }

      // Pass 4: core dots
      for (const { px, py, color, isHovered } of visible) {
        ctx.beginPath()
        ctx.arc(px, py, isHovered ? 4.5 : 2.8, 0, TWO_PI)
        ctx.fillStyle = isHovered ? "#ffffff" : color
        ctx.fill()
        ctx.strokeStyle = isHovered ? color : "rgba(255,255,255,0.5)"
        ctx.lineWidth = 0.8
        ctx.stroke()
      }
    }

    resize()
    projectionRef.current = d3
      .geoOrthographic()
      .scale(baseRadius)
      .translate([W / 2, H / 2])
      .clipAngle(90)
    pathGen = d3.geoPath().projection(projectionRef.current).context(ctx)

    // Timer stays alive forever; skips render body when hidden
    const timer = d3.timer((elapsed) => {
      if (!showGalleryRef.current) return
      if (autoRotateRef.current) {
        rotationRef.current[0] += 0.18
        projectionRef.current!.rotate(rotationRef.current)
      }
      render(elapsed)
    })

    // ── Shared helpers ────────────────────────────────────────────────────

    function getXY(clientX: number, clientY: number) {
      const r = canvas.getBoundingClientRect()
      return { x: clientX - r.left, y: clientY - r.top }
    }

    function findNearest(cx: number, cy: number, hitRadius: number): number | null {
      const proj = projectionRef.current!
      const incs = incidentsRef.current
      let best: number | null = null, bestD = hitRadius
      for (let i = 0; i < incs.length; i++) {
        const p = proj([incs[i].lng, incs[i].lat])
        if (!p) continue
        const d = Math.hypot(p[0] - cx, p[1] - cy)
        if (d < bestD) { bestD = d; best = i }
      }
      return best
    }

    // ── Mouse interaction ─────────────────────────────────────────────────

    let dragStart: { mx: number; my: number; rot: [number, number] } | null = null
    let didDrag = false
    let dragEndAt = 0

    function onMouseMove(e: MouseEvent) {
      const { x, y } = getXY(e.clientX, e.clientY)
      if (dragStart) {
        didDrag = true
        autoRotateRef.current = false
        const dx = x - dragStart.mx, dy = y - dragStart.my
        rotationRef.current[0] = dragStart.rot[0] + dx * 0.4
        rotationRef.current[1] = Math.max(-85, Math.min(85, dragStart.rot[1] - dy * 0.4))
        projectionRef.current!.rotate(rotationRef.current)
        hoveredIdxRef.current = null
        setHoveredIncident(null)
        return
      }
      const idx = findNearest(x, y, HIT_RADIUS_MOUSE)
      hoveredIdxRef.current = idx
      canvas.style.cursor = idx !== null ? "pointer" : "grab"
      if (idx !== null) {
        const canvasR = canvas.getBoundingClientRect()
        const containerR = container.getBoundingClientRect()
        const p = projectionRef.current!([incidentsRef.current[idx].lng, incidentsRef.current[idx].lat])!
        setHoveredIncident({
          incident: incidentsRef.current[idx],
          x: canvasR.left - containerR.left + p[0],
          y: canvasR.top - containerR.top + p[1],
        })
      } else {
        setHoveredIncident(null)
      }
    }

    function onMouseDown(e: MouseEvent) {
      const { x, y } = getXY(e.clientX, e.clientY)
      dragStart = { mx: x, my: y, rot: [rotationRef.current[0], rotationRef.current[1]] }
      didDrag = false
      canvas.style.cursor = "grabbing"
    }

    function onMouseUp(e: MouseEvent) {
      const wasDrag = didDrag
      dragStart = null
      canvas.style.cursor = "grab"
      if (wasDrag) {
        dragEndAt = performance.now()
        setTimeout(() => { autoRotateRef.current = true }, 2500)
      } else {
        const { x, y } = getXY(e.clientX, e.clientY)
        const idx = findNearest(x, y, HIT_RADIUS_MOUSE)
        if (idx !== null) {
          setSelectedIncident(incidentsRef.current[idx])
          setShowGallery(false)
        } else {
          setTimeout(() => { autoRotateRef.current = true }, 20)
        }
      }
    }

    function onClick(e: MouseEvent) {
      if (performance.now() - dragEndAt < 300) {
        e.stopPropagation()
        e.preventDefault()
      }
    }

    function onMouseLeave() {
      hoveredIdxRef.current = null
      setHoveredIncident(null)
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const factor = e.deltaY > 0 ? 0.92 : 1.08
      const proj = projectionRef.current!
      const newS = Math.max(baseRadius * 0.5, Math.min(baseRadius * 2.5, proj.scale() * factor))
      proj.scale(newS)
    }

    // ── Touch interaction ─────────────────────────────────────────────────
    // Single-finger drag → rotate globe
    // Tap (< 8px movement) → select nearest incident

    let touchStart: { x: number; y: number; rot: [number, number] } | null = null
    let touchMoved = false
    let touchEndAt = 0
    let lastPinchDist = 0

    function onTouchStart(e: TouchEvent) {
      // Two-finger pinch — store initial distance for zoom
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        lastPinchDist = Math.hypot(dx, dy)
        touchStart = null // cancel single-touch drag
        return
      }

      const t = e.touches[0]
      const { x, y } = getXY(t.clientX, t.clientY)
      touchStart = { x, y, rot: [rotationRef.current[0], rotationRef.current[1]] }
      touchMoved = false
      autoRotateRef.current = false
      e.preventDefault()
    }

    function onTouchMove(e: TouchEvent) {
      e.preventDefault()

      // Two-finger pinch zoom
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.hypot(dx, dy)
        if (lastPinchDist > 0) {
          const factor = dist / lastPinchDist
          const proj = projectionRef.current!
          const newS = Math.max(baseRadius * 0.5, Math.min(baseRadius * 2.5, proj.scale() * factor))
          proj.scale(newS)
        }
        lastPinchDist = dist
        return
      }

      if (!touchStart) return
      const t = e.touches[0]
      const { x, y } = getXY(t.clientX, t.clientY)
      const dx = x - touchStart.x
      const dy = y - touchStart.y

      // Only commit to drag once finger moves more than 6px
      if (!touchMoved && Math.hypot(dx, dy) < 6) return
      touchMoved = true

      rotationRef.current[0] = touchStart.rot[0] + dx * 0.4
      rotationRef.current[1] = Math.max(-85, Math.min(85, touchStart.rot[1] - dy * 0.4))
      projectionRef.current!.rotate(rotationRef.current)
      hoveredIdxRef.current = null
      setHoveredIncident(null)
    }

    function onTouchEnd(e: TouchEvent) {
      if (!touchStart) return

      if (!touchMoved) {
        // It's a tap — find nearest incident with the larger touch hit radius
        const { x, y } = touchStart
        const idx = findNearest(x, y, HIT_RADIUS_TOUCH)
        if (idx !== null) {
          setSelectedIncident(incidentsRef.current[idx])
          setShowGallery(false)
        }
      } else {
        // Drag ended — resume auto-rotate after a pause
        touchEndAt = performance.now()
        setTimeout(() => { autoRotateRef.current = true }, 2500)
      }

      touchStart = null
      touchMoved = false
      lastPinchDist = 0
    }

    canvas.addEventListener("mousemove", onMouseMove)
    canvas.addEventListener("mousedown", onMouseDown)
    canvas.addEventListener("mouseup", onMouseUp)
    canvas.addEventListener("click", onClick)
    canvas.addEventListener("mouseleave", onMouseLeave)
    canvas.addEventListener("wheel", onWheel, { passive: false })

    // Touch events — passive: false so we can preventDefault (stops page scroll while rotating)
    canvas.addEventListener("touchstart", onTouchStart, { passive: false })
    canvas.addEventListener("touchmove", onTouchMove, { passive: false })
    canvas.addEventListener("touchend", onTouchEnd)

    canvas.style.cursor = "grab"

    const ro = new ResizeObserver(resize)
    ro.observe(container)

    ;(async () => {
      try {
        if (_cachedLandFeatures) {
          landFeaturesRef.current = _cachedLandFeatures
          allDotsRef.current = _cachedDots
          setIsLoading(false)
          return
        }
        const res = await fetch(
          "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/110m/physical/ne_110m_land.json"
        )
        if (!res.ok) throw new Error()
        const data = await res.json()
        const dots: { lng: number; lat: number }[] = []
        data.features.forEach((f: any) => {
          genDots(f, 14).forEach(([lng, lat]) => dots.push({ lng, lat }))
        })
        _cachedLandFeatures = data
        _cachedDots = dots
        landFeaturesRef.current = data
        allDotsRef.current = dots
        setIsLoading(false)
      } catch {
        setIsLoading(false)
      }
    })()

    return () => {
      timer.stop()
      canvas.removeEventListener("mousemove", onMouseMove)
      canvas.removeEventListener("mousedown", onMouseDown)
      canvas.removeEventListener("mouseup", onMouseUp)
      canvas.removeEventListener("click", onClick)
      canvas.removeEventListener("mouseleave", onMouseLeave)
      canvas.removeEventListener("wheel", onWheel)
      canvas.removeEventListener("touchstart", onTouchStart)
      canvas.removeEventListener("touchmove", onTouchMove)
      canvas.removeEventListener("touchend", onTouchEnd)
      ro.disconnect()
    }
  }, [setSelectedIncident, setShowGallery])

  // ─── Stats panel — built once, used in both layouts ───────────────────────
  const statItems = CATEGORIES
    .map((cat, ci) => ({ cat, ci, count: categoryCounts[cat.id] || 0 }))
    .filter(({ count }) => count > 0)

  return (
    <div
      onMouseMove={handleMouseMove}
      style={{
        position: "fixed", inset: 0, zIndex: 3000, overflow: "hidden",
        background: "#00000f",
        opacity: showGallery ? 1 : 0,
        pointerEvents: showGallery ? "auto" : "none",
        transition: "opacity 0.4s ease",
      }}
    >
      {/* GridScan bg */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <GridScan
          ref={gridScanRef}
          sensitivity={0.95}
          lineThickness={1}
          linesColor="#12122a"
          gridScale={0.08}
          scanColor="#1a3aff"
          scanOpacity={0.15}
          enablePost
          bloomIntensity={0.4}
          chromaticAberration={0.02}
          noiseIntensity={0.15}
          scanDirection="pingpong"
        />
      </div>

      {/* Vignette */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
        background: "radial-gradient(ellipse 75% 75% at 50% 50%, transparent 30%, rgba(0,0,15,0.88) 100%)"
      }} />

      {/* Globe canvas */}
      <div ref={containerRef} style={{ position: "absolute", inset: 0, zIndex: 2 }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }} />
      </div>

      {/* Loading */}
      <AnimatePresence>
        {isLoading && showGallery && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              position: "absolute", inset: 0, zIndex: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column", gap: 28, pointerEvents: "none",
              background: "rgba(0,0,12,0.6)", backdropFilter: "blur(2px)",
            }}
          >
            {/* Animated globe rings */}
            <div style={{ position: "relative", width: 88, height: 88 }}>
              {/* Outer ring */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                style={{
                  position: "absolute", inset: 0, borderRadius: "50%",
                  border: "1.5px solid transparent",
                  borderTopColor: "rgba(80,140,255,0.9)",
                  borderRightColor: "rgba(80,140,255,0.3)",
                }}
              />
              {/* Middle ring */}
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                style={{
                  position: "absolute", inset: 10, borderRadius: "50%",
                  border: "1.5px solid transparent",
                  borderTopColor: "rgba(120,180,255,0.7)",
                  borderLeftColor: "rgba(120,180,255,0.2)",
                }}
              />
              {/* Core dot */}
              <motion.div
                animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <div style={{
                  width: 12, height: 12, borderRadius: "50%",
                  background: "rgba(80,140,255,0.9)",
                  boxShadow: "0 0 20px rgba(80,140,255,0.6)",
                }} />
              </motion.div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <p style={{
                color: "rgba(200,220,255,0.95)", fontSize: 13, fontWeight: 600,
                letterSpacing: "0.2em", fontFamily: "monospace", margin: 0,
              }}>
                LOADING GLOBE
              </p>
              {/* Animated dots */}
              <div style={{ display: "flex", gap: 5 }}>
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                    style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(80,140,255,0.8)" }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hover tooltip — desktop only (touch uses tap-to-open directly) */}
      <AnimatePresence>
        {hoveredIncident && showGallery && !isMobile && (
          <motion.div
            key={hoveredIncident.incident.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.12 }}
            style={{
              position: "absolute", zIndex: 20, pointerEvents: "none",
              left: Math.min(hoveredIncident.x + 18, window.innerWidth - 260),
              top: Math.max(10, hoveredIncident.y - 60),
              maxWidth: 240,
            }}
          >
            <StarBorder
              as="div"
              color={CATEGORY_COLORS[hoveredIncident.incident.category]}
              speed="4s"
              thickness={1.5}
              style={{
                borderRadius: 10,
                display: "block",
                boxShadow: `0 12px 40px rgba(0,0,0,0.7), 0 0 30px ${CATEGORY_COLORS[hoveredIncident.incident.category]}30`,
              }}
            >
              <div style={{
                borderRadius: 9,
                padding: "11px 14px",
                background: "rgba(3,5,18,0.97)",
                backdropFilter: "blur(20px)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
                  <span style={{ fontSize: 15 }}>{CATEGORY_EMOJI[hoveredIncident.incident.category]}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                    color: CATEGORY_COLORS[hoveredIncident.incident.category],
                    textTransform: "uppercase", fontFamily: "monospace",
                  }}>
                    {getCategoryInfo(hoveredIncident.incident.category).label}
                  </span>
                </div>
                <p style={{
                  margin: 0, fontSize: 12, color: "rgba(210,225,255,0.9)",
                  lineHeight: 1.55, fontFamily: "system-ui, sans-serif",
                }}>
                  {hoveredIncident.incident.description?.slice(0, 90) || "No description"}
                  {(hoveredIncident.incident.description?.length ?? 0) > 90 && "…"}
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 9, alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "rgba(100,130,200,0.65)", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 3 }}>
                    <MapPin size={8} />
                    {hoveredIncident.incident.lat.toFixed(2)}°, {hoveredIncident.incident.lng.toFixed(2)}°
                  </span>
                  <span style={{ fontSize: 10, color: "rgba(100,130,200,0.5)", fontFamily: "monospace", marginLeft: "auto", display: "flex", alignItems: "center", gap: 3 }}>
                    <Clock size={8} />
                    {timeAgo(hoveredIncident.incident.createdAt)}
                  </span>
                </div>
                <div style={{ marginTop: 8, paddingTop: 7, borderTop: "1px solid rgba(80,100,200,0.15)" }}>
                  <span style={{ fontSize: 10, color: "rgba(80,120,255,0.65)", fontFamily: "monospace", letterSpacing: "0.06em" }}>
                    CLICK TO VIEW DETAILS →
                  </span>
                </div>
              </div>
            </StarBorder>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stats panel — DESKTOP: right side column ──────────────────────── */}
      <AnimatePresence>
        {statsVisible && activeIncidents.length > 0 && showGallery && !isMobile && (
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.5 }}
            style={{
              position: "absolute", right: 20, top: "50%", transform: "translateY(-50%)",
              zIndex: 10, display: "flex", flexDirection: "column", gap: 5,
              // Keep it from running too tall and overlapping the header/footer
              maxHeight: "70vh", overflowY: "auto",
            }}
          >
            {statItems.map(({ cat, ci, count }) => (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: ci * 0.06 }}
              >
                <StarBorder
                  as="div"
                  color={cat.color}
                  speed="6s"
                  thickness={1}
                  style={{ borderRadius: 8, display: "block", minWidth: 140 }}
                >
                  <div style={{
                    display: "flex", alignItems: "center", gap: 9,
                    borderRadius: 7, padding: "6px 12px",
                    background: "rgba(3,5,18,0.88)",
                    backdropFilter: "blur(12px)",
                  }}>
                    <span style={{ fontSize: 12 }}>{CATEGORY_EMOJI[cat.id]}</span>
                    <span style={{ flex: 1, fontSize: 10, color: "rgba(180,195,255,0.65)", fontFamily: "monospace", letterSpacing: "0.05em" }}>
                      {cat.label.toUpperCase().slice(0, 13)}
                    </span>
                    <span style={{
                      fontSize: 13, fontWeight: 700, color: cat.color,
                      fontFamily: "monospace", minWidth: 20, textAlign: "right",
                    }}>
                      {count}
                    </span>
                  </div>
                </StarBorder>
              </motion.div>
            ))}
            <div style={{ marginTop: 4, padding: "4px 12px", borderTop: "1px solid rgba(80,100,200,0.12)" }}>
              <span style={{ fontSize: 10, color: "rgba(80,100,160,0.5)", fontFamily: "monospace", letterSpacing: "0.08em" }}>
                {activeIncidents.length} TOTAL INCIDENTS
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stats panel — MOBILE: horizontal strip just above bottom hint ── */}
      <AnimatePresence>
        {statsVisible && activeIncidents.length > 0 && showGallery && isMobile && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.4 }}
            style={{
              position: "absolute", bottom: 48, left: 0, right: 0,
              zIndex: 10, paddingBottom: 6,
            }}
          >
            {/* Horizontal scrollable row of compact chips */}
            <div style={{
              display: "flex", gap: 6, overflowX: "auto", paddingInline: 16,
              // Hide scrollbar on mobile
              scrollbarWidth: "none",
              WebkitOverflowScrolling: "touch",
            }}>
              {statItems.map(({ cat, count }) => (
                <div
                  key={cat.id}
                  style={{
                    flexShrink: 0,
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "5px 10px", borderRadius: 20,
                    background: "rgba(3,5,18,0.82)",
                    backdropFilter: "blur(12px)",
                    border: `1px solid ${cat.color}40`,
                  }}
                >
                  <span style={{ fontSize: 11 }}>{CATEGORY_EMOJI[cat.id]}</span>
                  <span style={{ fontSize: 10, color: "rgba(180,195,255,0.7)", fontFamily: "monospace" }}>
                    {cat.label.split(" ")[0].toUpperCase()}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: cat.color, fontFamily: "monospace" }}>
                    {count}
                  </span>
                </div>
              ))}
              {/* Total pill */}
              <div style={{
                flexShrink: 0,
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 10px", borderRadius: 20,
                background: "rgba(3,5,18,0.82)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(80,100,200,0.2)",
              }}>
                <span style={{ fontSize: 10, color: "rgba(100,130,200,0.6)", fontFamily: "monospace" }}>
                  TOTAL
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(160,185,255,0.9)", fontFamily: "monospace" }}>
                  {activeIncidents.length}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <AnimatePresence>
        {showGallery && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            style={{
              position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px",
              background: "linear-gradient(to bottom, rgba(0,0,15,0.92) 0%, transparent 100%)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <motion.div
                animate={{ opacity: [1, 0.25, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: "#ff3030", boxShadow: "0 0 12px #ff3030",
                }}
              />
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "rgba(210,225,255,0.95)", letterSpacing: "0.08em", fontFamily: "monospace" }}>
                  GLOBAL THREAT MAP
                </p>
                <p style={{ margin: 0, fontSize: 10, color: "rgba(100,130,200,0.5)", marginTop: 2, fontFamily: "monospace", letterSpacing: "0.07em" }}>
                  {activeIncidents.length} ACTIVE INCIDENTS · LIVE
                </p>
              </div>
            </div>
            <Button
              variant="outline" size="icon"
              onClick={() => setShowGallery(false)}
              style={{
                borderRadius: "50%", border: "1px solid rgba(80,120,255,0.2)",
                background: "rgba(4,6,24,0.7)", color: "rgba(160,185,255,0.8)",
                width: 36, height: 36, backdropFilter: "blur(12px)",
              }}
            >
              <X size={15} />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom hint */}
      <AnimatePresence>
        {showGallery && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 1.2, duration: 0.8 }}
            style={{
              position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 10,
              padding: "14px 18px", display: "flex", justifyContent: "center",
              background: "linear-gradient(to top, rgba(0,0,15,0.7) 0%, transparent 100%)",
            }}
          >
            <p style={{ margin: 0, fontSize: 10, color: "rgba(60,90,160,0.5)", letterSpacing: "0.12em", fontFamily: "monospace" }}>
              {isMobile
                ? "DRAG TO ROTATE · TAP MARKER TO INSPECT"
                : "SCROLL TO ZOOM · DRAG TO ROTATE · CLICK MARKER TO INSPECT"}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
