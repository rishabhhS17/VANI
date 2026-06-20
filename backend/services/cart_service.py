"""Cart service — add, remove, update, and retrieve cart items."""

from datetime import datetime, timezone

from fastapi import HTTPException, status

from database.connection import get_database


async def get_cart(user_id: str) -> dict:
    """Get the current cart with enriched product details."""
    db = get_database()
    cart = await db.carts.find_one({"user_id": user_id})

    if not cart or not cart.get("items"):
        return {"items": [], "total": 0.0, "item_count": 0}

    # Enrich cart items with product details
    product_ids = [item["product_id"] for item in cart["items"]]
    products_cursor = db.products.find({"id": {"$in": product_ids}})
    products_map = {}
    async for p in products_cursor:
        products_map[p["id"]] = p

    enriched_items = []
    total = 0.0

    for item in cart["items"]:
        product = products_map.get(item["product_id"])
        if product:
            subtotal = product["price"] * item["quantity"]
            total += subtotal
            enriched_items.append({
                "product_id": item["product_id"],
                "name": product["name"],
                "brand": product["brand"],
                "image": product["image"],
                "price": product["price"],
                "originalPrice": product.get("originalPrice"),
                "quantity": item["quantity"],
                "subtotal": round(subtotal, 2),
            })

    return {
        "items": enriched_items,
        "total": round(total, 2),
        "item_count": sum(i["quantity"] for i in enriched_items),
    }


async def add_to_cart(user_id: str, product_id: str, quantity: int = 1) -> dict:
    """Add a product to the cart. If already present, increment quantity."""
    db = get_database()

    # Verify product exists
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product not found: {product_id}",
        )

    cart = await db.carts.find_one({"user_id": user_id})

    if not cart:
        # Create new cart
        await db.carts.insert_one({
            "user_id": user_id,
            "items": [{"product_id": product_id, "quantity": quantity}],
            "updated_at": datetime.now(timezone.utc),
        })
    else:
        # Check if product already in cart
        existing_item = next(
            (i for i in cart["items"] if i["product_id"] == product_id), None
        )

        if existing_item:
            # Increment quantity
            await db.carts.update_one(
                {"user_id": user_id, "items.product_id": product_id},
                {
                    "$inc": {"items.$.quantity": quantity},
                    "$set": {"updated_at": datetime.now(timezone.utc)},
                },
            )
        else:
            # Add new item
            await db.carts.update_one(
                {"user_id": user_id},
                {
                    "$push": {"items": {"product_id": product_id, "quantity": quantity}},
                    "$set": {"updated_at": datetime.now(timezone.utc)},
                },
            )

    return await get_cart(user_id)


async def update_cart_quantity(user_id: str, product_id: str, quantity: int) -> dict:
    """Update item quantity. If quantity is 0, removes the item."""
    db = get_database()

    if quantity == 0:
        return await remove_from_cart(user_id, product_id)

    result = await db.carts.update_one(
        {"user_id": user_id, "items.product_id": product_id},
        {
            "$set": {
                "items.$.quantity": quantity,
                "updated_at": datetime.now(timezone.utc),
            },
        },
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found in cart",
        )

    return await get_cart(user_id)


async def remove_from_cart(user_id: str, product_id: str) -> dict:
    """Remove an item from the cart."""
    db = get_database()

    result = await db.carts.update_one(
        {"user_id": user_id},
        {
            "$pull": {"items": {"product_id": product_id}},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        },
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cart not found",
        )

    return await get_cart(user_id)
