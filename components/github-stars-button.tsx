"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

type Variant = "default" | "accent" | "outline" | "ghost"
type Size = "default" | "sm" | "lg"

interface GitHubStarsButtonProps
  extends Omit<React.ComponentPropsWithoutRef<typeof motion.a>, "href"> {
  username: string
  repo: string
  variant?: Variant
  size?: Size
  hoverScale?: number
  tapScale?: number
}

const variantClasses: Record<Variant, string> = {
  default:
    "bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80",
  accent:
    "bg-primary text-primary-foreground hover:bg-primary/90",
  outline:
    "bg-transparent border border-border text-foreground hover:bg-secondary",
  ghost:
    "bg-transparent text-foreground hover:bg-secondary border border-transparent",
}

const sizeClasses: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5",
  default: "h-8 px-3 text-sm gap-2",
  lg: "h-10 px-4 text-sm gap-2.5",
}

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export function GitHubStarsButton({
  username,
  repo,
  variant = "default",
  size = "default",
  hoverScale = 1.05,
  tapScale = 0.95,
  className,
  ...props
}: GitHubStarsButtonProps) {
  const [stars, setStars] = useState<number | null>(null)

  useEffect(() => {
    fetch(`https://api.github.com/repos/${username}/${repo}`)
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.stargazers_count === "number") {
          setStars(d.stargazers_count)
        }
      })
      .catch(() => {})
  }, [username, repo])

  return (
    <motion.a
      href={`https://github.com/${username}/${repo}`}
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ scale: hoverScale }}
      whileTap={{ scale: tapScale }}
      className={cn(
        "inline-flex items-center rounded-full font-medium transition-colors select-none",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {/* GitHub icon */}
      <svg
        viewBox="0 0 24 24"
        className={cn(
          "shrink-0 fill-current",
          size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4",
        )}
        aria-hidden="true"
      >
        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
      </svg>

      <span>Star</span>

      {/* Divider */}
      <span className="h-3.5 w-px bg-current opacity-20" />

      {/* Stars count */}
      <span className="tabular-nums">
        {stars === null ? (
          <span className="inline-block h-3 w-6 animate-pulse rounded bg-current opacity-20" />
        ) : (
          <>
            <Star
              className={cn(
                "mr-0.5 inline-block shrink-0",
                size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5",
              )}
              aria-hidden="true"
            />
            {formatStars(stars)}
          </>
        )}
      </span>
    </motion.a>
  )
}
