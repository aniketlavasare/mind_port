"""
Dynamic tool compilation and registration for mind_port_runner.

User-provided tools arrive as Python source code strings (ToolSpec.code).
This module safely compiles each snippet, extracts the callable, wraps it in
an ADK FunctionTool, and returns only the tools that compiled successfully.

Security note: exec() is used intentionally here.  In production this service
should run in an isolated environment (container / sandbox).  Do NOT expose
this service directly to the internet without a trust boundary.
"""

from __future__ import annotations

import traceback
from typing import Any

from google.adk.tools import FunctionTool

from .spec import ToolSpec


def _compile_tool(spec: ToolSpec) -> tuple[FunctionTool | None, str]:
    """
    Attempt to compile a ToolSpec into an ADK FunctionTool.

    Takes:
        spec: A ToolSpec whose `code` field contains Python source that defines
              a function named `spec.name`.

    Returns:
        A tuple of (FunctionTool | None, message).
        - On success: (FunctionTool, "ok")
        - On failure: (None, human-readable error string)
    """
    namespace: dict[str, Any] = {}

    try:
        compiled = compile(spec.code, filename=f"<tool:{spec.name}>", mode="exec")
        exec(compiled, namespace)  # noqa: S102
    except SyntaxError as exc:
        return None, f"SyntaxError in tool '{spec.name}': {exc}"
    except Exception as exc:
        return None, f"Execution error in tool '{spec.name}': {exc}"

    fn = namespace.get(spec.name)
    if fn is None:
        return None, (
            f"Tool '{spec.name}' compiled but no callable named '{spec.name}' "
            f"was found in the code. Make sure the function is defined at the "
            f"top level with exactly that name."
        )

    if not callable(fn):
        return None, f"'{spec.name}' is defined but is not callable."

    if spec.description:
        fn.__doc__ = spec.description

    try:
        tool = FunctionTool(fn)
    except Exception as exc:
        return None, f"ADK FunctionTool wrapping failed for '{spec.name}': {exc}"

    return tool, "ok"


def build_tools(
    tool_specs: list[ToolSpec],
) -> tuple[list[FunctionTool], list[dict[str, str]]]:
    """
    Compile all ToolSpecs and return the successful tools alongside a log of
    any compilation failures.

    Takes:
        tool_specs: List of ToolSpec objects from the AgentSpec.

    Returns:
        A tuple of:
        - tools: list of successfully compiled FunctionTool instances.
        - tool_trace: list of dicts with keys "name", "status", "message"
          describing the outcome of each compilation attempt.
    """
    tools: list[FunctionTool] = []
    tool_trace: list[dict[str, str]] = []

    for spec in tool_specs:
        tool, message = _compile_tool(spec)
        if tool is not None:
            tools.append(tool)
            tool_trace.append({"name": spec.name, "status": "registered", "message": message})
        else:
            tool_trace.append({"name": spec.name, "status": "failed", "message": message})

    return tools, tool_trace
