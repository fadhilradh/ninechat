import { Link, NavLink, useLocation } from "react-router-dom"
import { LogOut, MessageSquare } from "lucide-react"

import { Wordmark } from "./wordmark"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSession, signOut } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

const LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/about", label: "About", end: false },
  { to: "/chat", label: "Chat", end: false },
]

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const source = name?.trim() || email?.trim() || "?"
  const parts = source.split(/[\s@.]+/).filter(Boolean)
  return (parts[0]?.[0] ?? "?").concat(parts[1]?.[0] ?? "").toUpperCase()
}

/**
 * Shown on every page. Signing in is optional throughout the app -- these
 * buttons are an invitation, never a gate.
 */
export function SiteNav({ className }: { className?: string }) {
  const { data: session, isPending } = useSession()
  const location = useLocation()
  const user = session?.user

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur",
        className
      )}
    >
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link to="/" aria-label="Nine AI home">
          <Wordmark size="sm" />
        </Link>

        <ul className="hidden items-center gap-1 sm:flex">
          {LINKS.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )
                }
              >
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2">
          {isPending ? (
            <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                    {initials(user.name, user.email)}
                  </span>
                  <span className="hidden max-w-[140px] truncate sm:inline">
                    {user.name || user.email}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                  {user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/chat">
                    <MessageSquare />
                    Open chat
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void signOut()}>
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/auth?mode=signin" state={{ from: location.pathname }}>
                  Log in
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/auth?mode=signup" state={{ from: location.pathname }}>
                  Sign up
                </Link>
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
