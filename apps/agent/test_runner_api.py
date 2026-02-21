"""
Quick smoke test for the mind_port_runner API.
Sends a tutor AgentSpec + a user question and prints the answer.
"""

import json
import urllib.request

URL = "http://127.0.0.1:8000/run"

payload = {
    "spec": {
        "name": "Math Tutor",
        "description": "A patient math tutor for high school students.",
        "tags": ["math", "tutor", "education"],
        "prompt": (
            "You are a patient and encouraging high school math tutor. "
            "Explain concepts clearly, use simple language, and walk through "
            "problems step by step. Always check if the student understood."
        ),
        "policy": {
            "ask_clarifying_questions": False,
            "refuse_to_guess": False,
            "output_format": "plain",
            "temperature": 0.5,
        },
        "model_choice": "openai/qwen/qwen-2.5-7b-instruct",
    },
    "message": "Can you explain how to solve a quadratic equation using the quadratic formula?",
    "session_id": "tutor-test-001",
}

data = json.dumps(payload).encode("utf-8")
req = urllib.request.Request(URL, data=data, headers={"Content-Type": "application/json"})

print("Sending request to", URL)
print("-" * 60)

with urllib.request.urlopen(req, timeout=60) as resp:
    result = json.loads(resp.read().decode("utf-8"))

print("Answer:\n")
print(result["answer"])
print("-" * 60)
print("Session ID:", result["session_id"])
