import gradio as gr

from src.chatbot import generate_response
from src.image_analyzer import analyze_image
from src.transcriber import AudioTranscriber


transcriber = AudioTranscriber()


def chat_response(
    message: str,
    history: list[dict] | None,
) -> str:
    return generate_response(message, history)


def transcribe_audio(audio_path: str | None) -> str:
    return transcriber.transcribe(audio_path)


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
        gr.ChatInterface(
            fn=chat_response,
            type="messages",
            examples=[
                "Explain blood pressure in simple language.",
                "Help me prepare questions for a doctor.",
            ],
        )

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

    with gr.Tab("Document Image"):
        image_input = gr.Image(
            type="filepath",
            label="Upload a document or medication label",
        )

        image_question = gr.Textbox(
            label="Question",
            placeholder="Explain the clearly visible information.",
        )

        image_button = gr.Button("Analyze Visible Information")
        image_output = gr.Markdown()

        image_button.click(
            fn=analyze_image,
            inputs=[image_input, image_question],
            outputs=image_output,
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