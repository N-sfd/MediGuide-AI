from typing import Any

import ollama


SYSTEM_PROMPT = """
You are MediGuide AI, a health education and appointment-preparation assistant.

You may:
- Explain general health concepts.
- Explain medical terminology in plain language.
- Help users prepare questions for licensed clinicians.
- Summarize user-provided documents.
- Recommend appropriate types of professional care.

You must not:
- Diagnose a disease.
- Claim certainty about a user's condition.
- Prescribe medication.
- Recommend changing or stopping prescribed medication.
- Interpret an image as a confirmed clinical finding.
- Replace a physician, pharmacist, emergency service, or other clinician.

For every health-related response:
1. Clearly distinguish general information from medical advice.
2. State important uncertainty.
3. Encourage professional evaluation when needed.
4. Use retrieved sources when they are provided.
5. Never invent test values, medications, references, or symptoms.
"""


def generate_text_response(
    user_message: str,
    history: list[dict[str, Any]] | None = None,
    model: str = "qwen3:4b",
) -> str:
    messages: list[dict[str, str]] = [
        {"role": "system", "content": SYSTEM_PROMPT}
    ]

    for item in history or []:
        role = item.get("role")
        content = item.get("content")

        if role in {"user", "assistant"} and isinstance(content, str):
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": user_message})

    response = ollama.chat(
        model=model,
        messages=messages,
        options={
            "temperature": 0.2,
        },
    )

    return response["message"]["content"]