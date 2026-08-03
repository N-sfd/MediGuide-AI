from src.models.text_model import TextModel, get_text_model
from src.rag.citations import chunks_to_citations, format_context_block
from src.rag.retriever import Retriever
from src.safety.emergency import check_for_emergency
from src.safety.medical_guardrails import append_disclaimer, build_system_prompt
from src.schemas import ChatMessage, ConversationResponse


class ConversationService:
    def __init__(self, text_model: TextModel | None = None, retriever: Retriever | None = None):
        self.text_model = text_model or get_text_model()
        self.retriever = retriever or Retriever()

    def respond(self, user_message: str, history: list[ChatMessage] | None = None) -> ConversationResponse:
        safety = check_for_emergency(user_message)
        if safety.is_emergency:
            return ConversationResponse(reply=safety.message, is_emergency=True)

        chunks = self.retriever.retrieve(user_message)
        context_block = format_context_block(chunks)
        system_prompt = build_system_prompt(context_block)

        messages = [
            {"role": message.role.value, "content": message.content}
            for message in (history or [])
        ]
        messages.append({"role": "user", "content": user_message})

        reply = self.text_model.generate(messages, system=system_prompt)
        reply = append_disclaimer(reply)

        return ConversationResponse(
            reply=reply,
            citations=chunks_to_citations(chunks),
            is_emergency=False,
        )
