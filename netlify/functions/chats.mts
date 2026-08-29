import type { Config, Context } from "@netlify/functions"

import { auth, authEnabled } from "../lib/auth.js"
import { ensureSchema, pool } from "../lib/pg.js"
import { json } from "../lib/settings.js"

/**
 * Chat history for signed-in accounts.
 *
 *   GET    /api/chats       -> every chat you own, metadata only
 *   GET    /api/chats/:id   -> one chat with its messages
 *   PUT    /api/chats/:id   -> upsert a whole chat, last write wins
 *   DELETE /api/chats/:id   -> tombstone it for every device
 *
 * Deliberately a dumb mirror rather than a live backend: the browser stays the
 * source of truth and this is where a copy lands so another device can pick it
 * up. Guests never call any of it.
 *
 * Image attachments are *not* stored. They arrive as data URLs that dwarf the
 * conversation they belong to, and this is a free site anyone can sign up to --
 * so the metadata syncs and the bytes stay on the device that picked them.
 */

/** Enough for years of real use; low enough that one account cannot fill the disk. */
const MAX_SESSIONS = 300
const MAX_MESSAGES = 500
const MAX_CONTENT = 100_000
const MAX_BODY_BYTES = 1_000_000

interface WireAttachment {
  id: string
  name: string
  mime: string
  size: number
  width: number
  height: number
  dataUrl: string
}

interface WireMessage {
  id: string
  sessionId: string
  role: string
  content: string
  attachments: WireAttachment[]
  createdAt: number
  model?: string
  usage?: unknown
  latencyMs?: number
  error?: string
  hint?: string
}

interface WireSession {
  id: string
  title: string
  titleLocked: boolean
  systemPrompt: string
  temperature: number
  pinned: boolean
  createdAt: number
  updatedAt: number
  deletedAt?: number
}

function num(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function rowToSession(row: Record<string, unknown>): WireSession {
  return {
    id: String(row.id),
    title: String(row.title),
    titleLocked: Boolean(row.title_locked),
    systemPrompt: String(row.system_prompt ?? ""),
    temperature: num(row.temperature, 0.7),
    pinned: Boolean(row.pinned),
    createdAt: num(row.created_at, 0),
    updatedAt: num(row.updated_at, 0),
    ...(row.deleted_at === null || row.deleted_at === undefined
      ? {}
      : { deletedAt: num(row.deleted_at, 0) }),
  }
}

function rowToMessage(row: Record<string, unknown>): WireMessage {
  const meta = (row.meta ?? {}) as Record<string, unknown>
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    role: String(row.role),
    content: String(row.content ?? ""),
    attachments: Array.isArray(meta.attachments) ? (meta.attachments as WireAttachment[]) : [],
    createdAt: num(row.created_at, 0),
    ...(meta.model ? { model: String(meta.model) } : {}),
    ...(meta.usage ? { usage: meta.usage } : {}),
    ...(meta.latencyMs === undefined ? {} : { latencyMs: num(meta.latencyMs, 0) }),
    ...(meta.error ? { error: String(meta.error) } : {}),
    ...(meta.hint ? { hint: String(meta.hint) } : {}),
  }
}

export default async (request: Request, context: Context): Promise<Response> => {
  if (!authEnabled || !auth) {
    return json({ error: "Accounts are not configured on this deploy" }, 503)
  }

  const id = context.params.id ?? null

  try {
    await ensureSchema()

    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) return json({ error: "Sign in to sync your chats" }, 401)

    const userId = session.user.id

    if (request.method === "GET" && !id) return await listChats(userId)
    if (request.method === "GET") return await readChat(userId, id!)
    if (request.method === "PUT" && id) return await writeChat(userId, id, request)
    if (request.method === "DELETE" && id) return await tombstoneChat(userId, id)
    return json({ error: "Method not allowed" }, 405)
  } catch (error) {
    // The connection string and the driver's own messages are operator
    // business; the browser only needs to know the sync did not land.
    console.error("[chats]", error)
    return json({ error: "Could not reach your chat history right now" }, 502)
  }
}

/** Metadata only: the sync loop compares timestamps before pulling anything. */
async function listChats(userId: string): Promise<Response> {
  const { rows } = await pool().query(
    `SELECT id, title, title_locked, system_prompt, temperature, pinned,
            created_at, updated_at, deleted_at
       FROM chat_session
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT $2`,
    [userId, MAX_SESSIONS]
  )
  return json({ sessions: rows.map(rowToSession) })
}

async function readChat(userId: string, id: string): Promise<Response> {
  const client = pool()
  const found = await client.query(
    `SELECT id, title, title_locked, system_prompt, temperature, pinned,
            created_at, updated_at, deleted_at
       FROM chat_session
      WHERE user_id = $1 AND id = $2`,
    [userId, id]
  )
  if (found.rowCount === 0) return json({ error: "No such chat" }, 404)

  const messages = await client.query(
    `SELECT id, session_id, role, content, meta, created_at
       FROM chat_message
      WHERE user_id = $1 AND session_id = $2
      ORDER BY created_at ASC
      LIMIT $3`,
    [userId, id, MAX_MESSAGES]
  )

  return json({
    session: rowToSession(found.rows[0]),
    messages: messages.rows.map(rowToMessage),
  })
}

