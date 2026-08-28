import { useEffect } from "react"
import { useRegisterSW } from "virtual:pwa-register/react"
import { toast } from "sonner"

/**
 * The service worker caches the app shell, so a deploy would otherwise sit
 * unnoticed until the tab is closed. This offers the reload instead of forcing
 * one out from under whatever is being typed.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    if (!offlineReady) return
    toast.success("Nine AI is ready to work offline")
    setOfflineReady(false)
  }, [offlineReady, setOfflineReady])

  useEffect(() => {
    if (!needRefresh) return
    toast("A new version is available", {
      duration: Infinity,
      action: {
        label: "Reload",
        onClick: () => void updateServiceWorker(true),
      },
      cancel: {
        label: "Later",
        onClick: () => setNeedRefresh(false),
      },
    })
  }, [needRefresh, setNeedRefresh, updateServiceWorker])

  return null
}
