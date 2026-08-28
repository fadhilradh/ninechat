import { useCallback, useEffect, useRef, useState } from "react"

import { streamChat, suggestTitle } from "@/lib/api"
import * as db from "@/lib/db"
import type { Attachment, Message, Session, Usage } from "@/lib/types"
import { useSettings } from "./use-settings"

export interface ChatState {
  messages: Message[]
  streamingId: string | null
  busy: boolean
  send: (text: string, attachments: Attachment[]) => Promise<void>
  stop: () => void
  regenerate: (assistantMessageId: string) => Promise<void>
  editAndResend: (userMessageId: string, text: string) => Promise<void>
  remove: (messageId: string) => Promise<void>
  clear: () => Promise<void>
}

interface Options {
  session: Session | undefined
  onSessionChanged: () => void
}

export function useChat({ session, onSessionChanged }: Options): ChatState {
  const { settings } = useSettings()
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const sessionId = session?.id ?? null

  // Reload the transcript whenever the user switches chats, and cancel any
  // reply still streaming into the chat we just left.
  useEffect(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStreamingId(null)

    if (!sessionId) {
      setMessages([])
      return
    }

    let cancelled = false
    void db.listMessages(sessionId).then((loaded) => {
      if (!cancelled) setMessages(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  useEffect(() => () => abortRef.current?.abort(), [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  /**
   * Runs one completion against `history` and streams it into a fresh
   * assistant message. Every entry point (send, regenerate, edit) funnels here
   * so the streaming, persistence and error handling stay in one place.
   */
  const runCompletion = useCallback(
    async (current: Session, history: Message[]) => {
      const assistant: Message = {
        id: db.newId(),
        sessionId: current.id,
        role: "assistant",
        content: "",
        attachments: [],
        createdAt: Date.now(),
        model: current.model,
      }

      setMessages([...history, assistant])
      setStreamingId(assistant.id)

      const controller = new AbortController()
      abortRef.current = controller
      const startedAt = performance.now()

      let content = ""
      let usage: Usage | undefined
      let failure: { error: string; hint?: string } | undefined

      try {
        for await (const event of streamChat({
          model: current.model,
          temperature: current.temperature,
          systemPrompt: current.systemPrompt,
          messages: history,
          settings,
          signal: controller.signal,
        })) {
          switch (event.type) {
            case "meta":
              // Arrives again mid-stream when a fallback model took over, so
              // this has to reach state rather than just the local object.
              assistant.model = event.model
              setMessages((prev) =>
                prev.map((m) => (m.id === assistant.id ? { ...m, model: event.model } : m))
              )
              break
            case "delta":
              content += event.text
              setMessages((prev) =>
                prev.map((m) => (m.id === assistant.id ? { ...m, content } : m))
              )
              break
            case "usage":
              usage = {
                promptTokens: event.promptTokens,
                completionTokens: event.completionTokens,
                totalTokens: event.totalTokens,
              }
              break
            case "error":
              failure = { error: event.error, hint: event.hint }
              break
            case "done":
              break
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          failure = { error: (err as Error)?.message ?? "Streaming failed" }
        }
      }

      const stopped = controller.signal.aborted
      abortRef.current = null
      setStreamingId(null)

      const finished: Message = {
        ...assistant,
        content: stopped && content ? `${content}\n\n_(stopped)_` : content,
        usage,
        latencyMs: Math.round(performance.now() - startedAt),
        ...(failure ?? {}),
      }

      // A cancelled reply with nothing in it is noise; drop it entirely.
      if (stopped && !content) {
        setMessages(history)
        return
      }

      setMessages([...history, finished])
      await db.putMessage(finished)
      await db.touchSession(current.id)
      onSessionChanged()

      if (settings.autoTitle && !current.titleLocked && !failure) {
        const transcript = [...history, finished]
        if (transcript.filter((m) => m.role !== "system").length >= 2) {
          const title = await suggestTitle(settings, current.model, transcript)
          if (title) {
            const latest = await db.getSession(current.id)
            if (latest && !latest.titleLocked) {
              await db.putSession({ ...latest, title })
              onSessionChanged()
            }
          }
        }
      }
    },
    [settings, onSessionChanged]
  )

  const send = useCallback(
    async (text: string, attachments: Attachment[]) => {
      if (!session) return
      if (!text.trim() && attachments.length === 0) return

      const userMessage: Message = {
        id: db.newId(),
        sessionId: session.id,
        role: "user",
        content: text.trim(),
        attachments,
        createdAt: Date.now(),
      }

      await db.putMessage(userMessage)
      const history = [...messages, userMessage]
      setMessages(history)
      await runCompletion(session, history)
    },
    [session, messages, runCompletion]
  )

  const regenerate = useCallback(
    async (assistantMessageId: string) => {
      if (!session) return
      const index = messages.findIndex((m) => m.id === assistantMessageId)
      if (index === -1) return

      // Drop the old answer and anything after it, then ask again from the
      // same point in the conversation.
      const dropped = messages.slice(index)
      const history = messages.slice(0, index)
      await db.deleteMessages(dropped.map((m) => m.id))
      setMessages(history)
      await runCompletion(session, history)
    },
    [session, messages, runCompletion]
  )

  const editAndResend = useCallback(
    async (userMessageId: string, text: string) => {
      if (!session) return
      const index = messages.findIndex((m) => m.id === userMessageId)
      if (index === -1) return

      const original = messages[index]
      const dropped = messages.slice(index)
      await db.deleteMessages(dropped.map((m) => m.id))

      const edited: Message = {
        ...original,
        id: db.newId(),
        content: text.trim(),
        createdAt: Date.now(),
      }
      await db.putMessage(edited)

      const history = [...messages.slice(0, index), edited]
      setMessages(history)
      await runCompletion(session, history)
    },
    [session, messages, runCompletion]
  )

  const remove = useCallback(
    async (messageId: string) => {
      await db.deleteMessages([messageId])
      setMessages((prev) => prev.filter((m) => m.id !== messageId))
      if (sessionId) await db.touchSession(sessionId)
      onSessionChanged()
    },
    [sessionId, onSessionChanged]
  )

  const clear = useCallback(async () => {
    if (!sessionId) return
    await db.deleteMessages(messages.map((m) => m.id))
    setMessages([])
    await db.touchSession(sessionId)
    onSessionChanged()
  }, [sessionId, messages, onSessionChanged])

  return {
    messages,
    streamingId,
    busy: streamingId !== null,
    send,
    stop,
    regenerate,
    editAndResend,
    remove,
    clear,
  }
}
