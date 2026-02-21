"""
mind_port_runner — FastAPI service entry point.

Routes:
    GET  /health  →  liveness check
    POST /run     →  run a dynamic ADK agent from a full AgentSpec + message

Start with:
    cd apps/agent
    .venv/Scripts/uvicorn mind_port_runner.main:app --port 8001 --reload
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .runner import run_agent
from .spec import RunRequest, RunResponse

# ─── Logging ─────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ─── App ─────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="MindPort Runner",
    description="Dynamically constructs and runs ADK agents from AgentSpec payloads.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to Next.js origin in production
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ─── Global error handler ─────────────────────────────────────────────────────


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all handler — returns a stable JSON error instead of a 500 HTML page."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": "internal_error", "detail": str(exc)},
    )


# ─── Routes ──────────────────────────────────────────────────────────────────


@app.get("/health", summary="Liveness check")
async def health() -> dict[str, str]:
    """
    Returns {"status": "ok"} when the service is running.
    Used by load balancers and the Next.js startup check.
    """
    return {"status": "ok"}


@app.post(
    "/run",
    response_model=RunResponse,
    summary="Run a dynamic ADK agent",
)
async def run(request: RunRequest) -> RunResponse:
    """
    Accepts a full AgentSpec + user message, constructs an ADK LlmAgent,
    runs it against the message, and returns the agent's answer.

    Takes (request body):
        spec       - Full AgentSpec (name, prompt, policy, tools, model_choice).
        message    - The user message to send to the agent.
        session_id - Optional session identifier; a UUID is generated if absent.

    Returns:
        answer     - Final text response from the agent.
        session_id - The session ID used for this run.
    """
    logger.info(
        "POST /run | agent=%s session=%s",
        request.spec.name,
        request.session_id or "(auto)",
    )
    return await run_agent(request)
