import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface RenameDialogProps {
  open: boolean
  currentTitle: string
  onOpenChange: (open: boolean) => void
  onSubmit: (title: string) => void
}

export function RenameDialog({ open, currentTitle, onOpenChange, onSubmit }: RenameDialogProps) {
  const [title, setTitle] = useState(currentTitle)

  useEffect(() => {
    if (open) setTitle(currentTitle)
  }, [open, currentTitle])

  function submit() {
    const trimmed = title.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rename chat</DialogTitle>
          <DialogDescription>
            A renamed chat keeps its name -- automatic titling will not overwrite it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="chat-title">Title</Label>
          <Input
            id="chat-title"
            value={title}
            autoFocus
            maxLength={80}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit()
            }}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
