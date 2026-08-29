import { useEffect, useState } from "react"
import { CheckCircle2, XCircle } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "./confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { fetchHealth, type HealthReport } from "@/lib/api"
import { clearEverything } from "@/lib/db"
import type { AppSettings } from "@/lib/types"

interface SettingsDialogProps {
  open: boolean
  settings: AppSettings
  onOpenChange: (open: boolean) => void
  onUpdate: (patch: Partial<AppSettings>) => void
  onCleared: () => void
}

export function SettingsDialog({
  open,
  settings,
  onOpenChange,
  onUpdate,
  onCleared,
}: SettingsDialogProps) {
  const [health, setHealth] = useState<HealthReport | null>(null)
  const [checking, setChecking] = useState(false)
  const [confirmWipe, setConfirmWipe] = useState(false)

  useEffect(() => {
    if (!open) return
    setChecking(true)
    fetchHealth()
      .then(setHealth)
      .finally(() => setChecking(false))
  }, [open])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl gap-0 p-0">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Stored in this browser. There is nothing to configure to start chatting.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[65vh]">
            <div className="space-y-6 px-6 pb-6">
              <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs">
                {checking ? (
                  <span className="text-muted-foreground">Checking the service...</span>
                ) : health?.ok ? (
                  <>
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span>
                      Service is up
                      {health.latencyMs ? ` (${health.latencyMs}ms)` : ""}. Models are chosen
                      automatically for each message.
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <span>
                      The chat service is not responding right now. Nothing you have written is
                      lost -- try again in a moment.
                    </span>
                  </>
                )}
              </div>

              <Separator />

              <section className="space-y-4">
                <h3 className="text-sm font-semibold">Defaults for new chats</h3>

                <div className="space-y-2">
                  <Label htmlFor="system-prompt">System prompt</Label>
                  <Textarea
                    id="system-prompt"
                    value={settings.defaultSystemPrompt}
                    rows={3}
                    placeholder="e.g. Answer concisely. Prefer examples over prose."
                    onChange={(event) => onUpdate({ defaultSystemPrompt: event.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="temperature">Temperature</Label>
                    <span className="font-mono text-xs text-muted-foreground">
                      {settings.defaultTemperature.toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    id="temperature"
                    min={0}
                    max={2}
                    step={0.05}
                    value={[settings.defaultTemperature]}
                    onValueChange={([next]) => onUpdate({ defaultTemperature: next ?? 0.7 })}
                  />
                </div>
              </section>

              <Separator />

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Behaviour</h3>

                <label className="flex items-center justify-between gap-4 text-sm">
                  <span>
                    Enter sends the message
                    <span className="block text-xs text-muted-foreground">
                      Turn off to require Ctrl+Enter instead.
                    </span>
                  </span>
                  <Switch
                    checked={settings.sendOnEnter}
                    onCheckedChange={(checked) => onUpdate({ sendOnEnter: checked })}
                  />
                </label>

                <label className="flex items-center justify-between gap-4 text-sm">
                  <span>
                    Name chats automatically
                    <span className="block text-xs text-muted-foreground">
                      Uses one short extra request after the first reply.
                    </span>
                  </span>
                  <Switch
                    checked={settings.autoTitle}
                    onCheckedChange={(checked) => onUpdate({ autoTitle: checked })}
                  />
                </label>
              </section>

              <Separator />

              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-destructive">Danger zone</h3>
                <p className="text-xs text-muted-foreground">
                  Conversations live in this browser&apos;s storage, and in your account if you are signed in. Clearing them is permanent and
                  cannot be undone from another device.
                </p>
                <Button variant="destructive" size="sm" onClick={() => setConfirmWipe(true)}>
                  Delete all chats
                </Button>
              </section>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmWipe}
        title="Delete every chat?"
        description="Every conversation and attached image will be deleted from this browser, and from your account if you are signed in."
        confirmLabel="Delete everything"
        onOpenChange={setConfirmWipe}
        onConfirm={() => {
          void clearEverything().then(() => {
            onCleared()
            toast.success("All chats deleted")
          })
        }}
      />
    </>
  )
}
