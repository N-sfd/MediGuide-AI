import gradio as gr

from src.chatbot import generate_response
from src.image_analyzer import (
    analyze_medical_document_image,
    format_extraction_for_review,
)
from src.transcriber import transcribe_audio as run_transcription


def chat_response(
    message: str,
    history: list[dict] | None,
) -> tuple[list[dict], str]:
    current_history = list(history or [])

    if not message or not message.strip():
        return current_history, ""

    answer = generate_response(message, history)

    current_history.extend(
        [
            {"role": "user", "content": message},
            {"role": "assistant", "content": answer},
        ]
    )

    return current_history, ""


def transcribe_audio(audio_path: str | None) -> str:
    result = run_transcription(audio_path)
    if not result.success:
        return result.error or "Transcription failed."
    return result.text


def create_image_extraction(
    image_path: str | None,
    question: str,
) -> tuple[str, str, bool]:
    result = analyze_medical_document_image(
        image_path=image_path,
        user_question=question,
    )

    if not result.success:
        return (
            "",
            f"❌ {result.error}",
            False,
        )

    if not result.structured_data:
        return (
            "",
            "❌ No structured information was returned.",
            False,
        )

    editable_text = format_extraction_for_review(
        result.structured_data,
    )

    return (
        editable_text,
        (
            "✅ Extraction completed. Review every name, value, unit, "
            "date, and medication before confirming."
        ),
        False,
    )


def send_confirmed_image_text(
    extracted_text: str,
    confirmed: bool,
    history: list[dict] | None,
) -> tuple[list[dict], str, bool, str]:
    current_history = list(history or [])

    if not extracted_text or not extracted_text.strip():
        return (
            current_history,
            "❌ There is no extracted information to send.",
            False,
            extracted_text,
        )

    if not confirmed:
        return (
            current_history,
            (
                "⚠️ Review the extracted information and check "
                "the confirmation box first."
            ),
            False,
            extracted_text,
        )

    confirmed_prompt = (
        "The following information was extracted from an uploaded "
        "medical document and reviewed by the user.\n\n"
        f"{extracted_text.strip()}\n\n"
        "Explain this information in plain language. Do not diagnose, "
        "prescribe, or infer information not included above. Identify "
        "important uncertainty and suggest questions the user can ask "
        "a qualified professional."
    )

    answer = generate_response(
        confirmed_prompt,
        current_history,
    )

    current_history.extend(
        [
            {
                "role": "user",
                "content": (
                    "Please explain the confirmed information "
                    "from my uploaded document."
                ),
            },
            {
                "role": "assistant",
                "content": answer,
            },
        ]
    )

    return (
        current_history,
        "✅ Confirmed information sent to MediGuide.",
        False,
        "",
    )


def clear_image_inputs():
    return (
        None,
        "",
        "",
        False,
        "Image input cleared.",
    )


with gr.Blocks(title="MediGuide AI") as app:
    gr.Markdown(
        """
        # MediGuide AI

        **Health education and appointment preparation**

        This educational prototype does not diagnose conditions,
        prescribe medication, interpret scans clinically, or replace
        qualified healthcare professionals.

        **For emergencies, call 911 or your local emergency number.**
        """
    )

    with gr.Tab("Text Chat"):
        chatbot = gr.Chatbot(height=420)
        message_box = gr.Textbox(
            placeholder="Ask a health question…",
            show_label=False,
        )

        with gr.Row():
            send_btn = gr.Button("Send")
            clear_btn = gr.Button("Clear conversation")

        gr.Examples(
            examples=[
                "Explain blood pressure in simple language.",
                "Help me prepare questions for a doctor.",
            ],
            inputs=message_box,
        )

        send_btn.click(chat_response, [message_box, chatbot], [chatbot, message_box])
        message_box.submit(chat_response, [message_box, chatbot], [chatbot, message_box])
        clear_btn.click(lambda: ([], ""), None, [chatbot, message_box])

    with gr.Tab("Voice Question"):
        audio_input = gr.Audio(
            sources=["microphone", "upload"],
            type="filepath",
            label="Record your question",
        )

        transcribe_button = gr.Button("Create Transcript")

        transcript = gr.Textbox(
            label="Review and correct this transcript",
            lines=5,
        )

        transcribe_button.click(
            fn=transcribe_audio,
            inputs=audio_input,
            outputs=transcript,
        )

        gr.Markdown(
            "Copy the corrected transcript into Text Chat after checking it."
        )

    with gr.Tab("Medical Document Image"):
        gr.Markdown(
            """
### Safe image workflow

Upload a medication label, lab-report screenshot, appointment
instruction, discharge instruction, insurance letter, or another
document containing visible health information.

This feature does not clinically interpret X-rays, CT scans, MRI
scans, ultrasound images, wounds, skin lesions, or other diagnostic
medical images.
"""
        )

        image_input = gr.Image(
            type="filepath",
            label="Upload medical document image",
            sources=["upload", "clipboard", "webcam"],
        )

        image_question = gr.Textbox(
            label="What should be extracted?",
            placeholder=(
                "Example: Extract the visible medication name, "
                "instructions, dates, and warnings."
            ),
            lines=3,
        )

        analyze_image_button = gr.Button(
            "1. Extract Visible Information",
            variant="secondary",
        )

        extracted_text = gr.Textbox(
            label="2. Review and edit extracted information",
            placeholder=(
                "The extracted information will appear here. "
                "Correct every error before confirming."
            ),
            lines=14,
        )

        image_confirmation = gr.Checkbox(
            label=(
                "3. I reviewed the extracted text and corrected "
                "all important names, numbers, units, and dates."
            ),
            value=False,
        )

        send_image_button = gr.Button(
            "4. Send Confirmed Information",
            variant="primary",
        )

        clear_image_button = gr.Button("Clear Image Input")

        image_status = gr.Markdown(
            "No image has been analyzed."
        )

        analyze_image_button.click(
            fn=create_image_extraction,
            inputs=[
                image_input,
                image_question,
            ],
            outputs=[
                extracted_text,
                image_status,
                image_confirmation,
            ],
        )

        send_image_button.click(
            fn=send_confirmed_image_text,
            inputs=[
                extracted_text,
                image_confirmation,
                chatbot,
            ],
            outputs=[
                chatbot,
                image_status,
                image_confirmation,
                extracted_text,
            ],
        )

        clear_image_button.click(
            fn=clear_image_inputs,
            outputs=[
                image_input,
                image_question,
                extracted_text,
                image_confirmation,
                image_status,
            ],
        )

    with gr.Tab("Privacy and Limitations"):
        gr.Markdown(
            """
            ## Limitations

            - This project is not a medical device.
            - It does not provide diagnoses.
            - It does not prescribe medication.
            - Image extraction can be incorrect.
            - Voice transcription can change medication names or numbers.
            - Users must verify extracted information.
            - Do not upload real patient records to a public demonstration.
            """
        )


if __name__ == "__main__":
    app.launch()
