"use client"

import { useState, useEffect } from "react"
import { useAppState } from "@/hooks/use-app-state"
import { subscribeToPush, unsubscribeFromPush, getSubscriptionStatus } from "@/lib/messaging"
import { motion } from "framer-motion"
import { Bell, BellOff, Shield, Loader2, CheckCircle2, AlertTriangle, Globe } from "lucide-react"
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

type PushState = "checking" | "idle" | "subscribed" | "requesting" | "granted" | "unsubscribing" | "denied" | "unsupported" | "error"

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

  const [pushState, setPushState] = useState<PushState>("checking")
  const [errorMessage, setErrorMessage] = useState("")
  const [worldwide, setWorldwide] = useState(false)
  const [includeUnverified, setIncludeUnverified] = useState(false)

  // On mount: silently check whether the user is already subscribed so the
  // button reflects reality instead of always showing "Enable Browser Push".
  useEffect(() => {
    let cancelled = false
    getSubscriptionStatus().then((status) => {
      if (!cancelled) {
        setPushState(status.subscribed ? "subscribed" : "idle")
      }
    })
    return () => { cancelled = true }
  }, [])

  const handleActivatePush = async () => {
    if (pushState === "requesting" || pushState === "checking") return

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
        setPushState("subscribed")
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

  const handleUnsubscribe = async () => {
    if (pushState === "unsubscribing") return
    setPushState("unsubscribing")
    setErrorMessage("")

    const result = await unsubscribeFromPush()
    if (result.ok) {
      showToast("Push notifications disabled.")
      setPushState("idle")
    } else {
      setPushState("subscribed")
      setErrorMessage(result.message)
    }
  }

  const handleClose = () => {
    setShowNotificationSheet(false)
    if (pushState === "granted") setPushState("subscribed")
    else if (pushState !== "subscribed") setPushState("idle")
    setErrorMessage("")
  }

  const isBusy = pushState === "requesting" || pushState === "checking" || pushState === "unsubscribing"
  const isSubscribed = pushState === "subscribed"

  return (
    <Sheet open={showNotificationSheet} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent
        side="bottom"
        className="scrollbar-hide mx-auto max-h-[82svh] max-w-lg overflow-y-auto rounded-t-2xl border-t border-border/60 bg-card/90 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl backdrop-blur-2xl dark:bg-card/80 sm:px-6 sm:pt-6"
      >
        {/* Drag handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30 sm:mb-5" />

        <SheetHeader className="mb-5 text-left">
          <SheetTitle>
            {isSubscribed ? "Alert Preferences" : "Get Alerts Near You"}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Configure your alert preferences and notification radius
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 sm:gap-6">

          {/* ── Already-subscribed banner ── */}
          {isSubscribed && (
            <div className="flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                  Push alerts are active
                </p>
                <p className="text-xs text-muted-foreground">
                  You'll receive notifications for incidents in your area.
                </p>
              </div>
            </div>
          )}

          {/* ── Worldwide toggle ── */}
          <div
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
              worldwide ? "border-accent bg-accent/10" : "border-border bg-secondary/50"
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
              disabled={isSubscribed || isBusy}
              className="data-[state=checked]:bg-accent"
            />
          </div>

          {/* ── Include unverified toggle ── */}
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
              disabled={isSubscribed || isBusy}
              className="data-[state=checked]:bg-yellow-500"
            />
          </div>

          {/* ── Radius ── */}
          <div className={worldwide || isSubscribed ? "pointer-events-none opacity-40" : ""}>
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

          {/* ── Sensitivity ── */}
          <div className={isSubscribed ? "pointer-events-none opacity-40" : ""}>
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

          {/* ── Location warning ── */}
          {locationStatus !== "granted" && !worldwide && !isSubscribed && (
            <Alert className="border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs leading-relaxed text-muted-foreground">
                {locationStatus === "denied"
                  ? "Location access was denied. Enable it in browser settings so alerts use your real position."
                  : "Waiting for your location before subscribing…"}
              </AlertDescription>
            </Alert>
          )}

          {/* ── Error ── */}
          {(pushState === "denied" || pushState === "unsupported" || pushState === "error") && errorMessage && (
            <Alert variant="destructive" className="bg-destructive/10">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs leading-relaxed">
                {errorMessage}
              </AlertDescription>
            </Alert>
          )}

          {/* ── Subscribe CTA ── */}
          {!isSubscribed && (
            <StarBorder
              as="div"
              color="#e54d42"
              speed="5s"
              thickness={!isBusy ? 2 : 0}
              className="rounded-xl"
              style={{ borderRadius: "0.75rem" }}
            >
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleActivatePush}
                disabled={isBusy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 sm:py-3.5"
              >
                {pushState === "requesting" && <Loader2 className="h-4 w-4 animate-spin" />}
                {pushState === "granted"    && <CheckCircle2 className="h-4 w-4" />}
                {pushState === "checking"   && <Loader2 className="h-4 w-4 animate-spin" />}
                {!isBusy && pushState !== "granted" && <Bell className="h-4 w-4" />}

                {pushState === "checking"   && "Checking…"}
                {pushState === "idle"       && (worldwide ? "Enable Worldwide Alerts" : "Enable Browser Push")}
                {pushState === "requesting" && "Requesting permission…"}
                {pushState === "granted"    && "Notifications enabled!"}
                {(pushState === "denied" || pushState === "unsupported" || pushState === "error") && "Try again"}
              </motion.button>
            </StarBorder>
          )}

          {/* ── Unsubscribe CTA ── */}
          {(pushState === "subscribed" || pushState === "unsubscribing") && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleUnsubscribe}
              disabled={pushState === "unsubscribing"}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 py-3 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50 sm:py-3.5"
            >
              {pushState === "unsubscribing"
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <BellOff className="h-4 w-4" />}
              {pushState === "unsubscribing" ? "Disabling…" : "Disable Notifications"}
            </motion.button>
          )}

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
