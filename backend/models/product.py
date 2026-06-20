"""Product document model for MongoDB.

Mirrors the schema from frontend/src/data/products.json.
"""


def create_product_document(data: dict) -> dict:
    """Create a product document from raw JSON data for MongoDB insertion."""
    return {
        "id": data.get("id", ""),
        "name": data.get("name", ""),
        "brand": data.get("brand", ""),
        "category": data.get("category", ""),
        "image": data.get("image", ""),
        "all_images": data.get("all_images", []),
        "rating": float(data.get("rating", 0)),
        "reviews": int(data.get("reviews", 0)),
        "price": float(data.get("price", 0)),
        "originalPrice": float(data["originalPrice"]) if data.get("originalPrice") else None,
        "about": data.get("about", ""),
        "description": data.get("description", ""),
        "rating_distribution": data.get("rating_distribution", {}),
        "customer_reviews": data.get("customer_reviews", []),
    }
