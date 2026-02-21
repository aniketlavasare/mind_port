export interface PolicyToggles {
  ask_clarifying_questions: boolean
  refuse_to_guess: boolean
  output_format: "plain" | "bullets" | "json"
  max_output_tokens?: number
  temperature?: number
}

export interface AgentSpec {
  name: string
  description: string
  tags: string[]
  prompt: string
  policy: PolicyToggles
  model_choice: string
}

export interface RunRequest {
  spec: AgentSpec
  message: string
  session_id?: string
}

export interface RunResponse {
  answer: string
  session_id: string
}

export interface ApiError {
  error: string
  detail: string
}

export interface TraceEvent {
  ts: string
  event: string
  detail: Record<string, unknown>
}

export interface Receipt {
  sessionId: string
  model: string
  outputFormat: string
  responseTimeMs: number
  charCount: number
  timestamp: Date
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  error?: string
  receipt?: Receipt
  trace?: TraceEvent[]
}

export const DEFAULT_MODEL = "openai/qwen/qwen-2.5-7b-instruct"
export const DEFAULT_MODEL_LABEL = "Qwen 2.5 7B (0G)"

export const MODELS = [
  { value: "openai/qwen/qwen-2.5-7b-instruct", label: "Qwen 2.5 7B (0G)" },
]

export const DEFAULT_POLICY: PolicyToggles = {
  ask_clarifying_questions: false,
  refuse_to_guess: false,
  output_format: "plain",
  max_output_tokens: undefined,
  temperature: undefined,
}

export const DEFAULT_SPEC: AgentSpec = {
  name: "",
  description: "",
  tags: [],
  prompt: "",
  policy: DEFAULT_POLICY,
  model_choice: DEFAULT_MODEL,
}

export interface AgentRecord {
  id: string
  createdAt: string
  updatedAt: string
  spec: AgentSpec
  stats: {
    runs: number
    lastRunAt: string | null
  }
  ui: {
    favorite: boolean
    colorTag: "none" | "gray" | "black"
  }
  lastOutputFormatUsed?: string
}
