# MediGuide AI

MediGuide AI is a local, multimodal health-education and
appointment-preparation assistant.

## Current Features

- Local open-source language model
- Gradio chatbot interface
- Conversation history
- Emergency phrase detection
- Medical scope restrictions
- Response validation

## Important Limitation

This project is an educational prototype. It does not diagnose,
prescribe medication, interpret medical images clinically, or replace
a qualified healthcare professional.

## Run Locally

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
ollama pull gemma3:4b
python app.py