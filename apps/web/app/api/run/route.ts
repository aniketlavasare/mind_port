import { NextRequest, NextResponse } from "next/server"
import { PYTHON_SERVICE_URL } from "@/lib/env"

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_request", detail: "Request body must be valid JSON." }, { status: 400 })
  }

  try {
    const response = await fetch(`${PYTHON_SERVICE_URL}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        return NextResponse.json(
          { error: "timeout", detail: "The agent took too long to respond. Try a shorter message." },
          { status: 504 }
        )
      }
      if (err.message.includes("ECONNREFUSED") || err.message.includes("fetch failed")) {
        return NextResponse.json(
          { error: "connection_error", detail: "Could not connect to the agent service. Make sure the Python runner is running on port 8001." },
          { status: 502 }
        )
      }
    }
    return NextResponse.json(
      { error: "internal_error", detail: String(err) },
      { status: 500 }
    )
  }
}
