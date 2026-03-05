"use client"

import { useSyncExternalStore, useCallback } from "react"
import {
  getIncidents,
  subscribe,
  voteConfirm,
  voteResolve,
  voteFlag,
  addIncident,
} from "@/lib/incidents-store"
import type { Incident, IncidentCategory } from "@/lib/types"

export function useIncidents() {
  const incidents = useSyncExternalStore(subscribe, getIncidents, getIncidents)

  const confirm = useCallback((id: string) => voteConfirm(id), [])
  const resolve = useCallback((id: string) => voteResolve(id), [])
  const flag    = useCallback((id: string) => voteFlag(id),    [])

  const report = useCallback(
    (category: IncidentCategory, description: string, lat: number, lng: number) =>
      addIncident(category, description, lat, lng),
    []
  )

  const visibleIncidents = incidents.filter(
    (i: Incident) => i.status === "active" || i.status === "pending"
  )

  return { incidents: visibleIncidents, confirm, resolve, flag, report }
}
