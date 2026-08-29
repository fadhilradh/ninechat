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
import { MadeBy } from "@/components/made-by"
import { Wordmark } from "@/components/wordmark"

const FEATURES = [
  {
    icon: Zap,
    title: "No sign-up, no setup",
    body: "Open it and type. No account, no API key, no configuration screen to get through first.",
  },
  {
    icon: Layers,
    title: "The model is chosen for you",
    body: "Every message is routed to a model that suits it. Nothing to pick, nothing to keep up with as new ones appear.",
  },
  {
    icon: Coins,
    title: "No message limits",
    body: "No daily cap, no trial counter, no upgrade prompt at the bottom of the screen.",
  },
  {
    icon: ImageIcon,
    title: "Screenshots welcome",
    body: "Paste or drop an image straight into the composer. It is resized in your browser before it is sent.",
  },
  {
    icon: Repeat,
    title: "Rewind and retry",
    body: "Regenerate any answer, edit a question and resend it, or branch a whole new chat from any point in the thread.",
  },
  {
    icon: Lock,
    title: "Your chats stay yours",
    body: "Conversations are stored in your own browser. Sign in and they follow you to your other devices; either way, clearing them is a button, not a support ticket.",
  },
  {
    icon: MonitorSmartphone,
    title: "Installs like an app",
    body: "Add it to your dock or home screen. It opens in its own window and loads instantly, even on a bad connection.",
  },
  {
    icon: ShieldCheck,
    title: "Nothing to lose track of",
    body: "No billing, no seats, no keys to rotate. There is nothing here that can quietly start costing you money.",
  },
]

const STEPS = [
  {
    step: "01",
    title: "Open it",
    body: "No account, no install, no configuration. The chat is the landing pad.",
  },
  {
    step: "02",
    title: "Start typing",
    body: "Ask anything. Attach a screenshot if it helps explain the question.",
  },
  {
    step: "03",
    title: "Come back whenever",
    body: "Your conversations are waiting in this browser. Make an account whenever you want them on another device too.",
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
            No account. No limits. No catch.
          </Badge>

          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-6xl">
            Free forever{" "}
            <span className="bg-gradient-to-r from-primary to-fuchsia-500 bg-clip-text text-transparent">
              AI chat
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
            A fast, private chatbot that anyone can use. Nothing to sign up for, nothing to
            configure, and no transcripts on someone else&apos;s server.
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
          <h2 className="text-3xl font-semibold tracking-tight">
            Everything you need, nothing you don&apos;t
          </h2>
          <p className="mt-3 text-muted-foreground">
            Most chat apps want an account before they will answer a single question. This one just
            answers.
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
            There is no step two
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
          There is no billing to build because there is nothing to bill for. Open Chat keeps your
          conversations in your own browser, syncs them to your account only if you make one, and
          has no per-seat cost to recover. It is a chatbot, not a funnel.
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
            <Link to="/auth?mode=signup" className="hover:text-foreground">
              Sign up
            </Link>
          </nav>
        </div>
        <div className="border-t px-4 py-5">
          <MadeBy />
        </div>
      </footer>
    </main>
  )
}
