"""
Seed script — imports products from frontend/src/data/products.json into MongoDB.

Usage:
    python seed_products.py

This script is idempotent: it clears the products collection and re-seeds.
"""

import asyncio
import json
import os
import sys

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = "vani_db"

# Path to the products JSON relative to this script
PRODUCTS_JSON_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "frontend", "src", "data", "products.json"
)


async def seed():
    """Seed the products collection from products.json."""
    # Check if file exists
    if not os.path.exists(PRODUCTS_JSON_PATH):
        print(f"❌ Products file not found: {PRODUCTS_JSON_PATH}")
        sys.exit(1)

    print(f"📂 Loading products from: {PRODUCTS_JSON_PATH}")

    with open(PRODUCTS_JSON_PATH, "r", encoding="utf-8") as f:
        products = json.load(f)

    print(f"📦 Loaded {len(products)} products")

    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DB_NAME]

    # Clear existing products
    deleted = await db.products.delete_many({})
    print(f"🗑️  Cleared {deleted.deleted_count} existing products")

    # Prepare documents
    docs = []
    for p in products:
        doc = {
            "id": p.get("id", ""),
            "name": p.get("name", ""),
            "brand": p.get("brand", ""),
            "category": p.get("category", ""),
            "image": p.get("image", ""),
            "all_images": p.get("all_images", []),
            "rating": float(p.get("rating", 0)),
            "reviews": int(p.get("reviews", 0)),
            "price": float(p.get("price", 0)),
            "originalPrice": float(p["originalPrice"]) if p.get("originalPrice") else None,
            "about": p.get("about", ""),
            "description": p.get("description", ""),
            "rating_distribution": p.get("rating_distribution", {}),
            "customer_reviews": p.get("customer_reviews", []),
        }
        docs.append(doc)

    # Batch insert
    if docs:
        result = await db.products.insert_many(docs)
        print(f"✅ Inserted {len(result.inserted_ids)} products")

    # Create indexes
    await db.products.create_index("id", unique=True)
    await db.products.create_index("category")
    await db.products.create_index("price")
    await db.products.create_index("brand")

    # Drop existing text index if any, then create new one
    try:
        await db.products.drop_index("product_text_search")
    except Exception:
        pass

    await db.products.create_index(
        [("name", "text"), ("brand", "text"), ("category", "text"), ("about", "text")],
        name="product_text_search",
    )
    print("📇 Indexes created")

    # Print some stats
    categories = await db.products.distinct("category")
    brands = await db.products.distinct("brand")
    print(f"\n📊 Stats:")
    print(f"   Categories: {len(categories)}")
    print(f"   Brands: {len(brands)}")
    print(f"   Total products: {len(docs)}")
    print(f"\n🎉 Seeding complete!")

    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
