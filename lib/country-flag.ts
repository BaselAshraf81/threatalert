/**
 * Reverse-geocode a lat/lng to a country flag emoji.
 * Uses OpenStreetMap Nominatim (free, no key needed).
 * Results are cached in memory for the lifetime of the page.
 */

const cache = new Map<string, string>()

function cacheKey(lat: number, lng: number) {
  // Round to 1 decimal place — accurate enough for country-level lookup
  return `${lat.toFixed(1)},${lng.toFixed(1)}`
}

function countryCodeToFlag(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(c.charCodeAt(0) + 127397))
}

export async function getCountryFlag(lat: number, lng: number): Promise<string> {
  const key = cacheKey(lat, lng)
  if (cache.has(key)) return cache.get(key)!

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "Accept-Language": "en" } }
    )
    const data = await res.json()
    const code: string = data?.address?.country_code ?? ""
    const flag = code ? countryCodeToFlag(code) : "🌍"
    cache.set(key, flag)
    return flag
  } catch {
    cache.set(key, "🌍")
    return "🌍"
  }
}
