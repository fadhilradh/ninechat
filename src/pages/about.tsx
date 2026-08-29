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
    body: "The backend is two serverless functions. Replies run on a streaming function, which gets a 60 second budget instead of the 10 seconds a regular one gets.",
  },
  {
    icon: Database,
    title: "Your browser is the database",
    body: "Conversations live in IndexedDB on the device you typed them on. The server stores no transcripts, which is why no account is needed to use it.",
  },
  {
    icon: GitBranch,
    title: "Automatic model routing",
    body: "Each message goes to whichever model suits it, with a fallback chain behind that so a rate-limited model degrades instead of failing.",
  },
]

const FAQ = [
  {
    q: "Is it really free?",
    a: "Yes, and there is no plan to upgrade to. Open Chat stores nothing per user and runs no background jobs, so there is no per-seat cost to recover. The running cost is paid by whoever deployed it.",
  },
  {
    q: "Do I have to make an account?",
    a: "No. Everything works signed out. An account exists so the site can greet you by name, but nothing is gated behind it.",
  },
  {
    q: "Which model am I talking to?",
    a: "Whichever one suits the message. Routing is automatic, so there is no model list to keep up with. Each reply is labelled with the model that actually answered it, so you are never guessing.",
  },
  {
    q: "Where do my conversations live?",
    a: "In your browser's IndexedDB, on the device you typed them on. They are not uploaded, not backed up, and not readable by the server. Clearing site data deletes them for good.",
  },
  {
    q: "Are there message limits?",
    a: "No daily cap and no trial counter. A single reply has to finish inside 60 seconds, which is a platform limit rather than a policy, and you get a clear message rather than a dead connection if one hits it.",
  },
  {
    q: "What happens to images I attach?",
    a: "They are resized to fit within 1568px and re-encoded in the browser, then sent inline with the message. The resized copy is stored alongside the chat in IndexedDB.",
  },
]

export function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16">
      <h1 className="text-4xl font-bold tracking-tight">About Open Chat</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        A free chatbot for everyone, that keeps your conversations on your own machine.
      </p>

      <Separator className="my-10" />

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Why it exists</h2>
        <p className="leading-relaxed text-muted-foreground">
          Most chat apps want an account before they will answer a single question, then keep the
          transcript. Open Chat asks for neither. There is no sign-up wall, and the conversations
          sit in your own browser storage rather than on a server.
        </p>
        <p className="leading-relaxed text-muted-foreground">
          That is what makes &ldquo;free forever&rdquo; honest rather than a countdown. There is no
          per-seat cost to recover, because there is no seat -- the deploy holds no transcripts,
          runs no background jobs, and stores nothing per user unless you choose to sign in.
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
          <Link to="/auth?mode=signup">Create an account</Link>
        </Button>
      </div>
    </main>
  )
}
