import { cn } from "@/lib/utils"

interface WordmarkProps {
  className?: string
  showTagline?: boolean
  size?: "sm" | "md" | "lg"
}

const SIZES = {
  sm: { mark: "h-6 w-6", text: "text-sm" },
  md: { mark: "h-8 w-8", text: "text-base" },
  lg: { mark: "h-11 w-11", text: "text-2xl" },
} as const

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" role="img" aria-label="Nine AI" className={className}>
      <defs>
        <linearGradient id="nine-ai-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(263 85% 68%)" />
          <stop offset="100%" stopColor="hsl(291 80% 58%)" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#nine-ai-mark)" />
      <circle cx="14" cy="14" r="2.4" fill="white" />
      <circle cx="24" cy="14" r="3.4" fill="white" />
      <circle cx="34" cy="14" r="2.4" fill="white" />
      <circle cx="14" cy="24" r="3.4" fill="white" />
      <circle cx="24" cy="24" r="5" fill="white" />
      <circle cx="34" cy="24" r="3.4" fill="white" />
      <circle cx="14" cy="34" r="2.4" fill="white" />
      <circle cx="24" cy="34" r="3.4" fill="white" />
      <circle cx="34" cy="34" r="2.4" fill="white" />
    </svg>
  )
}

export function Wordmark({ className, showTagline = false, size = "md" }: WordmarkProps) {
  const sizing = SIZES[size]
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className={cn(sizing.mark, "shrink-0 rounded-[28%]")} />
      <span className="min-w-0">
        <span className={cn("block font-semibold leading-tight tracking-tight", sizing.text)}>
          Nine AI
        </span>
        {showTagline ? (
          <span className="block text-[11px] leading-tight text-muted-foreground">
            Free Forever AI Chat
          </span>
        ) : null}
      </span>
    </span>
  )
}
