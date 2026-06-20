"""Order service — create orders from cart, view history."""

from bson import ObjectId
from fastapi import HTTPException, status

from database.connection import get_database
from models.order import create_order_document


async def create_order(user_id: str, shipping_address: dict) -> dict:
    """Create an order from the user's current cart, then clear the cart."""
    db = get_database()

    # Get the cart
    cart = await db.carts.find_one({"user_id": user_id})
    if not cart or not cart.get("items"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cart is empty. Add items before placing an order.",
        )

    # Fetch product details for each cart item
    product_ids = [item["product_id"] for item in cart["items"]]
    products_cursor = db.products.find({"id": {"$in": product_ids}})
    products_map = {}
    async for p in products_cursor:
        products_map[p["id"]] = p

    # Build order items (snapshot of product info at order time)
    order_items = []
    total = 0.0

    for item in cart["items"]:
        product = products_map.get(item["product_id"])
        if not product:
            continue

        item_total = product["price"] * item["quantity"]
        total += item_total
        order_items.append({
            "product_id": item["product_id"],
            "name": product["name"],
            "price": product["price"],
            "quantity": item["quantity"],
            "image": product["image"],
        })

    if not order_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid products found in cart",
        )

    # Create order document
    order_doc = create_order_document(
        user_id=user_id,
        items=order_items,
        total=round(total, 2),
        shipping_address=shipping_address,
    )
    result = await db.orders.insert_one(order_doc)

    # Clear the cart
    await db.carts.update_one(
        {"user_id": user_id},
        {"$set": {"items": []}},
    )

    order_doc["id"] = str(result.inserted_id)
    order_doc.pop("_id", None)
    return order_doc


async def get_orders(user_id: str) -> dict:
    """Get all orders for a user, sorted newest first."""
    db = get_database()
    cursor = db.orders.find({"user_id": user_id}).sort("created_at", -1)
    orders = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        orders.append(doc)

    return {"orders": orders, "total": len(orders)}


async def get_order_by_id(user_id: str, order_id: str) -> dict:
    """Get a single order by ID (must belong to the user)."""
    db = get_database()

    try:
        obj_id = ObjectId(order_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid order ID format",
        )

    doc = await db.orders.find_one({"_id": obj_id, "user_id": user_id})
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    doc["id"] = str(doc.pop("_id"))
    return doc
