import { useCallback, useEffect, useState } from "react"

import * as db from "@/lib/db"
import type { AppSettings, Session } from "@/lib/types"

// Kept on the old key for the same reason as the database name; see lib/db.ts.
const LAST_SESSION_KEY = "ninechat:last-session"

export interface SessionsState {
  sessions: Session[]
  activeId: string | null
  active: Session | undefined
  ready: boolean
  select: (id: string | null) => void
  create: (settings: AppSettings) => Promise<Session>
  rename: (id: string, title: string) => Promise<void>
  remove: (id: string) => Promise<void>
  togglePin: (id: string) => Promise<void>
  patch: (id: string, patch: Partial<Session>) => Promise<void>
  fork: (id: string, upToMessageId?: string) => Promise<void>
  refresh: () => Promise<void>
}

export function useSessions(): SessionsState {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    setSessions(await db.listSessions())
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const list = await db.listSessions()
      if (cancelled) return
      setSessions(list)

      const remembered = localStorage.getItem(LAST_SESSION_KEY)
      const exists = list.some((s) => s.id === remembered)
      setActiveId(exists ? remembered : (list[0]?.id ?? null))
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const select = useCallback((id: string | null) => {
    setActiveId(id)
    if (id) localStorage.setItem(LAST_SESSION_KEY, id)
    else localStorage.removeItem(LAST_SESSION_KEY)
  }, [])

  const create = useCallback(
    async (settings: AppSettings) => {
      const session = await db.createSession({
        model: settings.defaultModel,
        systemPrompt: settings.defaultSystemPrompt,
        temperature: settings.defaultTemperature,
      })
      await refresh()
      select(session.id)
      return session
    },
    [refresh, select]
  )

  const rename = useCallback(
    async (id: string, title: string) => {
      await db.renameSession(id, title)
      await refresh()
    },
    [refresh]
  )

  const remove = useCallback(
    async (id: string) => {
      await db.deleteSession(id)
      const remaining = await db.listSessions()
      setSessions(remaining)
      if (activeId === id) select(remaining[0]?.id ?? null)
    },
    [activeId, select]
  )

  const togglePin = useCallback(
    async (id: string) => {
      const session = await db.getSession(id)
      if (!session) return
      await db.putSession({ ...session, pinned: !session.pinned })
      await refresh()
    },
    [refresh]
  )

  const patch = useCallback(
    async (id: string, next: Partial<Session>) => {
      await db.touchSession(id, next)
      await refresh()
    },
    [refresh]
  )

  const fork = useCallback(
    async (id: string, upToMessageId?: string) => {
      const copy = await db.forkSession(id, upToMessageId)
      await refresh()
      if (copy) select(copy.id)
    },
    [refresh, select]
  )

  return {
    sessions,
    activeId,
    active: sessions.find((s) => s.id === activeId),
    ready,
    select,
    create,
    rename,
    remove,
    togglePin,
    patch,
    fork,
    refresh,
  }
}
