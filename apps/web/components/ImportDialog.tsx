"use client"

import React, { useRef, useState } from "react"
import { AlertCircle, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { AgentRecord } from "@/lib/types"
import { importAgents } from "@/lib/storage"

interface ImportDialogProps {
  open: boolean
  onClose: () => void
  onImported: (records: AgentRecord[]) => void
}

export function ImportDialog({ open, onClose, onImported }: ImportDialogProps) {
  const [jsonText, setJsonText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setJsonText("")
    setError(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const [importing, setImporting] = useState(false)

  const handleImport = async () => {
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      setError("Invalid JSON — please check the format and try again.")
      return
    }
    setImporting(true)
    try {
      const records = await importAgents(parsed)
      if (records.length === 0) {
        setError("No valid agents found. Check that the JSON matches the AgentSpec or AgentRecord format.")
        return
      }
      onImported(records)
      handleClose()
    } catch {
      setError("Import failed — please try again.")
    } finally {
      setImporting(false)
    }
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      setJsonText(text)
      setError(null)
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Agents</DialogTitle>
          <DialogDescription>
            Paste JSON (AgentRecord, AgentSpec, or array of either) or upload a file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            placeholder={'[\n  {\n    "name": "My Agent",\n    "prompt": "You are..."\n  }\n]'}
            value={jsonText}
            onChange={e => { setJsonText(e.target.value); setError(null) }}
            rows={10}
            className="font-mono text-xs"
          />

          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-900 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> Upload JSON file
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFile} />

          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleImport} disabled={!jsonText.trim() || importing}>
            {importing ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
