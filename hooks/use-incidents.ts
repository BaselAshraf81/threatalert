"use client"

import { useSyncExternalStore, useCallback } from "react"
import {
  getIncidents,
  subscribe,
  voteConfirm,
  voteResolve,
  voteFlag,
  addIncident,
  uploadPhotos,
  patchIncidentPhotos,
} from "@/lib/incidents-store"
import type { Incident, IncidentCategory } from "@/lib/types"

export function useIncidents() {
  const incidents = useSyncExternalStore(subscribe, getIncidents, getIncidents)

  const confirm = useCallback((id: string) => voteConfirm(id), [])
  const resolve = useCallback((id: string) => voteResolve(id), [])
  const flag    = useCallback((id: string) => voteFlag(id),    [])

  /**
   * Create an incident, optionally uploading photo files first.
   * Photos are uploaded to Firebase Storage and the resulting URLs
   * are stored alongside the incident document.
   */
  const report = useCallback(
    async (
      category: IncidentCategory,
      description: string,
      lat: number,
      lng: number,
      photos?: File[]
    ) => {
      // First create the incident to get an ID
      const incident = await addIncident(category, description, lat, lng)

      // Then upload photos (if any) and patch the incident with URLs
      if (photos && photos.length > 0) {
        try {
          const urls = await uploadPhotos(incident.id, photos)
          // Re-call addIncident is wasteful; instead we patch the created doc
          // via the store helper that uses the returned id
          await patchIncidentPhotos(incident.id, urls)
        } catch (err) {
          // Photo upload failure is non-fatal – the incident is already created
          console.warn("Photo upload failed:", err)
        }
      }

      return incident
    },
    []
  )

  const visibleIncidents = incidents.filter(
    (i: Incident) => i.status === "active" || i.status === "pending"
  )

  return { incidents: visibleIncidents, confirm, resolve, flag, report }
}
