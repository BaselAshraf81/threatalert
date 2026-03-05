"use client"

import dynamic from "next/dynamic"
import { AppProvider } from "@/hooks/use-app-state"
import { TopBar } from "@/components/top-bar"
import { ReportFAB } from "@/components/report-fab"
import { IncidentDetailSheet } from "@/components/incident-detail-sheet"
import { ReportSheet } from "@/components/report-sheet"
import { NotificationSheet } from "@/components/notification-sheet"
import { AlertToast } from "@/components/alert-toast"
import { IncidentTicker } from "@/components/incident-ticker"
import { BetaBanner } from "@/components/beta-banner"
import { IncidentGallery } from "@/components/incident-gallery"
import ClickSpark from "@/components/ClickSpark"
import { useTheme } from "next-themes"

// Leaflet must be loaded client-side only (uses window)
const MapView = dynamic(() => import("@/components/map-view").then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <div className="relative flex flex-col items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          <p className="text-xs text-muted-foreground sm:text-sm">Loading map...</p>
        </div>
      </div>
    </div>
  ),
})

function AppContent() {
  const { resolvedTheme } = useTheme()
  const sparkColor = resolvedTheme === "dark" ? "#6b9fff" : "#3b6fe0"

  return (
    <ClickSpark sparkColor={sparkColor} sparkSize={10} sparkRadius={18} sparkCount={8} duration={400}>
      <main className="relative h-dvh w-full overflow-hidden bg-background">
        <TopBar />
        <MapView />
        <IncidentTicker />
        <ReportFAB />
        <IncidentDetailSheet />
        <ReportSheet />
        <NotificationSheet />
        <AlertToast />
        <BetaBanner />
        <IncidentGallery />
      </main>
    </ClickSpark>
  )
}

export default function HomePage() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
