"""Product request/response schemas."""

from typing import Optional
from pydantic import BaseModel, Field


class ProductResponse(BaseModel):
    """Full product response schema."""
    id: str
    name: str
    brand: str
    category: str
    image: str
    all_images: list[str] = []
    rating: float
    reviews: int
    price: float
    originalPrice: Optional[float] = None
    about: str = ""
    description: str = ""
    rating_distribution: dict = {}
    customer_reviews: list[dict] = []


class ProductListResponse(BaseModel):
    """Paginated product list response."""
    products: list[ProductResponse]
    total: int
    page: int
    limit: int
    total_pages: int


class ProductSearchParams(BaseModel):
    """Product search and filter parameters."""
    query: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    color: Optional[str] = None
    price_min: Optional[float] = Field(None, ge=0)
    price_max: Optional[float] = Field(None, ge=0)
    rating_min: Optional[float] = Field(None, ge=0, le=5)
    sort_by: Optional[str] = Field(None, pattern="^(price_asc|price_desc|rating|newest|reviews)$")
    page: int = Field(1, ge=1)
    limit: int = Field(20, ge=1, le=100)
