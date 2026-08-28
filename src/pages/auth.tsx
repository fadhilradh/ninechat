import { useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { AlertTriangle, ArrowRight, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Wordmark } from "@/components/wordmark"
import {
  describeAuthError,
  fetchAuthStatus,
  signIn,
  signUp,
  useSession,
  type AuthStatus,
} from "@/lib/auth-client"

type Mode = "signin" | "signup"

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.9-.1-1.5-.2-2.2H12v4.1h6.6c-.1 1.1-.9 2.8-2.5 3.9l-.02.15 3.6 2.8.25.03c2.3-2.1 3.6-5.2 3.6-8.8"
      />
      <path
        fill="#34A853"
        d="M12 24c3.3 0 6-1.1 8-2.9l-3.8-3c-1 .7-2.4 1.2-4.2 1.2a7.3 7.3 0 0 1-6.9-5l-.14.01-3.7 2.9-.05.14C3.3 21.3 7.3 24 12 24"
      />
      <path
        fill="#FBBC05"
        d="M5.1 14.3a7.2 7.2 0 0 1 0-4.6l-.01-.15-3.75-2.9-.12.06a12 12 0 0 0 0 10.6l3.9-3"
      />
      <path
        fill="#EA4335"
        d="M12 4.7c2.3 0 3.9 1 4.8 1.8l3.5-3.4C18 1.2 15.3 0 12 0 7.3 0 3.3 2.7 1.2 6.7l3.9 3A7.3 7.3 0 0 1 12 4.7"
      />
    </svg>
  )
}

export function AuthPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { data: session } = useSession()

  const mode: Mode = params.get("mode") === "signup" ? "signup" : "signin"
  const [status, setStatus] = useState<AuthStatus | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [pending, setPending] = useState<"email" | "google" | null>(null)

  useEffect(() => {
    void fetchAuthStatus().then(setStatus)
  }, [])

  // Already signed in? There is nothing to do on this page.
  useEffect(() => {
    if (session?.user) navigate("/chat", { replace: true })
  }, [session, navigate])

  function setMode(next: Mode) {
    setParams({ mode: next }, { replace: true })
  }

  async function submitEmail(event: React.FormEvent) {
    event.preventDefault()
    setPending("email")

    const result =
      mode === "signup"
        ? await signUp.email({
            email,
            password,
            name: name.trim() || email.split("@")[0] || "There",
            callbackURL: "/chat",
          })
        : await signIn.email({ email, password, callbackURL: "/chat" })

    setPending(null)

    if (result.error) {
      toast.error(describeAuthError(result.error.message, result.error.code))
      return
    }

    toast.success(mode === "signup" ? "Account created" : "Welcome back")
    navigate("/chat", { replace: true })
  }

  async function continueWithGoogle() {
    setPending("google")
    const result = await signIn.social({ provider: "google", callbackURL: "/chat" })
    if (result?.error) {
      setPending(null)
      toast.error(describeAuthError(result.error.message, result.error.code))
    }
  }

  const disabled = status?.enabled === false

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Wordmark size="lg" showTagline />
        <p className="text-sm text-muted-foreground">
          An account syncs nothing yet -- it just keeps your name on the door. Chat works fine
          without one.
        </p>
      </div>

      {disabled ? (
        <div className="mb-6 flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div>
            <p className="font-medium">Accounts are not set up on this deploy.</p>
            <p className="text-xs text-muted-foreground">
              Set <code>DATABASE_URL</code> and <code>BETTER_AUTH_SECRET</code> in the Netlify
              environment to switch them on.
            </p>
          </div>
        </div>
      ) : null}

      <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="signin">Log in</TabsTrigger>
          <TabsTrigger value="signup">Sign up</TabsTrigger>
        </TabsList>
      </Tabs>

      <form onSubmit={submitEmail} className="mt-6 space-y-4">
        {mode === "signup" ? (
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              autoComplete="name"
              value={name}
              placeholder="Optional"
              disabled={disabled}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            disabled={disabled}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            disabled={disabled}
            onChange={(event) => setPassword(event.target.value)}
          />
          {mode === "signup" ? (
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          ) : null}
        </div>

        <Button type="submit" className="w-full" disabled={disabled || pending !== null}>
          {pending === "email" ? <Loader2 className="animate-spin" /> : null}
          {mode === "signup" ? "Create account" : "Log in"}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={disabled || status?.google === false || pending !== null}
        onClick={() => void continueWithGoogle()}
      >
        {pending === "google" ? <Loader2 className="animate-spin" /> : <GoogleGlyph />}
        Continue with Google
      </Button>

      {status?.google === false && !disabled ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Google sign-in needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the deploy.
        </p>
      ) : null}

      <Button variant="link" asChild className="mt-6 text-muted-foreground">
        <Link to="/chat">
          Skip -- just start chatting
          <ArrowRight />
        </Link>
      </Button>
    </main>
  )
}
