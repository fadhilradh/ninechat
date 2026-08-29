import { useEffect, useState } from "react"
import { CheckCircle2, Cloud, Laptop, XCircle } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { fetchHealth, type HealthReport } from "@/lib/api"
import { clearEverything } from "@/lib/db"
import type { AppSettings, TransportMode } from "@/lib/types"
import { cn } from "@/lib/utils"

interface SettingsDialogProps {
  open: boolean
  settings: AppSettings
  onOpenChange: (open: boolean) => void
  onUpdate: (patch: Partial<AppSettings>) => void
  onCleared: () => void
}

const TRANSPORTS: Array<{ id: TransportMode; icon: typeof Cloud; title: string; blurb: string }> = [
  {
    id: "proxy",
    icon: Cloud,
    title: "Via this site",
    blurb:
      "Requests go through the deployed function, which holds the gateway key. Use this when the gateway is reachable from the internet.",
  },
  {
    id: "direct",
    icon: Laptop,
    title: "Direct from browser",
    blurb:
      "Your browser calls the gateway itself, using a key you paste below. The only option that works with a gateway on your own machine.",
  },
]

function GatewayStatus({ checking, health }: { checking: boolean; health: HealthReport | null }) {
  if (checking) {
    return <span className="text-muted-foreground">Checking the gateway...</span>
  }
  if (health?.ok) {
    return (
      <>
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        <span>
          Gateway reachable at <code>{health.baseUrl}</code>
          {health.latencyMs ? ` (${health.latencyMs}ms)` : ""}.
        </span>
      </>
    )
  }
  return (
    <>
      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <span>
        {health?.reason === "no-key"
          ? "No gateway key is configured on the server. Paste your own below, or set GATEWAY_API_KEY on the deploy."
          : "The server could not reach the gateway. If yours runs on localhost, switch to Direct mode."}
      </span>
    </>
  )
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
    if (!open || settings.transport !== "proxy") {
      setHealth(null)
      return
    }
    setChecking(true)
    fetchHealth(settings)
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => setChecking(false))
    // Re-probing on every keystroke in the key field would be wasteful.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, settings.transport])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl gap-0 p-0">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Stored in this browser only. Nothing here is sent anywhere except the gateway you
              point it at.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[65vh]">
            <div className="space-y-6 px-6 pb-6">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">How requests reach the gateway</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {TRANSPORTS.map((transport) => {
                    const active = settings.transport === transport.id
                    const Icon = transport.icon
                    return (
                      <button
                        key={transport.id}
                        type="button"
                        onClick={() => onUpdate({ transport: transport.id })}
                        className={cn(
                          "rounded-lg border p-3 text-left transition-colors",
                          active ? "border-primary bg-primary/5" : "hover:border-muted-foreground/40"
                        )}
                      >
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <Icon className={cn("h-4 w-4", active && "text-primary")} />
                          {transport.title}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                          {transport.blurb}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {settings.transport === "proxy" ? (
                  <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-xs">
                    <GatewayStatus checking={checking} health={health} />
                  </div>
                ) : null}
              </section>

              <Separator />

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Gateway</h3>

                {settings.transport === "direct" ? (
                  <div className="space-y-2">
                    <Label htmlFor="base-url">Base URL</Label>
                    <Input
                      id="base-url"
                      value={settings.directBaseUrl}
                      placeholder="https://openrouter.ai/api/v1"
                      onChange={(event) => onUpdate({ directBaseUrl: event.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Any OpenAI-compatible endpoint. OpenRouter is
                      <code className="mx-1">https://openrouter.ai/api/v1</code>; a local 9Router
                      is <code className="mx-1">http://localhost:20128/v1</code>.
                    </p>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="api-key">
                    API key {settings.transport === "proxy" ? "(optional)" : ""}
                  </Label>
                  <Input
                    id="api-key"
                    type="password"
                    autoComplete="off"
                    value={settings.directApiKey}
                    placeholder="Paste a key for the gateway above"
                    onChange={(event) => onUpdate({ directApiKey: event.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {settings.transport === "proxy"
                      ? "Leave blank to use the key configured on the deploy. Set one to bill your own gateway account instead."
                      : "Required in Direct mode. Kept in this browser and sent only to the base URL above."}
                  </p>
                </div>
              </section>

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
                      Costs one short extra call after the first reply.
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
                  Conversations live in this browser&apos;s storage. Clearing them is permanent and
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
        description="All conversations and attached images will be removed from this browser."
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
