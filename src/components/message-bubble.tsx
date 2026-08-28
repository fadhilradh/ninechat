import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Bot, User } from "lucide-react"

import { AttachmentGrid } from "./attachment-grid"
import { Markdown } from "./markdown"
import { MessageActions } from "./message-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { Message } from "@/lib/types"
import { cn } from "@/lib/utils"

interface MessageBubbleProps {
  message: Message
  streaming: boolean
  busy: boolean
  onRegenerate: (id: string) => void
  onEdit: (id: string, text: string) => void
  onDelete: (id: string) => void
  onFork: (id: string) => void
}

function Avatar({ role }: { role: Message["role"] }) {
  const isUser = role === "user"
  return (
    <div
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
        isUser ? "bg-secondary text-secondary-foreground" : "bg-primary/10 text-primary"
      )}
    >
      {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
    </div>
  )
}

export function MessageBubble({
  message,
  streaming,
  busy,
  onRegenerate,
  onEdit,
  onDelete,
  onFork,
}: MessageBubbleProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.content)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const isUser = message.role === "user"

  useEffect(() => {
    if (!editing) return
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    editor.setSelectionRange(editor.value.length, editor.value.length)
  }, [editing])

  function beginEdit() {
    setDraft(message.content)
    setEditing(true)
  }

  function commitEdit() {
    const text = draft.trim()
    setEditing(false)
    if (text && text !== message.content) onEdit(message.id, text)
  }

  return (
    <article className="group flex gap-3 px-4 py-3">
      <Avatar role={message.role} />

      <div className="min-w-0 flex-1 space-y-2">
        <header className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{isUser ? "You" : "Assistant"}</span>
          {message.model && !isUser ? (
            <Badge variant="outline" className="font-mono text-[10px] font-normal">
              {message.model}
            </Badge>
          ) : null}
          {message.usage ? (
            <span title="prompt / completion tokens" className="tabular-nums">
              {message.usage.promptTokens} + {message.usage.completionTokens} tok
            </span>
          ) : null}
          {message.latencyMs && !streaming ? (
            <span className="tabular-nums">{(message.latencyMs / 1000).toFixed(1)}s</span>
          ) : null}
        </header>

        <AttachmentGrid attachments={message.attachments} />

        {editing ? (
          <div className="space-y-2">
            <Textarea
              ref={editorRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setEditing(false)
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) commitEdit()
              }}
              className="min-h-24 resize-y"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={commitEdit}>
                Resend
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <span className="text-xs text-muted-foreground">
                Everything after this message is replaced.
              </span>
            </div>
          </div>
        ) : (
          <div className="text-sm">
            {message.content ? (
              isUser ? (
                <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
              ) : (
                <Markdown content={message.content} />
              )
            ) : streaming ? (
              <span className="inline-flex gap-1">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    style={{ animationDelay: `${delay}ms` }}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
                  />
                ))}
              </span>
            ) : null}

            {streaming && message.content ? (
              <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-primary align-text-bottom" />
            ) : null}
          </div>
        )}

        {message.error ? (
          <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="space-y-1">
              <p className="font-medium">{message.error}</p>
              {message.hint ? (
                <p className="text-xs text-muted-foreground">{message.hint}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {!editing && !streaming ? (
          <MessageActions
            message={message}
            busy={busy}
            onEdit={isUser ? beginEdit : undefined}
            onRegenerate={isUser ? undefined : () => onRegenerate(message.id)}
            onDelete={() => onDelete(message.id)}
            onFork={() => onFork(message.id)}
          />
        ) : null}
      </div>
    </article>
  )
}
