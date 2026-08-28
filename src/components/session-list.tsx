import { useState } from "react"
import { MessageSquare, MoreHorizontal, Pencil, Pin, PinOff, Trash2 } from "lucide-react"

import { ConfirmDialog } from "./confirm-dialog"
import { RenameDialog } from "./rename-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatRelativeTime } from "@/lib/api"
import type { Session } from "@/lib/types"
import { cn } from "@/lib/utils"

interface SessionListProps {
  sessions: Session[]
  activeId: string | null
  onSelect: (id: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  onTogglePin: (id: string) => void
}

export function SessionList({
  sessions,
  activeId,
  onSelect,
  onRename,
  onDelete,
  onTogglePin,
}: SessionListProps) {
  const [renaming, setRenaming] = useState<Session | null>(null)
  const [deleting, setDeleting] = useState<Session | null>(null)

  if (sessions.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-sm text-muted-foreground">
        No chats yet. Start one to see it here.
      </p>
    )
  }

  return (
    <>
      <ul className="space-y-0.5 px-2">
        {sessions.map((session) => {
          const active = session.id === activeId
          return (
            <li key={session.id}>
              <div
                className={cn(
                  "group flex items-center gap-1 rounded-lg pr-1 transition-colors",
                  active ? "bg-secondary" : "hover:bg-secondary/60"
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(session.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left focus-visible:outline-none"
                >
                  {session.pinned ? (
                    <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />
                  ) : (
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{session.title}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {formatRelativeTime(session.updatedAt)}
                    </span>
                  </span>
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Actions for ${session.title}`}
                      className={cn(
                        "shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100",
                        active && "opacity-100"
                      )}
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onSelect={() => setRenaming(session)}>
                      <Pencil />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onTogglePin(session.id)}>
                      {session.pinned ? <PinOff /> : <Pin />}
                      {session.pinned ? "Unpin" : "Pin to top"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => setDeleting(session)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          )
        })}
      </ul>

      <RenameDialog
        open={renaming !== null}
        currentTitle={renaming?.title ?? ""}
        onOpenChange={(open) => !open && setRenaming(null)}
        onSubmit={(title) => renaming && onRename(renaming.id, title)}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this chat?"
        description={`"${deleting?.title ?? ""}" and every message in it will be removed from this browser. This cannot be undone.`}
        confirmLabel="Delete"
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={() => deleting && onDelete(deleting.id)}
      />
    </>
  )
}
