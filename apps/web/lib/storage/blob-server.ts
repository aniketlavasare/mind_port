/**
 * Server-only blob operations — one blob per agent.
 * Import ONLY from Next.js API routes — never from client components.
 *
 * Each agent is stored at: mindport/agents/{id}.json
 * Listing uses the prefix scan. No single-file bottleneck, no race conditions.
 */

import { put, list, del } from "@vercel/blob"
import type { AgentRecord } from "@/lib/types"

const PREFIX = "mindport/agents/"
const blobPath = (id: string) => `${PREFIX}${id}.json`

/** List all agents from blob storage. */
export async function readAgents(): Promise<AgentRecord[]> {
  try {
    const agents: AgentRecord[] = []
    let cursor: string | undefined

    do {
      const result = await list({ prefix: PREFIX, cursor })
      const fetches = result.blobs.map(async (blob) => {
        const url = blob.downloadUrl ?? blob.url
        const res = await fetch(url, { cache: "no-store" })
        if (!res.ok) return null
        return (await res.json()) as AgentRecord
      })
      const batch = await Promise.all(fetches)
      agents.push(...batch.filter((a): a is AgentRecord => a !== null))
      cursor = result.hasMore ? result.cursor : undefined
    } while (cursor)

    return agents
  } catch {
    return []
  }
}

/** Read a single agent by ID. Faster than listing all. */
export async function readAgent(id: string): Promise<AgentRecord | null> {
  try {
    const { blobs } = await list({ prefix: blobPath(id) })
    const found = blobs.find(b => b.pathname === blobPath(id))
    if (!found) return null
    const url = found.downloadUrl ?? found.url
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return null
    return (await res.json()) as AgentRecord
  } catch {
    return null
  }
}

/** Write (create or update) a single agent. */
export async function writeAgent(agent: AgentRecord): Promise<void> {
  await put(blobPath(agent.id), JSON.stringify(agent), {
    access: "private",
    contentType: "application/json",
    allowOverwrite: true,
  })
}

/** Delete a single agent. Returns true if deleted. */
export async function deleteAgentBlob(id: string): Promise<boolean> {
  try {
    const { blobs } = await list({ prefix: blobPath(id) })
    const found = blobs.find(b => b.pathname === blobPath(id))
    if (!found) return false
    await del(found.url)
    return true
  } catch {
    return false
  }
}
