"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePublicClient } from "wagmi"
import { parseAbiItem } from "viem"
import { ArrowLeft, Loader2, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WalletButton } from "@/components/WalletButton"
import { ListingCard, type ListingDisplay } from "@/components/ListingCard"
import { BRAIN_ABI, MARKETPLACE_ABI, getContracts } from "@/lib/contracts"

export default function MarketplacePage() {
  const contracts = useMemo(() => getContracts(), [])
  const publicClient = usePublicClient()

  const [listings, setListings] = useState<ListingDisplay[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  const fetchListings = useCallback(async () => {
    if (!publicClient || !contracts) return
    setLoading(true)
    setErrorMsg("")

    try {
      const mktAddr = contracts.marketplace
      const brainAddr = contracts.agentBrain

      // Fetch all event types in parallel
      const [listedLogs, finalizedLogs, cancelledLogs] = await Promise.all([
        publicClient.getLogs({
          address: mktAddr,
          event: parseAbiItem("event Listed(uint256 indexed tokenId, address indexed seller, uint256 minBid)"),
          fromBlock: 0n, toBlock: "latest",
        }),
        publicClient.getLogs({
          address: mktAddr,
          event: parseAbiItem("event SaleFinalized(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 amount)"),
          fromBlock: 0n, toBlock: "latest",
        }),
        publicClient.getLogs({
          address: mktAddr,
          event: parseAbiItem("event ListingCancelled(uint256 indexed tokenId, address indexed seller)"),
          fromBlock: 0n, toBlock: "latest",
        }),
      ])

      // Compute active token IDs: listed minus (finalized ∪ cancelled)
      const resolvedIds = new Set([
        ...finalizedLogs.map(l => l.args.tokenId!.toString()),
        ...cancelledLogs.map(l => l.args.tokenId!.toString()),
      ])

      // Deduplicate (keep last occurrence per tokenId for re-listed tokens)
      const seen = new Set<string>()
      const activeTokenIds: bigint[] = []
      for (const log of [...listedLogs].reverse()) {
        const id = log.args.tokenId!.toString()
        if (!resolvedIds.has(id) && !seen.has(id)) {
          seen.add(id)
          activeTokenIds.unshift(log.args.tokenId!)
        }
      }

      // Read state for each active tokenId
      const displayListings = await Promise.all(
        activeTokenIds.map(async (tokenId) => {
          const [listing, highestBid, meta] = await Promise.all([
            publicClient.readContract({
              address: mktAddr, abi: MARKETPLACE_ABI, functionName: "listings", args: [tokenId],
            }),
            publicClient.readContract({
              address: mktAddr, abi: MARKETPLACE_ABI, functionName: "highestBids", args: [tokenId],
            }),
            publicClient.readContract({
              address: brainAddr, abi: BRAIN_ABI, functionName: "getMeta", args: [tokenId],
            }),
          ])

          const listArr = listing as unknown as [string, bigint, boolean]
          const bidArr = highestBid as unknown as [string, bigint]
          const metaArr = meta as unknown as [string, string, string, string, string, bigint]

          return {
            tokenId,
            seller: listArr[0],
            minBid: listArr[1],
            active: listArr[2],
            highestBidder: bidArr[0],
            highestBidAmount: bidArr[1],
            name: metaArr[1],
            description: metaArr[2],
            tags: metaArr[3],
            creator: metaArr[0],
          } satisfies ListingDisplay
        })
      )

      setListings(displayListings.filter(l => l.active))
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message.split("\n")[0] : "Failed to load listings")
    } finally {
      setLoading(false)
    }
  }, [publicClient, contracts])

  useEffect(() => { fetchListings() }, [fetchListings])

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Home
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold text-gray-900">Marketplace</span>
        </div>
        <WalletButton />
      </header>

      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Agent Marketplace</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {loading ? "Loading listings…" : `${listings.length} active listing${listings.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchListings} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Refresh"}
          </Button>
        </div>

        {/* Not deployed */}
        {!contracts && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
            Contracts not deployed. Run <code className="font-mono">scripts/deploy.ts</code> then restart.
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
            {errorMsg}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24 gap-2 text-sm text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading listings…
          </div>
        )}

        {/* Empty */}
        {!loading && !errorMsg && contracts && listings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
              <Store className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-700">No active listings</p>
            <p className="text-xs text-gray-400">Mint an agent and list it for sale from the Library.</p>
            <Button size="sm" variant="outline" asChild>
              <Link href="/library">Go to Library</Link>
            </Button>
          </div>
        )}

        {/* Listings grid */}
        {!loading && listings.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map(l => (
              <ListingCard key={l.tokenId.toString()} listing={l} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
