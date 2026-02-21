"use client"

import { Receipt } from "@/lib/types"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

interface ReceiptPanelProps {
  receipt: Receipt
}

export function ReceiptPanel({ receipt }: ReceiptPanelProps) {
  const rows: [string, string][] = [
    ["Session", receipt.sessionId.slice(0, 16) + "…"],
    ["Model", receipt.model],
    ["Format", receipt.outputFormat],
    ["Response time", `${(receipt.responseTimeMs / 1000).toFixed(2)}s`],
    ["Length", `${receipt.charCount} chars`],
    ["Timestamp", receipt.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })],
  ]

  return (
    <div className="space-y-1.5 pb-1">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between text-xs">
          <span className="text-gray-400">{k}</span>
          <span className="text-gray-700 font-mono">{v}</span>
        </div>
      ))}
    </div>
  )
}

/** Self-contained collapsible receipt accordion for embedding in message bubbles. */
export function ReceiptAccordion({ receipt }: ReceiptPanelProps) {
  return (
    <AccordionItem value="receipt">
      <AccordionTrigger className="px-3 text-xs text-gray-500">Receipt</AccordionTrigger>
      <AccordionContent className="px-3">
        <ReceiptPanel receipt={receipt} />
      </AccordionContent>
    </AccordionItem>
  )
}
