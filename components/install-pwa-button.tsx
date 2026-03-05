"use client"

import { useState, useEffect } from "react"
import { Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import StarBorder from "@/components/StarBorder"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

declare global {
  interface Window {
    __installPromptEvent: BeforeInstallPromptEvent | null
  }
}

export function InstallPWAButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstallable, setIsInstallable] = useState(false)

  useEffect(() => {
    // Already installed — nothing to show
    if (window.matchMedia("(display-mode: standalone)").matches) return

    function adopt(e: BeforeInstallPromptEvent) {
      setDeferredPrompt(e)
      setIsInstallable(true)
    }

    // Case 1: the early-capture script in layout.tsx already caught the event
    // before React hydrated — grab it directly from window
    if (window.__installPromptEvent) {
      adopt(window.__installPromptEvent)
      return
    }

    // Case 2: event hasn't fired yet (slower devices / first paint still in progress)
    // Listen for both the real event and the custom relay event
    function onCaptured() {
      if (window.__installPromptEvent) adopt(window.__installPromptEvent)
    }
    function onPrompt(e: Event) {
      adopt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener("installpromptcaptured", onCaptured)
    window.addEventListener("beforeinstallprompt", onPrompt)
    return () => {
      window.removeEventListener("installpromptcaptured", onCaptured)
      window.removeEventListener("beforeinstallprompt", onPrompt)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") {
      setIsInstallable(false)
      setDeferredPrompt(null)
      window.__installPromptEvent = null
    }
  }

  if (!isInstallable) return null

  return (
    <StarBorder as="div" color="#6b9fff" speed="6s" thickness={1} className="rounded-full">
      <Button
        variant="outline"
        size="sm"
        onClick={handleInstall}
        className="h-8 gap-1.5 rounded-full border-border/50 bg-card/70 px-2.5 text-xs font-medium shadow-lg backdrop-blur-2xl hover:bg-card/90 dark:bg-card/60 sm:h-9 sm:gap-2 sm:px-4"
      >
        <Smartphone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        <span>Install</span>
      </Button>
    </StarBorder>
  )
}
