import ollama

VISION_SYSTEM_PROMPT = """
You are reviewing an image for educational document assistance.

Allowed tasks:
- Extract visible text.
- Identify the apparent type of document or product.
- Explain visible medical terms.
- Organize visible information.
- Suggest questions for a licensed professional.

Prohibited tasks:
- Confirm a diagnosis.
- Determine whether an image is medically normal or abnormal.
- Prescribe treatment.
- Infer information not clearly visible.
- Invent unreadable text or values.

For every extracted field, label it as:
- Clearly visible
- Partially visible
- Uncertain
- Not visible
"""


def describe_image(
    image_path: str,
    user_prompt: str = "Extract and organize everything visible in this image.",
    model: str = "llava",
) -> str:
    response = ollama.chat(
        model=model,
        messages=[
            {"role": "system", "content": VISION_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt, "images": [image_path]},
        ],
        options={
            "temperature": 0.2,
        },
    )

    return response["message"]["content"]
