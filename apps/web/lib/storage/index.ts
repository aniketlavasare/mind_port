/**
 * Client-side storage — backed by Vercel Blob via Next.js API routes.
 * All functions are async. Call from client components using await or .then().
 */

import type { AgentRecord, AgentOnchain, AgentSpec } from "@/lib/types"
import { generateId } from "@/lib/uuid"

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? `API error ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function listAgents(): Promise<AgentRecord[]> {
  return apiFetch<AgentRecord[]>("/api/agents")
}

export async function getAgent(id: string): Promise<AgentRecord | null> {
  try {
    return await apiFetch<AgentRecord>(`/api/agents/${id}`)
  } catch {
    return null
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function createAgent(spec: AgentSpec): Promise<AgentRecord> {
  return apiFetch<AgentRecord>("/api/agents", {
    method: "POST",
    body: JSON.stringify({ spec }),
  })
}

export async function updateAgent(id: string, spec: AgentSpec): Promise<AgentRecord | null> {
  try {
    return await apiFetch<AgentRecord>(`/api/agents/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ spec }),
    })
  } catch { return null }
}

export async function deleteAgent(id: string): Promise<boolean> {
  try {
    await apiFetch(`/api/agents/${id}`, { method: "DELETE" })
    return true
  } catch { return false }
}

export async function duplicateAgent(id: string): Promise<AgentRecord | null> {
  try {
    return await apiFetch<AgentRecord>(`/api/agents/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ duplicate: true }),
    })
  } catch { return null }
}

export async function toggleFavorite(id: string): Promise<AgentRecord | null> {
  try {
    return await apiFetch<AgentRecord>(`/api/agents/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ toggleFavorite: true }),
    })
  } catch { return null }
}

export async function updateOnchain(
  id: string,
  tokenId: number,
  chainId: number,
  agentBrainAddress: string
): Promise<AgentRecord | null> {
  const onchain: AgentOnchain = { tokenId, chainId, agentBrainAddress }
  try {
    return await apiFetch<AgentRecord>(`/api/agents/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ onchain }),
    })
  } catch { return null }
}

export async function incrementRunStats(id: string): Promise<AgentRecord | null> {
  try {
    return await apiFetch<AgentRecord>(`/api/agents/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ incrementRuns: true }),
    })
  } catch { return null }
}

// ─── Import ───────────────────────────────────────────────────────────────────

/**
 * Accepts a parsed JSON value (AgentRecord, AgentSpec, or array of either)
 * and creates agents from each entry. Returns newly created records.
 */
export async function importAgents(raw: unknown): Promise<AgentRecord[]> {
  const items = Array.isArray(raw) ? raw : [raw]
  const specs: AgentSpec[] = []

  for (const item of items) {
    if (!item || typeof item !== "object") continue
    const obj = item as Record<string, unknown>
    const spec = normalizeSpec(obj.spec as Record<string, unknown> ?? obj)
    if (spec) specs.push(spec)
  }

  const created = await Promise.all(specs.map(spec => createAgent(spec)))
  return created
}

// ─── Normalise helpers ────────────────────────────────────────────────────────

function normalizeSpec(obj: Record<string, unknown>): AgentSpec | null {
  const name = String(obj.name ?? "").trim()
  const prompt = String(obj.prompt ?? "").trim()
  if (!name || !prompt) return null
  const policy = (obj.policy ?? {}) as Record<string, unknown>
  return {
    name,
    description: String(obj.description ?? ""),
    tags: Array.isArray(obj.tags) ? (obj.tags as string[]).map(String) : [],
    prompt,
    policy: {
      ask_clarifying_questions: Boolean(policy.ask_clarifying_questions ?? false),
      refuse_to_guess: Boolean(policy.refuse_to_guess ?? false),
      output_format: (["plain", "bullets", "json"].includes(String(policy.output_format))
        ? String(policy.output_format)
        : "plain") as "plain" | "bullets" | "json",
      temperature: typeof policy.temperature === "number" ? Number(policy.temperature) : undefined,
      max_output_tokens: typeof policy.max_output_tokens === "number" ? Number(policy.max_output_tokens) : undefined,
    },
    model_choice: String(obj.model_choice ?? ""),
  }
}

// kept for potential external use
export { normalizeSpec, generateId }
