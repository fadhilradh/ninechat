import { useState } from "react"
import { ImageOff } from "lucide-react"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { formatBytes } from "@/lib/image"
import type { Attachment } from "@/lib/types"
import { cn } from "@/lib/utils"

interface AttachmentGridProps {
  attachments: Attachment[]
  className?: string
}

export function AttachmentGrid({ attachments, className }: AttachmentGridProps) {
  const [preview, setPreview] = useState<Attachment | null>(null)

  if (attachments.length === 0) return null

  return (
    <>
      <div
        className={cn(
          "flex flex-wrap gap-2",
          attachments.length === 1 ? "max-w-sm" : "max-w-lg",
          className
        )}
      >
        {attachments.map((attachment) =>
          /* Images never leave the device that picked them, so a chat opened
             elsewhere carries the description without the bytes. */
          attachment.dataUrl === "" ? (
            <div
              key={attachment.id}
              title={`${attachment.name} - sent from another device`}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-2 text-center text-[10px] leading-tight text-muted-foreground",
                attachments.length === 1 ? "h-24 w-40" : "h-24 w-24"
              )}
            >
              <ImageOff className="h-4 w-4" />
              <span className="line-clamp-2">Image stayed on the device that sent it</span>
            </div>
          ) : (
            <button
              key={attachment.id}
              type="button"
              onClick={() => setPreview(attachment)}
              title={`${attachment.name} - ${attachment.width}x${attachment.height}, ${formatBytes(attachment.size)}`}
              className="group relative overflow-hidden rounded-lg border transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <img
                src={attachment.dataUrl}
                alt={attachment.name}
                loading="lazy"
                className={cn(
                  "object-cover",
                  attachments.length === 1 ? "max-h-64 w-auto" : "h-24 w-24"
                )}
              />
            </button>
          )
        )}
      </div>

      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-4xl border-none bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">{preview?.name ?? "Attachment"}</DialogTitle>
          {preview ? (
            <img
              src={preview.dataUrl}
              alt={preview.name}
              className="max-h-[80vh] w-full rounded-lg object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
