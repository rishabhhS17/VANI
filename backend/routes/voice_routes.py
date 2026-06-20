"""Voice command routes — process commands and view analytics."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from services.intent_parser import parse_intent
from services.intent_dispatcher import dispatch_intent
from middleware.auth_middleware import get_current_user
from database.connection import get_database

router = APIRouter(prefix="/voice", tags=["Voice Commands"])


class VoiceCommandRequest(BaseModel):
    """Request body for processing a voice command."""
    command: str = Field(..., min_length=1, max_length=500, examples=["show me blue shoes under 50"])


class VoiceCommandResponse(BaseModel):
    """Response from processing a voice command."""
    action: str
    message: str
    data: dict | list | None = None
    intent: dict
    success: bool


@router.post("/command", response_model=VoiceCommandResponse)
async def process_voice_command(
    request: VoiceCommandRequest,
    user: dict = Depends(get_current_user),
):
    """
    Process a voice command text through the hybrid intent parser.

    Flow: Voice Command → Rule-Based Parser → (if low confidence) → Groq Parser → Dispatcher
    """
    # Parse the intent
    parsed = await parse_intent(request.command)

    # Dispatch to the appropriate service
    result = await dispatch_intent(parsed, user_id=user["sub"], command=request.command)

    return result


@router.get("/analytics")
async def get_voice_analytics(user: dict = Depends(get_current_user)):
    """
    Get voice command analytics for the current user.

    Returns:
    - Total commands
    - Success rate
    - Most used intents
    - Most used commands
    - Failed commands
    - Parser distribution (rule vs groq)
    """
    db = get_database()
    user_id = user["sub"]

    # Total commands
    total = await db.voice_logs.count_documents({"user_id": user_id})
    if total == 0:
        return {
            "total_commands": 0,
            "success_rate": 0,
            "most_used_intents": [],
            "recent_commands": [],
            "failed_commands": [],
            "parser_distribution": {"rule": 0, "groq": 0},
        }

    # Success rate
    successful = await db.voice_logs.count_documents({"user_id": user_id, "success": True})
    success_rate = round((successful / total) * 100, 1) if total > 0 else 0

    # Most used intents (aggregation)
    intent_pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": "$intent", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    intent_cursor = db.voice_logs.aggregate(intent_pipeline)
    most_used_intents = [
        {"intent": doc["_id"], "count": doc["count"]}
        async for doc in intent_cursor
    ]

    # Recent commands
    recent_cursor = (
        db.voice_logs.find({"user_id": user_id})
        .sort("created_at", -1)
        .limit(20)
    )
    recent_commands = []
    async for doc in recent_cursor:
        recent_commands.append({
            "command": doc["command"],
            "intent": doc["intent"],
            "success": doc["success"],
            "confidence": doc["confidence"],
            "parser_used": doc["parser_used"],
            "created_at": doc["created_at"].isoformat(),
        })

    # Failed commands
    failed_cursor = (
        db.voice_logs.find({"user_id": user_id, "success": False})
        .sort("created_at", -1)
        .limit(10)
    )
    failed_commands = []
    async for doc in failed_cursor:
        failed_commands.append({
            "command": doc["command"],
            "intent": doc["intent"],
            "created_at": doc["created_at"].isoformat(),
        })

    # Parser distribution
    parser_pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": "$parser_used", "count": {"$sum": 1}}},
    ]
    parser_cursor = db.voice_logs.aggregate(parser_pipeline)
    parser_dist = {"rule": 0, "groq": 0}
    async for doc in parser_cursor:
        if doc["_id"] in parser_dist:
            parser_dist[doc["_id"]] = doc["count"]

    return {
        "total_commands": total,
        "success_rate": success_rate,
        "most_used_intents": most_used_intents,
        "recent_commands": recent_commands,
        "failed_commands": failed_commands,
        "parser_distribution": parser_dist,
    }
