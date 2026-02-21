import { NextRequest, NextResponse } from "next/server"
import { readAgents, writeAgents } from "@/lib/storage/blob-server"
import { generateId } from "@/lib/uuid"
import type { AgentOnchain, AgentRecord } from "@/lib/types"

interface PatchBody {
  spec?: AgentRecord["spec"]
  ui?: Partial<AgentRecord["ui"]>
  onchain?: AgentOnchain
  toggleFavorite?: boolean
  incrementRuns?: boolean
  duplicate?: boolean
}

/** GET /api/agents/[id] */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const agents = await readAgents()
  const record = agents.find(a => a.id === id)
  if (!record) return NextResponse.json({ error: "not_found" }, { status: 404 })
  return NextResponse.json(record)
}

/** PATCH /api/agents/[id] — update spec, ui, onchain, or increment counters */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json() as PatchBody
  const agents = await readAgents()
  const idx = agents.findIndex(a => a.id === id)
  if (idx === -1) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const existing = agents[idx]
  const now = new Date().toISOString()

  // Handle duplicate: create a copy with a new ID
  if (body.duplicate) {
    const copy: AgentRecord = {
      ...existing,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      spec: { ...existing.spec, name: `${existing.spec.name} (copy)` },
      stats: { runs: 0, lastRunAt: null },
      onchain: undefined,
    }
    await writeAgents([...agents, copy])
    return NextResponse.json(copy, { status: 201 })
  }

  const updated: AgentRecord = {
    ...existing,
    updatedAt: now,
    ...(body.spec ? { spec: body.spec, lastOutputFormatUsed: body.spec.policy.output_format } : {}),
    ...(body.onchain ? { onchain: body.onchain } : {}),
    ui: {
      ...existing.ui,
      ...(body.ui ?? {}),
      ...(body.toggleFavorite ? { favorite: !existing.ui.favorite } : {}),
    },
    stats: {
      ...existing.stats,
      ...(body.incrementRuns ? { runs: existing.stats.runs + 1, lastRunAt: now } : {}),
    },
  }

  agents[idx] = updated
  await writeAgents(agents)
  return NextResponse.json(updated)
}

/** DELETE /api/agents/[id] */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const agents = await readAgents()
  const filtered = agents.filter(a => a.id !== id)
  if (filtered.length === agents.length) return NextResponse.json({ error: "not_found" }, { status: 404 })
  await writeAgents(filtered)
  return NextResponse.json({ ok: true })
}
