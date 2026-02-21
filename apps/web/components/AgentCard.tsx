"use client"

import React from "react"
import { useRouter } from "next/navigation"
import {
  MoreHorizontal, Play, Pencil, Copy, Trash2, Download,
  Star, StarOff, Tag,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AgentRecord } from "@/lib/types"
import { formatRelativeTime, formatRunCount } from "@/lib/formatting"

const COLOR_DOT: Record<AgentRecord["ui"]["colorTag"], string> = {
  none: "bg-transparent",
  gray: "bg-gray-400",
  black: "bg-gray-900",
}

interface AgentCardProps {
  agent: AgentRecord
  onOpen: () => void
  onRun: () => void
  onDuplicate: () => void
  onDelete: () => void
  onExport: () => void
  onToggleFavorite: () => void
}

export function AgentCard({
  agent, onOpen, onRun, onDuplicate, onDelete, onExport, onToggleFavorite,
}: AgentCardProps) {
  const { spec, stats, ui } = agent

  return (
    <div className="group relative rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm transition-all duration-150">

      {/* Color tag dot */}
      {ui.colorTag !== "none" && (
        <span className={`absolute top-3 right-10 w-2 h-2 rounded-full ${COLOR_DOT[ui.colorTag]}`} />
      )}

      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {ui.favorite && <Star className="w-3 h-3 text-gray-400 fill-gray-400 shrink-0" />}
            <h3 className="text-sm font-semibold text-gray-900 truncate">{spec.name}</h3>
          </div>
          {spec.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{spec.description}</p>
          )}
        </div>

        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onOpen}>
              <Pencil className="w-3.5 h-3.5 mr-2" /> Edit in Builder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRun}>
              <Play className="w-3.5 h-3.5 mr-2" /> Run Agent
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onToggleFavorite}>
              {ui.favorite
                ? <><StarOff className="w-3.5 h-3.5 mr-2" /> Remove from favorites</>
                : <><Star className="w-3.5 h-3.5 mr-2" /> Add to favorites</>
              }
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="w-3.5 h-3.5 mr-2" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExport}>
              <Download className="w-3.5 h-3.5 mr-2" /> Export JSON
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600 focus:bg-red-50">
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tags */}
      {spec.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {spec.tags.slice(0, 4).map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 rounded px-1.5 py-0.5"
            >
              <Tag className="w-2.5 h-2.5" />{tag}
            </span>
          ))}
          {spec.tags.length > 4 && (
            <span className="text-xs text-gray-400">+{spec.tags.length - 4}</span>
          )}
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">{spec.model_choice.split("/").pop()}</Badge>
          <span className="text-xs text-gray-400">{formatRunCount(stats.runs)}</span>
        </div>
        <span className="text-xs text-gray-400">{formatRelativeTime(agent.updatedAt)}</span>
      </div>

      {/* Quick-action buttons (always visible on mobile, hover on desktop) */}
      <div className="flex gap-1.5 mt-3">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-7 text-xs"
          onClick={onOpen}
        >
          <Pencil className="w-3 h-3 mr-1" /> Edit
        </Button>
        <Button
          size="sm"
          className="flex-1 h-7 text-xs bg-gray-900 hover:bg-gray-700 text-white"
          onClick={onRun}
        >
          <Play className="w-3 h-3 mr-1" /> Run
        </Button>
      </div>
    </div>
  )
}
