export type Role = "system" | "user" | "assistant"

export interface Attachment {
  id: string
  name: string
  mime: string
  /** Byte size after client-side downscaling. */
  size: number
  width: number
  height: number
  /** `data:<mime>;base64,...` -- what vision models expect on the wire. */
  dataUrl: string
}

export interface Usage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface Message {
  id: string
  sessionId: string
  role: Role
  content: string
  attachments: Attachment[]
  createdAt: number
  model?: string
  usage?: Usage
  latencyMs?: number
  error?: string
  hint?: string
}

export interface Session {
  id: string
  title: string
  /** Set when the user renames a chat, so auto-titling stops overwriting it. */
  titleLocked: boolean
  model: string
  systemPrompt: string
  temperature: number
  pinned: boolean
  createdAt: number
  updatedAt: number
}

/**
 * Where the browser sends completions.
 *
 * `proxy` goes through the Netlify function, which holds the key server-side.
 * `direct` goes straight from the browser to a gateway you can reach yourself.
 * Direct is the only option that works with a gateway on localhost, because a
 * function running in Netlify's cloud cannot see your machine -- but it also
 * means the key is held in this browser and sent from it.
 */
export type TransportMode = "proxy" | "direct"

export interface AppSettings {
  transport: TransportMode
  directBaseUrl: string
  directApiKey: string
  defaultModel: string
  defaultSystemPrompt: string
  defaultTemperature: number
  sendOnEnter: boolean
  autoTitle: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  transport: "proxy",
  // Seeded from the deploy's own gateway on first load; this is the fallback.
  directBaseUrl: "https://openrouter.ai/api/v1",
  directApiKey: "",
  defaultModel: "",
  defaultSystemPrompt: "",
  defaultTemperature: 0.7,
  sendOnEnter: true,
  autoTitle: true,
}

export interface ModelInfo {
  id: string
  provider: string
  label: string
}

export type StreamEvent =
  | { type: "meta"; model: string }
  | { type: "delta"; text: string }
  | { type: "usage"; promptTokens: number; completionTokens: number; totalTokens: number }
  | { type: "done"; finishReason: string | null }
  | { type: "error"; error: string; hint?: string }
