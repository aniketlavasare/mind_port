"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Search, SlidersHorizontal, Star, Download, Upload, Bot, Cpu, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { AgentCard } from "@/components/AgentCard"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { ImportDialog } from "@/components/ImportDialog"
import { ApproveAndListDialog } from "@/components/ApproveAndListDialog"
import { WalletButton } from "@/components/WalletButton"
import { AgentRecord } from "@/lib/types"
import {
  deleteAgent, duplicateAgent, listAgents, toggleFavorite,
} from "@/lib/storage"
import { getContracts } from "@/lib/contracts"

type SortKey = "recent" | "name" | "runs"

function exportAgent(agent: AgentRecord) {
  const json = JSON.stringify(agent, null, 2)
  const blob = new Blob([json], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${agent.spec.name.replace(/\s+/g, "-").toLowerCase()}-agent.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function LibraryPage() {
  const router = useRouter()
  const contracts = useMemo(() => getContracts(), [])
  const [agents, setAgents] = useState<AgentRecord[]>([])
  const [search, setSearch] = useState("")
  const [favOnly, setFavOnly] = useState(false)
  const [sort, setSort] = useState<SortKey>("recent")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [listAgentId, setListAgentId] = useState<string | null>(null)

  const reload = useCallback(() => setAgents(listAgents()), [])
  useEffect(() => { reload() }, [reload])

  const filtered = useMemo(() => {
    let list = agents
    if (favOnly) list = list.filter(a => a.ui.favorite)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a =>
        a.spec.name.toLowerCase().includes(q) ||
        a.spec.description.toLowerCase().includes(q) ||
        a.spec.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    return [...list].sort((a, b) => {
      if (sort === "name") return a.spec.name.localeCompare(b.spec.name)
      if (sort === "runs") return b.stats.runs - a.stats.runs
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  }, [agents, favOnly, search, sort])

  const handleDelete = () => {
    if (!deleteId) return
    deleteAgent(deleteId)
    setDeleteId(null)
    reload()
  }

  const handleDuplicate = (id: string) => {
    duplicateAgent(id)
    reload()
  }

  const handleToggleFavorite = (id: string) => {
    toggleFavorite(id)
    reload()
  }

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
        <Link href="/" className="font-semibold text-gray-900 tracking-tight hover:text-gray-600 transition-colors">
          MindPort
        </Link>
        <nav className="flex items-center gap-4 text-sm text-gray-500">
          <Link href="/library" className="text-gray-900 font-medium">Library</Link>
          <Link href="/builder" className="hover:text-gray-900 transition-colors">Builder</Link>
          <Link href="/marketplace" className="hover:text-gray-900 transition-colors">Marketplace</Link>
        </nav>
        <WalletButton />
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">

          {/* Page header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Agent Library</h1>
              <p className="text-sm text-gray-500 mt-0.5">{agents.length} saved agent{agents.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="w-3.5 h-3.5 mr-1.5" /> Import
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/mint"><Cpu className="w-3.5 h-3.5 mr-1.5" /> Mint NFT</Link>
              </Button>
              <Button size="sm" className="bg-gray-900 hover:bg-gray-700 text-white" asChild>
                <Link href="/builder">
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> New Agent
                </Link>
              </Button>
            </div>
          </div>

          {/* Filters bar */}
          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <Input
                placeholder="Search by name, description, or tag…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>

            <button
              onClick={() => setFavOnly(v => !v)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                favOnly
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              <Star className="w-3 h-3" /> Favorites
            </button>

            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <Select value={sort} onValueChange={v => setSort(v as SortKey)}>
                <SelectTrigger className="h-8 w-32 text-xs border-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most recent</SelectItem>
                  <SelectItem value="name">Name A–Z</SelectItem>
                  <SelectItem value="runs">Most runs</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator className="mb-6" />

          {/* Grid */}
          {filtered.length === 0 ? (
            <EmptyState hasSearch={!!search || favOnly} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(agent => (
                <div key={agent.id} className="relative">
                  <AgentCard
                    agent={agent}
                    onOpen={() => router.push(`/builder?id=${agent.id}`)}
                    onRun={() => router.push(`/run/${agent.id}`)}
                    onDuplicate={() => handleDuplicate(agent.id)}
                    onDelete={() => setDeleteId(agent.id)}
                    onExport={() => exportAgent(agent)}
                    onToggleFavorite={() => handleToggleFavorite(agent.id)}
                  />
                  {/* Onchain badges & actions */}
                  <div className="px-3 pb-3 -mt-1 flex items-center gap-2 flex-wrap">
                    {agent.onchain ? (
                      <>
                        <Badge variant="secondary" className="text-xs gap-1 shrink-0">
                          <Cpu className="w-2.5 h-2.5" /> Token #{agent.onchain.tokenId}
                        </Badge>
                        {contracts && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs px-2 gap-1 shrink-0"
                            onClick={() => setListAgentId(agent.id)}
                          >
                            <Store className="w-3 h-3" /> List
                          </Button>
                        )}
                      </>
                    ) : (
                      contracts && (
                        <Link href="/mint" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                          Mint NFT →
                        </Link>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteId}
        title="Delete agent"
        description={`Are you sure you want to delete "${agents.find(a => a.id === deleteId)?.spec.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      {/* Import dialog */}
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => { reload(); setImportOpen(false) }}
      />

      {/* Approve + List dialog */}
      {contracts && listAgentId && (() => {
        const agent = agents.find(a => a.id === listAgentId)
        if (!agent?.onchain) return null
        return (
          <ApproveAndListDialog
            open={true}
            onClose={() => setListAgentId(null)}
            onSuccess={() => { setListAgentId(null); router.push("/marketplace") }}
            tokenId={agent.onchain.tokenId}
            brainAddress={contracts.agentBrain}
            marketplaceAddress={contracts.marketplace}
            agentName={agent.spec.name || "Unnamed Agent"}
          />
        )
      })()}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
        <Bot className="w-6 h-6 text-gray-400" />
      </div>
      {hasSearch ? (
        <>
          <p className="text-sm font-medium text-gray-700">No agents match your search</p>
          <p className="text-xs text-gray-400">Try different keywords or remove the filter.</p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-gray-700">No agents saved yet</p>
          <p className="text-xs text-gray-400">Create your first agent in the Builder.</p>
          <Button size="sm" className="mt-2 bg-gray-900 hover:bg-gray-700 text-white" asChild>
            <Link href="/builder"><Plus className="w-3.5 h-3.5 mr-1.5" /> New Agent</Link>
          </Button>
        </>
      )}
    </div>
  )
}
