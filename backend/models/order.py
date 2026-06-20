"""Order document model for MongoDB."""

from datetime import datetime, timezone


def create_order_document(
    user_id: str,
    items: list[dict],
    total: float,
    shipping_address: dict,
) -> dict:
    """Create an order document for MongoDB insertion."""
    return {
        "user_id": user_id,
        "items": items,
        "total": total,
        "status": "confirmed",
        "shipping_address": shipping_address,
        "created_at": datetime.now(timezone.utc),
    }
