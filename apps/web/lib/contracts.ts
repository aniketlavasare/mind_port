/**
 * Static ABIs and dynamic address loader for deployed contracts.
 * ABIs are derived from the Solidity source and never need to be regenerated
 * unless the contract interface changes.
 * Addresses come from contracts.local.json, written by scripts/export-contracts.ts.
 */

import { parseAbi } from "viem"
import localAddrs from "./contracts.local.json"

// ─── ABIs ─────────────────────────────────────────────────────────────────────

export const BRAIN_ABI = parseAbi([
  // Core mint / metadata
  "function mint(string name_, string description_, string tags_, string prompt_) returns (uint256)",
  "function getMeta(uint256 tokenId) view returns (address creator, string name_, string description_, string tags_, string prompt_, uint64 createdAt)",
  "function updateMeta(uint256 tokenId, string name_, string description_, string tags_, string prompt_)",
  "function totalMinted() view returns (uint256)",
  // ERC-721
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function approve(address to, uint256 tokenId)",
  "function getApproved(uint256 tokenId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  // Events
  "event Minted(uint256 indexed tokenId, address indexed owner, address indexed creator, string name)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)",
])

export const MARKETPLACE_ABI = parseAbi([
  // Write
  "function createListing(uint256 tokenId, uint256 minBid)",
  "function placeBid(uint256 tokenId) payable",
  "function acceptHighestBid(uint256 tokenId)",
  "function cancelListing(uint256 tokenId)",
  // Read
  "function listings(uint256 tokenId) view returns (address seller, uint256 minBid, bool active)",
  "function highestBids(uint256 tokenId) view returns (address bidder, uint256 amount)",
  "function nft() view returns (address)",
  // Events
  "event Listed(uint256 indexed tokenId, address indexed seller, uint256 minBid)",
  "event BidPlaced(uint256 indexed tokenId, address indexed bidder, uint256 amount)",
  "event BidRefunded(uint256 indexed tokenId, address indexed bidder, uint256 amount)",
  "event SaleFinalized(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 amount)",
  "event ListingCancelled(uint256 indexed tokenId, address indexed seller)",
])

// ─── Address loader ───────────────────────────────────────────────────────────

export interface ContractAddresses {
  chainId: number
  agentBrain: `0x${string}`
  marketplace: `0x${string}`
}

const ZERO = "0x0000000000000000000000000000000000000000"

/** Returns contract addresses or null if not yet deployed (zero addresses in JSON). */
export function getContracts(): ContractAddresses | null {
  const { agentBrain, marketplace, chainId } = localAddrs
  if (!agentBrain || agentBrain === ZERO || !marketplace || marketplace === ZERO) return null
  return {
    chainId,
    agentBrain: agentBrain as `0x${string}`,
    marketplace: marketplace as `0x${string}`,
  }
}
