import { createHash } from "crypto"
import type { Handler } from "@netlify/functions"

// ── Word lists (must match live-chat-sheet.tsx exactly) ───────────────────────
const ADJECTIVES = [
  "Silent", "Swift", "Bold", "Calm", "Keen", "Wise", "Brave", "Dark",
  "Sharp", "Cool", "Quick", "Quiet", "Bright", "Rapid", "Stark", "Lone",
  "Iron", "Steel", "Amber", "Azure", "Crimson", "Neon", "Phantom", "Ghost",
]
const ANIMALS = [
  "Fox", "Hawk", "Wolf", "Bear", "Owl", "Lynx", "Raven", "Eagle",
  "Viper", "Shark", "Tiger", "Puma", "Falcon", "Cobra", "Badger", "Bison",
  "Jackal", "Moose", "Crane", "Heron", "Panther", "Dingo", "Osprey", "Wren",
]

function hashToUsername(hash: string): string {
  // Use different slices of the hex hash to independently pick each component
  const adjIdx    = parseInt(hash.slice(0, 4), 16) % ADJECTIVES.length
  const animalIdx = parseInt(hash.slice(4, 8), 16) % ANIMALS.length
  const num       = (parseInt(hash.slice(8, 12), 16) % 90) + 10  // 10–99

  return `${ADJECTIVES[adjIdx]}${ANIMALS[animalIdx]}${num}`
}

export const handler: Handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
  }

  // Netlify sets x-nf-client-connection-ip to the real client IP (not spoofable)
  // Fall back to x-forwarded-for as secondary source
  const ip =
    event.headers["x-nf-client-connection-ip"] ||
    event.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    "unknown"

  // SHA-256 of the IP — never stored, just used to derive username
  const hash    = createHash("sha256").update(ip).digest("hex")
  const username = hashToUsername(hash)

  // Also return the first 12 hex chars as a stable session ID substitute
  const userId = hash.slice(0, 16)

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ username, userId }),
  }
}
