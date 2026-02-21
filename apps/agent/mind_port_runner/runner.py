"""
ADK agent construction and execution for mind_port_runner.

This module is responsible for:
1. Building a fully-configured ADK LlmAgent from an AgentSpec.
2. Running that agent against a user message using ADK's Runner.
3. Collecting the final text answer from the event stream.

The 0G inference backend is accessed via LiteLlm using an OpenAI-compatible
proxy.  All configuration comes from environment variables loaded at import
time (following the same pattern as test_agent/agent.py).
"""

from __future__ import annotations

import logging
import os
import uuid
from pathlib import Path

from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai.types import Content, Part
from litellm.exceptions import BadRequestError as LiteLLMBadRequestError

from .spec import AgentSpec, RunRequest, RunResponse
from .tools import build_tools

logger = logging.getLogger(__name__)

# ─── Environment / constants ─────────────────────────────────────────────────

_ENV_LOADED = False


def _load_env_file() -> None:
    """
    Load .env from the project root (mind_port/.env) into os.environ.
    Only keys not already set are written, so shell env vars take precedence.
    Idempotent — safe to call multiple times.
    """
    global _ENV_LOADED
    if _ENV_LOADED:
        return
    _ENV_LOADED = True

    env_path = Path(__file__).resolve().parents[3] / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_env_file()

PROXY_BASE_URL: str = os.getenv(
    "PROXY_BASE_URL",
    "https://compute-network-6.integratenetwork.work/v1/proxy",
)
LLM_API_KEY: str = os.getenv("LLM_API_KEY", "")
DEFAULT_MODEL: str = os.getenv(
    "DEFAULT_MODEL",
    "openai/qwen/qwen-2.5-7b-instruct",
)

# ─── Prompt augmentation ──────────────────────────────────────────────────────


def _build_instruction(spec: AgentSpec) -> str:
    """
    Construct the full system prompt by appending policy-driven instructions to
    the user-supplied base prompt.

    Takes:
        spec: The AgentSpec containing the base prompt and policy toggles.

    Returns:
        A single string to be used as the LlmAgent `instruction` field.
    """
    parts: list[str] = [spec.prompt.strip()]

    if spec.policy.ask_clarifying_questions:
        parts.append(
            "Ask up to 2 clarifying questions before answering if the request "
            "is ambiguous or under-specified."
        )

    if spec.policy.refuse_to_guess:
        parts.append(
            "If you are unsure or lack sufficient information, say so explicitly "
            "and ask for the required information rather than guessing."
        )

    fmt = spec.policy.output_format
    if fmt == "json":
        parts.append("Output valid JSON only. Do not include any text outside the JSON.")
    elif fmt == "bullets":
        parts.append("Use bullet points for your response.")

    return "\n\n".join(parts)


# ─── Agent construction ───────────────────────────────────────────────────────


def build_agent(spec: AgentSpec) -> tuple[LlmAgent, list[dict[str, str]]]:
    """
    Construct an ADK LlmAgent from an AgentSpec.

    Takes:
        spec: Fully validated AgentSpec.

    Returns:
        A tuple of:
        - agent: The constructed LlmAgent, ready to run.
        - tool_trace: List of dicts describing each tool's compilation outcome.
    """
    tools, tool_trace = build_tools(spec.tools)

    model_kwargs: dict = {}
    if spec.policy.temperature is not None:
        model_kwargs["temperature"] = spec.policy.temperature
    if spec.policy.max_output_tokens is not None:
        model_kwargs["max_tokens"] = spec.policy.max_output_tokens

    model = LiteLlm(
        model=DEFAULT_MODEL,
        api_base=PROXY_BASE_URL,
        api_key=LLM_API_KEY,
        **model_kwargs,
    )

    instruction = _build_instruction(spec)

    safe_name = "".join(c if c.isalnum() or c == "_" else "_" for c in spec.name)
    if not safe_name or not safe_name[0].isalpha():
        safe_name = "agent_" + safe_name

    agent = LlmAgent(
        name=safe_name,
        instruction=instruction,
        tools=tools,
        model=model,
    )

    return agent, tool_trace


# ─── Agent execution ──────────────────────────────────────────────────────────


async def run_agent(request: RunRequest) -> RunResponse:
    """
    Build an agent from the request spec and run it against the user message.

    Takes:
        request: A validated RunRequest containing spec, message, and optional
                 session_id.

    Returns:
        A RunResponse with the agent's final answer and the session_id used.

    Raises:
        RuntimeError: If the agent produces no final response.
    """
    session_id = request.effective_session_id()
    spec = request.spec

    logger.info(
        "run_agent start | session=%s agent=%s model_choice=%s",
        session_id,
        spec.name,
        spec.model_choice,
    )

    agent, tool_trace = build_agent(spec)

    for entry in tool_trace:
        logger.info(
            "tool | name=%s status=%s msg=%s",
            entry["name"],
            entry["status"],
            entry["message"],
        )

    session_service = InMemorySessionService()
    await session_service.create_session(
        app_name="mind_port",
        user_id="user",
        session_id=session_id,
    )

    runner = Runner(
        app_name="mind_port",
        agent=agent,
        session_service=session_service,
    )

    answer = ""

    logger.info("run_agent executing | session=%s message_len=%d", session_id, len(request.message))

    user_message = Content(role="user", parts=[Part(text=request.message)])

    try:
        async for event in runner.run_async(
            user_id="user",
            session_id=session_id,
            new_message=user_message,
        ):
            if event.is_final_response():
                if event.content and event.content.parts:
                    answer = event.content.parts[0].text or ""
                break

    except LiteLLMBadRequestError as exc:
        # The 0G upstream provider does not support function-calling for this
        # model.  Rebuild the agent without tools and retry once.
        if tool_trace and any(e["status"] == "registered" for e in tool_trace):
            logger.warning(
                "run_agent tool-call rejected by provider (400) — retrying without tools | session=%s error=%s",
                session_id,
                exc,
            )
            agent_no_tools = LlmAgent(
                name=agent.name,
                instruction=agent.instruction,
                tools=[],
                model=agent.model,
            )
            runner_no_tools = Runner(
                app_name="mind_port",
                agent=agent_no_tools,
                session_service=session_service,
            )
            # Create a fresh session for the retry
            retry_session_id = session_id + "-retry"
            await session_service.create_session(
                app_name="mind_port",
                user_id="user",
                session_id=retry_session_id,
            )
            async for event in runner_no_tools.run_async(
                user_id="user",
                session_id=retry_session_id,
                new_message=user_message,
            ):
                if event.is_final_response():
                    if event.content and event.content.parts:
                        answer = event.content.parts[0].text or ""
                    break
        else:
            raise

    if not answer:
        logger.warning("run_agent produced empty answer | session=%s", session_id)

    logger.info("run_agent done | session=%s answer_len=%d", session_id, len(answer))

    return RunResponse(answer=answer, session_id=session_id)
