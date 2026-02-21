/**
 * Server-only Redis operations via Upstash.
 * Import ONLY from Next.js API routes — never from client components.
 *
 * Each agent stored as: agent:{id} → JSON string
 * All agent IDs tracked in a Redis Set: agent:ids
 */

import { Redis } from "@upstash/redis"
import type { AgentRecord } from "@/lib/types"

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

const KEY = (id: string) => `agent:${id}`
const INDEX = "agent:ids"

/** List all agents. */
export async function readAgents(): Promise<AgentRecord[]> {
  const ids = await redis.smembers(INDEX)
  if (ids.length === 0) return []

  const pipeline = redis.pipeline()
  for (const id of ids) pipeline.get(KEY(id))
  const results = await pipeline.exec<(AgentRecord | null)[]>()

  return results.filter((r): r is AgentRecord => r !== null)
}

/** Read a single agent by ID. */
export async function readAgent(id: string): Promise<AgentRecord | null> {
  return redis.get<AgentRecord>(KEY(id))
}

/** Write (create or update) a single agent. */
export async function writeAgent(agent: AgentRecord): Promise<void> {
  const pipeline = redis.pipeline()
  pipeline.set(KEY(agent.id), JSON.stringify(agent))
  pipeline.sadd(INDEX, agent.id)
  await pipeline.exec()
}

/** Delete a single agent. Returns true if it existed. */
export async function deleteAgentRedis(id: string): Promise<boolean> {
  const pipeline = redis.pipeline()
  pipeline.del(KEY(id))
  pipeline.srem(INDEX, id)
  const [deleted] = await pipeline.exec<[number, number]>()
  return deleted > 0
}
