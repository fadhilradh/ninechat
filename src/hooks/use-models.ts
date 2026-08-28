import { useCallback, useEffect, useState } from "react"

import { fetchModels } from "@/lib/api"
import type { AppSettings, ModelInfo } from "@/lib/types"

interface ModelsState {
  models: ModelInfo[]
  loading: boolean
  error: string | null
  reload: () => void
}

/**
 * The model list is the first thing that breaks when the gateway is
 * misconfigured, so we surface its error rather than silently showing an empty
 * picker.
 */
export function useModels(settings: AppSettings, enabled: boolean): ModelsState {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    setLoading(true)
    setError(null)

    fetchModels(settings)
      .then((list) => {
        if (cancelled) return
        setModels(list)
      })
      .catch((err: Error) => {
        if (cancelled) return
        setModels([])
        setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // Only the connection settings should trigger a refetch. Depending on the
    // whole object would re-list models every time the temperature slider moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, nonce, settings.transport, settings.directBaseUrl, settings.directApiKey])

  return { models, loading, error, reload }
}
