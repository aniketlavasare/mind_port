"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useAccount, usePublicClient, useWriteContract } from "wagmi"
import { formatEther, parseEther } from "viem"
import {
  ArrowLeft, CheckCircle2, Gavel, Loader2, Tag, XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { WalletButton } from "@/components/WalletButton"
import { BRAIN_ABI, MARKETPLACE_ABI, getContracts } from "@/lib/contracts"

const ZERO_ADDR = "0x0000000000000000000000000000000000000000"

interface PageState {
  loading: boolean
  error: string
  name: string
  description: string
  tags: string
  prompt: string
  seller: string
  minBid: bigint
  active: boolean
  highestBidder: string
  highestBidAmount: bigint
}

type TxState = "idle" | "sending" | "confirming" | "done" | "error"

export default function ListingDetailPage() {
  const params = useParams()
  const tokenId = BigInt(params?.tokenId as string ?? "0")
  const contracts = useMemo(() => getContracts(), [])
  const publicClient = usePublicClient()
  const { address, isConnected } = useAccount()
  const { writeContractAsync } = useWriteContract()

  const [state, setState] = useState<PageState>({
    loading: true, error: "", name: "", description: "", tags: "",
    prompt: "", seller: "", minBid: 0n, active: false,
    highestBidder: ZERO_ADDR, highestBidAmount: 0n,
  })

  const [bidAmount, setBidAmount] = useState("")
  const [txState, setTxState] = useState<TxState>("idle")
  const [txError, setTxError] = useState("")
  const [txLabel, setTxLabel] = useState("")

  const load = useCallback(async () => {
    if (!publicClient || !contracts) return
    setState(s => ({ ...s, loading: true, error: "" }))
    try {
      const [listing, highestBid, meta] = await Promise.all([
        publicClient.readContract({ address: contracts.marketplace, abi: MARKETPLACE_ABI, functionName: "listings", args: [tokenId] }),
        publicClient.readContract({ address: contracts.marketplace, abi: MARKETPLACE_ABI, functionName: "highestBids", args: [tokenId] }),
        publicClient.readContract({ address: contracts.agentBrain, abi: BRAIN_ABI, functionName: "getMeta", args: [tokenId] }),
      ])
      const listArr = listing as unknown as [string, bigint, boolean]
      const bidArr = highestBid as unknown as [string, bigint]
      const metaArr = meta as unknown as [string, string, string, string, string, bigint]
      setState({
        loading: false, error: "",
        name: metaArr[1], description: metaArr[2], tags: metaArr[3], prompt: metaArr[4],
        seller: listArr[0], minBid: listArr[1], active: listArr[2],
        highestBidder: bidArr[0], highestBidAmount: bidArr[1],
      })
    } catch (e: unknown) {
      setState(s => ({ ...s, loading: false, error: e instanceof Error ? e.message.split("\n")[0] : "Failed to load" }))
    }
  }, [publicClient, contracts, tokenId])

  useEffect(() => { load() }, [load])

  const isSeller = address?.toLowerCase() === state.seller.toLowerCase()
  const hasHighestBid = state.highestBidder !== ZERO_ADDR && state.highestBidder !== "0x"
  const tagList = state.tags.split(",").map(t => t.trim()).filter(Boolean)

  const sendTx = async (
    label: string,
    fn: () => Promise<`0x${string}`>,
  ) => {
    if (!publicClient) return
    setTxState("sending")
    setTxLabel(label)
    setTxError("")
    try {
      const hash = await fn()
      setTxState("confirming")
      await publicClient.waitForTransactionReceipt({ hash })
      setTxState("done")
      await load()
    } catch (e: unknown) {
      setTxError(e instanceof Error ? e.message.split("\n")[0] : "Transaction failed")
      setTxState("error")
    }
  }

  const handleBid = () => sendTx("Placing bid", () =>
    writeContractAsync({
      address: contracts!.marketplace, abi: MARKETPLACE_ABI, functionName: "placeBid",
      args: [tokenId], value: parseEther(bidAmount),
    })
  )

  const handleAccept = () => sendTx("Accepting bid", () =>
    writeContractAsync({
      address: contracts!.marketplace, abi: MARKETPLACE_ABI, functionName: "acceptHighestBid",
      args: [tokenId],
    })
  )

  const handleCancel = () => sendTx("Cancelling listing", () =>
    writeContractAsync({
      address: contracts!.marketplace, abi: MARKETPLACE_ABI, functionName: "cancelListing",
      args: [tokenId],
    })
  )

  if (state.loading) return (
    <div className="flex items-center justify-center h-screen gap-2 text-sm text-gray-400">
      <Loader2 className="w-5 h-5 animate-spin" /> Loading listing…
    </div>
  )

  if (state.error) return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <XCircle className="w-8 h-8 text-red-400" />
      <p className="text-sm text-gray-700">{state.error}</p>
      <Button variant="outline" size="sm" asChild><Link href="/marketplace">Back to Marketplace</Link></Button>
    </div>
  )

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="h-14 border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/marketplace" className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Marketplace
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold text-gray-900">Token #{tokenId.toString()}</span>
          {!state.active && <Badge variant="secondary">Inactive</Badge>}
        </div>
        <WalletButton />
      </header>

      <div className="flex-1 max-w-2xl mx-auto w-full px-6 py-8 space-y-6">

        {/* Agent info */}
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{state.name}</h1>
          {state.description && <p className="text-sm text-gray-500 mt-1">{state.description}</p>}
          {tagList.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tagList.map(t => (
                <span key={t} className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
                  <Tag className="w-2.5 h-2.5" />{t}
                </span>
              ))}
            </div>
          )}
          {state.prompt && (
            <pre className="mt-3 text-xs font-mono text-gray-500 bg-gray-50 border border-gray-200 rounded p-3 whitespace-pre-wrap">
              {state.prompt.slice(0, 300)}{state.prompt.length > 300 ? "…" : ""}
            </pre>
          )}
        </div>

        <Separator />

        {/* Listing state */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Listing</h2>
          <div className="rounded-lg border border-gray-200 p-4 space-y-2">
            {[
              ["Seller", `${state.seller.slice(0, 6)}…${state.seller.slice(-4)}`],
              ["Min bid", `${formatEther(state.minBid)} 0G`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-gray-400">{k}</span>
                <span className="font-mono text-gray-700">{v}</span>
              </div>
            ))}
            {hasHighestBid && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400 flex items-center gap-1"><Gavel className="w-3.5 h-3.5" /> Highest bid</span>
                <div className="text-right">
                  <p className="font-mono font-medium text-gray-900">{formatEther(state.highestBidAmount)} 0G</p>
                  <p className="text-xs font-mono text-gray-400">{state.highestBidder.slice(0, 6)}…{state.highestBidder.slice(-4)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tx feedback */}
        {txState === "done" && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="w-4 h-4" /> {txLabel} — confirmed.
          </div>
        )}
        {txState === "error" && txError && (
          <p className="text-xs text-red-500">{txError}</p>
        )}
        {(txState === "sending" || txState === "confirming") && (
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {txLabel}…
          </p>
        )}

        {/* Actions */}
        {!isConnected && (
          <p className="text-xs text-gray-400">Connect your wallet to interact with this listing.</p>
        )}

        {isConnected && state.active && (
          <div className="space-y-3">
            {/* Seller actions */}
            {isSeller && (
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-gray-900 hover:bg-gray-700 text-white"
                  onClick={handleAccept}
                  disabled={!hasHighestBid || txState === "sending" || txState === "confirming"}
                >
                  {!hasHighestBid ? "No bids yet" : "Accept Highest Bid"}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleCancel}
                  disabled={hasHighestBid || txState === "sending" || txState === "confirming"}
                  title={hasHighestBid ? "Cannot cancel: bids exist" : "Cancel listing"}
                >
                  {hasHighestBid ? "Cancel (bids exist)" : "Cancel Listing"}
                </Button>
              </div>
            )}

            {/* Bidder actions */}
            {!isSeller && (
              <div className="space-y-2">
                <Label>Your bid (0G)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.001"
                    min={formatEther(state.minBid)}
                    placeholder={`≥ ${formatEther(hasHighestBid ? state.highestBidAmount + 1n : state.minBid)} 0G`}
                    value={bidAmount}
                    onChange={e => setBidAmount(e.target.value)}
                    disabled={txState === "sending" || txState === "confirming"}
                  />
                  <Button
                    className="bg-gray-900 hover:bg-gray-700 text-white"
                    onClick={handleBid}
                    disabled={!bidAmount || txState === "sending" || txState === "confirming"}
                  >
                    <Gavel className="w-4 h-4 mr-1.5" /> Place Bid
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {isConnected && !state.active && (
          <p className="text-sm text-gray-500">This listing is no longer active.</p>
        )}
      </div>
    </div>
  )
}
