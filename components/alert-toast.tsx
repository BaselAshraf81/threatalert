"use client"

import { useAppState } from "@/hooks/use-app-state"
import { motion, AnimatePresence } from "framer-motion"
import { ShieldAlert, ArrowRight } from "lucide-react"

export function AlertToast() {
  const { toastMessage, setSelectedIncident } = useAppState()

  return (
    <AnimatePresence>
      {toastMessage && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-3000 mx-auto max-w-md px-3 sm:px-4"
        >
          <div className="flex items-center gap-2.5 rounded-2xl border border-border/60 bg-card/90 px-3 py-2.5 shadow-2xl backdrop-blur-2xl dark:bg-card/80 sm:gap-3 sm:px-4 sm:py-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 sm:h-8 sm:w-8">
              <ShieldAlert className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />
            </div>
            <p className="flex-1 text-xs text-foreground sm:text-sm">{toastMessage}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
