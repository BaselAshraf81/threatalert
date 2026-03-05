"use client"

import { useCallback, useEffect, useState } from "react"
import useEmblaCarousel from "embla-carousel-react"
import { X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface PhotoCarouselProps {
  urls: string[]
  /** compact: inline strip (in detail sheet). lightbox: full overlay on tap */
  variant?: "inline" | "lightbox"
}

export function PhotoCarousel({ urls, variant = "inline" }: PhotoCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: "center" })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on("select", onSelect)
    return () => { emblaApi.off("select", onSelect) }
  }, [emblaApi, onSelect])

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])

  if (!urls.length) return null

  const single = urls.length === 1

  return (
    <>
      {/* ── Carousel strip ── */}
      <div className="relative w-full overflow-hidden rounded-xl">
        <div ref={emblaRef} className="overflow-hidden rounded-xl">
          <div className="flex gap-2" style={{ touchAction: "pan-y" }}>
            {urls.map((url, i) => (
              <div
                key={url}
                className="relative shrink-0 cursor-pointer overflow-hidden rounded-xl"
                style={{
                  width: single ? "100%" : "calc(80% + 0px)",
                  aspectRatio: "4 / 3",
                }}
                onClick={() => setLightboxIndex(i)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Incident photo ${i + 1}`}
                  className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                  draggable={false}
                />
                {/* zoom hint */}
                <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm">
                  <ZoomIn className="h-3 w-3 text-white" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Prev / Next buttons (only when multiple) */}
        {!single && (
          <>
            <button
              onClick={scrollPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70 disabled:opacity-30"
              disabled={selectedIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={scrollNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70 disabled:opacity-30"
              disabled={selectedIndex === urls.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        {/* Dot indicators */}
        {!single && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
            {urls.map((_, i) => (
              <button
                key={i}
                onClick={() => emblaApi?.scrollTo(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === selectedIndex
                    ? "w-4 bg-white"
                    : "w-1.5 bg-white/50 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Lightbox overlay ── */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <motion.div
            key="lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
            onClick={() => setLightboxIndex(null)}
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.88, opacity: 0 }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              className="relative max-h-full max-w-2xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={urls[lightboxIndex]}
                alt={`Photo ${lightboxIndex + 1}`}
                className="max-h-[85dvh] w-full rounded-2xl object-contain shadow-2xl"
              />

              {/* Close */}
              <button
                onClick={() => setLightboxIndex(null)}
                className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Counter */}
              {urls.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white/80 backdrop-blur-sm">
                  {lightboxIndex + 1} / {urls.length}
                </div>
              )}

              {/* Prev / next in lightbox */}
              {urls.length > 1 && (
                <>
                  <button
                    disabled={lightboxIndex === 0}
                    onClick={() => setLightboxIndex((p) => Math.max(0, (p ?? 0) - 1))}
                    className="absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70 disabled:opacity-20"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    disabled={lightboxIndex === urls.length - 1}
                    onClick={() => setLightboxIndex((p) => Math.min(urls.length - 1, (p ?? 0) + 1))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70 disabled:opacity-20"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
