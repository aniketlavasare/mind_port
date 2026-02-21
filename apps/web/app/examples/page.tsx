"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { AgentSpec, DEFAULT_MODEL } from "@/lib/types"

const EXAMPLES: { id: string; title: string; subtitle: string; spec: AgentSpec }[] = [
  {
    id: "pitch_coach",
    title: "Pitch Coach",
    subtitle: "Crafts compelling pitches, hooks, and slide outlines for startup founders.",
    spec: {
      name: "Pitch Coach",
      description: "Crafts concise, compelling pitches and slide outlines.",
      tags: ["pitch", "writing", "startup"],
      prompt: "You are a brutally effective pitch coach. You enforce structure, challenge vague ideas, and produce concise slide outlines and hook statements. Keep responses tight and actionable.",
      policy: { ask_clarifying_questions: true, refuse_to_guess: false, output_format: "bullets" },
      model_choice: DEFAULT_MODEL,
    },
  },
  {
    id: "code_reviewer",
    title: "Code Reviewer",
    subtitle: "Reviews code for bugs, style issues, and security vulnerabilities.",
    spec: {
      name: "Code Reviewer",
      description: "Reviews code for bugs, style, and improvements.",
      tags: ["code", "review", "engineering"],
      prompt: "You are a senior software engineer reviewing code. Identify bugs, suggest improvements, highlight security issues, and always explain your reasoning. Be direct and specific.",
      policy: { ask_clarifying_questions: false, refuse_to_guess: true, output_format: "bullets" },
      model_choice: DEFAULT_MODEL,
    },
  },
  {
    id: "research_assistant",
    title: "Research Assistant",
    subtitle: "Summarises topics thoroughly with clear assumptions and sourced reasoning.",
    spec: {
      name: "Research Assistant",
      description: "Summarises topics thoroughly with sourced reasoning.",
      tags: ["research", "analysis", "writing"],
      prompt: "You are a thorough research assistant. Summarise topics clearly, state your assumptions, and refuse to guess when uncertain. Use plain prose unless asked for bullet points.",
      policy: { ask_clarifying_questions: false, refuse_to_guess: true, output_format: "plain" },
      model_choice: DEFAULT_MODEL,
    },
  },
]

export default function ExamplesPage() {
  const router = useRouter()

  const handleLoad = (id: string) => {
    router.push(`/builder?example=${id}`)
  }

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-gray-900">Examples</span>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">Example Agents</h1>
          <p className="text-gray-500">
            Pre-built AgentSpec templates. Click "Load in Builder" to open any example in the builder,
            where you can customise and run it.
          </p>
        </div>

        <div className="space-y-4">
          {EXAMPLES.map(ex => (
            <div
              key={ex.id}
              className="border border-gray-200 rounded-lg p-5 hover:border-gray-400 transition-colors group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-semibold text-gray-900">{ex.title}</h2>
                    {ex.spec.tags.map(tag => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500">{ex.subtitle}</p>

                  <div className="flex gap-3 pt-1 flex-wrap text-xs text-gray-400">
                    <span>Output: <span className="font-mono">{ex.spec.policy.output_format}</span></span>
                    <span>Clarifying: <span className="font-mono">{ex.spec.policy.ask_clarifying_questions ? "yes" : "no"}</span></span>
                    <span>Refuse to guess: <span className="font-mono">{ex.spec.policy.refuse_to_guess ? "yes" : "no"}</span></span>
                  </div>
                </div>

                <button
                  onClick={() => handleLoad(ex.id)}
                  className="flex items-center gap-1.5 shrink-0 text-sm bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
                >
                  Load in Builder
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Prompt preview */}
              <div className="mt-4 border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-400 mb-1.5">System prompt</p>
                <p className="text-xs text-gray-600 font-mono leading-relaxed bg-gray-50 p-3 rounded border border-gray-100 line-clamp-3">
                  {ex.spec.prompt}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 border-t border-gray-100 pt-6 flex gap-3">
          <Link href="/builder" className="text-sm bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors">
            Open Builder
          </Link>
          <Link href="/docs" className="text-sm border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors">
            Read Docs
          </Link>
        </div>
      </main>
    </div>
  )
}
