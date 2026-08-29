import { Heart } from "lucide-react"

import { cn } from "@/lib/utils"

const GITHUB_URL = "https://github.com/fadhilradh"

/** Byline. Shown wherever there is a quiet corner for it. */
export function MadeBy({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-center justify-center gap-1.5 text-sm text-muted-foreground", className)}>
      Made with
      <Heart className="h-3.5 w-3.5 fill-primary text-primary" aria-label="love" />
      by
      <a
        href={GITHUB_URL}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-foreground underline-offset-4 hover:underline"
      >
        Fadhil Radhian
      </a>
    </p>
  )
}
