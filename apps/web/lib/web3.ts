import { createConfig, http } from "wagmi"
import { hardhat } from "wagmi/chains"
import { defineChain } from "viem"
import { injected } from "wagmi/connectors"

/** 0G Galileo Testnet — not in viem's built-in chains yet */
export const zerogTestnet = defineChain({
  id: 16602,
  name: "0G Galileo Testnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://evmrpc-testnet.0g.ai"] },
  },
  blockExplorers: {
    default: { name: "0G Scan", url: "https://chainscan-galileo.0g.ai" },
  },
  testnet: true,
})

const configuredChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 31337)
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545"

/** Wagmi v2 config — supports both Hardhat localhost (31337) and 0G Galileo (16602) */
export const wagmiConfig = createConfig({
  chains: [hardhat, zerogTestnet],
  connectors: [injected()],
  transports: {
    [hardhat.id]: http(configuredChainId === 31337 ? rpcUrl : "http://127.0.0.1:8545"),
    [zerogTestnet.id]: http(configuredChainId === 16602 ? rpcUrl : "https://evmrpc-testnet.0g.ai"),
  },
  ssr: true,
})

export const SUPPORTED_CHAIN_IDS = [31337, 16602] as const
export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number]
