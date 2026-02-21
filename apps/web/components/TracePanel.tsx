"use client"

import { TraceEvent } from "@/lib/types"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

interface TracePanelProps {
  trace: TraceEvent[]
  compact?: boolean
}

export function TracePanel({ trace, compact = false }: TracePanelProps) {
  if (trace.length === 0) return <p className="text-xs text-gray-400 py-1">No trace events.</p>

  return (
    <div className={`space-y-2 ${compact ? "pb-0" : "pb-1"}`}>
      {trace.map((event, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
            <span className="text-xs font-mono text-gray-500">
              {event.ts.split("T")[1]?.split(".")[0] ?? event.ts}
            </span>
            <span className="text-xs font-medium text-gray-700">{event.event}</span>
          </div>
          <pre className="text-xs font-mono text-gray-500 bg-gray-50 border border-gray-100 rounded p-2 ml-3.5 overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(event.detail, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  )
}

/** Self-contained collapsible trace accordion for embedding in message bubbles. */
export function TraceAccordion({ trace }: { trace: TraceEvent[] }) {
  return (
    <AccordionItem value="trace">
      <AccordionTrigger className="px-3 text-xs text-gray-500">
        Trace ({trace.length} events)
      </AccordionTrigger>
      <AccordionContent className="px-3">
        <TracePanel trace={trace} compact />
      </AccordionContent>
    </AccordionItem>
  )
}
