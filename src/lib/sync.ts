import * as db from "./db"
import type { Message, Session } from "./types"

/**
 * Two-way sync between this browser and your account.
 *
 * The browser stays the source of truth. The server holds a copy per chat so
 * another device can pick it up, and reconciliation is a straight comparison
 * of `updatedAt` per chat id -- newer wins, whole chat at a time. That is
 * coarse on purpose: the alternative is merging two divergent message lists,
 * which costs real complexity to fix a case (two devices, same chat, between
 * syncs) that barely happens and whose loser is a chat you were not looking at.
 *
 * Guests never reach any of this; nothing runs until there is a session.
 */

interface RemoteSession extends Session {
  deletedAt?: number
}

export interface SyncResult {
  pulled: number
  pushed: number
  removed: number
}

const EMPTY: SyncResult = { pulled: 0, pushed: 0, removed: 0 }

/** Thrown for anything the caller might want to show; everything else is swallowed. */
export class SyncError extends Error {}

async function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  })
}

/**
 * Attachment bytes are never uploaded -- they dwarf the conversation and this
 * is a free site anyone can sign up to. The metadata goes, so another device
 * can show that an image was part of the exchange.
 */
function withoutImageData(messages: Message[]): Message[] {
  return messages.map((message) =>
    message.attachments.length === 0
      ? message
      : {
          ...message,
          attachments: message.attachments.map((file) => ({ ...file, dataUrl: "" })),
        }
  )
}

/**
 * Keeps images alive on the device that picked them. A pulled message carries
 * attachment stubs; if this browser already holds the bytes for the same
 * attachment, they survive the pull.
 */
function restoreLocalImages(incoming: Message[], existing: Message[]): Message[] {
  if (existing.length === 0) return incoming
  const known = new Map(existing.map((message) => [message.id, message]))

  return incoming.map((message) => {
    if (message.attachments.every((file) => file.dataUrl !== "")) return message
    const local = known.get(message.id)
    if (!local) return message

    const bytes = new Map(local.attachments.map((file) => [file.id, file.dataUrl]))
    return {
      ...message,
      attachments: message.attachments.map((file) =>
        file.dataUrl === "" ? { ...file, dataUrl: bytes.get(file.id) ?? "" } : file
      ),
    }
  })
}

async function pull(id: string): Promise<boolean> {
  const response = await api(`/api/chats/${id}`)
  if (!response.ok) return false

  const body = (await response.json()) as { session: RemoteSession; messages: Message[] }
  const existing = await db.listMessages(id)
  const messages = restoreLocalImages(body.messages, existing)

  await db.withoutNotifying(async () => {
    const { deletedAt: _ignored, ...session } = body.session
    await db.putSession(session)
    await db.replaceSessionMessages(id, messages)
  })
  return true
}

async function push(session: Session): Promise<boolean> {
  const messages = withoutImageData(await db.listMessages(session.id))
  const response = await api(`/api/chats/${session.id}`, {
    method: "PUT",
    body: JSON.stringify({ session, messages }),
  })

  if (response.status === 409 || response.status === 413) {
    const body = (await response.json().catch(() => ({}))) as { error?: string }
    throw new SyncError(body.error ?? "That chat could not be saved to your account")
  }
  return response.ok
}

async function drainDeletes(): Promise<number> {
  const queued = db.pendingDeletes()
  if (queued.length === 0) return 0

  const settled: string[] = []
  for (const id of queued) {
    const response = await api(`/api/chats/${id}`, { method: "DELETE" })
    if (response.ok) settled.push(id)
  }
  db.forgetPendingDeletes(settled)
  return settled.length
}

/**
 * One full reconciliation. Safe to call often -- the index is metadata only,
 * and nothing transfers unless a timestamp actually differs.
 *
 * Returns null when there is nothing to sync with: signed out, or a deploy
 * with no database. Callers treat that as "carry on locally", not an error.
 */
export async function syncNow(): Promise<SyncResult | null> {
  const index = await api("/api/chats")
  if (index.status === 401 || index.status === 503) return null
  if (!index.ok) throw new SyncError("Could not reach your chat history")

  const { sessions: remote } = (await index.json()) as { sessions: RemoteSession[] }
  const local = await db.listSessions()

  const remoteById = new Map(remote.map((session) => [session.id, session]))
  const localById = new Map(local.map((session) => [session.id, session]))

  const result: SyncResult = { ...EMPTY }

  for (const entry of remote) {
    const mine = localById.get(entry.id)

    if (entry.deletedAt) {
      // Deleted on another device. Delete it here without re-queueing the
      // tombstone we are already acting on.
      if (mine) {
        await db.withoutNotifying(() => db.deleteSession(entry.id))
        result.removed += 1
      }
      continue
    }

    if (!mine || entry.updatedAt > mine.updatedAt) {
      if (await pull(entry.id)) result.pulled += 1
    }
  }

  for (const mine of local) {
    const theirs = remoteById.get(mine.id)
    if (theirs?.deletedAt) continue
    if (!theirs || mine.updatedAt > theirs.updatedAt) {
      if (await push(mine)) result.pushed += 1
    }
  }

  result.removed += await drainDeletes()
  return result
}
