import { createAuthClient } from "better-auth/react"

/**
 * Same origin in every environment -- `netlify dev` and the deployed site both
 * serve the auth routes under /api/auth.
 */
export const authClient = createAuthClient({
  basePath: "/api/auth",
})

export const { signIn, signUp, signOut, useSession } = authClient

export interface AuthStatus {
  enabled: boolean
  google: boolean
}

export async function fetchAuthStatus(): Promise<AuthStatus> {
  try {
    const response = await fetch("/api/auth-status")
    if (!response.ok) return { enabled: false, google: false }
    return (await response.json()) as AuthStatus
  } catch {
    return { enabled: false, google: false }
  }
}

/** Turns Better Auth's error codes into something worth reading. */
export function describeAuthError(message: string | undefined, code?: string): string {
  switch (code) {
    case "USER_ALREADY_EXISTS":
      return "That email already has an account. Try logging in instead."
    case "INVALID_EMAIL_OR_PASSWORD":
      return "That email and password do not match an account."
    case "PASSWORD_TOO_SHORT":
      return "Passwords need at least 8 characters."
    default:
      return message || "Something went wrong. Please try again."
  }
}
