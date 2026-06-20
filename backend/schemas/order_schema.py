"""Order request/response schemas."""

from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class ShippingAddress(BaseModel):
    """Shipping address schema."""
    name: str = Field(..., min_length=2)
    street: str = Field(..., min_length=5)
    city: str = Field(..., min_length=2)
    state: str = Field(..., min_length=2)
    pincode: str = Field(..., min_length=4, max_length=10)
    phone: str = Field(..., min_length=10, max_length=15)


class CreateOrderRequest(BaseModel):
    """Schema for creating an order from the current cart."""
    shipping_address: ShippingAddress


class OrderItemResponse(BaseModel):
    """Individual order item snapshot."""
    product_id: str
    name: str
    price: float
    quantity: int
    image: str


class OrderResponse(BaseModel):
    """Full order response."""
    id: str
    items: list[OrderItemResponse]
    total: float
    status: str
    shipping_address: dict
    created_at: datetime


class OrderListResponse(BaseModel):
    """List of orders response."""
    orders: list[OrderResponse]
    total: int
