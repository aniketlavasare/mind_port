import { NextRequest, NextResponse } from "next/server"
import { readAgents, writeAgent } from "@/lib/storage/redis"
import { generateId } from "@/lib/uuid"
import type { AgentRecord, AgentSpec } from "@/lib/types"

/** GET /api/agents — list all agents */
export async function GET() {
  const agents = await readAgents()
  return NextResponse.json(agents)
}

/** POST /api/agents — create a new agent from a spec */
export async function POST(req: NextRequest) {
  const body = await req.json() as { spec: AgentSpec }

  const now = new Date().toISOString()
  const record: AgentRecord = {
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    spec: body.spec,
    stats: { runs: 0, lastRunAt: null },
    ui: { favorite: false, colorTag: "none" },
  }

  await writeAgent(record)
  return NextResponse.json(record, { status: 201 })
}
