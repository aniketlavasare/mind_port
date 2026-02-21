from __future__ import annotations

import os
from pathlib import Path

from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm

PROXY_BASE_URL = "https://compute-network-6.integratenetwork.work/v1/proxy"
MODEL_NAME = "openai/qwen/qwen-2.5-7b-instruct"
LLM_API_KEY_ENV_VAR = "LLM_API_KEY"


def _load_env_file() -> None:
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

api_key = os.getenv(LLM_API_KEY_ENV_VAR)
if not api_key:
    raise ValueError(
        f"Missing required environment variable: {LLM_API_KEY_ENV_VAR} (set it in .env)"
    )

root_agent = LlmAgent(
    name="test_agent",
    instruction="You are a helpful assistant.",
    model=LiteLlm(
        model=MODEL_NAME,
        api_base=PROXY_BASE_URL,
        api_key=api_key,
    ),
)
