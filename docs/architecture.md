# Architecture roadmap and current foundation

MediGuide is evolving from a local RAG chatbot into a multimodal,
evidence-grounded health-information workspace.

## Routes

- `/` — public marketing homepage
- `/workspace` — product application (conversations, documents, labs, medications, visit prep, demo, evaluation, system)

## Provenance chain (Milestone 1)

Document → DocumentPage → ExtractedField → LabObservation

Confirmed document fields that match tracked lab codes become
human-verified observations. Timeline points always expose:

- document_id
- page_number
- field_id
- report_date
- unit
- verification_state

## Package layout (target)

- `frontend/` Next.js workspace UI
- `src/api/` FastAPI routers by subsystem
- `src/database/` SQLAlchemy models + session
- `src/labs/` lab normalization + timeline services
- `src/agents/` MedicalAgentOrchestrator skeleton
- `migrations/` Alembic revisions
- `n8n/` operational workflows (not chat reasoning)
- `docker-compose.yml` Postgres + API

## Milestone sequence

1. Data foundation (this release)
2. Document Intelligence V2 provenance + page citations
3. Lab Timeline UX polish
4. Visit Preparation Agent export
5. Unified orchestrator
6. Evidence V2 sufficiency/ranking
7. n8n operational workflows
8. Demo mode, evaluation dashboard, deployment polish

Safety rule: LIMITED evidence never falls back to unrestricted model knowledge.
