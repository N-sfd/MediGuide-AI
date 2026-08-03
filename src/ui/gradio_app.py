import tempfile
from pathlib import Path

import gradio as gr

from src.orchestrator import Orchestrator
from src.rag.citations import format_citations_footer


def _format_reply(reply: str, citations) -> str:
    footer = format_citations_footer(citations)
    return f"{reply}\n\n{footer}" if footer else reply


def build_app(orchestrator: Orchestrator | None = None) -> gr.Blocks:
    orch = orchestrator or Orchestrator()

    def handle_chat(message: str, chat_history: list):
        response = orch.chat(message)
        chat_history = chat_history + [(message, _format_reply(response.reply, response.citations))]
        return "", chat_history

    def handle_voice_chat(audio_path: str, chat_history: list):
        if not audio_path:
            return chat_history, None
        transcript, response = orch.chat_from_audio(audio_path)
        chat_history = chat_history + [(transcript, _format_reply(response.reply, response.citations))]

        out_path = Path(tempfile.gettempdir()) / "mediguide_reply.wav"
        orch.speak(response.reply, out_path)
        return chat_history, str(out_path)

    def handle_reset():
        orch.reset_conversation()
        return []

    def handle_report(file_path: str):
        if not file_path:
            return "Upload a report to get started."
        summary = orch.read_report(file_path)
        lines = [summary.summary]
        if summary.key_findings:
            lines.append("\n**Key findings:**\n" + "\n".join(f"- {f}" for f in summary.key_findings))
        if summary.flagged_values:
            lines.append("\n**Flagged values:**\n" + "\n".join(f"- {v}" for v in summary.flagged_values))
        lines.append(f"\n_{summary.disclaimer}_")
        return "\n".join(lines)

    def handle_symptom(description: str):
        if not description.strip():
            return "Describe a symptom to log it."
        orch.log_symptom(description)
        timeline = orch.get_symptom_timeline()
        rows = [
            f"- **{entry.recorded_at:%Y-%m-%d %H:%M}** — {entry.description}"
            + (f" (severity: {entry.severity})" if entry.severity else "")
            + (f" (onset: {entry.onset})" if entry.onset else "")
            for entry in timeline
        ]
        return "\n".join(rows) if rows else "No symptoms logged yet."

    def handle_appointment(notes: str):
        if not notes.strip():
            return "Paste appointment notes or a transcript to summarize."
        summary = orch.summarize_appointment(notes)
        lines = [summary.summary]
        if summary.action_items:
            lines.append("\n**Action items:**\n" + "\n".join(f"- {a}" for a in summary.action_items))
        if summary.follow_up:
            lines.append(f"\n**Follow-up:** {summary.follow_up}")
        return "\n".join(lines)

    with gr.Blocks(title="MediGuide AI") as demo:
        gr.Markdown(
            "# MediGuide AI\n"
            "Educational health guidance — not a diagnosis, not a substitute for professional "
            "medical care. In an emergency, call your local emergency number."
        )

        with gr.Tab("Chat"):
            chatbot = gr.Chatbot(height=420)
            with gr.Row():
                message_box = gr.Textbox(placeholder="Ask a health question…", scale=4)
                send_btn = gr.Button("Send", scale=1)
            with gr.Row():
                audio_in = gr.Audio(sources=["microphone", "upload"], type="filepath", label="Speak")
                audio_out = gr.Audio(label="Spoken reply", autoplay=True)
            clear_btn = gr.Button("Reset conversation")

            send_btn.click(handle_chat, [message_box, chatbot], [message_box, chatbot])
            message_box.submit(handle_chat, [message_box, chatbot], [message_box, chatbot])
            audio_in.stop_recording(handle_voice_chat, [audio_in, chatbot], [chatbot, audio_out])
            clear_btn.click(handle_reset, None, chatbot)

        with gr.Tab("Report Reader"):
            report_file = gr.File(label="Lab report / medical document", type="filepath")
            report_output = gr.Markdown()
            report_file.change(handle_report, report_file, report_output)

        with gr.Tab("Symptom Timeline"):
            symptom_input = gr.Textbox(label="Describe a symptom", placeholder="e.g. mild headache since this morning")
            symptom_btn = gr.Button("Log symptom")
            symptom_output = gr.Markdown()
            symptom_btn.click(handle_symptom, symptom_input, symptom_output)

        with gr.Tab("Appointment Summary"):
            appointment_input = gr.Textbox(label="Appointment notes or transcript", lines=10)
            appointment_btn = gr.Button("Summarize")
            appointment_output = gr.Markdown()
            appointment_btn.click(handle_appointment, appointment_input, appointment_output)

    return demo
