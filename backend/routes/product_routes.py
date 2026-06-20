"""Product routes — list, search, filter, details, categories."""

from typing import Optional
from fastapi import APIRouter, Query

from schemas.product_schema import ProductResponse, ProductListResponse
from services import product_service

router = APIRouter(prefix="/products", tags=["Products"])


@router.get("/search", response_model=ProductListResponse)
async def search_products(
    q: str = Query(..., min_length=1, description="Search query"),
    category: Optional[str] = Query(None),
    color: Optional[str] = Query(None),
    brand: Optional[str] = Query(None),
    price_min: Optional[float] = Query(None, ge=0),
    price_max: Optional[float] = Query(None, ge=0),
    rating_min: Optional[float] = Query(None, ge=0, le=5),
    sort_by: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """Search products with text query and optional filters."""
    result = await product_service.search_products(
        query=q,
        category=category,
        color=color,
        price_min=price_min,
        price_max=price_max,
        rating_min=rating_min,
        page=page,
        limit=limit,
        sort_by=sort_by,
    )
    return result


@router.get("/categories", response_model=list[str])
async def get_categories():
    """Get all distinct product categories."""
    return await product_service.get_categories()


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(product_id: str):
    """Get a single product by its ID."""
    return await product_service.get_product_by_id(product_id)


@router.get("", response_model=ProductListResponse)
async def list_products(
    category: Optional[str] = Query(None),
    brand: Optional[str] = Query(None),
    price_min: Optional[float] = Query(None, ge=0),
    price_max: Optional[float] = Query(None, ge=0),
    rating_min: Optional[float] = Query(None, ge=0, le=5),
    sort_by: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """List all products with optional filters and pagination."""
    result = await product_service.get_products(
        page=page,
        limit=limit,
        category=category,
        brand=brand,
        price_min=price_min,
        price_max=price_max,
        rating_min=rating_min,
        sort_by=sort_by,
    )
    return result
