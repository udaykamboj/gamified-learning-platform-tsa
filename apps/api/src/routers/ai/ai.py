import json
import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlmodel.ext.asyncio.session import AsyncSession

from src.services.ai.ai import (
    ai_send_activity_chat_message,
    ai_start_activity_chat_session,
    ai_start_activity_chat_session_stream,
    ai_send_activity_chat_message_stream,
)
from src.services.ai.base import ask_ai_stream, save_message_to_history, generate_follow_up_suggestions
from src.services.ai.schemas.ai import (
    ActivityAIChatSessionResponse,
    SendActivityAIChatMessage,
    StartActivityAIChatSession,
)
from src.core.events.database import get_db_session
from src.db.users import PublicUser
from src.security.auth import get_authenticated_user

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/start/activity_chat_session",
    response_model=ActivityAIChatSessionResponse,
    summary="Start activity AI chat session",
    description="Start a new AI chat session anchored to a course activity. Returns the new session's state and initial message.",
    responses={
        200: {"description": "New AI chat session created.", "model": ActivityAIChatSessionResponse},
        401: {"description": "Authentication required"},
        403: {"description": "User lacks permission or AI feature disabled for this organization"},
        404: {"description": "Activity or organization not found"},
    },
)
async def api_ai_start_activity_chat_session(
    request: Request,
    chat_session_object: StartActivityAIChatSession,
    current_user: PublicUser = Depends(get_authenticated_user),
    db_session: AsyncSession = Depends(get_db_session),
)-> ActivityAIChatSessionResponse:
    """
    Start a new AI Chat session with a Course Activity
    """
    return await ai_start_activity_chat_session(
        request, chat_session_object, current_user, db_session
    )

@router.post(
    "/send/activity_chat_message",
    response_model=ActivityAIChatSessionResponse,
    summary="Send activity AI chat message",
    description="Send a message to an existing AI chat session anchored to a course activity and receive the updated session state.",
    responses={
        200: {"description": "Message sent and AI response recorded.", "model": ActivityAIChatSessionResponse},
        401: {"description": "Authentication required"},
        403: {"description": "User lacks permission or AI feature disabled for this organization"},
        404: {"description": "Session or activity not found"},
    },
)
async def api_ai_send_activity_chat_message(
    request: Request,
    chat_session_object: SendActivityAIChatMessage,
    current_user: PublicUser = Depends(get_authenticated_user),
    db_session: AsyncSession = Depends(get_db_session),
)-> ActivityAIChatSessionResponse:
    """
    Send a message to an AI Chat session with a Course Activity
    """
    return await ai_send_activity_chat_message(
        request, chat_session_object, current_user, db_session
    )


async def activity_chat_event_generator(
    stream_generator,
    aichat_uuid: str,
    activity_uuid: str,
    user_message: str,
    ai_friendly_text: str,
    ai_model: str,
    org_id: int | None = None,
):
    """Convert async generator to SSE format with follow-up suggestions.

    Credits are reserved by the caller before the stream is created. If the
    stream dies before producing any model output (upstream error, client
    disconnect, cancellation) we refund one credit so a flaky connection
    doesn't silently drain the org's quota.
    """
    import asyncio
    from src.security.features_utils.usage import refund_ai_credit

    full_response = ""
    stream_failed = False
    try:
        # Send start event immediately so frontend knows we're ready
        yield f"data: {json.dumps({'type': 'start', 'aichat_uuid': aichat_uuid})}\n\n"

        async for chunk in stream_generator:
            full_response += chunk
            yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"

        # Save the message exchange to history
        save_message_to_history(aichat_uuid, user_message, full_response)

        # Send done event immediately (without waiting for follow-ups)
        yield f"data: {json.dumps({'type': 'done', 'aichat_uuid': aichat_uuid, 'activity_uuid': activity_uuid})}\n\n"

        # Generate follow-up suggestions and send as separate event
        follow_ups = await generate_follow_up_suggestions(
            full_response,
            ai_friendly_text[:1000],
            ai_model,
            user_message
        )

        if follow_ups:
            yield f"data: {json.dumps({'type': 'follow_ups', 'follow_up_suggestions': follow_ups})}\n\n"

    except asyncio.CancelledError:
        # Client disconnect / server shutdown. Do NOT force a refund here: if
        # the model already produced output the credit was legitimately spent.
        # The finally block still refunds when nothing was produced
        # (full_response empty), so a disconnect *after* a full response can't
        # be abused to get free AI. Re-raise so Starlette observes the cancel.
        raise
    except Exception:
        stream_failed = True
        logger.exception("Error in activity_chat_event_generator")
        yield f"data: {json.dumps({'type': 'error', 'message': 'An internal error occurred while processing the AI chat request.'})}\n\n"
    finally:
        # Refund credit if the model produced nothing useful.
        if org_id is not None and (stream_failed or not full_response):
            try:
                refund_ai_credit(org_id, 1)
            except Exception:
                logger.debug("AI credit refund failed", exc_info=True)


