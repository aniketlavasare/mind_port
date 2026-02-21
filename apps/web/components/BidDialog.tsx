"use client"

import React, { useState } from "react"
import { parseEther, formatEther } from "viem"
import { useWriteContract, usePublicClient, useAccount } from "wagmi"
import { AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { MARKETPLACE_ABI } from "@/lib/contracts"

interface BidDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  tokenId: bigint
  marketplaceAddress: `0x${string}`
  minBid: bigint
  currentHighestBid: bigint
}

export function BidDialog({
  open, onClose, onSuccess,
  tokenId, marketplaceAddress, minBid, currentHighestBid,
}: BidDialogProps) {
  const { isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()

  const [amount, setAmount] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "confirming" | "done" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  const floorBid = currentHighestBid > 0n ? currentHighestBid + 1n : minBid
  const floorEth = formatEther(floorBid)

  const handleBid = async () => {
    if (!isConnected || !publicClient) return
    const value = parseEther(amount)
    if (value < minBid) { setErrorMsg(`Minimum bid is ${formatEther(minBid)} ETH`); return }
    if (value <= currentHighestBid) { setErrorMsg(`Must exceed current highest bid of ${formatEther(currentHighestBid)} ETH`); return }

    setStatus("sending")
    setErrorMsg("")
    try {
      const hash = await writeContractAsync({
        address: marketplaceAddress,
        abi: MARKETPLACE_ABI,
        functionName: "placeBid",
        args: [tokenId],
        value,
      })
      setStatus("confirming")
      await publicClient.waitForTransactionReceipt({ hash })
      setStatus("done")
      onSuccess()
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message.split("\n")[0] : "Transaction failed")
      setStatus("error")
    }
  }

  const handleClose = () => { setAmount(""); setStatus("idle"); setErrorMsg(""); onClose() }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Place a Bid</DialogTitle>
          <DialogDescription>
            Token #{tokenId.toString()} · Minimum: {formatEther(minBid)} ETH
            {currentHighestBid > 0n && ` · Current highest: ${formatEther(currentHighestBid)} ETH`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Bid amount (ETH)</Label>
            <Input
              type="number"
              step="0.001"
              min={floorEth}
              placeholder={floorEth}
              value={amount}
              onChange={e => { setAmount(e.target.value); setErrorMsg("") }}
              disabled={status === "sending" || status === "confirming"}
            />
          </div>
          {errorMsg && (
            <p className="text-xs text-red-500 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {errorMsg}
            </p>
          )}
          {status === "confirming" && (
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Confirming transaction…
            </p>
          )}
          {status === "done" && (
            <p className="text-xs text-green-600">✔ Bid placed successfully.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleBid}
            disabled={!amount || status === "sending" || status === "confirming" || !isConnected}
          >
            {status === "sending" ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Sending…</> : "Place Bid"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
