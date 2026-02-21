"use client"

import Link from "next/link"
import { formatEther } from "viem"
import { Tag, Gavel, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export interface ListingDisplay {
  tokenId: bigint
  seller: string
  minBid: bigint
  active: boolean
  highestBidder: string
  highestBidAmount: bigint
  // metadata
  name: string
  description: string
  tags: string
  creator: string
}

interface ListingCardProps {
  listing: ListingDisplay
}

export function ListingCard({ listing }: ListingCardProps) {
  const hasHighestBid = listing.highestBidder !== "0x0000000000000000000000000000000000000000"
  const tagList = listing.tags ? listing.tags.split(",").map(t => t.trim()).filter(Boolean) : []

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm transition-all duration-150">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs shrink-0">#{listing.tokenId.toString()}</Badge>
            <h3 className="text-sm font-semibold text-gray-900 truncate">{listing.name}</h3>
          </div>
          {listing.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{listing.description}</p>
          )}
        </div>
      </div>

      {tagList.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {tagList.slice(0, 3).map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
              <Tag className="w-2.5 h-2.5" />{tag}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-1 border-t border-gray-100 pt-2 mt-2">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Min bid</span>
          <span className="font-mono text-gray-700">{formatEther(listing.minBid)} 0G</span>
        </div>
        {hasHighestBid && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-400 flex items-center gap-1">
              <Gavel className="w-3 h-3" /> Highest bid
            </span>
            <span className="font-mono text-gray-900 font-medium">{formatEther(listing.highestBidAmount)} 0G</span>
          </div>
        )}
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Seller</span>
          <span className="font-mono text-gray-500">{listing.seller.slice(0, 6)}…{listing.seller.slice(-4)}</span>
        </div>
      </div>

      <Button size="sm" variant="outline" className="w-full mt-3 h-7 text-xs" asChild>
        <Link href={`/marketplace/${listing.tokenId.toString()}`}>
          View Listing <ArrowRight className="w-3 h-3 ml-1" />
        </Link>
      </Button>
    </div>
  )
}
