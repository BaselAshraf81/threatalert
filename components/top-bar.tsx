"use client"

import { useAppState } from "@/hooks/use-app-state"
import { useTheme } from "next-themes"
import { Bell, Shield, Sun, Moon, Globe, Loader2, ImageIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import StarBorder from "@/components/StarBorder"
import { GitHubStarsButton } from "@/components/github-stars-button"
import { InstallPWAButton } from "@/components/install-pwa-button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function TopBar() {
  const { setShowNotificationSheet, setShowGallery, isGlobeLoading, showGallery } = useAppState()
  const { theme, setTheme } = useTheme()

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-1000 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-5 sm:py-3 md:px-8">
      {/* Left: notification bell */}
      <div className="flex items-center">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowNotificationSheet(true)}
          className="pointer-events-auto h-9 w-9 rounded-full border-border/50 bg-card/70 shadow-lg backdrop-blur-2xl hover:bg-card/90 dark:bg-card/60 sm:h-10 sm:w-10"
          aria-label="Notification settings"
        >
          <Bell className="h-4 w-4" />
        </Button>
      </div>

      {/* Center: logo — in-flow, never overlapped */}
      <div className="pointer-events-auto flex justify-center rounded-full">
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

      {/* Right: Install PWA + GitHub stars + globe gallery + theme toggle */}
      <div className="pointer-events-auto flex items-center justify-end gap-2">
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
          onClick={() => setShowGallery(true)}
          disabled={isGlobeLoading && !showGallery}
          className="relative h-9 w-9 rounded-full border-border/50 bg-card/70 shadow-lg backdrop-blur-2xl hover:bg-card/90 dark:bg-card/60 sm:h-10 sm:w-10"
          aria-label="Globe incident gallery"
        >
          {isGlobeLoading && showGallery ? (
            <Loader2 className="h-4 w-4 animate-spin opacity-70" />
          ) : (
            <Globe className="h-4 w-4" />
          )}
        </Button>

        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full border-border/50 bg-card/70 shadow-lg backdrop-blur-2xl hover:bg-card/90 dark:bg-card/60 sm:h-10 sm:w-10"
              aria-label="Show picture"
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Image preview</DialogTitle>
              <DialogDescription>
              </DialogDescription>
            </DialogHeader>
            <img
              src="/picture.png"
              alt="Crétin"
              className="max-h-[60vh] w-full rounded-md border object-contain"
            />
            <p className="text-center text-sm text-muted-foreground">Crétin</p>
          </DialogContent>
        </Dialog>

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
