/**
 * In-memory agent store.
 * Data lives for the lifetime of the browser session.
 * Import only from client components.
 */

import { AgentRecord, AgentSpec } from "@/lib/types"
import { generateId } from "@/lib/uuid"

const SCHEMA_VERSION = 1

interface StoreState {
  version: number
  agents: Map<string, AgentRecord>
}

const store: StoreState = {
  version: SCHEMA_VERSION,
  agents: new Map(),
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export function listAgents(): AgentRecord[] {
  return Array.from(store.agents.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

export function getAgent(id: string): AgentRecord | null {
  return store.agents.get(id) ?? null
}

// ─── Write ────────────────────────────────────────────────────────────────────

export function createAgent(spec: AgentSpec): AgentRecord {
  const now = new Date().toISOString()
  const record: AgentRecord = {
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    spec,
    stats: { runs: 0, lastRunAt: null },
    ui: { favorite: false, colorTag: "none" },
    lastOutputFormatUsed: spec.policy.output_format,
  }
  store.agents.set(record.id, record)
  return record
}

export function updateAgent(id: string, spec: AgentSpec): AgentRecord | null {
  const existing = store.agents.get(id)
  if (!existing) return null
  const updated: AgentRecord = {
    ...existing,
    spec,
    updatedAt: new Date().toISOString(),
    lastOutputFormatUsed: spec.policy.output_format,
  }
  store.agents.set(id, updated)
  return updated
}

export function deleteAgent(id: string): boolean {
  return store.agents.delete(id)
}

export function duplicateAgent(id: string): AgentRecord | null {
  const existing = store.agents.get(id)
  if (!existing) return null
  const now = new Date().toISOString()
  const copy: AgentRecord = {
    ...existing,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    spec: { ...existing.spec, name: `${existing.spec.name} (copy)` },
    stats: { runs: 0, lastRunAt: null },
  }
  store.agents.set(copy.id, copy)
  return copy
}

export function toggleFavorite(id: string): AgentRecord | null {
  const existing = store.agents.get(id)
  if (!existing) return null
  const updated: AgentRecord = {
    ...existing,
    ui: { ...existing.ui, favorite: !existing.ui.favorite },
    updatedAt: new Date().toISOString(),
  }
  store.agents.set(id, updated)
  return updated
}

export function incrementRunStats(id: string): AgentRecord | null {
  const existing = store.agents.get(id)
  if (!existing) return null
  const updated: AgentRecord = {
    ...existing,
    stats: { runs: existing.stats.runs + 1, lastRunAt: new Date().toISOString() },
    updatedAt: new Date().toISOString(),
  }
  store.agents.set(id, updated)
  return updated
}

// ─── Import / Export ──────────────────────────────────────────────────────────

/**
 * Accepts an array of unknown objects (parsed from JSON) and imports them as
 * AgentRecords. Handles:
 *   - a single AgentRecord  (has .id + .spec)
 *   - a single AgentSpec    (has .name + .prompt, no .id)
 *   - an array of either
 *
 * Returns the list of newly created records.
 */
export function importAgents(raw: unknown): AgentRecord[] {
  const items = Array.isArray(raw) ? raw : [raw]
  const created: AgentRecord[] = []

  for (const item of items) {
    if (!item || typeof item !== "object") continue
    const obj = item as Record<string, unknown>

    // Looks like a full AgentRecord
    if (obj.id && obj.spec && typeof obj.spec === "object") {
      const record = normalizeRecord(obj)
      if (record) {
        store.agents.set(record.id, record)
        created.push(record)
      }
      continue
    }

    // Looks like a bare AgentSpec
    if (obj.name && obj.prompt) {
      const spec = normalizeSpec(obj)
      if (spec) {
        const record = createAgent(spec)
        created.push(record)
      }
    }
  }

  return created
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeSpec(obj: Record<string, unknown>): AgentSpec | null {
  const name = String(obj.name ?? "").trim()
  const prompt = String(obj.prompt ?? "").trim()
  if (!name || !prompt) return null
  return {
    name,
    description: String(obj.description ?? ""),
    tags: Array.isArray(obj.tags) ? (obj.tags as string[]).map(String) : [],
    prompt,
    policy: {
      ask_clarifying_questions: Boolean((obj.policy as Record<string, unknown>)?.ask_clarifying_questions ?? false),
      refuse_to_guess: Boolean((obj.policy as Record<string, unknown>)?.refuse_to_guess ?? false),
      output_format: (["plain", "bullets", "json"].includes(String((obj.policy as Record<string, unknown>)?.output_format)) ? String((obj.policy as Record<string, unknown>)?.output_format) : "plain") as "plain" | "bullets" | "json",
      temperature: typeof (obj.policy as Record<string, unknown>)?.temperature === "number" ? Number((obj.policy as Record<string, unknown>)?.temperature) : undefined,
      max_output_tokens: typeof (obj.policy as Record<string, unknown>)?.max_output_tokens === "number" ? Number((obj.policy as Record<string, unknown>)?.max_output_tokens) : undefined,
    },
    model_choice: String(obj.model_choice ?? ""),
  }
}

function normalizeRecord(obj: Record<string, unknown>): AgentRecord | null {
  const spec = normalizeSpec(obj.spec as Record<string, unknown>)
  if (!spec) return null
  const now = new Date().toISOString()
  const stats = obj.stats as Record<string, unknown> | undefined
  const ui = obj.ui as Record<string, unknown> | undefined
  return {
    id: generateId(),
    createdAt: typeof obj.createdAt === "string" ? obj.createdAt : now,
    updatedAt: now,
    spec,
    stats: {
      runs: typeof stats?.runs === "number" ? stats.runs : 0,
      lastRunAt: typeof stats?.lastRunAt === "string" ? stats.lastRunAt : null,
    },
    ui: {
      favorite: Boolean(ui?.favorite ?? false),
      colorTag: (["none", "gray", "black"].includes(String(ui?.colorTag)) ? String(ui?.colorTag) : "none") as "none" | "gray" | "black",
    },
    lastOutputFormatUsed: typeof obj.lastOutputFormatUsed === "string" ? obj.lastOutputFormatUsed : undefined,
  }
}
