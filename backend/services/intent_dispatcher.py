"""Intent dispatcher — routes parsed intents to appropriate services."""

from services.intent_parser import ParsedIntent
from services import product_service, cart_service
from models.voice_log import create_voice_log_document
from database.connection import get_database


def _search_query(intent: ParsedIntent) -> str:
    """Primary text to search the product catalog with."""
    return (intent.query or intent.category or intent.brand or "").strip()


def _category_filter(intent: ParsedIntent, search_query: str) -> str | None:
    """Apply category filter only when it adds information beyond the query."""
    if not intent.category:
        return None
    if intent.category.lower() == search_query.lower():
        return None
    return intent.category


async def dispatch_intent(intent: ParsedIntent, user_id: str, command: str = "") -> dict:
    """
    Execute the appropriate service based on the parsed intent
    and log the command for analytics.

    Returns a structured response with action type and data.
    """
    db = get_database()
    success = True
    response_data = {}

    try:
        if intent.intent == "search_products":
            search_query = _search_query(intent)
            result = await product_service.search_products(
                query=search_query,
                category=_category_filter(intent, search_query),
                color=intent.color,
                price_min=intent.price_min,
                price_max=intent.price_max,
                limit=50,
            )
            label = search_query or intent.color or "products"
            response_data = {
                "action": "search_products",
                "message": f"Found {result['total']} {label}",
                "data": result,
                "search_query": search_query,
            }

        elif intent.intent == "add_to_cart":
            if intent.product_name:
                # Search for the product by name to get its ID
                search_result = await product_service.search_products(
                    query=intent.product_name, limit=1
                )
                if search_result["products"]:
                    product = search_result["products"][0]
                    cart = await cart_service.add_to_cart(
                        user_id, product["id"], intent.quantity or 1
                    )
                    response_data = {
                        "action": "add_to_cart",
                        "message": f"Added {product['name']} to cart",
                        "data": cart,
                    }
                else:
                    success = False
                    response_data = {
                        "action": "add_to_cart",
                        "message": f"Could not find product: {intent.product_name}",
                        "data": None,
                    }
            else:
                # No product name — signal frontend to add the first currently-visible product
                response_data = {
                    "action": "add_first_visible",
                    "message": "Adding first shown product to cart",
                    "data": None,
                }

        elif intent.intent == "remove_from_cart":
            if intent.product_name:
                # Find matching item in cart
                cart = await cart_service.get_cart(user_id)
                matched_item = None
                for item in cart["items"]:
                    if intent.product_name.lower() in item["name"].lower():
                        matched_item = item
                        break

                if matched_item:
                    updated_cart = await cart_service.remove_from_cart(
                        user_id, matched_item["product_id"]
                    )
                    response_data = {
                        "action": "remove_from_cart",
                        "message": f"Removed {matched_item['name']} from cart",
                        "data": updated_cart,
                    }
                else:
                    success = False
                    response_data = {
                        "action": "remove_from_cart",
                        "message": f"Could not find '{intent.product_name}' in your cart",
                        "data": None,
                    }
            else:
                # No product name — remove the last-added item from the cart
                cart = await cart_service.get_cart(user_id)
                if cart["items"]:
                    last_item = cart["items"][-1]
                    updated_cart = await cart_service.remove_from_cart(
                        user_id, last_item["product_id"]
                    )
                    response_data = {
                        "action": "remove_from_cart",
                        "message": f"Removed {last_item['name']} from cart",
                        "data": updated_cart,
                    }
                else:
                    success = False
                    response_data = {
                        "action": "remove_from_cart",
                        "message": "Your cart is already empty",
                        "data": None,
                    }

        elif intent.intent == "open_cart":
            cart = await cart_service.get_cart(user_id)
            response_data = {
                "action": "open_cart",
                "message": f"Your cart has {cart['item_count']} items",
                "data": cart,
            }

        elif intent.intent == "checkout":
            cart = await cart_service.get_cart(user_id)
            response_data = {
                "action": "checkout",
                "message": "Opening checkout. Please confirm your shipping address.",
                "data": cart,
            }

        elif intent.intent == "next_page":
            response_data = {
                "action": "next_page",
                "message": "Showing next page",
                "data": {"direction": "next"},
            }

        elif intent.intent == "previous_page":
            response_data = {
                "action": "previous_page",
                "message": "Showing previous page",
                "data": {"direction": "previous"},
            }

        elif intent.intent == "product_details":
            if intent.product_name:
                search_result = await product_service.search_products(
                    query=intent.product_name, limit=1
                )
                if search_result["products"]:
                    product = search_result["products"][0]
                    response_data = {
                        "action": "product_details",
                        "message": f"Showing details for {product['name']}",
                        "data": product,
                    }
                else:
                    success = False
                    response_data = {
                        "action": "product_details",
                        "message": f"Could not find product: {intent.product_name}",
                        "data": None,
                    }
            else:
                response_data = {
                    "action": "product_details",
                    "message": "Please specify which product",
                    "data": None,
                }

        else:
            success = False
            response_data = {
                "action": "unknown",
                "message": "I didn't understand that command. Try saying 'show me shoes under 50'.",
                "data": None,
            }

    except Exception as e:
        success = False
        response_data = {
            "action": intent.intent,
            "message": f"An error occurred: {str(e)}",
            "data": None,
        }

    # Log the voice command
    log_doc = create_voice_log_document(
        user_id=user_id,
        command=command or intent.query or "",
        intent=intent.intent,
        parsed_params=intent.to_dict(),
        success=success,
        confidence=intent.confidence,
        parser_used=intent.parser_used,
    )
    await db.voice_logs.insert_one(log_doc)

    return {
        **response_data,
        "intent": intent.to_dict(),
        "success": success,
    }
