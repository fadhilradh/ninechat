import { openDB, type DBSchema, type IDBPDatabase } from "idb"

import { DEFAULT_SETTINGS, type AppSettings, type Message, type Session } from "./types"

/**
 * Everything the user types lives in their own browser. That is a deliberate
 * choice for a site anyone can hit on a public URL: no shared database, no
 * per-user auth to get wrong, and no transcripts sitting on a server.
 */
interface NinechatSchema extends DBSchema {
  sessions: {
    key: string
    value: Session
    indexes: { byUpdatedAt: number }
  }
  messages: {
    key: string
    value: Message
    indexes: { bySession: string }
  }
  settings: {
    key: string
    value: unknown
  }
}

// Deliberately not renamed with the product. The database name is invisible to
// users, and changing it would orphan every conversation already stored in a
// browser rather than migrating them.
const DB_NAME = "ninechat"
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<NinechatSchema>> | null = null

function db() {
  dbPromise ??= openDB<NinechatSchema>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      const sessions = database.createObjectStore("sessions", { keyPath: "id" })
      sessions.createIndex("byUpdatedAt", "updatedAt")

      const messages = database.createObjectStore("messages", { keyPath: "id" })
      messages.createIndex("bySession", "sessionId")

      database.createObjectStore("settings")
    },
  })
  return dbPromise
}

export function newId(): string {
  return crypto.randomUUID()
}

// --- sessions --------------------------------------------------------------

export async function listSessions(): Promise<Session[]> {
  const all = await (await db()).getAll("sessions")
  return all.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return b.updatedAt - a.updatedAt
  })
}

export async function getSession(id: string): Promise<Session | undefined> {
  return (await db()).get("sessions", id)
}

export async function putSession(session: Session): Promise<void> {
  await (await db()).put("sessions", session)
}

export async function createSession(init: Partial<Session> = {}): Promise<Session> {
  const now = Date.now()
  const session: Session = {
    id: newId(),
    title: "New chat",
    titleLocked: false,
    systemPrompt: "",
    temperature: 0.7,
    pinned: false,
    createdAt: now,
    updatedAt: now,
    ...init,
  }
  await putSession(session)
  return session
}

export async function deleteSession(id: string): Promise<void> {
  const database = await db()
  const tx = database.transaction(["sessions", "messages"], "readwrite")
  const messageIds = await tx.objectStore("messages").index("bySession").getAllKeys(id)
  await Promise.all([
    tx.objectStore("sessions").delete(id),
    ...messageIds.map((key) => tx.objectStore("messages").delete(key)),
    tx.done,
  ])
}

export async function renameSession(id: string, title: string): Promise<Session | undefined> {
  const session = await getSession(id)
  if (!session) return undefined
  const trimmed = title.trim().slice(0, 80)
  if (!trimmed) return session
  const updated: Session = {
    ...session,
    title: trimmed,
    titleLocked: true,
    updatedAt: Date.now(),
  }
  await putSession(updated)
  return updated
}

export async function touchSession(id: string, patch: Partial<Session> = {}): Promise<void> {
  const session = await getSession(id)
  if (!session) return
  await putSession({ ...session, ...patch, updatedAt: Date.now() })
}

// --- messages --------------------------------------------------------------

export async function listMessages(sessionId: string): Promise<Message[]> {
  const all = await (await db()).getAllFromIndex("messages", "bySession", sessionId)
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function putMessage(message: Message): Promise<void> {
  await (await db()).put("messages", message)
}

export async function deleteMessages(ids: string[]): Promise<void> {
  const database = await db()
  const tx = database.transaction("messages", "readwrite")
  await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done])
}

/** Duplicates a chat, including its history. Handy before trying a risky prompt. */
export async function forkSession(sessionId: string, upTo?: string): Promise<Session | undefined> {
  const source = await getSession(sessionId)
  if (!source) return undefined

  const messages = await listMessages(sessionId)
  const cutoff = upTo ? messages.findIndex((m) => m.id === upTo) : -1
  const kept = cutoff === -1 ? messages : messages.slice(0, cutoff + 1)

  const copy = await createSession({
    ...source,
    id: newId(),
    title: `${source.title} (copy)`,
    titleLocked: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })

  const database = await db()
  const tx = database.transaction("messages", "readwrite")
  await Promise.all([
    ...kept.map((m) => tx.store.put({ ...m, id: newId(), sessionId: copy.id })),
    tx.done,
  ])
  return copy
}

// --- settings --------------------------------------------------------------

export async function loadSettings(): Promise<AppSettings> {
  const stored = (await (await db()).get("settings", "app")) as Partial<AppSettings> | undefined
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await (await db()).put("settings", settings, "app")
}

/** Wipes every conversation. The Settings dialog confirms before calling this. */
export async function clearEverything(): Promise<void> {
  const database = await db()
  const tx = database.transaction(["sessions", "messages"], "readwrite")
  await Promise.all([tx.objectStore("sessions").clear(), tx.objectStore("messages").clear(), tx.done])
}
