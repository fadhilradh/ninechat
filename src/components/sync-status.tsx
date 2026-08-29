import { Link } from "react-router-dom"
import { CloudOff, Loader2, RefreshCw, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatRelativeTime } from "@/lib/api"
import type { SyncState } from "@/hooks/use-sync"

/**
 * Says where the chats actually live, which changes depending on whether you
 * are signed in. Guests are told the truth rather than nudged: local-only is a
 * legitimate way to use this.
 */
export function SyncStatus({ sync, signedIn }: { sync: SyncState; signedIn: boolean }) {
  if (!signedIn) {
    return (
      <p className="px-2 text-xs leading-relaxed text-muted-foreground">
        <CloudOff className="mr-1 inline h-3 w-3 align-[-2px]" />
        Saved in this browser.{" "}
        <Link to="/auth?mode=signup" className="text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>{" "}
        to keep them across devices.
      </p>
    )
  }

  if (sync.status === "error") {
    return (
      <div className="flex items-center gap-1 px-2 text-xs text-destructive">
        <TriangleAlert className="h-3 w-3 shrink-0" />
        <span className="min-w-0 flex-1 truncate">Not synced</span>
        <Button variant="ghost" size="icon-sm" onClick={sync.run} aria-label="Retry sync">
          <RefreshCw />
        </Button>
      </div>
    )
  }

  return (
    <p className="px-2 text-xs text-muted-foreground">
      {sync.status === "syncing" ? (
        <>
          <Loader2 className="mr-1 inline h-3 w-3 animate-spin align-[-2px]" />
          Syncing your chats...
        </>
      ) : sync.lastSyncedAt ? (
        <>Synced to your account {formatRelativeTime(sync.lastSyncedAt)}</>
      ) : (
        <>Saved to your account</>
      )}
    </p>
  )
}
