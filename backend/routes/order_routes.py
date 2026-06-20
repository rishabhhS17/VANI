"""Order routes — create order, view history, view details."""

from fastapi import APIRouter, Depends

from schemas.order_schema import CreateOrderRequest, OrderResponse, OrderListResponse
from services import order_service
from middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.post("", response_model=OrderResponse, status_code=201)
async def create_order(
    request: CreateOrderRequest,
    user: dict = Depends(get_current_user),
):
    """Create an order from the current cart. Clears the cart after."""
    result = await order_service.create_order(
        user_id=user["sub"],
        shipping_address=request.shipping_address.model_dump(),
    )
    return result


@router.get("", response_model=OrderListResponse)
async def get_orders(user: dict = Depends(get_current_user)):
    """Get the current user's order history."""
    return await order_service.get_orders(user["sub"])


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: str,
    user: dict = Depends(get_current_user),
):
    """Get details of a specific order."""
    return await order_service.get_order_by_id(
        user_id=user["sub"],
        order_id=order_id,
    )
