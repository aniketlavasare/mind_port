# MindPort

Create, run, own, and trade AI agents — powered by [Google ADK](https://github.com/google/adk-python), [0G Compute](https://0g.ai/), and on-chain NFTs.

## What is MindPort?

MindPort lets you define AI agents as structured specs (prompt, policy, model), execute them on-demand, and optionally mint them as ERC-721 NFTs for on-chain ownership and trading.

## Architecture

```
apps/
  web/          → Next.js 16 frontend + API routes
  agent/        → FastAPI service (Google ADK agent runner)
contracts/
  relative/     → Solidity smart contracts (Hardhat 3)
```

| Layer | Tech |
|-------|------|
| Frontend | Next.js, React 19, Tailwind CSS, Radix UI |
| Web3 | wagmi, viem, 0G Testnet |
| Agent Runner | FastAPI, Google ADK, LiteLLM |
| LLM | Qwen 2.5 7B via 0G Compute proxy |
| Storage | Upstash Redis, Vercel Blob |
| Contracts | Solidity 0.8.28, OpenZeppelin, Hardhat 3 |

## Features

- **Builder** — Design agents with custom prompts, policies, and model config
- **Library** — Browse, search, favorite, duplicate, and export saved agents
- **Runner** — Execute agents with streaming responses and trace inspection
- **Minting** — Mint agents as AgentBrain NFTs with on-chain metadata
- **Marketplace** — List, bid on, and trade agent NFTs

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- An [0G API key](https://0g.ai/)

### Environment Variables

Create a `.env` file in the project root:

```env
# Agent service
LLM_API_KEY=<0G API key>
PROXY_BASE_URL=https://compute-network-6.integratenetwork.work/v1/proxy
DEFAULT_MODEL=openai/qwen/qwen-2.5-7b-instruct

# Web app
KV_REST_API_URL=<Upstash Redis URL>
KV_REST_API_TOKEN=<Upstash Redis token>
BLOB_READ_WRITE_TOKEN=<Vercel Blob token>
NEXT_PUBLIC_CHAIN_ID=16602
NEXT_PUBLIC_RPC_URL=<RPC endpoint>
PYTHON_SERVICE_URL=http://127.0.0.1:8001 <exposed using ngrok>

# Contracts (optional)
ZEROG_PRIVATE_KEY=<deployer private key>
```

### Run

**1. Agent service**

```bash
cd apps/agent
python -m venv .venv && .venv/Scripts/activate   # Windows
# source .venv/bin/activate                       # macOS/Linux
pip install -r requirements.txt
uvicorn mind_port_runner.main:app --port 8001 --reload
```

**2. Web app**

```bash
cd apps/web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**3. Smart contracts** (optional)

```bash
cd contracts/relative
npm install
npx hardhat ignition deploy ignition/modules/Counter.ts --network zerog
```

## How It Works

1. Define an agent spec in the **Builder** (prompt, policy, model).
2. Spec is persisted to **Upstash Redis** via Next.js API routes.
3. On execution, the web app calls the **FastAPI** service which constructs a Google ADK agent.
4. The agent runs inference through **LiteLLM → 0G Compute proxy**.
5. Responses stream back to the frontend.
6. Optionally, mint the agent as an **AgentBrain NFT** on 0G Testnet for ownership and marketplace trading.

## Smart Contracts

| Contract | Description |
|----------|-------------|
| `AgentBrain.sol` | ERC-721 NFT storing agent name, description, tags, and prompt on-chain |
| `AgentMarketplace.sol` | Escrow-based marketplace with open bidding for AgentBrain NFTs |

## License

MIT
