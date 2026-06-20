"""Cart routes — view, add, update, remove cart items."""

from fastapi import APIRouter, Depends

from schemas.cart_schema import AddToCartRequest, UpdateCartRequest, CartResponse
from services import cart_service
from middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/cart", tags=["Cart"])


@router.get("", response_model=CartResponse)
async def get_cart(user: dict = Depends(get_current_user)):
    """Get the current user's cart with product details."""
    return await cart_service.get_cart(user["sub"])


@router.post("/add", response_model=CartResponse)
async def add_to_cart(
    request: AddToCartRequest,
    user: dict = Depends(get_current_user),
):
    """Add a product to the cart. Increments quantity if already present."""
    return await cart_service.add_to_cart(
        user_id=user["sub"],
        product_id=request.product_id,
        quantity=request.quantity,
    )


@router.put("/update", response_model=CartResponse)
async def update_cart(
    request: UpdateCartRequest,
    user: dict = Depends(get_current_user),
):
    """Update item quantity. Set quantity to 0 to remove."""
    return await cart_service.update_cart_quantity(
        user_id=user["sub"],
        product_id=request.product_id,
        quantity=request.quantity,
    )


@router.delete("/{product_id}", response_model=CartResponse)
async def remove_from_cart(
    product_id: str,
    user: dict = Depends(get_current_user),
):
    """Remove an item from the cart."""
    return await cart_service.remove_from_cart(
        user_id=user["sub"],
        product_id=product_id,
    )
