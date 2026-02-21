import { NextRequest, NextResponse } from "next/server"
import { createPublicClient, http, verifyMessage } from "viem"
import { hardhat } from "viem/chains"
import { PYTHON_SERVICE_URL } from "@/lib/env"
import { BRAIN_ABI } from "@/lib/contracts"
import localContracts from "@/lib/contracts.local.json"

interface TokenGate {
  tokenId: number
  userAddress: string
  signature: string
  nonce: string
}

async function verifyOwnership(gate: TokenGate): Promise<string | null> {
  // 1. Verify signature
  const message = `MindPort Run Authorization\nTokenId: ${gate.tokenId}\nNonce: ${gate.nonce}`
  const isValid = await verifyMessage({
    address: gate.userAddress as `0x${string}`,
    message,
    signature: gate.signature as `0x${string}`,
  })
  if (!isValid) return "invalid_signature"

  // 2. Check on-chain ownership via local RPC
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545"
  const brainAddress = localContracts.agentBrain
  if (!brainAddress || brainAddress === "0x0000000000000000000000000000000000000000") {
    return null // contracts not deployed, skip gate
  }

  const client = createPublicClient({
    chain: hardhat,
    transport: http(rpcUrl),
  })

  try {
    const owner = await client.readContract({
      address: brainAddress as `0x${string}`,
      abi: BRAIN_ABI,
      functionName: "ownerOf",
      args: [BigInt(gate.tokenId)],
    })
    if ((owner as string).toLowerCase() !== gate.userAddress.toLowerCase()) {
      return "not_token_owner"
    }
  } catch {
    return "token_not_found"
  }

  return null // no error = authorized
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_request", detail: "Request body must be valid JSON." }, { status: 400 })
  }

  // Optional ownership gate
  const tokenGate = body.tokenGate as TokenGate | undefined
  if (tokenGate) {
    const gateError = await verifyOwnership(tokenGate)
    if (gateError === "invalid_signature") {
      return NextResponse.json({ error: "unauthorized", detail: "Signature verification failed." }, { status: 401 })
    }
    if (gateError === "not_token_owner") {
      return NextResponse.json({ error: "forbidden", detail: "Connected wallet is not the token owner." }, { status: 403 })
    }
    if (gateError === "token_not_found") {
      return NextResponse.json({ error: "not_found", detail: "Token not found on chain." }, { status: 404 })
    }
  }

  // Strip tokenGate before forwarding to Python (it doesn't know about it)
  const { tokenGate: _gate, ...pythonBody } = body

  try {
    const response = await fetch(`${PYTHON_SERVICE_URL}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pythonBody),
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
