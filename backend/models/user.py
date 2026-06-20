"""User document model for MongoDB."""

from datetime import datetime, timezone


def create_user_document(name: str, email: str, password_hash: str) -> dict:
    """Create a user document for MongoDB insertion."""
    now = datetime.now(timezone.utc)
    return {
        "name": name,
        "email": email.lower().strip(),
        "password_hash": password_hash,
        "created_at": now,
        "updated_at": now,
    }
