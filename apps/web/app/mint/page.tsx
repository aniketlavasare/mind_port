"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useAccount, usePublicClient, useWriteContract } from "wagmi"
import { ArrowLeft, CheckCircle2, Cpu, Loader2, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { WalletButton } from "@/components/WalletButton"
import { BRAIN_ABI, getContracts } from "@/lib/contracts"
import { listAgents, updateOnchain } from "@/lib/storage"
import type { AgentRecord } from "@/lib/types"

type MintState = "idle" | "sending" | "confirming" | "done" | "error"

export default function MintPage() {
  const contracts = useMemo(() => getContracts(), [])
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()

  const [agents, setAgents] = useState<AgentRecord[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [mintState, setMintState] = useState<MintState>("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [mintedTokenId, setMintedTokenId] = useState<number | null>(null)

  useEffect(() => { setAgents(listAgents()) }, [])

  const unmintedAgents = agents.filter(a => !a.onchain)
  const selected = agents.find(a => a.id === selectedId)

  const handleMint = async () => {
    if (!selected || !contracts || !isConnected || !publicClient) return
    setMintState("sending")
    setErrorMsg("")

    try {
      const { spec } = selected
      const hash = await writeContractAsync({
        address: contracts.agentBrain,
        abi: BRAIN_ABI,
        functionName: "mint",
        args: [spec.name, spec.description, spec.tags.join(","), spec.prompt],
      })

      setMintState("confirming")
      const receipt = await publicClient.waitForTransactionReceipt({ hash })

      // Strategy 1: Find the ERC-721 Transfer event from the brain contract.
      // Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
      // On mint, from = address(0). tokenId is in topics[3].
      const TRANSFER_SIG = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      const brainLower = contracts.agentBrain.toLowerCase()

      const transferLog = receipt.logs.find(log =>
        log.address.toLowerCase() === brainLower &&
        log.topics.length >= 4 &&
        log.topics[0]?.toLowerCase() === TRANSFER_SIG
      )

      let tokenId: number | null = null

      if (transferLog?.topics[3]) {
        tokenId = Number(BigInt(transferLog.topics[3]))
      }

      // Strategy 2: Fallback — read totalMinted() from contract
      if (tokenId === null) {
        const total = await publicClient.readContract({
          address: contracts.agentBrain,
          abi: BRAIN_ABI,
          functionName: "totalMinted",
        })
        tokenId = Number(total as bigint)
      }

      if (tokenId === null || tokenId === 0) {
        throw new Error("Mint succeeded but could not determine tokenId")
      }

      updateOnchain(selected.id, tokenId, 31337, contracts.agentBrain)
      setMintedTokenId(tokenId)
      setMintState("done")
      setAgents(listAgents())
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message.split("\n")[0] : "Mint failed")
      setMintState("error")
    }
  }

  const tagList = selected?.spec.tags ?? []
  const isBusy = mintState === "sending" || mintState === "confirming"

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/library" className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Library
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold text-gray-900">Mint NFT</span>
        </div>
        <WalletButton />
      </header>

      <div className="flex-1 max-w-lg mx-auto w-full px-6 py-10 space-y-6">

        {/* Not deployed warning */}
        {!contracts && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
            Contracts not deployed. Run <code className="font-mono">scripts/deploy.ts</code> then{" "}
            <code className="font-mono">scripts/export-contracts.ts</code> and restart the dev server.
          </div>
        )}

        {/* Not connected warning */}
        {contracts && !isConnected && (
          <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600">
            Connect your wallet to mint.
          </div>
        )}

        {/* No unminted agents */}
        {unmintedAgents.length === 0 && agents.length > 0 && (
          <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600">
            All saved agents are already minted. <Link href="/builder" className="underline">Create a new agent</Link>.
          </div>
        )}

        {/* Select agent */}
        {unmintedAgents.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Select Agent</label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an agent to mint…" />
              </SelectTrigger>
              <SelectContent>
                {unmintedAgents.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.spec.name || "Unnamed Agent"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Preview */}
        {selected && mintState !== "done" && (
          <div className="rounded-lg border border-gray-200 p-4 space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Fields to mint on-chain</h3>
            <Separator />
            <MetaRow label="Name" value={selected.spec.name || "Unnamed Agent"} />
            <MetaRow label="Description" value={selected.spec.description || "—"} />
            <div className="space-y-1">
              <span className="text-xs text-gray-400">Tags</span>
              <div className="flex flex-wrap gap-1">
                {tagList.length > 0 ? tagList.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 rounded px-1.5 py-0.5">
                    <Tag className="w-2.5 h-2.5" />{t}
                  </span>
                )) : <span className="text-xs text-gray-400">—</span>}
              </div>
            </div>
            <MetaRow label="Prompt" value={selected.spec.prompt.slice(0, 120) + (selected.spec.prompt.length > 120 ? "…" : "")} mono />
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <p className="text-xs text-red-500">{errorMsg}</p>
        )}

        {/* Status messages */}
        {mintState === "confirming" && (
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Waiting for confirmation…
          </p>
        )}

        {/* Success */}
        {mintState === "done" && mintedTokenId !== null && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-5 space-y-3 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto" />
            <p className="text-sm font-semibold text-green-800">NFT minted successfully!</p>
            <Badge variant="secondary" className="text-base px-3 py-1">Token #{mintedTokenId}</Badge>
            <div className="flex gap-2 justify-center pt-1">
              <Button size="sm" variant="outline" asChild>
                <Link href="/library">Back to Library</Link>
              </Button>
              <Button size="sm" className="bg-gray-900 hover:bg-gray-700 text-white" asChild>
                <Link href="/marketplace">Browse Marketplace</Link>
              </Button>
            </div>
          </div>
        )}

        {/* Mint button */}
        {mintState !== "done" && (
          <Button
            className="w-full bg-gray-900 hover:bg-gray-700 text-white"
            onClick={handleMint}
            disabled={!selected || !contracts || !isConnected || isBusy}
          >
            {mintState === "sending" ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending tx…</>
            ) : mintState === "confirming" ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Confirming…</>
            ) : (
              <><Cpu className="w-4 h-4 mr-2" /> Mint NFT</>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <span className="text-xs text-gray-400">{label}</span>
      <p className={`text-sm text-gray-800 ${mono ? "font-mono text-xs leading-relaxed" : ""}`}>{value}</p>
    </div>
  )
}
