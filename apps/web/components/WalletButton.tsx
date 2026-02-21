"use client"

import { useAccount, useConnect, useDisconnect } from "wagmi"
import { injected } from "wagmi/connectors"
import { Wallet, AlertTriangle, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SUPPORTED_CHAIN_IDS } from "@/lib/web3"

const CHAIN_NAMES: Record<number, string> = {
  31337: "Localhost 31337",
  16602: "0G Galileo Testnet",
}

export function WalletButton() {
  const { address, isConnected, chain } = useAccount()
  const { connect, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()

  const configuredChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 31337)
  const onCorrectChain = chain?.id === configuredChainId

  if (isConnected && !onCorrectChain) {
    const expected = CHAIN_NAMES[configuredChainId] ?? `Chain ${configuredChainId}`
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-amber-200 bg-amber-50 text-xs text-amber-700">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        Switch to {expected}
      </div>
    )
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-end">
          <span className="text-xs font-mono text-gray-600 bg-gray-100 border border-gray-200 rounded px-2 py-1">
            {address.slice(0, 6)}…{address.slice(-4)}
          </span>
          {chain && (
            <span className="text-[10px] text-gray-400 mt-0.5">
              {CHAIN_NAMES[chain.id] ?? `Chain ${chain.id}`}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => disconnect()}
          className="h-7 w-7 p-0 text-gray-400 hover:text-gray-700"
          title="Disconnect wallet"
        >
          <LogOut className="w-3.5 h-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => connect({ connector: injected() })}
      disabled={isConnecting}
      className="h-8 text-xs gap-1.5"
    >
      <Wallet className="w-3.5 h-3.5" />
      {isConnecting ? "Connecting…" : "Connect Wallet"}
    </Button>
  )
}

// Re-export for convenience
export { SUPPORTED_CHAIN_IDS }
