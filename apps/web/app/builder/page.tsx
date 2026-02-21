"use client"

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Send, RotateCcw, Download, Upload, Copy, Check,
  Bot, User, AlertCircle, BookOpen, Layers, Library,
  Save, SaveAll, ArrowLeft,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Accordion } from "@/components/ui/accordion"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { AgentForm, DEFAULT_FORM, FormState, formToSpec, specToForm } from "@/components/AgentForm"
import { ReceiptAccordion } from "@/components/ReceiptPanel"
import { TraceAccordion } from "@/components/TracePanel"
import { renderAnswer } from "@/lib/render"
import { ChatMessage, MODELS, Receipt, RunRequest, TraceEvent, AgentSpec } from "@/lib/types"
import { createAgent, getAgent, updateAgent } from "@/lib/storage"

// ─── Example presets (loaded via ?example= param) ────────────────────────────

const EXAMPLE_SPECS: Record<string, AgentSpec> = {
  pitch_coach: {
    name: "Pitch Coach",
    description: "Crafts concise, compelling pitches and slide outlines.",
    tags: ["pitch", "writing", "startup"],
    prompt: "You are a brutally effective pitch coach. You enforce structure, challenge vague ideas, and produce concise slide outlines and hook statements. Keep responses tight and actionable.",
    policy: { ask_clarifying_questions: true, refuse_to_guess: false, output_format: "bullets" },
    model_choice: "openai/qwen/qwen-2.5-7b-instruct",
  },
  code_reviewer: {
    name: "Code Reviewer",
    description: "Reviews code for bugs, style, and improvements.",
    tags: ["code", "review", "engineering"],
    prompt: "You are a senior software engineer reviewing code. Identify bugs, suggest improvements, highlight security issues, and always explain your reasoning. Be direct and specific.",
    policy: { ask_clarifying_questions: false, refuse_to_guess: true, output_format: "bullets" },
    model_choice: "openai/qwen/qwen-2.5-7b-instruct",
  },
  research_assistant: {
    name: "Research Assistant",
    description: "Summarises topics thoroughly with sourced reasoning.",
    tags: ["research", "analysis", "writing"],
    prompt: "You are a thorough research assistant. Summarise topics clearly, state your assumptions, and refuse to guess when uncertain. Use plain prose unless asked for bullet points.",
    policy: { ask_clarifying_questions: false, refuse_to_guess: true, output_format: "plain" },
    model_choice: "openai/qwen/qwen-2.5-7b-instruct",
  },
}

// ─── URL param reader (needs Suspense) ───────────────────────────────────────

interface ParamState { example?: string; id?: string }

