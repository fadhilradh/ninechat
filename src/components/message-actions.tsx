import { GitBranch, Pencil, RefreshCw, Trash2 } from "lucide-react"

import { CopyButton } from "./copy-button"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Message } from "@/lib/types"

interface MessageActionsProps {
  message: Message
  busy: boolean
  onEdit?: () => void
  onRegenerate?: () => void
  onDelete: () => void
  onFork: () => void
}

function IconAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="iconSm"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className="text-muted-foreground hover:text-foreground"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * The row of controls under a message. Hidden until the message is hovered or
 * focused so a long transcript stays quiet.
 */
export function MessageActions({
  message,
  busy,
  onEdit,
  onRegenerate,
  onDelete,
  onFork,
}: MessageActionsProps) {
  return (
    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
      <CopyButton value={message.content} />

      {onRegenerate ? (
        <IconAction label="Regenerate" onClick={onRegenerate} disabled={busy}>
          <RefreshCw />
        </IconAction>
      ) : null}

      {onEdit ? (
        <IconAction label="Edit and resend" onClick={onEdit} disabled={busy}>
          <Pencil />
        </IconAction>
      ) : null}

      <IconAction label="Branch a new chat from here" onClick={onFork} disabled={busy}>
        <GitBranch />
      </IconAction>

      <IconAction label="Delete message" onClick={onDelete} disabled={busy}>
        <Trash2 />
      </IconAction>
    </div>
  )
}
