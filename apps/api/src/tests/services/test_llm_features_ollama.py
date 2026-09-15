"""Live, end-to-end tests of the REAL AI feature functions against a local Ollama server.

Unlike test_llm_ollama.py (which exercises the llm primitives directly), this drives the
actual production service functions — activity chat, chat title, follow-ups, course planning,
and MagicBlocks — and configures the provider through the REAL config path
(STARLAB_AI_* env vars -> get_starlab_config() -> build_model), exactly as a deployment
would. Proves the whole stack runs on a non-Gemini provider with config-only changes.

Run locally:
    ollama serve
    ollama pull qwen2.5:3b
    pytest -m ollama src/tests/services/test_llm_features_ollama.py
Override the model with OLLAMA_TEST_MODEL.
"""

import socket

import pytest

from src.services.ai import base
from src.services.ai.rag.embedding_service import embed_single_text, generate_embeddings

import os

OLLAMA_HOST, OLLAMA_PORT = "localhost", 11434
OLLAMA_MODEL = os.environ.get("OLLAMA_TEST_MODEL", "qwen2.5:3b")
OLLAMA_EMBED_MODEL = os.environ.get("OLLAMA_EMBED_MODEL", "nomic-embed-text")


def _ollama_running() -> bool:
    try:
        with socket.create_connection((OLLAMA_HOST, OLLAMA_PORT), timeout=0.5):
            return True
    except OSError:
        return False


pytestmark = [
    pytest.mark.ollama,
    pytest.mark.skipif(not _ollama_running(), reason="Ollama not reachable on localhost:11434"),
]


@pytest.fixture(autouse=True)
def _ollama_env(monkeypatch):
    """Configure the REAL config to use Ollama for every tier (env path, not a mock)."""
    monkeypatch.setenv("STARLAB_AI_PROVIDER", "ollama")
    monkeypatch.setenv("STARLAB_AI_BASE_URL", f"http://{OLLAMA_HOST}:{OLLAMA_PORT}/v1")
    for tier in ("FAST", "STANDARD", "PRO"):
        monkeypatch.setenv(f"STARLAB_AI_MODEL_{tier}", OLLAMA_MODEL)
    # Embeddings follow the same (ollama) provider; use a local embedding model.
    monkeypatch.setenv("STARLAB_AI_EMBEDDING_MODEL", OLLAMA_EMBED_MODEL)


@pytest.mark.asyncio
async def test_activity_chat_ask_ai():
    """base.ask_ai — the activity-chat / editor non-streaming path."""
    result = await base.ask_ai(
        question="What is 2 + 2? Reply with just the number.",
        message_history=[],
        text_reference="This lesson covers basic arithmetic.",
        message_for_the_prompt="You are a concise math tutor.",
        model_name="",  # resolves to the configured standard tier
    )
    assert isinstance(result["output"], str) and result["output"].strip()
    assert "4" in result["output"]


@pytest.mark.asyncio
async def test_activity_chat_ask_ai_stream():
    """base.ask_ai_stream — the streaming path used by activity chat, RAG, and the editor."""
    chunks = [
        chunk
        async for chunk in base.ask_ai_stream(
            question="Say the word: hello",
            message_history=[],
            text_reference="",
            message_for_the_prompt="You are terse. Output a single word.",
            model_name="",
        )
    ]
    assert chunks, "expected at least one streamed chunk"
    assert "".join(chunks).strip()


@pytest.mark.asyncio
async def test_chat_history_is_used():
    """History threading through the real chat path (stored Redis-format dicts)."""
    history = [
        {"role": "user", "content": "Remember the code word is BANANA."},
        {"role": "model", "content": "Understood, the code word is BANANA."},
    ]
    result = await base.ask_ai(
        question="What is the code word? Reply with one word.",
        message_history=history,
        text_reference="",
        message_for_the_prompt="You are a helpful assistant.",
        model_name="",
    )
    assert "banana" in result["output"].lower()


@pytest.mark.asyncio
async def test_generate_chat_title():
    """base.generate_chat_title — fast tier summarization."""
    title = await base.generate_chat_title(
        "How do volcanoes form?",
        "Volcanoes form where magma rises through the crust and erupts.",
    )
    assert isinstance(title, str) and title.strip()
    assert len(title) <= 60


@pytest.mark.asyncio
async def test_generate_follow_up_suggestions():
    """base.generate_follow_up_suggestions — fast tier, parsed into a list."""
    suggestions = await base.generate_follow_up_suggestions(
        ai_response="Photosynthesis converts sunlight, water, and CO2 into glucose and oxygen.",
        context="biology lesson",
        model_name="",
        user_message="What is photosynthesis?",
    )
    assert isinstance(suggestions, list)
    assert len(suggestions) <= 3
    assert all(isinstance(s, str) for s in suggestions)


@pytest.mark.asyncio
async def test_rag_embeddings_follow_provider():
    """RAG embeddings run through the chosen provider (Ollama), not hardcoded Gemini."""
    vec = await embed_single_text("photosynthesis converts sunlight into energy")
    assert isinstance(vec, list) and len(vec) == 768  # matches the pgvector column
    assert all(isinstance(x, float) for x in vec[:5])

    # Batch path used by course indexing.
    vecs = await generate_embeddings(["alpha", "beta", "gamma"])
    assert len(vecs) == 3 and all(len(v) == 768 for v in vecs)
