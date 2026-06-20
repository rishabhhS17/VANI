"""Cart document model for MongoDB."""

from datetime import datetime, timezone


def create_cart_document(user_id: str) -> dict:
    """Create an empty cart document for a new user."""
    return {
        "user_id": user_id,
        "items": [],
        "updated_at": datetime.now(timezone.utc),
    }
