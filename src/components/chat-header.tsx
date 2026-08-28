import { PanelLeft, Settings2, SlidersHorizontal } from "lucide-react"

import { ModelPicker } from "./model-picker"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import type { ModelInfo, Session } from "@/lib/types"

interface ChatHeaderProps {
  session: Session | undefined
  models: ModelInfo[]
  modelsLoading: boolean
  modelsError: string | null
  onReloadModels: () => void
  onPatchSession: (patch: Partial<Session>) => void
  onToggleSidebar: () => void
  onOpenSettings: () => void
}

/**
 * Per-chat controls. These override the global defaults for this conversation
 * only, which is what you want when one chat needs a colder model than the rest.
 */
export function ChatHeader({
  session,
  models,
  modelsLoading,
  modelsError,
  onReloadModels,
  onPatchSession,
  onToggleSidebar,
  onOpenSettings,
}: ChatHeaderProps) {
  return (
    <header className="flex items-center gap-2 border-b px-3 py-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleSidebar}
        aria-label="Toggle chat list"
        className="text-muted-foreground lg:hidden"
      >
        <PanelLeft />
      </Button>

      <h1 className="min-w-0 flex-1 truncate text-sm font-medium">
        {session?.title ?? "Nine AI"}
      </h1>

      {session ? (
        <>
          <ModelPicker
            value={session.model}
            models={models}
            loading={modelsLoading}
            error={modelsError}
            onChange={(model) => onPatchSession({ model })}
            onReload={onReloadModels}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Chat options">
                <SlidersHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-3">
              <DropdownMenuLabel className="px-0 pt-0">This chat only</DropdownMenuLabel>
              <DropdownMenuSeparator />

              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="chat-system-prompt" className="text-xs">
                    System prompt
                  </Label>
                  <Textarea
                    id="chat-system-prompt"
                    rows={4}
                    value={session.systemPrompt}
                    placeholder="Steer the assistant for this conversation."
                    onChange={(event) => onPatchSession({ systemPrompt: event.target.value })}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="chat-temperature" className="text-xs">
                      Temperature
                    </Label>
                    <span className="font-mono text-xs text-muted-foreground">
                      {session.temperature.toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    id="chat-temperature"
                    min={0}
                    max={2}
                    step={0.05}
                    value={[session.temperature]}
                    onValueChange={([next]) => onPatchSession({ temperature: next ?? 0.7 })}
                  />
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : null}

      <Button variant="ghost" size="icon" onClick={onOpenSettings} aria-label="Settings">
        <Settings2 />
      </Button>
    </header>
  )
}
