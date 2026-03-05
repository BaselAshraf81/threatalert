"use client"

import { useAppState } from "@/hooks/use-app-state"
import { useTheme } from "next-themes"
import { Bell, Shield, Sun, Moon, Globe } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import StarBorder from "@/components/StarBorder"
import { GitHubStarsButton } from "@/components/github-stars-button"
import { InstallPWAButton } from "@/components/install-pwa-button"

export function TopBar() {
  const { setShowNotificationSheet, setShowGallery } = useAppState()
  const { theme, setTheme } = useTheme()

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-1000 flex items-center px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-5 sm:py-3 md:px-8">
      {/* Left: notification bell */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setShowNotificationSheet(true)}
        className="pointer-events-auto h-9 w-9 rounded-full border-border/50 bg-card/70 shadow-lg backdrop-blur-2xl hover:bg-card/90 dark:bg-card/60 sm:h-10 sm:w-10"
        aria-label="Notification settings"
      >
        <Bell className="h-4 w-4" />
      </Button>

      {/* Center: logo */}
      <div className="pointer-events-auto absolute left-1/2 -translate-x-1/2 rounded-full">
        <StarBorder as="div" color="#6b9fff" speed="8s" thickness={1} className="rounded-full">
          <div className="flex items-center gap-1.5 rounded-full bg-card/70 px-3 py-1.5 shadow-lg backdrop-blur-2xl dark:bg-card/60 sm:gap-2 sm:px-4 sm:py-2">
            <Shield className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />
            <span className="text-xs font-semibold tracking-tight text-foreground sm:text-sm">
              ThreatAlert
            </span>
            <Badge
              variant="outline"
              className="h-4 rounded-sm border-amber-500/50 bg-amber-500/10 px-1 text-[9px] font-bold uppercase tracking-wider text-amber-500 sm:h-[18px] sm:text-[10px]"
            >
              Beta
            </Badge>
          </div>
        </StarBorder>
      </div>

      {/* Right: Install PWA + GitHub stars + theme toggle */}
      <div className="pointer-events-auto ml-auto flex items-center gap-2 rounded-full">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowGallery(true)}
          className="pointer-events-auto h-9 w-9 rounded-full border-border/50 bg-card/70 shadow-lg backdrop-blur-2xl hover:bg-card/90 dark:bg-card/60 sm:h-10 sm:w-10"
          aria-label="World incident gallery"
        >
          <Globe className="h-4 w-4" />
        </Button>
        <InstallPWAButton />
        
        <GitHubStarsButton
          username="BaselAshraf81"
          repo="threatalert"
          variant="outline"
          size="sm"
          className="hidden border-border/50 bg-card/70 shadow-lg backdrop-blur-2xl hover:bg-card/90 dark:bg-card/60 sm:inline-flex"
        />

        <Button
          variant="outline"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="h-9 w-9 rounded-full border-border/50 bg-card/70 shadow-lg backdrop-blur-2xl hover:bg-card/90 dark:bg-card/60 sm:h-10 sm:w-10"
          aria-label="Toggle theme"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
        </Button>
      </div>
    </header>
  )
}
