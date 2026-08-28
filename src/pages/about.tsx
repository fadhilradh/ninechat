import { Link } from "react-router-dom"
import { ArrowRight, Boxes, Database, GitBranch, Server } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

const STACK = [
  {
    icon: Boxes,
    title: "React 18 + TypeScript + Vite",
    body: "shadcn-ui components on Tailwind, so every widget is source in this repo rather than a dependency you cannot patch.",
  },
  {
    icon: Server,
    title: "Netlify Functions",
    body: "The backend is three serverless functions. Completions run on a streaming function, which gets a 60 second budget instead of the 10 seconds a regular one gets.",
  },
  {
    icon: Database,
    title: "IndexedDB for chats, Postgres for accounts",
    body: "Conversations never leave your browser. Better Auth keeps accounts in Postgres, and the site works fully without one.",
  },
  {
    icon: GitBranch,
    title: "9Router as the model layer",
    body: "One OpenAI-compatible endpoint in front of 40+ providers, with tiered fallback when a quota runs dry.",
  },
]

const FAQ = [
  {
    q: "Is it really free?",
    a: "The app is. Completions cost whatever your gateway's providers charge -- which, if you route through 9Router's free tiers, is often nothing. Nine AI itself has no plan, quota, or paywall to hit.",
  },
  {
    q: "Do I have to make an account?",
    a: "No. Everything works signed out. An account exists so the site can greet you by name and so future sync has somewhere to hang, but nothing is gated behind it.",
  },
  {
    q: "Where do my conversations live?",
    a: "In your browser's IndexedDB, on the device you typed them on. They are not uploaded, not backed up, and not readable by the deploy. Clearing site data deletes them for good.",
  },
  {
    q: "Why can the deployed site not see my local 9Router?",
    a: "A Netlify function runs in Netlify's cloud and has no route to your laptop's localhost. Switch the app to Direct mode in Settings and your browser will call the gateway itself.",
  },
  {
    q: "What happens to images I attach?",
    a: "They are resized to fit within 1568px and re-encoded in the browser, then sent inline with the message. The resized copy is stored alongside the chat in IndexedDB.",
  },
]

export function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16">
      <h1 className="text-4xl font-bold tracking-tight">About Nine AI</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        A chat client for people who would rather own their transcript than rent it.
      </p>

      <Separator className="my-10" />

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Why it exists</h2>
        <p className="leading-relaxed text-muted-foreground">
          Every hosted chat app makes the same two decisions for you: which model you get, and who
          keeps your conversations. Nine AI makes neither. The model is a dropdown backed by
          whatever your gateway serves, and the conversations sit in your own browser storage.
        </p>
        <p className="leading-relaxed text-muted-foreground">
          That combination is what makes &ldquo;free forever&rdquo; honest rather than a countdown.
          There is no per-seat cost to recover, because there is no seat -- the deploy holds no
          transcripts, runs no background jobs, and stores nothing per user unless you choose to
          sign in.
        </p>
      </section>

      <Separator className="my-10" />

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight">How it is built</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {STACK.map(({ icon: Icon, title, body }) => (
            <article key={title} className="rounded-xl border bg-card p-4">
              <Icon className="mb-2 h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <Separator className="my-10" />

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight">Questions people actually ask</h2>
        <dl className="space-y-6">
          {FAQ.map(({ q, a }) => (
            <div key={q}>
              <dt className="font-medium">{q}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Separator className="my-10" />

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <Button asChild>
          <Link to="/chat">
            Open the chat
            <ArrowRight />
          </Link>
        </Button>
        <Button variant="ghost" asChild>
          <a href="https://9router.com" target="_blank" rel="noreferrer noopener">
            Learn about 9Router
          </a>
        </Button>
      </div>
    </main>
  )
}
