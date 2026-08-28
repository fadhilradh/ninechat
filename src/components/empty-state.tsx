import { ImagePlus, MessageSquarePlus, Sparkles, Zap } from "lucide-react"

import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  onStart: (prompt?: string) => void
}

const SUGGESTIONS = [
  {
    icon: Sparkles,
    title: "Explain a tricky bit of code",
    prompt: "Explain what this code does, then point out anything that will bite me later:\n\n",
  },
  {
    icon: ImagePlus,
    title: "Read a screenshot",
    prompt: "I am going to paste a screenshot. Tell me what is wrong with this UI.",
  },
  {
    icon: Zap,
    title: "Compare two models",
    prompt:
      "Ask me three questions to work out which model I should use for a coding assistant, then recommend one.",
  },
]

export function EmptyState({ onStart }: EmptyStateProps) {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">What are we working on?</h2>
        <p className="text-sm text-muted-foreground">
          Your chats stay in this browser. Pick a model, ask anything, attach a screenshot if it
          helps.
        </p>
      </div>

      <div className="grid w-full gap-2 sm:grid-cols-3">
        {SUGGESTIONS.map(({ icon: Icon, title, prompt }) => (
          <button
            key={title}
            type="button"
            onClick={() => onStart(prompt)}
            className="rounded-lg border p-3 text-left transition-colors hover:border-primary/60 hover:bg-accent"
          >
            <Icon className="mb-2 h-4 w-4 text-primary" />
            <span className="text-sm font-medium leading-snug">{title}</span>
          </button>
        ))}
      </div>

      <Button variant="outline" onClick={() => onStart()}>
        <MessageSquarePlus />
        Start a blank chat
      </Button>
    </div>
  )
}
