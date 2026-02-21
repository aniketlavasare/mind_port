# mind_port_runner

FastAPI service that dynamically constructs and runs ADK agents from a full
`AgentSpec` payload.  Called server-to-server by the Next.js API routes.

---

## Requirements

All dependencies are already installed in `apps/agent/.venv`:

- `fastapi`
- `uvicorn`
- `pydantic`
- `google-adk`
- `litellm`

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `LLM_API_KEY` | Yes | — | 0G API key (`app-sk-...`) |
| `PROXY_BASE_URL` | No | `https://compute-network-6.integratenetwork.work/v1/proxy` | 0G OpenAI-compat proxy |
| `DEFAULT_MODEL` | No | `openai/qwen/qwen-2.5-7b-instruct` | Model used at runtime |

Set these in `mind_port/.env` (the service loads it automatically) or export
them in your shell before starting.

---

## Start

```powershell
cd apps\agent
.venv\Scripts\uvicorn mind_port_runner.main:app --port 8001 --reload
```

The service starts on **http://127.0.0.1:8001**.

---

## Endpoints

### `GET /health`

```bash
curl http://localhost:8001/health
# {"status":"ok"}
```

---

### `POST /run`

**Request body:**

```json
{
  "spec": {
    "name": "Pitch Coach",
    "description": "Helps craft winning pitches",
    "tags": ["pitch", "writing"],
    "prompt": "You are a brutally effective pitch coach. Enforce structure and clarity.",
    "policy": {
      "ask_clarifying_questions": true,
      "refuse_to_guess": false,
      "output_format": "bullets",
      "max_output_tokens": 512,
      "temperature": 0.7
    },
    "model_choice": "openai/qwen/qwen-2.5-7b-instruct"
  },
  "message": "Help me pitch a B2B SaaS tool for small bakeries.",
  "session_id": "demo-session-1"
}
```

**Response:**

```json
{
  "answer": "Here are the key points for your pitch:\n- ...",
  "session_id": "demo-session-1"
}
```

**Validation error response:**

```json
{
  "detail": [
    { "loc": ["body", "spec", "prompt"], "msg": "Field required", "type": "missing" }
  ]
}
```

**Internal error response:**

```json
{
  "error": "internal_error",
  "detail": "..."
}
```

---

## Policy enforcement

Policy flags are injected as additional instructions appended to the system
prompt.

| Flag | Injected instruction |
|---|---|
| `ask_clarifying_questions: true` | "Ask up to 2 clarifying questions before answering if needed." |
| `refuse_to_guess: true` | "If unsure, say so explicitly and ask for required info." |
| `output_format: "json"` | "Output valid JSON only." |
| `output_format: "bullets"` | "Use bullet points." |
| `temperature` | Passed to LiteLlm `temperature` param |
| `max_output_tokens` | Passed to LiteLlm `max_tokens` param |
