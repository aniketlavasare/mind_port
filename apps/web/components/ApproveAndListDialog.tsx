"use client"

import React, { useState } from "react"
import { parseEther } from "viem"
import { useWriteContract, usePublicClient, useReadContract, useAccount } from "wagmi"
import { AlertCircle, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { BRAIN_ABI, MARKETPLACE_ABI } from "@/lib/contracts"

type Step = "idle" | "approving" | "approved" | "listing" | "listed" | "error"

interface ApproveAndListDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  tokenId: number
  brainAddress: `0x${string}`
  marketplaceAddress: `0x${string}`
  agentName: string
}

export function ApproveAndListDialog({
  open, onClose, onSuccess,
  tokenId, brainAddress, marketplaceAddress, agentName,
}: ApproveAndListDialogProps) {
  const { address: connectedAddress, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()

  const [minBidEth, setMinBidEth] = useState("0")
  const [step, setStep] = useState<Step>("idle")
  const [errorMsg, setErrorMsg] = useState("")

  const tokenIdBig = BigInt(tokenId)

  // Check if marketplace is already approved for this token
  const { data: approvedAddress } = useReadContract({
    address: brainAddress,
    abi: BRAIN_ABI,
    functionName: "getApproved",
    args: [tokenIdBig],
    query: { enabled: open && !!connectedAddress },
  })

  const isAlreadyApproved =
    approvedAddress?.toLowerCase() === marketplaceAddress.toLowerCase()

  const handleList = async () => {
    if (!isConnected || !publicClient) return
    setErrorMsg("")

    try {
      // Step 1: Approve (skip if already approved)
      if (!isAlreadyApproved) {
        setStep("approving")
        const approveHash = await writeContractAsync({
          address: brainAddress,
          abi: BRAIN_ABI,
          functionName: "approve",
          args: [marketplaceAddress, tokenIdBig],
        })
        await publicClient.waitForTransactionReceipt({ hash: approveHash })
      }

      setStep("listing")

      // Step 2: Create listing
      const minBidWei = parseEther(minBidEth || "0")
      const listHash = await writeContractAsync({
        address: marketplaceAddress,
        abi: MARKETPLACE_ABI,
        functionName: "createListing",
        args: [tokenIdBig, minBidWei],
      })
      await publicClient.waitForTransactionReceipt({ hash: listHash })

      setStep("listed")
      onSuccess()
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message.split("\n")[0] : "Transaction failed")
      setStep("error")
    }
  }

  const handleClose = () => { setStep("idle"); setErrorMsg(""); setMinBidEth("0"); onClose() }

  const isBusy = step === "approving" || step === "listing"

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>List Agent for Sale</DialogTitle>
          <DialogDescription>
            Listing <strong>{agentName}</strong> (Token #{tokenId}) on the marketplace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress steps */}
          <div className="flex items-center gap-2 text-xs">
            <StepIndicator
              label="Approve"
              done={isAlreadyApproved || step === "listing" || step === "listed"}
              active={step === "approving"}
              skipped={isAlreadyApproved}
            />
            <div className="flex-1 h-px bg-gray-200" />
            <StepIndicator
              label="List"
              done={step === "listed"}
              active={step === "listing"}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Minimum bid (ETH) — set to 0 for any bid</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.0"
              value={minBidEth}
              onChange={e => setMinBidEth(e.target.value)}
              disabled={isBusy}
            />
          </div>

          {errorMsg && (
            <p className="text-xs text-red-500 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {errorMsg}
            </p>
          )}

          {step === "approving" && (
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Approving marketplace…
            </p>
          )}
          {step === "listing" && (
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating listing…
            </p>
          )}
          {step === "listed" && (
            <p className="text-xs text-green-600 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> Listed successfully!
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isBusy}>Cancel</Button>
          <Button onClick={handleList} disabled={isBusy || !isConnected || step === "listed"}>
            {isBusy ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Working…</> : "Approve & List"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StepIndicator({ label, done, active, skipped }: { label: string; done: boolean; active: boolean; skipped?: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 ${active ? "text-gray-900" : done ? "text-green-600" : "text-gray-400"}`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium border ${
        done ? "bg-green-600 border-green-600 text-white" :
        active ? "border-gray-900 text-gray-900" : "border-gray-300"
      }`}>
        {done ? "✓" : skipped ? "–" : active ? "●" : "○"}
      </div>
      <span>{label}{skipped ? " (skip)" : ""}</span>
    </div>
  )
}
