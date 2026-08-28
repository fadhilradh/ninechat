import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import { loadSettings, saveSettings } from "@/lib/db"
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/types"

interface SettingsContextValue {
  settings: AppSettings
  ready: boolean
  update: (patch: Partial<AppSettings>) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void loadSettings().then((loaded) => {
      if (cancelled) return
      setSettings(loaded)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch }
      void saveSettings(next)
      return next
    })
  }, [])

  const value = useMemo(() => ({ settings, ready, update }), [settings, ready, update])

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext)
  if (!context) throw new Error("useSettings must be used inside a SettingsProvider")
  return context
}
