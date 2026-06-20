"""Product service — catalog browsing, search, and filtering."""

import math
import re
from typing import Optional

from fastapi import HTTPException, status

from database.connection import get_database


def _serialize_product(doc: dict) -> dict:
    """Convert a MongoDB product document to API response format."""
    doc.pop("_id", None)
    return doc


async def get_products(
    page: int = 1,
    limit: int = 20,
    category: Optional[str] = None,
    brand: Optional[str] = None,
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    rating_min: Optional[float] = None,
    sort_by: Optional[str] = None,
) -> dict:
    """Get paginated, filterable product list."""
    db = get_database()
    query: dict = {}

    if category:
        query["category"] = {"$regex": re.escape(category), "$options": "i"}
    if brand:
        query["brand"] = {"$regex": re.escape(brand), "$options": "i"}
    if price_min is not None or price_max is not None:
        query["price"] = {}
        if price_min is not None:
            query["price"]["$gte"] = price_min
        if price_max is not None:
            query["price"]["$lte"] = price_max
        if not query["price"]:
            del query["price"]
    if rating_min is not None:
        query["rating"] = {"$gte": rating_min}

    # Sorting
    sort_spec = [("_id", -1)]  # default: newest
    if sort_by == "price_asc":
        sort_spec = [("price", 1)]
    elif sort_by == "price_desc":
        sort_spec = [("price", -1)]
    elif sort_by == "rating":
        sort_spec = [("rating", -1)]
    elif sort_by == "reviews":
        sort_spec = [("reviews", -1)]

    total = await db.products.count_documents(query)
    skip = (page - 1) * limit

    cursor = db.products.find(query).sort(sort_spec).skip(skip).limit(limit)
    products = [_serialize_product(doc) async for doc in cursor]

    return {
        "products": products,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": math.ceil(total / limit) if total > 0 else 0,
    }


async def get_product_by_id(product_id: str) -> dict:
    """Get a single product by its ID field (not _id)."""
    db = get_database()
    doc = await db.products.find_one({"id": product_id})
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product not found: {product_id}",
        )
    return _serialize_product(doc)


async def search_products(
    query: str,
    category: Optional[str] = None,
    color: Optional[str] = None,
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    rating_min: Optional[float] = None,
    page: int = 1,
    limit: int = 20,
    sort_by: Optional[str] = None,
) -> dict:
    """Search products using text search or regex fallback."""
    db = get_database()

    # Build the filter
    filters: dict = {}

    if category:
        filters["category"] = {"$regex": re.escape(category), "$options": "i"}
    if color:
        filters["$or"] = [
            {"name": {"$regex": re.escape(color), "$options": "i"}},
            {"about": {"$regex": re.escape(color), "$options": "i"}},
            {"description": {"$regex": re.escape(color), "$options": "i"}},
        ]
    if price_min is not None or price_max is not None:
        filters["price"] = {}
        if price_min is not None:
            filters["price"]["$gte"] = price_min
        if price_max is not None:
            filters["price"]["$lte"] = price_max
    if rating_min is not None:
        filters["rating"] = {"$gte": rating_min}

    # Try $text search first, fall back to regex
    try:
        text_filter = {"$text": {"$search": query}, **filters}
        total = await db.products.count_documents(text_filter)
        if total > 0:
            skip = (page - 1) * limit
            sort_spec = [("score", {"$meta": "textScore"})]
            if sort_by == "price_asc":
                sort_spec = [("price", 1)]
            elif sort_by == "price_desc":
                sort_spec = [("price", -1)]
            elif sort_by == "rating":
                sort_spec = [("rating", -1)]

            cursor = (
                db.products.find(text_filter, {"score": {"$meta": "textScore"}})
                .sort(sort_spec)
                .skip(skip)
                .limit(limit)
            )
            products = []
            async for doc in cursor:
                doc.pop("score", None)
                products.append(_serialize_product(doc))

            return {
                "products": products,
                "total": total,
                "page": page,
                "limit": limit,
                "total_pages": math.ceil(total / limit) if total > 0 else 0,
            }
    except Exception:
        pass

    # Regex fallback — search across multiple fields
    regex = {"$regex": re.escape(query), "$options": "i"}
    regex_filter = {
        "$or": [
            {"name": regex},
            {"brand": regex},
            {"category": regex},
            {"about": regex},
            {"description": regex},
        ],
        **filters,
    }

    total = await db.products.count_documents(regex_filter)
    skip = (page - 1) * limit

    sort_spec_fallback = [("rating", -1)]
    if sort_by == "price_asc":
        sort_spec_fallback = [("price", 1)]
    elif sort_by == "price_desc":
        sort_spec_fallback = [("price", -1)]
    elif sort_by == "rating":
        sort_spec_fallback = [("rating", -1)]

    cursor = db.products.find(regex_filter).sort(sort_spec_fallback).skip(skip).limit(limit)
    products = [_serialize_product(doc) async for doc in cursor]

    return {
        "products": products,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": math.ceil(total / limit) if total > 0 else 0,
    }


async def get_categories() -> list[str]:
    """Get all distinct product categories."""
    db = get_database()
    categories = await db.products.distinct("category")
    return sorted(categories)
