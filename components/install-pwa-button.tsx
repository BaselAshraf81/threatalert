"use client"

import { useState, useEffect } from "react"
import { Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import StarBorder from "@/components/StarBorder"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function InstallPWAButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstallable, setIsInstallable] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setIsInstallable(true)
    }

    window.addEventListener("beforeinstallprompt", handler)

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstallable(false)
    }

    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === "accepted") {
      setIsInstallable(false)
      setDeferredPrompt(null)
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
