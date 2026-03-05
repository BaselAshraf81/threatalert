"use client"

import { useEffect, useState } from "react"
import { Shield, Zap, Lock, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

const STORAGE_KEY = "threatalert_beta_seen_v1"

export function BetaBanner() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setOpen(true)
  }, [])

  const dismiss = () => {
    setOpen(false)
    localStorage.setItem(STORAGE_KEY, "1")
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && dismiss()}>
      <SheetContent
        side="bottom"
        className="z-[9999] mx-auto max-w-lg rounded-t-3xl border-t border-border/60 bg-card px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl sm:px-7 sm:pt-7"
      >
        {/* Drag handle */}
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-muted-foreground/25" />

        <SheetHeader className="sr-only">
          <SheetTitle>Welcome to ThreatAlert Beta</SheetTitle>
          <SheetDescription>Important information about using this beta application</SheetDescription>
        </SheetHeader>

        {/* Logo row */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-foreground">ThreatAlert</span>
              <Badge
                variant="outline"
                className="border-amber-500/50 bg-amber-500/10 text-[10px] font-bold uppercase tracking-wider text-amber-500"
              >
                Beta
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Community safety — early access</p>
          </div>
        </div>

        <Separator className="mb-4" />

        <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
          This is an early beta. Your feedback shapes what it becomes. This app is available as PWA, you can always just click Install App for better experience. 
        </p>

        {/* Feature bullets */}
        <div className="mb-5 space-y-2.5">
          {[
            {
              icon: <Zap className="h-3.5 w-3.5" />,
              color: "text-amber-500 bg-amber-500/10",
              text: "Reports are community-verified — not moderated by us",
            },
            {
              icon: <Lock className="h-3.5 w-3.5" />,
              color: "text-blue-400 bg-blue-400/10",
              text: "Fully anonymous — no account, no tracking, no ads",
            },
            {
              icon: <Shield className="h-3.5 w-3.5" />,
              color: "text-primary bg-primary/10",
              text: "Incidents need multiple confirmations before going live",
            },
          ].map(({ icon, color, text }) => (
            <div key={text} className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${color}`}
              >
                {icon}
              </span>
              <span className="text-sm text-foreground/80">{text}</span>
            </div>
          ))}
        </div>

        <Button
          onClick={dismiss}
          className="w-full gap-2 rounded-xl py-5 text-sm font-semibold"
          style={{ boxShadow: "0 4px 24px rgba(229,77,66,0.3)" }}
        >
          Got it — let's go
          <ArrowRight className="h-4 w-4" />
        </Button>
      </SheetContent>
    </Sheet>
  )
}
