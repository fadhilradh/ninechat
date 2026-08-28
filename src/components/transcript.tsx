import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { ArrowDown } from "lucide-react"

import { MessageBubble } from "./message-bubble"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Message } from "@/lib/types"

interface TranscriptProps {
  messages: Message[]
  streamingId: string | null
  busy: boolean
  onRegenerate: (id: string) => void
  onEdit: (id: string, text: string) => void
  onDelete: (id: string) => void
  onFork: (id: string) => void
}

/** Treat "within this many pixels of the bottom" as still following the reply. */
const PIN_THRESHOLD = 80

export function Transcript({
  messages,
  streamingId,
  busy,
  onRegenerate,
  onEdit,
  onDelete,
  onFork,
}: TranscriptProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [pinned, setPinned] = useState(true)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.scrollTo({ top: viewport.scrollHeight, behavior })
  }, [])

  // Scrolling up during a stream should stop the view from yanking back down.
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    function onScroll() {
      const distance = viewport!.scrollHeight - viewport!.scrollTop - viewport!.clientHeight
      setPinned(distance <= PIN_THRESHOLD)
    }

    viewport.addEventListener("scroll", onScroll, { passive: true })
    return () => viewport.removeEventListener("scroll", onScroll)
  }, [])

  const lastContent = messages[messages.length - 1]?.content ?? ""

  useLayoutEffect(() => {
    if (pinned) scrollToBottom(streamingId ? "auto" : "smooth")
  }, [messages.length, lastContent, pinned, streamingId, scrollToBottom])

  return (
    <div className="relative min-h-0 flex-1">
      <ScrollArea className="h-full scrollbar-thin" viewportRef={viewportRef}>
        <div className="mx-auto max-w-3xl py-4">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              streaming={message.id === streamingId}
              busy={busy}
              onRegenerate={onRegenerate}
              onEdit={onEdit}
              onDelete={onDelete}
              onFork={onFork}
            />
          ))}
        </div>
      </ScrollArea>

      {!pinned ? (
        <Button
          size="icon"
          variant="secondary"
          onClick={() => scrollToBottom()}
          aria-label="Jump to the latest message"
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full shadow-lg"
        >
          <ArrowDown />
        </Button>
      ) : null}
    </div>
  )
}
