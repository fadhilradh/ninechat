import { useMemo, useState } from "react"
import { Plus, Search, X } from "lucide-react"

import { SessionList } from "./session-list"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Wordmark } from "./wordmark"
import type { Session } from "@/lib/types"
import { cn } from "@/lib/utils"

interface SidebarProps {
  sessions: Session[]
  activeId: string | null
  open: boolean
  onClose: () => void
  onNew: () => void
  onSelect: (id: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  onTogglePin: (id: string) => void
  footer?: React.ReactNode
}

export function Sidebar({
  sessions,
  activeId,
  open,
  onClose,
  onNew,
  onSelect,
  onRename,
  onDelete,
  onTogglePin,
  footer,
}: SidebarProps) {
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return sessions
    return sessions.filter((session) => session.title.toLowerCase().includes(needle))
  }, [sessions, query])

  return (
    <>
      {open ? (
        <div
          onClick={onClose}
          aria-hidden
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r bg-card transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center gap-2 px-3 py-3">
          <Wordmark className="flex-1" />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close chat list"
            className="lg:hidden"
          >
            <X />
          </Button>
        </div>

        <div className="space-y-2 px-3 pb-2">
          <Button onClick={onNew} className="w-full justify-start">
            <Plus />
            New chat
          </Button>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              placeholder="Search chats"
              onChange={(event) => setQuery(event.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1 scrollbar-thin">
          <div className="py-1">
            <SessionList
              sessions={filtered}
              activeId={activeId}
              onSelect={(id) => {
                onSelect(id)
                onClose()
              }}
              onRename={onRename}
              onDelete={onDelete}
              onTogglePin={onTogglePin}
            />
          </div>
        </ScrollArea>

        {footer ? <div className="border-t p-3">{footer}</div> : null}
      </aside>
    </>
  )
}
