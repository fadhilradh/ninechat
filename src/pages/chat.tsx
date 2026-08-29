import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { ChatHeader } from "@/components/chat-header"
import { Composer } from "@/components/composer"
import { EmptyState } from "@/components/empty-state"
import { SettingsDialog } from "@/components/settings-dialog"
import { Sidebar } from "@/components/sidebar"
import { Transcript } from "@/components/transcript"
import { Button } from "@/components/ui/button"
import { useChat } from "@/hooks/use-chat"
import { useSessions } from "@/hooks/use-sessions"
import { useSettings } from "@/hooks/use-settings"
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

  const chat = useChat({ session: sessions.active, onSessionChanged: sessions.refresh })

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

        {/* Extra bottom clearance on small screens: Netlify's badge sits in the
            bottom-right corner and would otherwise overlap the send button. */}
        <div className="mx-auto w-full max-w-3xl px-4 pb-10 sm:pb-6">
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
        ready={Boolean(sessions.activeId)}
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
