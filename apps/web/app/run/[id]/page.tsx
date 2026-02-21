"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  Send, Bot, User, AlertCircle, ArrowLeft, Pencil, RotateCcw, Lock, ShieldCheck, Loader2,
} from "lucide-react"
import { useAccount, useSignMessage } from "wagmi"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Accordion } from "@/components/ui/accordion"
import { ReceiptAccordion } from "@/components/ReceiptPanel"
import { TraceAccordion } from "@/components/TracePanel"
import { WalletButton } from "@/components/WalletButton"
import { renderAnswer } from "@/lib/render"
import { AgentRecord, ChatMessage, MODELS, Receipt, RunRequest, TraceEvent } from "@/lib/types"
import { getAgent, incrementRunStats } from "@/lib/storage"

interface TokenGate {
  tokenId: number
  userAddress: string
  signature: string
  nonce: string
}

export default function RunPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()

  const [agent, setAgent] = useState<AgentRecord | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [tokenGate, setTokenGate] = useState<TokenGate | null>(null)
  const [isSigning, setIsSigning] = useState(false)
  const [signError, setSignError] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Whether this agent requires owner-gating
  const requiresGate = !!agent?.onchain?.tokenId
  const isAuthorized = !requiresGate || !!tokenGate

  useEffect(() => {
    if (!id) return
    const record = getAgent(id)
    if (!record) { setNotFound(true); return }
    setAgent(record)
  }, [id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  const handleSignAuth = async () => {
    if (!agent?.onchain || !address) return
    setIsSigning(true)
    setSignError("")
    try {
      const tokenId = agent.onchain.tokenId
      const nonce = Date.now().toString()
      const message = `MindPort Run Authorization\nTokenId: ${tokenId}\nNonce: ${nonce}`
      const signature = await signMessageAsync({ message })
      setTokenGate({ tokenId, userAddress: address, signature, nonce })
    } catch (e: unknown) {
      setSignError(e instanceof Error ? e.message.split("\n")[0] : "Signing failed")
    } finally {
      setIsSigning(false)
    }
  }

  const handleSend = useCallback(async () => {
    if (!inputMessage.trim() || isLoading || !agent) return

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
      detail: { agent: agent.spec.name, message_length: userMsg.content.length, model: agent.spec.model_choice },
    }

    try {
      const request: RunRequest & { tokenGate?: TokenGate } = {
        spec: agent.spec,
        message: userMsg.content,
        session_id: sessionId,
        ...(tokenGate ? { tokenGate } : {}),
      }
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

      // Update run stats
      const updated = incrementRunStats(agent.id)
      if (updated) setAgent(updated)

      const receipt: Receipt = {
        sessionId: data.session_id,
        model: MODELS.find(m => m.value === agent.spec.model_choice)?.label ?? agent.spec.model_choice,
        outputFormat: agent.spec.policy.output_format,
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
  }, [inputMessage, isLoading, agent, tokenGate])

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 text-center">
        <p className="text-sm font-medium text-gray-700">Agent not found</p>
        <p className="text-xs text-gray-400">
          This agent may have been deleted, or the session was refreshed.
        </p>
        <Button size="sm" variant="outline" asChild>
          <Link href="/library"><ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Library</Link>
        </Button>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    )
  }

  const { spec, stats } = agent

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-gray-200 flex items-center justify-between px-5 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/library"
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Library
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold text-gray-900 truncate max-w-[200px]">{spec.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs hidden sm:flex">{spec.model_choice.split("/").pop()}</Badge>
          {agent.onchain && <Badge variant="outline" className="text-xs hidden sm:flex gap-1"><Lock className="w-2.5 h-2.5" />Token #{agent.onchain.tokenId}</Badge>}
          <span className="text-xs text-gray-400 hidden sm:block">{stats.runs} run{stats.runs !== 1 ? "s" : ""}</span>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setMessages([])} title="Clear chat">
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => router.push(`/builder?id=${agent.id}`)}>
            <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
          </Button>
          <WalletButton />
        </div>
      </header>

      {/* Agent info strip */}
      {spec.description && (
        <div className="px-5 py-2 bg-gray-50 border-b border-gray-100 shrink-0">
          <p className="text-xs text-gray-500 line-clamp-1">{spec.description}</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-16">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Bot className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">{spec.name} is ready</p>
              <p className="text-xs text-gray-400 mt-1">Send a message to start the conversation.</p>
            </div>
          </div>
        )}

        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} outputFormat={spec.policy.output_format} />
        ))}

        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Ownership gate banner */}
      {requiresGate && !isAuthorized && (
        <div className="border-t border-amber-200 bg-amber-50 px-5 py-3 shrink-0">
          <div className="flex items-center justify-between max-w-4xl mx-auto gap-3">
            <div className="flex items-center gap-2 text-xs text-amber-700">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              This agent is token-gated. Sign to verify ownership before running.
            </div>
            <div className="flex items-center gap-2">
              {!isConnected && <WalletButton />}
              {isConnected && (
                <Button size="sm" variant="outline" onClick={handleSignAuth} disabled={isSigning} className="text-xs h-7">
                  {isSigning ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Signing…</> : <><ShieldCheck className="w-3 h-3 mr-1.5" /> Sign & Authorize</>}
                </Button>
              )}
            </div>
          </div>
          {signError && <p className="text-xs text-red-500 mt-1 max-w-4xl mx-auto">{signError}</p>}
        </div>
      )}

      {requiresGate && isAuthorized && (
        <div className="border-t border-green-200 bg-green-50 px-5 py-1.5 shrink-0">
          <p className="text-xs text-green-600 flex items-center gap-1.5 max-w-4xl mx-auto">
            <ShieldCheck className="w-3 h-3" /> Ownership verified for this session.
          </p>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-200 px-5 py-4 shrink-0">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <Textarea
            placeholder={!isAuthorized ? "Sign to authorize before sending…" : "Send a message…"}
            value={inputMessage}
            onChange={e => setInputMessage(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
            }}
            rows={2}
            className="resize-none flex-1"
            disabled={isLoading || !isAuthorized}
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !inputMessage.trim() || !isAuthorized}
            className="self-end h-9 w-9 p-0"
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  )
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
