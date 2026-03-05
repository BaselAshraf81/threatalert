"use client"

import { useState } from "react"
import { useAppState } from "@/hooks/use-app-state"
import { subscribeToPush } from "@/lib/messaging"
import { motion } from "framer-motion"
import { Bell, Shield, Loader2, CheckCircle2, AlertTriangle, Globe } from "lucide-react"
import StarBorder from "@/components/StarBorder"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { InstallPWAButton } from "@/components/install-pwa-button"
type PushState = "idle" | "requesting" | "granted" | "denied" | "unsupported" | "error"

const RADIUS_OPTIONS = [1, 5, 10, 25]

export function NotificationSheet() {
  const {
    showNotificationSheet,
    setShowNotificationSheet,
    notificationRadius,
    setNotificationRadius,
    notificationThreshold,
    setNotificationThreshold,
    showToast,
    userLocation,
    locationStatus,
  } = useAppState()

  const [pushState, setPushState] = useState<PushState>("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [worldwide, setWorldwide] = useState(false)
  const [includeUnverified, setIncludeUnverified] = useState(false)

  const handleActivatePush = async () => {
    if (pushState === "requesting") return

    if (!userLocation) {
      showToast("Waiting for your location — try again in a moment.")
      return
    }

    setPushState("requesting")
    setErrorMessage("")

    const result = await subscribeToPush({
      lat: userLocation.lat,
      lng: userLocation.lng,
      radiusKm: worldwide ? 40075 : notificationRadius,
      threshold: notificationThreshold,
      worldwide,
      includeUnverified,
    })

    if (result.ok) {
      setPushState("granted")
      showToast(
        worldwide
          ? `Worldwide alerts enabled — you'll hear about every verified incident.`
          : `Push alerts activated within ${notificationRadius}km of your location.`
      )
      setTimeout(() => {
        setShowNotificationSheet(false)
        setPushState("idle")
      }, 1800)
    } else if (result.reason === "denied") {
      setPushState("denied")
      setErrorMessage("Permission denied. Enable notifications in your browser settings and try again.")
    } else if (result.reason === "unsupported") {
      setPushState("unsupported")
      setErrorMessage("Push notifications aren't supported in this browser.")
    } else {
      setPushState("error")
      setErrorMessage(result.message)
    }
  }

  const handleClose = () => {
    setShowNotificationSheet(false)
    if (pushState !== "granted") setPushState("idle")
    setErrorMessage("")
  }

  const isActive =
    pushState !== "idle" &&
    pushState !== "denied" &&
    pushState !== "unsupported" &&
    pushState !== "error"

  return (
    <Sheet open={showNotificationSheet} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-lg rounded-t-2xl border-t border-border/60 bg-card/90 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl backdrop-blur-2xl dark:bg-card/80 sm:px-6 sm:pt-6"
      >
        {/* Drag handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30 sm:mb-5" />

        <SheetHeader className="mb-5 text-left">
          <SheetTitle>Get Alerts Near You</SheetTitle>
          <SheetDescription className="sr-only">
            Configure your alert preferences and notification radius
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 sm:gap-6">
          {/* ── Worldwide toggle (shadcn Switch) ── */}
          <div
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
              worldwide
                ? "border-accent bg-accent/10"
                : "border-border bg-secondary/50"
            }`}
          >
            <Globe className={`h-4 w-4 shrink-0 ${worldwide ? "text-accent" : "text-muted-foreground"}`} />
            <div className="min-w-0 flex-1">
              <Label
                htmlFor="worldwide-switch"
                className={`cursor-pointer text-sm font-semibold ${worldwide ? "text-accent" : "text-foreground"}`}
              >
                Alert worldwide
              </Label>
              <p className="text-xs text-muted-foreground">
                Receive alerts for every verified incident globally
              </p>
            </div>
            <Switch
              id="worldwide-switch"
              checked={worldwide}
              onCheckedChange={setWorldwide}
              className="data-[state=checked]:bg-accent"
            />
          </div>

          {/* ── Include unverified toggle (shadcn Switch) ── */}
          <div
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
              includeUnverified
                ? "border-yellow-500/40 bg-yellow-500/10"
                : "border-border bg-secondary/50"
            }`}
          >
            <AlertTriangle className={`h-4 w-4 shrink-0 ${includeUnverified ? "text-yellow-500" : "text-muted-foreground"}`} />
            <div className="min-w-0 flex-1">
              <Label
                htmlFor="unverified-switch"
                className={`cursor-pointer text-sm font-semibold ${includeUnverified ? "text-yellow-600 dark:text-yellow-500" : "text-foreground"}`}
              >
                Include unverified threats
              </Label>
              <p className="text-xs text-muted-foreground">
                Get notified about pending incidents before they're verified
              </p>
            </div>
            <Switch
              id="unverified-switch"
              checked={includeUnverified}
              onCheckedChange={setIncludeUnverified}
              className="data-[state=checked]:bg-yellow-500"
            />
          </div>

          {/* ── Radius (shadcn ToggleGroup) ── */}
          <div className={worldwide ? "pointer-events-none opacity-40" : ""}>
            <p className="mb-2.5 text-sm font-medium text-muted-foreground sm:mb-3">Alert radius</p>
            <ToggleGroup
              type="single"
              value={String(notificationRadius)}
              onValueChange={(v) => v && setNotificationRadius(Number(v))}
              className="w-full gap-1.5 sm:gap-2"
            >
              {RADIUS_OPTIONS.map((r) => (
                <ToggleGroupItem
                  key={r}
                  value={String(r)}
                  className="flex-1 rounded-xl border border-border bg-secondary/50 py-2 text-sm font-medium text-muted-foreground data-[state=on]:border-accent data-[state=on]:bg-accent/15 data-[state=on]:text-accent sm:py-2.5"
                >
                  {r}km
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {/* ── Sensitivity (shadcn Slider) ── */}
          <div>
            <div className="mb-2.5 flex items-center justify-between sm:mb-3">
              <p className="text-sm font-medium text-muted-foreground">Alert sensitivity</p>
              <span className="text-sm font-semibold text-accent">{notificationThreshold}+ reports</span>
            </div>
            <Slider
              min={1}
              max={10}
              step={1}
              value={[notificationThreshold]}
              onValueChange={([v]) => setNotificationThreshold(v)}
              className="[&_[data-slot=slider-range]]:bg-accent [&_[data-slot=slider-thumb]]:border-accent"
            />
            <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
              <span>More alerts</span>
              <span>Fewer alerts</span>
            </div>
          </div>

          {/* ── Location warning (shadcn Alert) ── */}
          {locationStatus !== "granted" && !worldwide && (
            <Alert className="border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs leading-relaxed text-muted-foreground">
                {locationStatus === "denied"
                  ? "Location access was denied. Enable it in browser settings so alerts use your real position."
                  : "Waiting for your location before subscribing…"}
              </AlertDescription>
            </Alert>
          )}

          {/* ── Error (shadcn Alert destructive) ── */}
          {(pushState === "denied" || pushState === "unsupported" || pushState === "error") &&
            errorMessage && (
              <Alert variant="destructive" className="bg-destructive/10">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs leading-relaxed">
                  {errorMessage}
                </AlertDescription>
              </Alert>
            )}
<InstallPWAButton />
          {/* ── CTA ── */}
          <StarBorder
            as="div"
            color="#e54d42"
            speed="5s"
            thickness={!isActive ? 2 : 0}
            className="rounded-xl"
            style={{ borderRadius: "0.75rem" }}
          >
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleActivatePush}
              disabled={isActive}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 sm:py-3.5"
            >
              {pushState === "requesting" && <Loader2 className="h-4 w-4 animate-spin" />}
              {pushState === "granted" && <CheckCircle2 className="h-4 w-4" />}
              {!isActive && <Bell className="h-4 w-4" />}

              {pushState === "idle" && (worldwide ? "Enable Worldwide Alerts" : "Enable Browser Push")}
              {pushState === "requesting" && "Requesting permission…"}
              {pushState === "granted" && "Notifications enabled!"}
              {(pushState === "denied" || pushState === "unsupported" || pushState === "error") &&
                "Try again"}
            </motion.button>
          </StarBorder>
                
          {/* ── Privacy note ── */}
          <div className="flex items-start gap-2.5 rounded-xl bg-secondary/50 px-3.5 py-2.5 sm:px-4 sm:py-3">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Your location is only used to filter alerts by distance. It is never linked to your
              identity and is not shared with other users.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
