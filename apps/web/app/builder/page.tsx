"use client"

import React, { useState, useCallback, useEffect, useRef, useMemo, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  Send, RotateCcw, Download, Upload, Copy, Check,
  Bot, User, AlertCircle, BookOpen, Layers
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { renderAnswer } from "@/lib/render"
import { AgentSpec, ChatMessage, DEFAULT_MODEL, DEFAULT_POLICY, MODELS, PolicyToggles, Receipt, RunRequest, TraceEvent } from "@/lib/types"

// ─── Example presets (loaded via ?example= param) ────────────────────────────

const EXAMPLE_SPECS: Record<string, AgentSpec> = {
  pitch_coach: {
    name: "Pitch Coach",
    description: "Crafts concise, compelling pitches and slide outlines.",
    tags: ["pitch", "writing", "startup"],
    prompt: "You are a brutally effective pitch coach. You enforce structure, challenge vague ideas, and produce concise slide outlines and hook statements. Keep responses tight and actionable.",
    policy: { ...DEFAULT_POLICY, output_format: "bullets", ask_clarifying_questions: true },
    model_choice: DEFAULT_MODEL,
  },
  code_reviewer: {
    name: "Code Reviewer",
    description: "Reviews code for bugs, style, and improvements.",
    tags: ["code", "review", "engineering"],
    prompt: "You are a senior software engineer reviewing code. Identify bugs, suggest improvements, highlight security issues, and always explain your reasoning. Be direct and specific.",
    policy: { ...DEFAULT_POLICY, output_format: "bullets", refuse_to_guess: true },
    model_choice: DEFAULT_MODEL,
  },
  research_assistant: {
    name: "Research Assistant",
    description: "Summarises topics thoroughly with sourced reasoning.",
    tags: ["research", "analysis", "writing"],
    prompt: "You are a thorough research assistant. Summarise topics clearly, state your assumptions, and refuse to guess when uncertain. Use plain prose unless asked for bullet points.",
    policy: { ...DEFAULT_POLICY, output_format: "plain", refuse_to_guess: true },
    model_choice: DEFAULT_MODEL,
  },
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormState {
  name: string
  description: string
  tagsInput: string
  prompt: string
  askClarifying: boolean
  refuseToGuess: boolean
  outputFormat: "plain" | "bullets" | "json"
  temperature: string
  maxOutputTokens: string
  toolsCode: string
  modelChoice: string
}

const DEFAULT_FORM: FormState = {
  name: "", description: "", tagsInput: "",
  prompt: "", askClarifying: false, refuseToGuess: false,
  outputFormat: "plain", temperature: "", maxOutputTokens: "",
  toolsCode: "", modelChoice: DEFAULT_MODEL,
}

function formToSpec(f: FormState): AgentSpec {
  const parsedTemp = f.temperature ? parseFloat(f.temperature) : undefined
  const parsedTokens = f.maxOutputTokens ? parseInt(f.maxOutputTokens, 10) : undefined
  const policy: PolicyToggles = {
    ask_clarifying_questions: f.askClarifying,
    refuse_to_guess: f.refuseToGuess,
    output_format: f.outputFormat,
    temperature: parsedTemp !== undefined && !isNaN(parsedTemp) ? parsedTemp : undefined,
    max_output_tokens: parsedTokens !== undefined && !isNaN(parsedTokens) ? parsedTokens : undefined,
  }
  return {
    name: f.name.trim() || "Unnamed Agent",
    description: f.description,
    tags: f.tagsInput.split(",").map(t => t.trim()).filter(Boolean),
    prompt: f.prompt.trim() || "You are a helpful assistant.",
    policy,
    model_choice: f.modelChoice,
  }
}

function specToForm(spec: AgentSpec): FormState {
  return {
    name: spec.name,
    description: spec.description,
    tagsInput: (spec.tags ?? []).join(", "),
    prompt: spec.prompt,
    askClarifying: spec.policy?.ask_clarifying_questions ?? false,
    refuseToGuess: spec.policy?.refuse_to_guess ?? false,
    outputFormat: (spec.policy?.output_format as FormState["outputFormat"]) ?? "plain",
    temperature: spec.policy?.temperature?.toString() ?? "",
    maxOutputTokens: spec.policy?.max_output_tokens?.toString() ?? "",
    toolsCode: "",
    modelChoice: spec.model_choice || DEFAULT_MODEL,
  }
}

// ─── Reads ?example= and fires a callback — must be wrapped in Suspense ───────

function ExampleLoader({ onLoad }: { onLoad: (spec: AgentSpec) => void }) {
  const searchParams = useSearchParams()
  useEffect(() => {
    const example = searchParams.get("example")
    if (example && EXAMPLE_SPECS[example]) {
      onLoad(EXAMPLE_SPECS[example])
    }
  }, [searchParams, onLoad])
  return null
}

// ─── Main page ────────────────────────────────────────────────────────────────

function BuilderPageInner() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importJson, setImportJson] = useState("")
  const [importError, setImportError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const spec = useMemo(() => formToSpec(form), [form])

  const handleLoadExample = useCallback((exampleSpec: AgentSpec) => {
    setForm(specToForm(exampleSpec))
  }, [])

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleReset = () => {
    setForm(DEFAULT_FORM)
    setMessages([])
    setInputMessage("")
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
        <ExampleLoader onLoad={handleLoadExample} />
      </Suspense>
      {/* Header */}
      <header className="h-14 border-b border-gray-200 flex items-center justify-between px-5 shrink-0">
        <Link href="/" className="font-semibold text-gray-900 tracking-tight hover:text-gray-600 transition-colors">
          MindPort
        </Link>
        <div className="flex items-center gap-4">
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
            <h2 className="text-sm font-semibold text-gray-900">Agent Builder</h2>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => setImportOpen(true)} title="Import JSON">
                <Upload className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleExport} title="Export JSON">
                <Download className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleReset} title="Reset">
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="px-5 py-4 space-y-5">

              {/* Basics */}
              <Section title="Basics">
                <Field label="Name">
                  <Input placeholder="e.g. Pitch Coach" value={form.name} onChange={e => set("name", e.target.value)} />
                </Field>
                <Field label="Description">
                  <Textarea placeholder="What does this agent do?" value={form.description} onChange={e => set("description", e.target.value)} rows={2} />
                </Field>
                <Field label="Tags (comma separated)">
                  <Input placeholder="pitch, writing, startup" value={form.tagsInput} onChange={e => set("tagsInput", e.target.value)} />
                </Field>
              </Section>

              <Separator />

              {/* Prompt */}
              <Section title="System Prompt">
                <Textarea
                  placeholder="You are a helpful assistant..."
                  value={form.prompt}
                  onChange={e => set("prompt", e.target.value)}
                  rows={6}
                  className="font-mono text-xs leading-relaxed"
                />
              </Section>

              <Separator />

              {/* Policy */}
              <Section title="Policy">
                <ToggleRow
                  label="Ask clarifying questions"
                  description="Prompt the agent to ask before answering ambiguous requests."
                  checked={form.askClarifying}
                  onCheckedChange={v => set("askClarifying", v)}
                />
                <ToggleRow
                  label="Refuse to guess"
                  description="Agent admits uncertainty instead of speculating."
                  checked={form.refuseToGuess}
                  onCheckedChange={v => set("refuseToGuess", v)}
                />
                <Field label="Output format">
                  <Select value={form.outputFormat} onValueChange={v => set("outputFormat", v as FormState["outputFormat"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="plain">Plain text</SelectItem>
                      <SelectItem value="bullets">Bullet points</SelectItem>
                      <SelectItem value="json">JSON only</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Temperature (0–2)">
                    <Input
                      type="number" min="0" max="2" step="0.1"
                      placeholder="0.7"
                      value={form.temperature}
                      onChange={e => set("temperature", e.target.value)}
                    />
                  </Field>
                  <Field label="Max output tokens">
                    <Input
                      type="number" min="1" max="8192"
                      placeholder="512"
                      value={form.maxOutputTokens}
                      onChange={e => set("maxOutputTokens", e.target.value)}
                    />
                  </Field>
                </div>
              </Section>

              <Separator />

              {/* Tools */}
              <Section title="Tools (Python)">
                <p className="text-xs text-gray-400 mb-2">
                  Paste Python function definitions here for future use.
                </p>
                <Textarea
                  placeholder={"def my_tool(input: str) -> str:\n    return input.upper()"}
                  value={form.toolsCode}
                  onChange={e => set("toolsCode", e.target.value)}
                  rows={5}
                  className="font-mono text-xs leading-relaxed"
                />
              </Section>

              <Separator />

              {/* Model */}
              <Section title="Model">
                <Field label="Inference model">
                  <Select value={form.modelChoice} onValueChange={v => set("modelChoice", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MODELS.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <p className="text-xs text-gray-400">Served via 0G Compute OpenAI-compatible proxy.</p>
              </Section>

              {/* Spec preview */}
              <Separator />
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
        </aside>

        {/* ─── RIGHT: Agent Runner ──────────────────────────────────────────── */}
        <section className="flex-1 flex flex-col overflow-hidden">
          {/* Runner header */}
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
              <Button onClick={handleSend} disabled={isLoading || !inputMessage.trim()} className="self-end h-9 w-9 p-0" size="icon">
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function ToggleRow({ label, description, checked, onCheckedChange }: {
  label: string; description: string; checked: boolean; onCheckedChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm text-gray-800">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="shrink-0 mt-0.5" />
    </div>
  )
}

function MessageBubble({ msg, outputFormat }: { msg: ChatMessage; outputFormat: string }) {
  const isUser = msg.role === "user"

  return (
    <div className={`flex gap-3 animate-fade-slide-up ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isUser ? "bg-gray-900" : "bg-gray-100 border border-gray-200"}`}>
        {isUser
          ? <User className="w-3.5 h-3.5 text-white" />
          : <Bot className="w-3.5 h-3.5 text-gray-600" />
        }
      </div>

      {/* Bubble */}
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

        {/* Receipt + Trace accordion for assistant messages */}
        {!isUser && !msg.error && msg.receipt && (
          <div className="w-full border border-gray-200 rounded-lg overflow-hidden bg-white">
            <Accordion type="multiple">
              <AccordionItem value="receipt">
                <AccordionTrigger className="px-3 text-xs text-gray-500">Receipt</AccordionTrigger>
                <AccordionContent className="px-3">
                  <ReceiptPanel receipt={msg.receipt} />
                </AccordionContent>
              </AccordionItem>
              {msg.trace && (
                <AccordionItem value="trace">
                  <AccordionTrigger className="px-3 text-xs text-gray-500">Trace</AccordionTrigger>
                  <AccordionContent className="px-3">
                    <TracePanel trace={msg.trace} />
                  </AccordionContent>
                </AccordionItem>
              )}
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

function ReceiptPanel({ receipt }: { receipt: Receipt }) {
  return (
    <div className="space-y-1.5 pb-1">
      {[
        ["Session", receipt.sessionId.slice(0, 16) + "…"],
        ["Model", receipt.model],
        ["Format", receipt.outputFormat],
        ["Response time", `${(receipt.responseTimeMs / 1000).toFixed(2)}s`],
        ["Length", `${receipt.charCount} chars`],
      ].map(([k, v]) => (
        <div key={k} className="flex justify-between text-xs">
          <span className="text-gray-400">{k}</span>
          <span className="text-gray-700 font-mono">{v}</span>
        </div>
      ))}
    </div>
  )
}

function TracePanel({ trace }: { trace: TraceEvent[] }) {
  return (
    <div className="space-y-2 pb-1">
      {trace.map((event, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
            <span className="text-xs font-mono text-gray-500">{event.ts.split("T")[1].split(".")[0]}</span>
            <span className="text-xs font-medium text-gray-700">{event.event}</span>
          </div>
          <pre className="text-xs font-mono text-gray-500 bg-gray-50 border border-gray-100 rounded p-2 ml-3.5 overflow-x-auto">
            {JSON.stringify(event.detail, null, 2)}
          </pre>
        </div>
      ))}
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
