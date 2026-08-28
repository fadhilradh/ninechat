import { useEffect, useState } from "react"
import { Check, Copy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CopyButtonProps {
  value: string
  className?: string
  label?: string
  variant?: "ghost" | "outline" | "secondary"
}

/**
 * Copies `value` and flips to a tick for a moment. Falls back to a hidden
 * textarea because the async clipboard API is unavailable on insecure origins
 * -- which includes a plain-HTTP LAN address.
 */
export function CopyButton({ value, className, label, variant = "ghost" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      } else {
        const scratch = document.createElement("textarea")
        scratch.value = value
        scratch.style.position = "fixed"
        scratch.style.opacity = "0"
        document.body.appendChild(scratch)
        scratch.select()
        document.execCommand("copy")
        document.body.removeChild(scratch)
      }
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={label ? "sm" : "iconSm"}
      onClick={copy}
      aria-label={copied ? "Copied" : "Copy"}
      className={cn("text-muted-foreground hover:text-foreground", className)}
    >
      {copied ? <Check className="text-emerald-500" /> : <Copy />}
      {label ? <span>{copied ? "Copied" : label}</span> : null}
    </Button>
  )
}
