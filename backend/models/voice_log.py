"""Voice log document model for MongoDB."""

from datetime import datetime, timezone


def create_voice_log_document(
    user_id: str,
    command: str,
    intent: str,
    parsed_params: dict,
    success: bool,
    confidence: float,
    parser_used: str,
) -> dict:
    """Create a voice log document for analytics tracking."""
    return {
        "user_id": user_id,
        "command": command,
        "intent": intent,
        "parsed_params": parsed_params,
        "success": success,
        "confidence": confidence,
        "parser_used": parser_used,
        "created_at": datetime.now(timezone.utc),
    }
