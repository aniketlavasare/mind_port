"use client"

import React from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { AgentSpec, DEFAULT_MODEL, DEFAULT_POLICY, MODELS, PolicyToggles } from "@/lib/types"

// ─── Form state (UI representation of AgentSpec) ──────────────────────────────

export interface FormState {
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

export const DEFAULT_FORM: FormState = {
  name: "", description: "", tagsInput: "",
  prompt: "", askClarifying: false, refuseToGuess: false,
  outputFormat: "plain", temperature: "", maxOutputTokens: "",
  toolsCode: "", modelChoice: DEFAULT_MODEL,
}

export function formToSpec(f: FormState): AgentSpec {
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

export function specToForm(spec: AgentSpec): FormState {
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

// ─── Component ────────────────────────────────────────────────────────────────

interface AgentFormProps {
  form: FormState
  onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void
}

export function AgentForm({ form, onChange }: AgentFormProps) {
  return (
    <div className="space-y-5">

      {/* Basics */}
      <Section title="Basics">
        <Field label="Name">
          <Input
            placeholder="e.g. Pitch Coach"
            value={form.name}
            onChange={e => onChange("name", e.target.value)}
          />
        </Field>
        <Field label="Description">
          <Textarea
            placeholder="What does this agent do?"
            value={form.description}
            onChange={e => onChange("description", e.target.value)}
            rows={2}
          />
        </Field>
        <Field label="Tags (comma separated)">
          <Input
            placeholder="pitch, writing, startup"
            value={form.tagsInput}
            onChange={e => onChange("tagsInput", e.target.value)}
          />
        </Field>
      </Section>

      <Separator />

      {/* System Prompt */}
      <Section title="System Prompt">
        <Textarea
          placeholder="You are a helpful assistant..."
          value={form.prompt}
          onChange={e => onChange("prompt", e.target.value)}
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
          onCheckedChange={v => onChange("askClarifying", v)}
        />
        <ToggleRow
          label="Refuse to guess"
          description="Agent admits uncertainty instead of speculating."
          checked={form.refuseToGuess}
          onCheckedChange={v => onChange("refuseToGuess", v)}
        />
        <Field label="Output format">
          <Select
            value={form.outputFormat}
            onValueChange={v => onChange("outputFormat", v as FormState["outputFormat"])}
          >
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
              onChange={e => onChange("temperature", e.target.value)}
            />
          </Field>
          <Field label="Max output tokens">
            <Input
              type="number" min="1" max="8192"
              placeholder="512"
              value={form.maxOutputTokens}
              onChange={e => onChange("maxOutputTokens", e.target.value)}
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
          onChange={e => onChange("toolsCode", e.target.value)}
          rows={5}
          className="font-mono text-xs leading-relaxed"
        />
      </Section>

      <Separator />

      {/* Model */}
      <Section title="Model">
        <Field label="Inference model">
          <Select value={form.modelChoice} onValueChange={v => onChange("modelChoice", v)}>
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
    </div>
  )
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

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
