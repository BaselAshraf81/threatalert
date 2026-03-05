"use client"

import { useIncidents } from "@/hooks/use-incidents"
import { useAppState } from "@/hooks/use-app-state"
import { getCategoryInfo } from "@/lib/types"
import { motion, AnimatePresence } from "framer-motion"
import type { Incident } from "@/lib/types"

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h`
}

export function IncidentTicker() {
  const { incidents } = useIncidents()
  const { setSelectedIncident } = useAppState()

  const activeIncidents = incidents.filter((i: Incident) => i.status === "active").slice(0, 8)

  if (activeIncidents.length === 0) return null

  return (
    <div className="absolute inset-x-0 bottom-[4.5rem] z-999 px-3 sm:bottom-24 sm:px-4 md:px-6">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <AnimatePresence>
          {activeIncidents.map((incident: Incident, index: number) => {
            const cat = getCategoryInfo(incident.category)
            return (
              <motion.button
                key={incident.id}
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setSelectedIncident(incident)}
                className="flex shrink-0 items-center gap-2 rounded-xl border border-border/50 bg-card/75 px-3 py-2 shadow-lg backdrop-blur-2xl transition-all hover:border-border hover:bg-card/90 hover:shadow-xl dark:bg-card/70 sm:gap-2.5 sm:px-3.5 sm:py-2.5"
              >
                <div className="relative">
                  <div
                    className="h-2 w-2 shrink-0 rounded-full sm:h-2.5 sm:w-2.5"
                    style={{ backgroundColor: cat.color, boxShadow: `0 0 8px ${cat.color}80` }}
                  />
                  <div
                    className="absolute inset-0 animate-ping rounded-full"
                    style={{ backgroundColor: cat.color, opacity: 0.4, animationDuration: '3s' }}
                  />
                </div>
                <span className="max-w-[120px] truncate text-[11px] font-medium text-foreground sm:max-w-[160px] sm:text-xs">
                  {incident.description}
                </span>
                <span className="text-[9px] text-muted-foreground sm:text-[10px]">
                  {timeAgo(incident.createdAt)}
                </span>
              </motion.button>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