@router.post(
    "/stream/start/activity_chat_session",
    summary="Start activity AI chat session (streaming)",
    description="Start a new AI chat session for a course activity and stream the response as Server-Sent Events (SSE).",
    responses={
        200: {
            "description": "SSE stream of chat events (start, chunk, done, follow_ups, error).",
            "content": {"text/event-stream": {}},
        },
        401: {"description": "Authentication required"},
        403: {"description": "User lacks permission or AI feature disabled for this organization"},
        404: {"description": "Activity or organization not found"},
    },
)
async def api_ai_start_activity_chat_session_stream(
    request: Request,
    chat_session_object: StartActivityAIChatSession,
    current_user: PublicUser = Depends(get_authenticated_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    """
    Start a new AI Chat session with streaming response (SSE).
    Returns Server-Sent Events stream.
    """
    context = await ai_start_activity_chat_session_stream(
        request, chat_session_object, current_user, db_session
    )

    # Create the streaming generator
    stream = ask_ai_stream(
        context["user_message"],
        context["chat_session"]["message_history"],
        context["ai_friendly_text"],
        context["message"],
        context["ai_model"],
    )

    return StreamingResponse(
        activity_chat_event_generator(
            stream,
            context["chat_session"]["aichat_uuid"],
            context["activity"].activity_uuid,
            context["user_message"],
            context["ai_friendly_text"],
            context["ai_model"],
            org_id=getattr(context.get("course", None), "org_id", None),
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.post(
    "/stream/send/activity_chat_message",
    summary="Send activity AI chat message (streaming)",
    description="Send a message to an existing activity AI chat session and stream the response as Server-Sent Events (SSE).",
    responses={
        200: {
            "description": "SSE stream of chat events (start, chunk, done, follow_ups, error).",
            "content": {"text/event-stream": {}},
        },
        401: {"description": "Authentication required"},
        403: {"description": "User lacks permission or AI feature disabled for this organization"},
        404: {"description": "Session or activity not found"},
    },
)
async def api_ai_send_activity_chat_message_stream(
    request: Request,
    chat_session_object: SendActivityAIChatMessage,
    current_user: PublicUser = Depends(get_authenticated_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    """
    Send a message to an existing AI Chat session with streaming response (SSE).
    Returns Server-Sent Events stream.
    """
    context = await ai_send_activity_chat_message_stream(
        request, chat_session_object, current_user, db_session
    )

    # Create the streaming generator
    stream = ask_ai_stream(
        context["user_message"],
        context["chat_session"]["message_history"],
        context["ai_friendly_text"],
        context["message"],
        context["ai_model"],
    )

    return StreamingResponse(
        activity_chat_event_generator(
            stream,
            context["chat_session"]["aichat_uuid"],
            context["activity"].activity_uuid,
            context["user_message"],
            context["ai_friendly_text"],
            context["ai_model"],
            org_id=getattr(context.get("course", None), "org_id", None),
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


# ============================================================================
# Editor AI Endpoints
# ============================================================================

# Content modification markers
CONTENT_START_MARKER = "<<<CONTENT>>>"
CONTENT_END_MARKER = "<<<END_CONTENT>>>"



