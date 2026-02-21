"""
Pydantic models for the mind_port_runner service.

All request/response shapes are defined here so they can be imported by
main.py, runner.py, and tools.py without circular dependencies.
"""

from __future__ import annotations

import uuid
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


class PolicyToggles(BaseModel):
    """
    Lightweight policy configuration that is appended to the agent's system
    prompt at runtime.  No hard enforcement — we rely on prompt augmentation.

    Fields:
        ask_clarifying_questions: If True, agent is instructed to ask up to 2
            clarifying questions before answering.
        refuse_to_guess: If True, agent is instructed to admit uncertainty and
            request more information rather than guessing.
        output_format: Hint for response shape — "plain" (default), "bullets",
            or "json".
        max_output_tokens: Optional token limit passed to LiteLlm if supported.
        temperature: Optional sampling temperature passed to LiteLlm if
            supported.  Range 0.0–2.0.
    """

    ask_clarifying_questions: bool = False
    refuse_to_guess: bool = False
    output_format: str = "plain"
    max_output_tokens: Optional[int] = Field(default=None, ge=1, le=8192)
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)

    @field_validator("output_format")
    @classmethod
    def validate_output_format(cls, v: str) -> str:
        allowed = {"plain", "bullets", "json"}
        if v not in allowed:
            raise ValueError(f"output_format must be one of {allowed}")
        return v


class ToolSpec(BaseModel):
    """
    A user-provided tool definition.  The `code` field must contain valid Python
    that defines a callable named exactly `name`.  The runner will attempt to
    compile and exec it; failures are caught and logged in the trace.

    Fields:
        name: Python identifier — the function name defined in `code`.
        description: Human-readable description surfaced in the trace.
        code: Python source code string.  Must define a function named `name`.
        input_schema: Optional JSON Schema dict for the function's arguments.
        output_schema: Optional JSON Schema dict for the function's return value.
    """

    name: str
    description: str
    code: str
    input_schema: Optional[dict[str, Any]] = None
    output_schema: Optional[dict[str, Any]] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v.isidentifier():
            raise ValueError(f"Tool name '{v}' is not a valid Python identifier")
        return v


class AgentSpec(BaseModel):
    """
    Full specification for a dynamically-constructed ADK agent.

    Fields:
        name: Agent display name (used as the ADK agent name).
        description: Short description of what the agent does.
        tags: Arbitrary string tags (informational only).
        prompt: The system prompt / instruction for the agent.
        policy: Behavioural toggles that are injected into the system prompt.
        tools: Optional list of user-provided tool definitions.
        model_choice: Model identifier string from the frontend dropdown.
            At runtime the service always uses DEFAULT_MODEL; this field is
            recorded in the trace for auditability.
    """

    name: str = Field(min_length=1, max_length=128)
    description: str = ""
    tags: list[str] = []
    prompt: str = Field(min_length=1)
    policy: PolicyToggles = Field(default_factory=PolicyToggles)
    tools: list[ToolSpec] = []
    model_choice: str = ""


class RunRequest(BaseModel):
    """
    Incoming request body for POST /run.

    Fields:
        spec: Full agent specification.
        message: The user message to send to the agent.
        session_id: Optional session identifier.  A UUID is generated if omitted.
    """

    spec: AgentSpec
    message: str = Field(min_length=1)
    session_id: Optional[str] = None

    def effective_session_id(self) -> str:
        """Returns the provided session_id or a freshly generated UUID."""
        return self.session_id or str(uuid.uuid4())


class RunResponse(BaseModel):
    """
    Response body for POST /run.

    Fields:
        answer: Final text response from the agent.
        session_id: The session ID used for this run.
    """

    answer: str
    session_id: str
