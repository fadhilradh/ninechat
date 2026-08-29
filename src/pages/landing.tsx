import { Link } from "react-router-dom"
import {
  ArrowRight,
  Coins,
  Image as ImageIcon,
  Layers,
  Lock,
  MonitorSmartphone,
  Repeat,
  ShieldCheck,
  Zap,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Wordmark } from "@/components/wordmark"

const FEATURES = [
  {
    icon: Layers,
    title: "Every model, one window",
    body: "One OpenAI-compatible endpoint in front of hundreds of models. Switch between them mid-conversation without touching a config file.",
  },
  {
    icon: Coins,
    title: "Falls back instead of failing",
    body: "When a model hits its quota, the request cascades down a fallback chain that ends in free models. You see a reply, not a 429.",
  },
  {
    icon: ImageIcon,
    title: "Screenshots welcome",
    body: "Paste or drop an image straight into the composer. It is resized in your browser before it ever leaves the tab.",
  },
  {
    icon: Repeat,
    title: "Rewind and retry",
    body: "Regenerate any answer, edit a question and resend it, or branch a whole new chat from any point in the thread.",
  },
  {
    icon: Lock,
    title: "Your chats stay yours",
    body: "Conversations are stored in your own browser, not on a server. Clearing them is a button, not a support ticket.",
  },
  {
    icon: MonitorSmartphone,
    title: "Installs like an app",
    body: "Add it to your dock or home screen. It opens in its own window and loads instantly, even on a bad connection.",
  },
]

const STEPS = [
  {
    step: "01",
    title: "Run or point at a gateway",
    body: "Point it at OpenRouter, a self-hosted 9Router, or any OpenAI-compatible endpoint you already have.",
  },
  {
    step: "02",
    title: "Pick a model",
    body: "The picker lists whatever your gateway actually serves, grouped by provider and searchable.",
  },
  {
    step: "03",
    title: "Start typing",
    body: "No sign-up wall, no trial counter, no credit card. Make an account later if you want one.",
  },
]

export function LandingPage() {
  return (
    <main className="flex-1">
      <section className="relative overflow-hidden border-b">
        <div aria-hidden className="pointer-events-none absolute inset-0 grid-fade opacity-40" />
        <div className="relative mx-auto max-w-4xl px-4 py-24 text-center">
          <Badge variant="secondary" className="mb-6 gap-1.5 px-3 py-1">
            <Zap className="h-3 w-3 text-primary" />
            Runs on any OpenAI-compatible gateway
          </Badge>

          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-6xl">
            Free forever{" "}
            <span className="bg-gradient-to-r from-primary to-fuchsia-500 bg-clip-text text-transparent">
              AI chat
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
            Open Chat is a fast, private chat window for every model your gateway can reach. No
            account required, no message limits, no transcripts on someone else&apos;s server.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link to="/chat">
                Start chatting
                <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/auth?mode=signup">Create an account</Link>
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Signing in is optional. It is there if you want it.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <header className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">Built for people who switch models</h2>
          <p className="mt-3 text-muted-foreground">
            Most chat UIs marry you to one provider. This one treats the model as a dropdown.
          </p>
        </header>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="rounded-xl border bg-card p-5 transition-colors hover:border-primary/40"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-medium">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y bg-card/40">
        <div className="mx-auto max-w-5xl px-4 py-20">
          <h2 className="text-center text-3xl font-semibold tracking-tight">
            Three steps, then you are chatting
          </h2>
          <ol className="mt-12 grid gap-8 sm:grid-cols-3">
            {STEPS.map(({ step, title, body }) => (
              <li key={step}>
                <span className="font-mono text-sm text-primary">{step}</span>
                <h3 className="mt-2 font-medium">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-24 text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
        <h2 className="mt-4 text-3xl font-semibold tracking-tight">
          &ldquo;Free forever&rdquo; is a design decision
        </h2>
        <p className="mt-4 text-muted-foreground">
          There is no billing to build because there is nothing to bill for. Open Chat stores your
          chats in your browser and sends completions to a gateway you control. The only costs are
          whatever your own gateway charges -- and the fallback chain is very good at routing
          those to zero.
        </p>
        <Button size="lg" className="mt-8" asChild>
          <Link to="/chat">
            Open the chat
            <ArrowRight />
          </Link>
        </Button>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row">
          <Wordmark size="sm" />
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link to="/about" className="hover:text-foreground">
              About
            </Link>
            <Link to="/chat" className="hover:text-foreground">
              Chat
            </Link>
            <a
              href="https://openrouter.ai"
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-foreground"
            >
              OpenRouter
            </a>
          </nav>
        </div>
      </footer>
    </main>
  )
}
