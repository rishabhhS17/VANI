"""Cart request/response schemas."""

from typing import Optional
from pydantic import BaseModel, Field


class AddToCartRequest(BaseModel):
    """Schema for adding an item to the cart."""
    product_id: str
    quantity: int = Field(1, ge=1, le=99)


class UpdateCartRequest(BaseModel):
    """Schema for updating cart item quantity."""
    product_id: str
    quantity: int = Field(..., ge=0, le=99)


class CartItemResponse(BaseModel):
    """Individual cart item with product details."""
    product_id: str
    name: str
    brand: str
    image: str
    price: float
    originalPrice: Optional[float] = None
    quantity: int
    subtotal: float


class CartResponse(BaseModel):
    """Full cart response."""
    items: list[CartItemResponse]
    total: float
    item_count: int