function ParamReader({ onParams }: { onParams: (p: ParamState) => void }) {
  const searchParams = useSearchParams()
  useEffect(() => {
    onParams({
      example: searchParams.get("example") ?? undefined,
      id: searchParams.get("id") ?? undefined,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])
  return null
}

// ─── Main page ────────────────────────────────────────────────────────────────

function BuilderPageInner() {
  const router = useRouter()

  // Form state
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)

  // Persistence state
  const [agentId, setAgentId] = useState<string | null>(null)
  const savedSpecJson = useRef<string>("")
  const [saveLabel, setSaveLabel] = useState<string | null>(null)

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Import JSON dialog
  const [importOpen, setImportOpen] = useState(false)
  const [importJson, setImportJson] = useState("")
  const [importError, setImportError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const spec = useMemo(() => formToSpec(form), [form])

  const hasUnsavedChanges = useMemo(() => {
    if (!agentId) return false
    return JSON.stringify(spec) !== savedSpecJson.current
  }, [spec, agentId])

  // ─── URL param loading ──────────────────────────────────────────────────────

  const handleParams = useCallback(({ example, id }: ParamState) => {
    if (id) {
      const record = getAgent(id)
      if (record) {
        setForm(specToForm(record.spec))
        setAgentId(record.id)
        savedSpecJson.current = JSON.stringify(record.spec)
      }
      return
    }
    if (example && EXAMPLE_SPECS[example]) {
      setForm(specToForm(EXAMPLE_SPECS[example]))
    }
  }, [])

  // ─── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  // ─── Form change handler ────────────────────────────────────────────────────
  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }, [])

  // ─── Save / Save As ─────────────────────────────────────────────────────────

  const flashSaved = (label: string) => {
    setSaveLabel(label)
    setTimeout(() => setSaveLabel(null), 2000)
  }

  const handleSave = useCallback(() => {
    if (agentId) {
      updateAgent(agentId, spec)
      savedSpecJson.current = JSON.stringify(spec)
      flashSaved("Saved")
    } else {
      const record = createAgent(spec)
      setAgentId(record.id)
      savedSpecJson.current = JSON.stringify(spec)
      flashSaved("Saved")
      router.replace(`/builder?id=${record.id}`)
    }
  }, [agentId, spec, router])

  const handleSaveAsNew = useCallback(() => {
    const record = createAgent(spec)
    setAgentId(record.id)
    savedSpecJson.current = JSON.stringify(spec)
    flashSaved("Saved as new")
    router.replace(`/builder?id=${record.id}`)
  }, [spec, router])

  // ─── Reset / Export / Import ─────────────────────────────────────────────────

  const handleReset = () => {
    setForm(DEFAULT_FORM)
    setMessages([])
    setInputMessage("")
    setAgentId(null)
    savedSpecJson.current = ""
  }

  const handleExport = () => {
    const json = JSON.stringify(spec, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${spec.name.replace(/\s+/g, "-").toLowerCase()}-spec.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const handleCopySpec = async () => {
    await navigator.clipboard.writeText(JSON.stringify(spec, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleImportConfirm = () => {
    try {
      const parsed = JSON.parse(importJson) as AgentSpec
      setForm(specToForm(parsed))
      setImportOpen(false)
      setImportJson("")
      setImportError(null)
    } catch {
      setImportError("Invalid JSON — please check the format and try again.")
    }
  }

  // ─── Send message ────────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!inputMessage.trim() || isLoading) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: inputMessage.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInputMessage("")
    setIsLoading(true)

    const startTime = Date.now()
    const sessionId = crypto.randomUUID()

    const traceStart: TraceEvent = {
      ts: new Date().toISOString(),
      event: "request_sent",
      detail: { agent: spec.name, message_length: userMsg.content.length, model: spec.model_choice },
    }

    try {
      const request: RunRequest = { spec, message: userMsg.content, session_id: sessionId }
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      })

      const responseTimeMs = Date.now() - startTime
      const data = await res.json()

      if (!res.ok) {
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(), role: "assistant", content: "",
          timestamp: new Date(), error: data.detail || data.error || "Unknown error",
        }])
        return
      }

      const receipt: Receipt = {
        sessionId: data.session_id,
        model: MODELS.find(m => m.value === spec.model_choice)?.label ?? spec.model_choice,
        outputFormat: spec.policy.output_format,
        responseTimeMs,
        charCount: data.answer.length,
        timestamp: new Date(),
      }

      const traceEnd: TraceEvent = {
        ts: new Date().toISOString(),
        event: "response_received",
        detail: { session_id: data.session_id, answer_length: data.answer.length, response_time_ms: responseTimeMs },
      }

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: "assistant",
        content: data.answer, timestamp: new Date(),
        receipt, trace: [traceStart, traceEnd],
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: "assistant", content: "",
        timestamp: new Date(), error: err instanceof Error ? err.message : String(err),
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      <Suspense fallback={null}>
        <ParamReader onParams={handleParams} />
      </Suspense>

      {/* Header */}
      <header className="h-14 border-b border-gray-200 flex items-center justify-between px-5 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-semibold text-gray-900 tracking-tight hover:text-gray-600 transition-colors">
            MindPort
          </Link>
          {agentId && (
            <>
              <span className="text-gray-300">/</span>
              <Link href="/library" className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 transition-colors">
                <Library className="w-3.5 h-3.5" /> Library
              </Link>
              <span className="text-gray-300">/</span>
              <span className="text-xs text-gray-700 truncate max-w-[140px]">{spec.name}</span>
            </>
          )}
          {hasUnsavedChanges && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
              Unsaved changes
            </span>
          )}
          {saveLabel && (
            <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded px-1.5 py-0.5 flex items-center gap-1">
              <Check className="w-3 h-3" /> {saveLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/docs" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <BookOpen className="w-3.5 h-3.5" /> Docs
          </Link>
          <Link href="/examples" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <Layers className="w-3.5 h-3.5" /> Examples
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ─── LEFT: Agent Builder ─────────────────────────────────────────── */}
        <aside className="w-[420px] shrink-0 border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Agent Builder</h2>
              {agentId && (
                <Link href="/library" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors">
                  <ArrowLeft className="w-3 h-3" /> Library
                </Link>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setImportOpen(true)} title="Import JSON spec">
                <Upload className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleExport} title="Export JSON spec">
                <Download className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleReset} title="Reset form">
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="px-5 py-4 space-y-5">
              <AgentForm form={form} onChange={set} />

              {/* Spec preview */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500">Current spec</span>
                  <button
                    onClick={handleCopySpec}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    {copied ? "Copied" : "Copy JSON"}
                  </button>
                </div>
                <pre className="text-xs font-mono text-gray-500 bg-gray-50 border border-gray-200 rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(spec, null, 2)}
                </pre>
              </div>

              <div className="pb-4" />
            </div>
          </ScrollArea>

          {/* Save bar */}
          <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-2 shrink-0 bg-white">
            <Button
              size="sm"
              className="flex-1 bg-gray-900 hover:bg-gray-700 text-white"
              onClick={handleSave}
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {agentId ? "Save" : "Save Agent"}
            </Button>
            {agentId && (
              <Button size="sm" variant="outline" onClick={handleSaveAsNew} title="Save as new agent">
                <SaveAll className="w-3.5 h-3.5 mr-1.5" /> Save as New
              </Button>
            )}
          </div>
        </aside>

        {/* ─── RIGHT: Agent Runner ──────────────────────────────────────────── */}
        <section className="flex-1 flex flex-col overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Run Agent</h2>
              <Badge variant="secondary">{MODELS.find(m => m.value === spec.model_choice)?.label ?? spec.model_choice}</Badge>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
              >
                Clear chat
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-16">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {form.name || "Your agent"} is ready
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Send a message to start a conversation.</p>
                </div>
              </div>
            )}

            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} outputFormat={spec.policy.output_format} />
            ))}

            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 px-5 py-4 shrink-0">
            <div className="flex gap-2">
              <Textarea
                placeholder="Send a message..."
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
                }}
                rows={2}
                className="resize-none flex-1"
                disabled={isLoading}
              />
              <Button
                onClick={handleSend}
                disabled={isLoading || !inputMessage.trim()}
                className="self-end h-9 w-9 p-0"
                size="icon"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Enter to send · Shift+Enter for new line</p>
          </div>
        </section>
      </div>

      {/* Import JSON Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import AgentSpec JSON</DialogTitle>
            <DialogDescription>Paste a JSON AgentSpec below to load it into the builder.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={'{\n  "name": "My Agent",\n  "prompt": "You are..."\n}'}
            value={importJson}
            onChange={e => { setImportJson(e.target.value); setImportError(null) }}
            rows={10}
            className="font-mono text-xs"
          />
          {importError && (
            <p className="text-xs text-red-500 flex items-center gap-1.5 mt-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {importError}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportOpen(false); setImportError(null) }}>Cancel</Button>
            <Button onClick={handleImportConfirm} disabled={!importJson.trim()}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function BuilderPage() {
  return <BuilderPageInner />
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MessageBubble({ msg, outputFormat }: { msg: ChatMessage; outputFormat: string }) {
  const isUser = msg.role === "user"

  return (
    <div className={`flex gap-3 animate-fade-slide-up ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isUser ? "bg-gray-900" : "bg-gray-100 border border-gray-200"}`}>
        {isUser
          ? <User className="w-3.5 h-3.5 text-white" />
          : <Bot className="w-3.5 h-3.5 text-gray-600" />
        }
      </div>

      <div className={`max-w-[80%] space-y-2 ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <div className={`rounded-2xl px-4 py-3 ${isUser
          ? "bg-gray-900 text-white rounded-tr-sm"
          : "bg-gray-50 border border-gray-200 rounded-tl-sm"
        }`}>
          {msg.error ? (
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{msg.error}</p>
            </div>
          ) : isUser ? (
            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
          ) : (
            renderAnswer(msg.content, outputFormat)
          )}
        </div>

        {!isUser && !msg.error && (msg.receipt || msg.trace) && (
          <div className="w-full border border-gray-200 rounded-lg overflow-hidden bg-white">
            <Accordion type="multiple">
              {msg.receipt && <ReceiptAccordion receipt={msg.receipt} />}
              {msg.trace && msg.trace.length > 0 && <TraceAccordion trace={msg.trace} />}
            </Accordion>
          </div>
        )}

        <span className="text-xs text-gray-400 px-1">
          {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-slide-up">
      <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
        <Bot className="w-3.5 h-3.5 text-gray-600" />
      </div>
      <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-dot-1" />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-dot-2" />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-dot-3" />
      </div>
    </div>
  )
}
