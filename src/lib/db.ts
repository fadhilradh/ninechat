import { openDB, type DBSchema, type IDBPDatabase } from "idb"

import { DEFAULT_SETTINGS, type AppSettings, type Message, type Session } from "./types"

/**
 * Everything the user types lives in their own browser first. That is a
 * deliberate choice for a site anyone can hit on a public URL: guests need no
 * account, and nothing they type touches a server beyond the model call.
 *
 * Signing in adds a copy on the server so a chat can follow you to another
 * device -- see lib/sync.ts. This module stays the source of truth either way;
 * it just announces its writes so the sync loop knows there is something to
 * send.
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

// --- change notification ---------------------------------------------------

export const LOCAL_CHANGE_EVENT = "openchat:local-change"

let muted = 0

/**
 * Pulling from the server writes through these same functions, and a push
 * fired by a pull is a loop. Sync wraps its writes in this.
 */
export async function withoutNotifying<T>(work: () => Promise<T>): Promise<T> {
  muted += 1
  try {
    return await work()
  } finally {
    muted -= 1
  }
}

function notifyChanged(sessionId?: string): void {
  if (muted > 0 || typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(LOCAL_CHANGE_EVENT, { detail: { sessionId } }))
}

// --- delete queue ----------------------------------------------------------

/**
 * A chat deleted here has to be deleted on your other devices too, and the
 * only way they find out is a tombstone on the server. Recording the id at the
 * point of deletion -- rather than at the call site -- means every path that
 * removes a chat is covered, including "clear everything".
 *
 * Harmless while signed out: sync drains the queue against ids the server
 * never had, which does nothing.
 */
const DELETE_QUEUE_KEY = "openchat:pending-deletes"
const DELETE_QUEUE_MAX = 200

export function pendingDeletes(): string[] {
  try {
    const raw = localStorage.getItem(DELETE_QUEUE_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function queueDeletes(ids: string[]): void {
  if (ids.length === 0 || typeof localStorage === "undefined") return
  const merged = [...new Set([...pendingDeletes(), ...ids])].slice(-DELETE_QUEUE_MAX)
  localStorage.setItem(DELETE_QUEUE_KEY, JSON.stringify(merged))
}

export function forgetPendingDeletes(ids: string[]): void {
  if (ids.length === 0 || typeof localStorage === "undefined") return
  const done = new Set(ids)
  localStorage.setItem(
    DELETE_QUEUE_KEY,
    JSON.stringify(pendingDeletes().filter((id) => !done.has(id)))
  )
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
  notifyChanged(session.id)
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
  if (muted === 0) queueDeletes([id])
  notifyChanged(id)
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
  notifyChanged(message.sessionId)
}

export async function deleteMessages(ids: string[]): Promise<void> {
  const database = await db()
  const tx = database.transaction("messages", "readwrite")
  await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done])
  notifyChanged()
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
  queueDeletes((await database.getAllKeys("sessions")) as string[])
  const tx = database.transaction(["sessions", "messages"], "readwrite")
  await Promise.all([tx.objectStore("sessions").clear(), tx.objectStore("messages").clear(), tx.done])
  notifyChanged()
}

/**
 * Swaps a chat's messages for the server's copy. Used by sync only -- the
 * message ids are stable, so this is a replace rather than a merge.
 */
export async function replaceSessionMessages(
  sessionId: string,
  messages: Message[]
): Promise<void> {
  const database = await db()
  const stale = await database.getAllKeysFromIndex("messages", "bySession", sessionId)
  const tx = database.transaction("messages", "readwrite")
  await Promise.all([
    ...stale.map((key) => tx.store.delete(key)),
    ...messages.map((message) => tx.store.put(message)),
    tx.done,
  ])
}