/**
 * Upsert, with the newer `updatedAt` winning outright. Two devices editing the
 * same chat between syncs is rare enough -- and the loser is a chat you were
 * not looking at -- that merging message-by-message would cost more complexity
 * than it buys.
 */
async function writeChat(userId: string, id: string, request: Request): Promise<Response> {
  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) {
    return json({ error: "That chat is too large to sync" }, 413)
  }

  let body: { session?: WireSession; messages?: WireMessage[] }
  try {
    body = JSON.parse(raw)
  } catch {
    return json({ error: "Malformed request" }, 400)
  }

  const incoming = body.session
  if (!incoming || incoming.id !== id) return json({ error: "Malformed request" }, 400)

  const messages = (body.messages ?? []).slice(0, MAX_MESSAGES)
  const client = await pool().connect()

  try {
    await client.query("BEGIN")

    const existing = await client.query(
      "SELECT updated_at FROM chat_session WHERE user_id = $1 AND id = $2",
      [userId, id]
    )

    if (existing.rowCount === 0) {
      const count = await client.query(
        "SELECT COUNT(*)::int AS n FROM chat_session WHERE user_id = $1 AND deleted_at IS NULL",
        [userId]
      )
      if (count.rows[0].n >= MAX_SESSIONS) {
        await client.query("ROLLBACK")
        return json(
          { error: `You have reached the limit of ${MAX_SESSIONS} saved chats. Delete a few to save more.` },
          409
        )
      }
    } else if (num(existing.rows[0].updated_at, 0) >= incoming.updatedAt) {
      // The server already has this or better. Nothing to do, and saying so
      // lets the client stop retrying.
      await client.query("ROLLBACK")
      return json({ stored: false, reason: "server-newer" })
    }

    await client.query(
      `INSERT INTO chat_session
         (id, user_id, title, title_locked, system_prompt, temperature, pinned,
          created_at, updated_at, deleted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         title_locked = EXCLUDED.title_locked,
         system_prompt = EXCLUDED.system_prompt,
         temperature = EXCLUDED.temperature,
         pinned = EXCLUDED.pinned,
         updated_at = EXCLUDED.updated_at,
         deleted_at = NULL`,
      [
        id,
        userId,
        String(incoming.title ?? "New chat").slice(0, 200),
        Boolean(incoming.titleLocked),
        String(incoming.systemPrompt ?? "").slice(0, MAX_CONTENT),
        num(incoming.temperature, 0.7),
        Boolean(incoming.pinned),
        num(incoming.createdAt, Date.now()),
        num(incoming.updatedAt, Date.now()),
      ]
    )

    // Replacing wholesale keeps deletes, edits and regenerates correct without
    // the client having to describe what changed.
    await client.query("DELETE FROM chat_message WHERE user_id = $1 AND session_id = $2", [
      userId,
      id,
    ])

    for (const message of messages) {
      const meta: Record<string, unknown> = {
        // Stubs, never bytes -- see the note at the top of this file.
        attachments: (message.attachments ?? []).map((file) => ({
          id: file.id,
          name: file.name,
          mime: file.mime,
          size: file.size,
          width: file.width,
          height: file.height,
          dataUrl: "",
        })),
      }
      if (message.model) meta.model = message.model
      if (message.usage) meta.usage = message.usage
      if (message.latencyMs !== undefined) meta.latencyMs = message.latencyMs
      if (message.error) meta.error = message.error
      if (message.hint) meta.hint = message.hint

      await client.query(
        `INSERT INTO chat_message (id, session_id, user_id, role, content, meta, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO NOTHING`,
        [
          message.id,
          id,
          userId,
          String(message.role ?? "user"),
          String(message.content ?? "").slice(0, MAX_CONTENT),
          JSON.stringify(meta),
          num(message.createdAt, Date.now()),
        ]
      )
    }

    await client.query("COMMIT")
    return json({ stored: true, messages: messages.length })
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

/**
 * A tombstone rather than a delete: your other devices only learn the chat is
 * gone by seeing the row. Messages go immediately, since nothing needs them.
 */
async function tombstoneChat(userId: string, id: string): Promise<Response> {
  const client = pool()
  await client.query("DELETE FROM chat_message WHERE user_id = $1 AND session_id = $2", [userId, id])
  await client.query(
    `UPDATE chat_session
        SET deleted_at = $3, updated_at = $3, title = '', system_prompt = ''
      WHERE user_id = $1 AND id = $2`,
    [userId, id, Date.now()]
  )
  return json({ deleted: true })
}

export const config: Config = { path: ["/api/chats", "/api/chats/:id"] }
