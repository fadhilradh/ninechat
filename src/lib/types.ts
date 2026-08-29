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
  /**
   * Which model actually answered. Reported by the server mid-stream rather
   * than chosen here -- the gateway routes each request itself.
   */
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
  systemPrompt: string
  temperature: number
  pinned: boolean
  createdAt: number
  updatedAt: number
}

export interface AppSettings {
  defaultSystemPrompt: string
  defaultTemperature: number
  sendOnEnter: boolean
  autoTitle: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultSystemPrompt: "",
  defaultTemperature: 0.7,
  sendOnEnter: true,
  autoTitle: true,
}

export type StreamEvent =
  | { type: "meta"; model: string }
  | { type: "delta"; text: string }
  | { type: "usage"; promptTokens: number; completionTokens: number; totalTokens: number }
  | { type: "done"; finishReason: string | null }
  | { type: "error"; error: string; hint?: string }
