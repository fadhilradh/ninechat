import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { ChatHeader } from "@/components/chat-header"
import { Composer } from "@/components/composer"
import { EmptyState } from "@/components/empty-state"
import { SettingsDialog } from "@/components/settings-dialog"
import { Sidebar } from "@/components/sidebar"
import { Transcript } from "@/components/transcript"
import { Button } from "@/components/ui/button"
import { useChat } from "@/hooks/use-chat"
import { useModels } from "@/hooks/use-models"
import { useSessions } from "@/hooks/use-sessions"
import { useSettings } from "@/hooks/use-settings"
import { fetchHealth } from "@/lib/api"
import type { Attachment } from "@/lib/types"

export function ChatPage() {
  const { settings, ready: settingsReady, update } = useSettings()
  const sessions = useSessions()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  /** Starter prompts prefill the composer; they are not sent for you. */
  const [composerSeed, setComposerSeed] = useState<string | null>(null)
  /** A message typed before any chat existed, waiting for one to be created. */
  const [pendingSend, setPendingSend] = useState<string | null>(null)

  const models = useModels(settings, settingsReady)
  const chat = useChat({ session: sessions.active, onSessionChanged: sessions.refresh })

  // Adopt the deploy's own gateway settings the first time we run, so a fresh
  // browser is not left staring at an empty picker -- and so flipping to
  // Direct mode points at the same gateway the site uses, rather than a
  // hard-coded guess the user then has to correct.
  const seededDefault = useRef(false)
  useEffect(() => {
    if (!settingsReady || seededDefault.current || settings.defaultModel) return
    seededDefault.current = true
    void fetchHealth(settings).then((health) => {
      if (!health) return
      update({
        ...(health.defaultModel ? { defaultModel: health.defaultModel } : {}),
        ...(health.baseUrl ? { directBaseUrl: health.baseUrl } : {}),
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsReady, settings.defaultModel])

  // A chat with no model cannot send anything; fill it from the defaults, or
  // from whatever the gateway offered first.
  const activeId = sessions.activeId
  const activeModel = sessions.active?.model
  const patchSession = sessions.patch
  const firstModelId = models.models[0]?.id
  useEffect(() => {
    if (!activeId || activeModel) return
    const fallback = settings.defaultModel || firstModelId
    if (fallback) void patchSession(activeId, { model: fallback })
  }, [activeId, activeModel, settings.defaultModel, firstModelId, patchSession])

  const createSession = sessions.create
  const startChat = useCallback(
    async (prompt?: string) => {
      await createSession(settings)
      if (prompt) setComposerSeed(prompt)
    },
    [createSession, settings]
  )

  async function handleSend(text: string, attachments: Attachment[]) {
    if (!sessions.active) {
      // Attachments cannot survive the hop, so only bare text is queued --
      // and the composer only reaches here with text when nothing is attached.
      await createSession(settings)
      setPendingSend(text)
      return
    }
    await chat.send(text, attachments)
  }

  const hasMessages = chat.messages.length > 0

  return (
    <div className="flex h-full min-h-0">
      <Sidebar
        sessions={sessions.sessions}
        activeId={sessions.activeId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNew={() => void startChat()}
        onSelect={sessions.select}
        onRename={(id, title) => void sessions.rename(id, title)}
        onDelete={(id) => {
          void sessions.remove(id)
          toast.success("Chat deleted")
        }}
        onTogglePin={(id) => void sessions.togglePin(id)}
        footer={
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={() => setSettingsOpen(true)}
          >
            Settings and gateway
          </Button>
        }
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <ChatHeader
          session={sessions.active}
          models={models.models}
          modelsLoading={models.loading}
          modelsError={models.error}
          onReloadModels={models.reload}
          onPatchSession={(patch) => {
            if (sessions.activeId) void sessions.patch(sessions.activeId, patch)
          }}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        {hasMessages ? (
          <Transcript
            messages={chat.messages}
            streamingId={chat.streamingId}
            busy={chat.busy}
            onRegenerate={(id) => void chat.regenerate(id)}
            onEdit={(id, text) => void chat.editAndResend(id, text)}
            onDelete={(id) => void chat.remove(id)}
            onFork={(id) => {
              if (sessions.activeId) void sessions.fork(sessions.activeId, id)
            }}
          />
        ) : (
          <div className="min-h-0 flex-1">
            <EmptyState onStart={(prompt) => void startChat(prompt)} />
          </div>
        )}

        <div className="mx-auto w-full max-w-3xl px-4 pb-4">
          <Composer
            disabled={!settingsReady}
            busy={chat.busy}
            sendOnEnter={settings.sendOnEnter}
            seedText={composerSeed}
            onSeedConsumed={() => setComposerSeed(null)}
            onSend={(text, attachments) => void handleSend(text, attachments)}
            onStop={chat.stop}
          />
        </div>
      </div>

      <SettingsDialog
        open={settingsOpen}
        settings={settings}
        onOpenChange={setSettingsOpen}
        onUpdate={update}
        onCleared={() => void sessions.refresh()}
      />

      <DeferredSend
        text={pendingSend}
        ready={Boolean(sessions.active?.model)}
        onSend={(text) => {
          setPendingSend(null)
          void chat.send(text, [])
        }}
      />
    </div>
  )
}

/**
 * Bridges "type first, chat second": a session only exists on the render after
 * it is created, so the queued message waits here until it has somewhere to go.
 */
function DeferredSend({
  text,
  ready,
  onSend,
}: {
  text: string | null
  ready: boolean
  onSend: (text: string) => void
}) {
  useEffect(() => {
    if (text && ready) onSend(text)
  }, [text, ready, onSend])
  return null
}
