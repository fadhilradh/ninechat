import { useCallback, useEffect, useRef, useState } from "react"
import { ImagePlus, Loader2, Send, Square, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ACCEPTED_IMAGE_TYPES, fileToAttachment, formatBytes, imagesFromClipboard } from "@/lib/image"
import type { Attachment } from "@/lib/types"
import { cn } from "@/lib/utils"

interface ComposerProps {
  disabled: boolean
  busy: boolean
  sendOnEnter: boolean
  /** Drops text into the box without sending it, e.g. from a starter prompt. */
  seedText?: string | null
  onSeedConsumed?: () => void
  onSend: (text: string, attachments: Attachment[]) => void
  onStop: () => void
}

const MAX_ATTACHMENTS = 6

export function Composer({
  disabled,
  busy,
  sendOnEnter,
  seedText,
  onSeedConsumed,
  onSend,
  onStop,
}: ComposerProps) {
  const [text, setText] = useState("")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [processing, setProcessing] = useState(0)
  const [dragging, setDragging] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)

  useEffect(() => {
    if (!seedText) return
    setText(seedText)
    onSeedConsumed?.()
    const textarea = textareaRef.current
    if (textarea) {
      textarea.focus()
      textarea.setSelectionRange(seedText.length, seedText.length)
    }
    // Firing only when a new seed arrives is the whole point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedText])

  // Grow with the content up to a ceiling, then scroll inside the box.
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = "auto"
    textarea.style.height = `${Math.min(textarea.scrollHeight, 260)}px`
  }, [text])

  const addFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return

      const room = MAX_ATTACHMENTS - attachments.length
      if (room <= 0) {
        toast.error(`That is the limit of ${MAX_ATTACHMENTS} images per message.`)
        return
      }

      const accepted = files.slice(0, room)
      if (files.length > room) {
        toast.warning(`Only the first ${room} image${room === 1 ? "" : "s"} were added.`)
      }

      setProcessing((count) => count + accepted.length)
      const results = await Promise.allSettled(accepted.map(fileToAttachment))
      setProcessing((count) => count - accepted.length)

      const ready: Attachment[] = []
      for (const result of results) {
        if (result.status === "fulfilled") ready.push(result.value)
        else toast.error(result.reason?.message ?? "Could not read that image")
      }
      if (ready.length) setAttachments((current) => [...current, ...ready])
    },
    [attachments.length]
  )

  function submit() {
    if (disabled || busy || processing > 0) return
    if (!text.trim() && attachments.length === 0) return
    onSend(text, attachments)
    setText("")
    setAttachments([])
    textareaRef.current?.focus()
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const modifierSend = event.key === "Enter" && (event.metaKey || event.ctrlKey)
    const plainSend = event.key === "Enter" && !event.shiftKey && sendOnEnter

    if (modifierSend || plainSend) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div
      onDragEnter={(event) => {
        event.preventDefault()
        dragDepth.current += 1
        setDragging(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => {
        dragDepth.current -= 1
        if (dragDepth.current <= 0) setDragging(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        dragDepth.current = 0
        setDragging(false)
        void addFiles(Array.from(event.dataTransfer.files).filter((f) => f.type.startsWith("image/")))
      }}
      className={cn(
        "relative rounded-xl border bg-card shadow-sm transition-colors",
        dragging && "border-primary ring-1 ring-primary"
      )}
    >
      {dragging ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/85 text-sm font-medium">
          Drop images to attach
        </div>
      ) : null}

      {attachments.length > 0 || processing > 0 ? (
        <div className="flex flex-wrap gap-2 border-b p-3">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="group relative">
              <img
                src={attachment.dataUrl}
                alt={attachment.name}
                className="h-16 w-16 rounded-md border object-cover"
              />
              <button
                type="button"
                aria-label={`Remove ${attachment.name}`}
                onClick={() =>
                  setAttachments((current) => current.filter((a) => a.id !== attachment.id))
                }
                className="absolute -right-1.5 -top-1.5 rounded-full border bg-background p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
              <span className="absolute inset-x-0 bottom-0 rounded-b-md bg-black/60 px-1 text-center text-[9px] text-white">
                {formatBytes(attachment.size)}
              </span>
            </div>
          ))}
          {Array.from({ length: processing }).map((_, index) => (
            <div
              key={`pending-${index}`}
              className="flex h-16 w-16 items-center justify-center rounded-md border bg-muted"
            >
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex items-end gap-2 p-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          multiple
          hidden
          onChange={(event) => {
            void addFiles(Array.from(event.target.files ?? []))
            event.target.value = ""
          }}
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-label="Attach images"
          onClick={() => fileInputRef.current?.click()}
          className="text-muted-foreground hover:text-foreground"
        >
          <ImagePlus />
        </Button>

        <Textarea
          ref={textareaRef}
          value={text}
          rows={1}
          disabled={disabled}
          placeholder={disabled ? "Start a new chat to begin" : "Send a message, or paste an image"}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          onPaste={(event) => {
            const images = imagesFromClipboard(event.clipboardData.items)
            if (images.length === 0) return
            event.preventDefault()
            void addFiles(images)
          }}
          className="min-h-[38px] resize-none border-0 bg-transparent px-1 py-2 text-sm shadow-none focus-visible:ring-0 md:text-sm"
        />

        {busy ? (
          <Button type="button" variant="secondary" size="icon" onClick={onStop} aria-label="Stop">
            <Square className="fill-current" />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            aria-label="Send"
            onClick={submit}
            disabled={disabled || processing > 0 || (!text.trim() && attachments.length === 0)}
          >
            <Send />
          </Button>
        )}
      </div>

      <p className="px-3 pb-2 text-[11px] text-muted-foreground">
        {sendOnEnter ? "Enter sends, Shift+Enter for a new line." : "Ctrl+Enter sends."} Images are
        resized in your browser before they are sent.
      </p>
    </div>
  )
}
