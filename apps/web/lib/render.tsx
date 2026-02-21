import React from "react"

export function renderAnswer(content: string, format: string): React.ReactNode {
  if (!content) return null

  if (format === "json") {
    try {
      const parsed = JSON.parse(content)
      return (
        <pre className="text-xs font-mono bg-gray-50 border border-gray-200 p-3 rounded-md overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      )
    } catch {
      // not valid json — fall through to plain
    }
  }

  if (format === "bullets") {
    const lines = content.split("\n")
    const items: string[] = []
    const preamble: string[] = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (/^[-•*]\s+/.test(trimmed)) {
        items.push(trimmed.replace(/^[-•*]\s+/, ""))
      } else if (/^\d+\.\s+/.test(trimmed)) {
        items.push(trimmed.replace(/^\d+\.\s+/, ""))
      } else if (trimmed) {
        preamble.push(trimmed)
      }
    }

    if (items.length > 0) {
      return (
        <div className="space-y-2">
          {preamble.length > 0 && (
            <p className="text-sm leading-relaxed text-gray-800">
              {preamble.join(" ")}
            </p>
          )}
          <ul className="space-y-1.5">
            {items.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-gray-400 mt-0.5 shrink-0">•</span>
                <span className="text-gray-800 leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )
    }
  }

  // plain — split on double newlines for paragraphs
  const paragraphs = content.split(/\n{2,}/).filter(Boolean)
  return (
    <div className="space-y-2">
      {paragraphs.map((para, i) => (
        <p key={i} className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">
          {para}
        </p>
      ))}
    </div>
  )
}
