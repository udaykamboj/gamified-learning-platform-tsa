"""Tests for the platform catalog DSL and sync service (R6, R7)."""

import pytest
from src.content.catalog.content import compile_document, ContentError
from src.content.catalog.sync import (
    load_catalog,
    stable_uuid,
    sync_platform_content,
)


def test_compile_document_primitives():
    blocks = [
        "h2:Introduction to AI",
        "h3:Key concepts",
        "p:Artificial intelligence is transforming industries.",
        {"info": "Pay attention to ethics."},
        {"warn": "Avoid biased training data."},
        {"ul": ["Item 1", "Item 2"]},
        {"ol": ["Step 1", "Step 2"]},
        {"code": "print('hello world')"},
    ]
    doc = compile_document(blocks)
    assert doc["type"] == "doc"
    content = doc["content"]
    assert len(content) == 8
    assert content[0]["type"] == "heading"
    assert content[0]["attrs"]["level"] == 2
    assert content[1]["type"] == "heading"
    assert content[1]["attrs"]["level"] == 3
    assert content[2]["type"] == "paragraph"
    assert content[3]["type"] == "calloutInfo"
    assert content[4]["type"] == "calloutWarning"
    assert content[5]["type"] == "bulletList"
    assert content[6]["type"] == "orderedList"
    assert content[7]["type"] == "codeBlock"


def test_compile_document_quiz():
    blocks = [
        {
            "quiz": {
                "q": "What is machine learning?",
                "a": [
                    ["A subset of AI", True],
                    ["A hardware device", False],
                ],
            }
        }
    ]
    doc = compile_document(blocks)
    assert doc["type"] == "doc"
    assert len(doc["content"]) == 1
    quiz_node = doc["content"][0]
    assert quiz_node["type"] == "blockQuiz"
    attrs = quiz_node["attrs"]
    assert len(attrs["questions"]) == 1
    q = attrs["questions"][0]
    assert q["question"] == "What is machine learning?"
    assert len(q["answers"]) == 2
    assert q["answers"][0]["correct"] is True
    assert q["answers"][1]["correct"] is False


def test_compile_document_unknown_block():
    with pytest.raises(ContentError):
        compile_document(["unknown:something"])


def test_stable_uuid():
    u1 = stable_uuid("course", "ai-ethics")
    u2 = stable_uuid("course", "ai-ethics")
    u3 = stable_uuid("course", "ai-foundations")
    assert u1 == u2
    assert u1 != u3
    assert u1.startswith("course_")


def test_load_catalog():
    courses = load_catalog()
    assert len(courses) >= 3
    slugs = [c["slug"] for c in courses]
    assert "ai-ethics" in slugs
    assert "ai-foundations" in slugs
    assert "prompt-engineering" in slugs

    for course in courses:
        assert "name" in course
        assert "description" in course
        assert "chapters" in course
        assert len(course["chapters"]) > 0


@pytest.mark.asyncio
async def test_sync_platform_content(db, org):
    stats = await sync_platform_content(db)
    assert stats.created > 0

    # Running sync a second time should be idempotent (nothing created)
    stats2 = await sync_platform_content(db)
    assert stats2.created == 0
