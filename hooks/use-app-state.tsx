"use client"

import { useState, useCallback, useEffect, createContext, useContext, type ReactNode } from "react"
import type { Incident, IncidentCategory } from "@/lib/types"

type LocationStatus = "pending" | "granted" | "denied" | "unsupported"

interface AppState {
  selectedIncident: Incident | null
  setSelectedIncident: (incident: Incident | null) => void
  showReportSheet: boolean
  setShowReportSheet: (show: boolean) => void
  showNotificationSheet: boolean
  setShowNotificationSheet: (show: boolean) => void
  reportLocation: { lat: number; lng: number } | null
  setReportLocation: (loc: { lat: number; lng: number } | null) => void
  /** When true the map shows the pin-placement crosshair UI */
  pinPlacementMode: boolean
  setPinPlacementMode: (v: boolean) => void
  toastMessage: string | null
  showToast: (message: string) => void
  /** Current best-known user location. Starts as null until geolocation resolves. */
  userLocation: { lat: number; lng: number } | null
  locationStatus: LocationStatus
  requestLocation: () => void
  notificationRadius: number
  setNotificationRadius: (r: number) => void
  notificationThreshold: number
  setNotificationThreshold: (t: number) => void
  votedIncidents: Set<string>
  markVoted: (id: string) => void
  /** Set when the app is opened via a shared incident link. MapView flies here; detail sheet opens once the incident loads. */
  pendingShareTarget: { id: string; lat: number; lng: number } | null
  setPendingShareTarget: (t: { id: string; lat: number; lng: number } | null) => void
  /** Globe gallery visibility */
  showGallery: boolean
  setShowGallery: (v: boolean) => void
  /** True while the globe is fetching/processing land data for the first time */
  isGlobeLoading: boolean
  setIsGlobeLoading: (v: boolean) => void
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [showReportSheet, setShowReportSheet] = useState(false)
  const [showNotificationSheet, setShowNotificationSheet] = useState(false)
  const [reportLocation, setReportLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [pinPlacementMode, setPinPlacementMode] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [notificationRadius, setNotificationRadius] = useState(5)
  const [notificationThreshold, setNotificationThreshold] = useState(5)
  const [votedIncidents, setVotedIncidents] = useState<Set<string>>(new Set())
  const [pendingShareTarget, setPendingShareTarget] = useState<{ id: string; lat: number; lng: number } | null>(null)
  const [showGallery, setShowGallery] = useState(false)
  const [isGlobeLoading, setIsGlobeLoading] = useState(false)

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("pending")
  const [watchId, setWatchId] = useState<number | null>(null)

  // ── Read share params from URL on first load ──────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const id  = params.get("i")
    const lat = parseFloat(params.get("lat") ?? "")
    const lng = parseFloat(params.get("lng") ?? "")
    if (id && !isNaN(lat) && !isNaN(lng)) {
      setPendingShareTarget({ id, lat, lng })
      // Clean the URL without triggering a navigation
      const clean = window.location.pathname
      window.history.replaceState({}, "", clean)
    }
  }, [])

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationStatus("unsupported")
      return
    }

    setLocationStatus("pending")

    const onSuccess = (pos: GeolocationPosition) => {
      setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      setLocationStatus("granted")
    }

    const onError = () => {
      setLocationStatus("denied")
    }

    const opts: PositionOptions = { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }

    // One-shot for the initial fix (fast)
    navigator.geolocation.getCurrentPosition(onSuccess, onError, opts)

    // Clear existing watch if any
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId)
    }

    // Continuous watch so the blue dot stays accurate while the user moves
    const newWatchId = navigator.geolocation.watchPosition(onSuccess, () => {}, opts)
    setWatchId(newWatchId)
  }, [watchId])

  useEffect(() => {
    requestLocation()
    
    return () => {
      if (watchId !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const showToast = useCallback((message: string) => {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), 6000)
  }, [])

  const markVoted = useCallback((id: string) => {
    setVotedIncidents((prev) => new Set(prev).add(id))
  }, [])

  return (
    <AppContext.Provider
      value={{
        selectedIncident,
        setSelectedIncident,
        showReportSheet,
        setShowReportSheet,
        showNotificationSheet,
        setShowNotificationSheet,
        reportLocation,
        setReportLocation,
        pinPlacementMode,
        setPinPlacementMode,
        toastMessage,
        showToast,
        userLocation,
        locationStatus,
        requestLocation,
        notificationRadius,
        setNotificationRadius,
        notificationThreshold,
        setNotificationThreshold,
        votedIncidents,
        markVoted,
        pendingShareTarget,
        setPendingShareTarget,
        showGallery,
        setShowGallery,
        isGlobeLoading,
        setIsGlobeLoading,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useAppState() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useAppState must be used within AppProvider")
  return ctx
}