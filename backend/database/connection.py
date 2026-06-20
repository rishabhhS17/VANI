"""Async MongoDB connection using Motor."""

import os
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = "vani_db"

_client: AsyncIOMotorClient | None = None
_database: AsyncIOMotorDatabase | None = None


async def connect_to_mongodb() -> None:
    """Initialize the MongoDB connection and create indexes."""
    global _client, _database
    _client = AsyncIOMotorClient(MONGODB_URL)
    _database = _client[DB_NAME]

    # Create indexes
    await _database.users.create_index("email", unique=True)
    await _database.products.create_index("id", unique=True)
    await _database.products.create_index("category")
    await _database.products.create_index("price")
    await _database.products.create_index("brand")
    await _database.products.create_index(
        [("name", "text"), ("brand", "text"), ("category", "text"), ("about", "text")],
        name="product_text_search",
    )
    await _database.carts.create_index("user_id", unique=True)
    await _database.orders.create_index("user_id")
    await _database.voice_logs.create_index("user_id")
    await _database.voice_logs.create_index("created_at")

    print(f"[OK] Connected to MongoDB: {DB_NAME}")


async def close_mongodb_connection() -> None:
    """Close the MongoDB connection."""
    global _client
    if _client:
        _client.close()
        print("[--] MongoDB connection closed")


def get_database() -> AsyncIOMotorDatabase:
    """Get the database instance. Must be called after connect_to_mongodb()."""
    if _database is None:
        raise RuntimeError("Database not initialized. Call connect_to_mongodb() first.")
    return _database
