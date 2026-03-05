export type IncidentCategory =
  | "crime"
  | "disaster"
  | "fire"
  | "infrastructure"
  | "unrest"
  | "custom"

export type IncidentStatus = "pending" | "active" | "resolved"

export interface Incident {
  id: string
  category: IncidentCategory
  description: string
  lat: number
  lng: number
  status: IncidentStatus
  confirmVotes: number
  resolveVotes: number
  flagVotes: number
  createdAt: number
  expiresAt: number
  photoUrl?: string   // legacy single-photo field (read only)
  photoUrls?: string[] // multi-photo support
}

export interface CategoryInfo {
  id: IncidentCategory
  label: string
  color: string
  bgClass: string
  textClass: string
  icon: string
  ttlHours: number
  threshold: number
}

export const CATEGORIES: CategoryInfo[] = [
  {
    id: "crime",
    label: "Crime / Safety",
    color: "#e54d42",
    bgClass: "bg-threat-crime",
    textClass: "text-threat-crime",
    icon: "shield-alert",
    ttlHours: 4,
    threshold: 3,
  },
  {
    id: "disaster",
    label: "Natural Disaster",
    color: "#e8903e",
    bgClass: "bg-threat-disaster",
    textClass: "text-threat-disaster",
    icon: "cloud-lightning",
    ttlHours: 12,
    threshold: 2,
  },
  {
    id: "fire",
    label: "Fire",
    color: "#d66038",
    bgClass: "bg-threat-fire",
    textClass: "text-threat-fire",
    icon: "flame",
    ttlHours: 6,
    threshold: 2,
  },
  {
    id: "infrastructure",
    label: "Infrastructure",
    color: "#c9b23e",
    bgClass: "bg-threat-infra",
    textClass: "text-threat-infra",
    icon: "construction",
    ttlHours: 8,
    threshold: 3,
  },
  {
    id: "unrest",
    label: "Civil Unrest",
    color: "#9b5de5",
    bgClass: "bg-threat-unrest",
    textClass: "text-threat-unrest",
    icon: "megaphone",
    ttlHours: 6,
    threshold: 4,
  },
  {
    id: "custom",
    label: "Other",
    color: "#8a8a8a",
    bgClass: "bg-threat-custom",
    textClass: "text-threat-custom",
    icon: "circle-dot",
    ttlHours: 4,
    threshold: 5,
  },
]

export function getCategoryInfo(id: IncidentCategory): CategoryInfo {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[5]
}
