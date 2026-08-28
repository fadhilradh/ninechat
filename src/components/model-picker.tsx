import { useMemo, useState } from "react"
import { Check, ChevronsUpDown, RefreshCw, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ModelInfo } from "@/lib/types"
import { cn } from "@/lib/utils"

interface ModelPickerProps {
  value: string
  models: ModelInfo[]
  loading: boolean
  error: string | null
  onChange: (modelId: string) => void
  onReload: () => void
}

/**
 * A gateway that fronts forty providers returns hundreds of model ids, so this
 * is a searchable dialog grouped by provider rather than a plain <select>.
 */
export function ModelPicker({
  value,
  models,
  loading,
  error,
  onChange,
  onReload,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const grouped = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matches = needle
      ? models.filter((m) => m.id.toLowerCase().includes(needle))
      : models

    const groups = new Map<string, ModelInfo[]>()
    for (const model of matches) {
      const bucket = groups.get(model.provider) ?? []
      bucket.push(model)
      groups.set(model.provider, bucket)
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [models, query])

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="max-w-[260px] justify-between gap-2 font-mono text-xs"
      >
        <span className="truncate">{value || "Choose a model"}</span>
        <ChevronsUpDown className="shrink-0 opacity-50" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl gap-3">
          <DialogHeader>
            <DialogTitle>Choose a model</DialogTitle>
            <DialogDescription>
              These come straight from your gateway. If one is missing, enable its provider there
              first.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                placeholder="Filter models"
                onChange={(event) => setQuery(event.target.value)}
                className="pl-8"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={onReload}
              disabled={loading}
              aria-label="Reload model list"
            >
              <RefreshCw className={cn(loading && "animate-spin")} />
            </Button>
          </div>

          {error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              {error}
            </p>
          ) : null}

          <ScrollArea className="h-[340px] rounded-md border">
            {grouped.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {loading ? "Loading models..." : "No models matched."}
              </p>
            ) : (
              <div className="p-1">
                {grouped.map(([provider, entries]) => (
                  <section key={provider} className="mb-1">
                    <header className="flex items-center gap-2 px-2 py-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {provider}
                      </span>
                      <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                        {entries.length}
                      </Badge>
                    </header>
                    {entries.map((model) => (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => {
                          onChange(model.id)
                          setOpen(false)
                          setQuery("")
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                          model.id === value && "bg-accent"
                        )}
                      >
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0",
                            model.id === value ? "opacity-100 text-primary" : "opacity-0"
                          )}
                        />
                        <span className="truncate font-mono text-xs">{model.id}</span>
                      </button>
                    ))}
                  </section>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  )
}
