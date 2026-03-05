"use client"

import { useRef, useState } from "react"
import { useAppState } from "@/hooks/use-app-state"
import { useIncidents } from "@/hooks/use-incidents"
import { CATEGORIES } from "@/lib/types"
import { motion, AnimatePresence } from "framer-motion"
import {
  ShieldAlert,
  CloudLightning,
  Flame,
  Construction,
  Megaphone,
  CircleDot,
  Camera,
  Send,
  X,
  ImagePlus,
  Loader2,
} from "lucide-react"
import StarBorder from "@/components/StarBorder"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import type { IncidentCategory } from "@/lib/types"

const CATEGORY_ICONS: Record<IncidentCategory, React.ReactNode> = {
  crime: <ShieldAlert className="h-5 w-5" />,
  disaster: <CloudLightning className="h-5 w-5" />,
  fire: <Flame className="h-5 w-5" />,
  infrastructure: <Construction className="h-5 w-5" />,
  unrest: <Megaphone className="h-5 w-5" />,
  custom: <CircleDot className="h-5 w-5" />,
}

const MAX_PHOTOS = 3
const MAX_FILE_MB = 10

export function ReportSheet() {
  const {
    showReportSheet,
    setShowReportSheet,
    reportLocation,
    userLocation,
    locationStatus,
    showToast,
    setReportLocation,
    setPinPlacementMode,
  } = useAppState()
  const { report } = useIncidents()

  const [selectedCategory, setSelectedCategory] = useState<IncidentCategory | null>(null)
  const [description, setDescription] = useState("")
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<"idle" | "uploading" | "done">("idle")
  const [showSuccess, setShowSuccess] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const location = reportLocation || userLocation
  const locationReady = !!location

  // ── Photo handling ─────────────────────────────────────────────────────────

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    const remaining = MAX_PHOTOS - photos.length
    const toAdd = files.slice(0, remaining)

    // Validate size
    const oversized = toAdd.filter((f) => f.size > MAX_FILE_MB * 1024 * 1024)
    if (oversized.length) {
      showToast(`Photos must be under ${MAX_FILE_MB} MB each`)
    }
    const valid = toAdd.filter((f) => f.size <= MAX_FILE_MB * 1024 * 1024)
    if (!valid.length) return

    // Generate local preview URLs
    const previews = valid.map((f) => URL.createObjectURL(f))
    setPhotos((prev) => [...prev, ...valid])
    setPhotoPreviews((prev) => [...prev, ...previews])

    // Reset input so the same file can be re-selected if removed
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviews[index])
    setPhotos((prev) => prev.filter((_, i) => i !== index))
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!selectedCategory || !location) return

    setIsSubmitting(true)
    try {
      if (photos.length > 0) setUploadProgress("uploading")
      await report(selectedCategory, description || "Incident reported", location.lat, location.lng, photos)
      setUploadProgress("done")
      setShowSuccess(true)

      setTimeout(() => {
        setShowSuccess(false)
        setShowReportSheet(false)
        reset()
        showToast("Incident submitted — it will appear once verified")
      }, 1200)
    } catch (err: any) {
      showToast(err?.message ?? "Submission failed — please try again.")
      setIsSubmitting(false)
      setUploadProgress("idle")
    }
  }

  const reset = () => {
    setSelectedCategory(null)
    setDescription("")
    photoPreviews.forEach((p) => URL.revokeObjectURL(p))
    setPhotos([])
    setPhotoPreviews([])
    setIsSubmitting(false)
    setUploadProgress("idle")
    setReportLocation(null)
    setPinPlacementMode(false)
  }

  const handleClose = () => {
    setShowReportSheet(false)
    reset()
  }

  return (
    <Sheet open={showReportSheet} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-lg rounded-t-2xl border-t border-border/60 bg-card/90 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl backdrop-blur-2xl dark:bg-card/80 sm:px-6 sm:pt-6"
      >
        {/* Drag handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30 sm:mb-5" />

        <SheetHeader className="sr-only">
          <SheetTitle>Report an Incident</SheetTitle>
          <SheetDescription>Submit a new incident report with location and details</SheetDescription>
        </SheetHeader>

        <AnimatePresence mode="wait">
          {showSuccess ? (
            /* ── Success state ── */
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex flex-col items-center gap-4 py-8"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 10, stiffness: 200, delay: 0.1 }}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/20"
              >
                <svg
                  width="32" height="32" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  className="text-accent"
                >
                  <motion.path
                    d="M5 13l4 4L19 7"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                  />
                </svg>
              </motion.div>
              <p className="text-sm font-medium text-foreground">Report submitted</p>
            </motion.div>
          ) : (
            /* ── Form ── */
            <motion.div key="form" className="flex flex-col gap-4 sm:gap-5">
              <SheetHeader className="text-left">
                <SheetTitle>Report an Incident</SheetTitle>
              </SheetHeader>

              {/* Location row */}
              <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3.5 py-2.5">
                <div
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    locationReady ? "bg-accent" : "bg-muted-foreground animate-pulse"
                  }`}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  {locationReady && location ? (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                    </span>
                  ) : (
                    <span className="animate-pulse text-xs text-muted-foreground">
                      Getting your location…
                    </span>
                  )}
                </div>
                <Button
                  variant="outline" size="sm"
                  onClick={() => { setShowReportSheet(false); setPinPlacementMode(true) }}
                  className="h-7 rounded-lg text-xs"
                >
                  Change
                </Button>
              </div>

              {/* Category picker */}
              <div>
                <p className="mb-2.5 text-sm font-medium text-muted-foreground sm:mb-3">Category</p>
                <div className="grid grid-cols-2 gap-1.5 xs:grid-cols-3 sm:gap-2">
                  {CATEGORIES.map((cat) => (
                    <motion.button
                      key={cat.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-[11px] transition-all sm:gap-1.5 sm:p-3 sm:text-xs ${
                        selectedCategory === cat.id
                          ? "border-transparent shadow-lg"
                          : "border-border bg-secondary/50 text-muted-foreground hover:bg-secondary"
                      }`}
                      style={
                        selectedCategory === cat.id
                          ? {
                              backgroundColor: cat.color + "18",
                              color: cat.color,
                              borderColor: cat.color + "40",
                              boxShadow: `0 0 20px ${cat.color}15`,
                            }
                          : undefined
                      }
                    >
                      <span style={selectedCategory === cat.id ? { color: cat.color } : undefined}>
                        {CATEGORY_ICONS[cat.id]}
                      </span>
                      <span className="text-balance text-center leading-tight">{cat.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground">
                  Description (optional)
                </p>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 280))}
                  placeholder="What's happening?"
                  rows={3}
                  className="resize-none rounded-xl border-border bg-secondary/50 focus-visible:border-accent focus-visible:ring-accent/30"
                />
                <p className="mt-1 text-right text-xs text-muted-foreground">
                  {description.length}/280
                </p>
              </div>

              {/* ── Photos section ── */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">
                    Photos{" "}
                    <span className="text-xs font-normal text-muted-foreground/60">
                      (optional, up to {MAX_PHOTOS})
                    </span>
                  </p>
                  {photos.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {photos.length}/{MAX_PHOTOS}
                    </span>
                  )}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {/* Existing photo thumbnails */}
                  {photoPreviews.map((preview, i) => (
                    <motion.div
                      key={preview}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preview}
                        alt={`Photo ${i + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <button
                        onClick={() => removePhoto(i)}
                        className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition hover:bg-black/80"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </motion.div>
                  ))}

                  {/* Add photo button */}
                  {photos.length < MAX_PHOTOS && (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-secondary/40 text-muted-foreground transition hover:border-accent/50 hover:bg-secondary hover:text-accent"
                    >
                      <ImagePlus className="h-5 w-5" />
                      <span className="text-[10px]">Add</span>
                    </motion.button>
                  )}
                </div>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
              </div>

              {/* Submit */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSubmit}
                disabled={!selectedCategory || !locationReady || isSubmitting}
                className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 sm:py-3.5"
              >
                {selectedCategory && !isSubmitting && (
                  <StarBorder
                    as="div"
                    color="#e54d42"
                    speed="4s"
                    thickness={2}
                    className="pointer-events-none absolute inset-0 rounded-xl"
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {uploadProgress === "uploading" ? "Uploading photos…" : "Submitting…"}
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Submit Report
                      {photos.length > 0 && (
                        <span className="ml-0.5 flex items-center gap-0.5 text-xs opacity-70">
                          <Camera className="h-3 w-3" />
                          {photos.length}
                        </span>
                      )}
                    </>
                  )}
                </span>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  )
}

