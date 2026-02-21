import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-gray-900">Docs</span>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-12 space-y-12">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">AgentSpec</h1>
          <p className="text-gray-500 leading-relaxed">
            An AgentSpec is a JSON document that fully defines an AI agent — its persona, policy,
            and model. The builder assembles this spec from your form inputs and sends it to the
            ADK runtime on every message.
          </p>
        </div>

        <DocSection title="Top-level fields">
          <FieldTable rows={[
            ["name", "string", "Display name for the agent. Used as the ADK agent identifier."],
            ["description", "string", "Short description (informational only)."],
            ["tags", "string[]", "Arbitrary labels for categorisation."],
            ["prompt", "string", "The system prompt. This is the core instruction that shapes all agent behaviour."],
            ["policy", "PolicyToggles", "Behavioural flags appended as instructions to the system prompt."],
            ["model_choice", "string", "Model identifier. Passed for audit; runtime always uses the configured default model."],
          ]} />
        </DocSection>

        <DocSection title="PolicyToggles">
          <FieldTable rows={[
            ["ask_clarifying_questions", "boolean", 'Appends: "Ask up to 2 clarifying questions before answering if the request is ambiguous."'],
            ["refuse_to_guess", "boolean", 'Appends: "If unsure, say so explicitly and ask for the required information."'],
            ["output_format", '"plain" | "bullets" | "json"', 'plain: prose. bullets: appends bullet-point instruction. json: appends "output valid JSON only".'],
            ["temperature", "number (0–2)", "Sampling temperature passed to LiteLLM. Lower = more deterministic."],
            ["max_output_tokens", "number (1–8192)", "Token limit passed to LiteLLM."],
          ]} />
        </DocSection>

        <DocSection title="Full example">
          <pre className="text-xs font-mono bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto leading-relaxed">
{`{
  "name": "Pitch Coach",
  "description": "Crafts compelling pitches and slide outlines.",
  "tags": ["pitch", "startup", "writing"],
  "prompt": "You are a brutally effective pitch coach. Enforce structure, challenge vague ideas, and produce concise slide outlines and hook statements. Keep responses tight and actionable.",
  "policy": {
    "ask_clarifying_questions": true,
    "refuse_to_guess": false,
    "output_format": "bullets",
    "temperature": 0.7,
    "max_output_tokens": 512
  },
  "model_choice": "openai/qwen/qwen-2.5-7b-instruct"
}`}
          </pre>
        </DocSection>

        <DocSection title="How policy enforcement works">
          <p className="text-sm text-gray-600 leading-relaxed">
            Policy flags are <strong>prompt-level</strong> — they append short instruction sentences to the system
            prompt before the agent runs. The model is not hard-constrained, but a well-written base prompt combined
            with these flags reliably shapes the output.
          </p>
          <div className="mt-4 space-y-2">
            {[
              ["ask_clarifying_questions: true", '"Ask up to 2 clarifying questions before answering if the request is ambiguous or under-specified."'],
              ["refuse_to_guess: true", '"If you are unsure or lack sufficient information, say so explicitly and ask for the required information."'],
              ['output_format: "json"', '"Output valid JSON only. Do not include any text outside the JSON."'],
              ['output_format: "bullets"', '"Use bullet points for your response."'],
            ].map(([flag, instruction]) => (
              <div key={flag} className="rounded-md border border-gray-200 p-3 space-y-1">
                <code className="text-xs font-mono text-gray-700">{flag}</code>
                <p className="text-xs text-gray-500 leading-relaxed">Appends: <em>{instruction}</em></p>
              </div>
            ))}
          </div>
        </DocSection>

        <DocSection title="API routes">
          <div className="space-y-3">
            <RouteDoc method="POST" path="/api/run" description="Forwards the RunRequest to the Python ADK service and returns the agent response.">
              <pre className="text-xs font-mono bg-gray-50 p-3 rounded border border-gray-200 mt-2">
{`// Request
{ "spec": AgentSpec, "message": string, "session_id"?: string }

// Response
{ "answer": string, "session_id": string }

// Error
{ "error": string, "detail": string }`}
              </pre>
            </RouteDoc>
          </div>
        </DocSection>

        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <Link href="/builder" className="text-sm bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors">
            Open Builder
          </Link>
          <Link href="/examples" className="text-sm border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors">
            Browse Examples
          </Link>
        </div>
      </main>
    </div>
  )
}

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2">{title}</h2>
      {children}
    </section>
  )
}

function FieldTable({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Field</th>
            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Type</th>
            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([field, type, desc]) => (
            <tr key={field} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
              <td className="px-4 py-2.5 font-mono text-xs text-gray-800">{field}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-gray-500 whitespace-nowrap">{type}</td>
              <td className="px-4 py-2.5 text-xs text-gray-600 leading-relaxed">{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RouteDoc({ method, path, description, children }: {
  method: string; path: string; description: string; children?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono font-semibold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded">{method}</span>
        <code className="text-sm font-mono text-gray-800">{path}</code>
      </div>
      <p className="text-sm text-gray-500">{description}</p>
      {children}
    </div>
  )
}
