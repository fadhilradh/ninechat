import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { useSession } from "@/lib/auth-client"
import { LOCAL_CHANGE_EVENT } from "@/lib/db"
import { SyncError, syncNow } from "@/lib/sync"

export type SyncStatus = "off" | "idle" | "syncing" | "error"

export interface SyncState {
  status: SyncStatus
  lastSyncedAt: number | null
  error: string | null
  /** Force a round trip, e.g. from a "Sync now" button. */
  run: () => void
}

/** Long enough that a burst of writes becomes one push, short enough to feel live. */
const DEBOUNCE_MS = 2_000
/** A backstop for changes made in another tab or on another device. */
const POLL_MS = 60_000

/**
 * Keeps this browser and the signed-in account's chat history in step.
 *
 * Signed out, the whole thing is inert -- Open Chat works without an account,
 * and nothing about that path should depend on this hook.
 */
export function useSync(onChanged: () => void | Promise<void>): SyncState {
  const { data: session } = useSession()
  const userId = session?.user?.id ?? null

  const [status, setStatus] = useState<SyncStatus>("off")
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const running = useRef(false)
  const queued = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const changed = useRef(onChanged)
  changed.current = onChanged

  const run = useCallback(async () => {
    // One at a time. A request that arrives mid-run is remembered rather than
    // dropped, so the last local edit always makes it up.
    if (running.current) {
      queued.current = true
      return
    }
    running.current = true
    setStatus("syncing")

    try {
      const result = await syncNow()
      if (result === null) {
        setStatus("off")
        return
      }
      setLastSyncedAt(Date.now())
      setError(null)
      setStatus("idle")
      if (result.pulled > 0 || result.removed > 0) await changed.current()
    } catch (cause) {
      const message =
        cause instanceof SyncError ? cause.message : "Your chats could not be synced just now"
      setError(message)
      setStatus("error")
      // Only the ones the server chose to explain -- a flaky network should not
      // interrupt anyone.
      if (cause instanceof SyncError) toast.error(message)
    } finally {
      running.current = false
      if (queued.current) {
        queued.current = false
        void run()
      }
    }
  }, [])

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void run(), DEBOUNCE_MS)
  }, [run])

  useEffect(() => {
    if (!userId) {
      setStatus("off")
      setLastSyncedAt(null)
      setError(null)
      return
    }

    // Signing in is the moment history should appear, so this one is immediate.
    void run()

    const onLocalChange = () => schedule()
    const onVisible = () => {
      if (document.visibilityState === "visible") void run()
    }

    window.addEventListener(LOCAL_CHANGE_EVENT, onLocalChange)
    document.addEventListener("visibilitychange", onVisible)
    const poll = setInterval(() => void run(), POLL_MS)

    return () => {
      window.removeEventListener(LOCAL_CHANGE_EVENT, onLocalChange)
      document.removeEventListener("visibilitychange", onVisible)
      clearInterval(poll)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [userId, run, schedule])

  return { status, lastSyncedAt, error, run: () => void run() }
}
