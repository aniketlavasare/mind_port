/**
 * Server-only blob operations.
 * Import ONLY from Next.js API routes — never from client components.
 *
 * All agents are stored in a single JSON blob at "mindport/agents.json".
 * This is intentionally simple for MVP: one read + one write per mutation.
 */

import { put, list } from "@vercel/blob"
import type { AgentRecord } from "@/lib/types"

const BLOB_PATH = "mindport/agents.json"

/** Fetch the current agents array from blob storage. Returns [] if not yet created. */
export async function readAgents(): Promise<AgentRecord[]> {
  try {
    const { blobs } = await list({ prefix: "mindport/agents" })
    const found = blobs.find(b => b.pathname === BLOB_PATH)
    if (!found) return []
    const res = await fetch(found.url, { cache: "no-store" })
    if (!res.ok) return []
    return (await res.json()) as AgentRecord[]
  } catch {
    return []
  }
}

/** Overwrite the agents array in blob storage. */
export async function writeAgents(agents: AgentRecord[]): Promise<void> {
  await put(BLOB_PATH, JSON.stringify(agents), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
  })
}
