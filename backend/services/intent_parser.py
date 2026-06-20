"""Hybrid intent parser — rule-based with Groq LLM fallback.

Flow:
    Voice Command → Rule-Based Parser → confidence high? → Execute
                                       → confidence low?  → Groq Parser → Execute
"""

import os
import re
import json
from typing import Optional
from dataclasses import dataclass, field, asdict

from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")


@dataclass
class ParsedIntent:
    """Result of parsing a voice command."""
    intent: str
    confidence: float = 0.0
    parser_used: str = "rule"
    category: Optional[str] = None
    color: Optional[str] = None
    brand: Optional[str] = None
    query: Optional[str] = None
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    quantity: Optional[int] = None
    page_direction: Optional[str] = None

    def to_dict(self) -> dict:
        result = asdict(self)
        # Remove None values for cleaner output
        return {k: v for k, v in result.items() if v is not None}


# ── Common categories and colors for rule matching ──────────────────────────

CATEGORIES = [
    "electronics", "fashion", "footwear", "watches", "bags", "sports",
    "beauty", "books", "home", "gaming", "clothing", "accessories",
    "polos", "undershirts", "shirts", "shoes", "sneakers", "headphones",
    "earbuds", "keyboard", "mouse", "laptop", "phone", "camera",
    "jeans", "jacket", "t-shirt", "hoodie", "backpack", "wallet",
    "sunglasses", "watch", "yoga", "dumbbell",
    # Indian clothing & fashion
    "kurta", "kurti", "saree", "sari", "lehenga", "dupatta", "salwar",
    "kameez", "sherwani", "dhoti", "churidar", "anarkali", "kurti",
    "ethnic", "traditional", "salwar suit", "palazzo", "kurti set",
    "indo western", "bandgala", "nehru jacket", "pathani",
]

COLORS = [
    "red", "blue", "green", "black", "white", "grey", "gray", "pink",
    "yellow", "orange", "purple", "brown", "navy", "beige", "maroon",
    "teal", "gold", "silver", "cream", "olive", "wine", "coral",
]

# ── Rule-Based Parser ──────────────────────────────────────────────────────

def _rule_based_parse(command: str) -> ParsedIntent:
    """Parse a voice command using regex and keyword matching."""
    cmd = command.lower().strip()

    # ── Checkout ──
    if re.search(r"\b(checkout|check\s*out|place\s*(my\s+)?order|buy\s+now|purchase|pay)\b", cmd):
        return ParsedIntent(intent="checkout", confidence=0.95)

    # ── Add to cart (before generic cart navigation) ──
    # Match "add to cart" / "add it to cart" shorthand (no product name — frontend adds first visible)
    if re.search(r"^(?:please\s+)?(?:add|put)\s+(?:it\s+)?(?:to|in|into)\s+(?:my\s+)?(?:cart|basket)$", cmd):
        return ParsedIntent(intent="add_to_cart", confidence=0.95)

    add_match = re.search(
        r"\b(add|put)\b\s+(?:this|that|it|the)?\s*(.+?)\s+\b(?:to|in|into)\s+(?:my\s+)?(?:cart|basket)\b",
        cmd,
    )
    if add_match:
        product_name = add_match.group(2).strip()
        intent = ParsedIntent(intent="add_to_cart", confidence=0.9, product_name=product_name or None)
        if not product_name or product_name in {"this", "that", "it", "the"}:
            intent.product_name = None
            intent.confidence = 0.85
        return intent

    if re.search(
        r"\b(add|put)\b\s+(?:this|that|it)\s+\b(?:to|in|into)\s+(?:my\s+)?(?:cart|basket)\b",
        cmd,
    ):
        return ParsedIntent(intent="add_to_cart", confidence=0.85)

    # ── Remove from cart ──
    # Match "remove from cart" shorthand (no product name — frontend removes last added item)
    if re.search(r"^(?:please\s+)?(?:remove|delete|take\s+out|take\s+it\s+out)\s+(?:from\s+)?(?:my\s+)?(?:cart|basket)$", cmd):
        return ParsedIntent(intent="remove_from_cart", confidence=0.95)

    remove_match = re.search(
        r"\b(remove|delete|take\s+out)\b\s*(?:the)?\s*(.+?)\s+\b(?:from\s+)?(?:my\s+)?(?:cart|basket)\b",
        cmd,
    )
    if remove_match:
        product_name = remove_match.group(2).strip()
        intent = ParsedIntent(intent="remove_from_cart", confidence=0.9, product_name=product_name)
        return intent

    # ── Cart navigation ──
    if re.search(r"\b(open|show|view|see|display)\b.*\b(cart|basket)\b", cmd):
        return ParsedIntent(intent="open_cart", confidence=0.95)

    if re.search(r"\b(my\s+)?(cart|basket)\b", cmd) and not re.search(
        r"\b(add|put|remove|delete)\b", cmd
    ):
        return ParsedIntent(intent="open_cart", confidence=0.8)

    # ── Pagination ──
    if re.search(r"\b(next|forward)\s+(?:page|results)\b", cmd) or cmd.strip() == "next":
        return ParsedIntent(intent="next_page", confidence=0.9, page_direction="next")

    if (
        re.search(r"\b(previous|prev)\s+(?:page|results)\b", cmd)
        or re.search(r"\bgo\s+back\b", cmd)
        or cmd.strip() in {"previous", "prev"}
    ):
        return ParsedIntent(intent="previous_page", confidence=0.9, page_direction="previous")

    # ── Product details ──
    details_match = re.search(
        r"\b(?:detail|details|more\s+info|tell\s+me\s+about|show\s+me\s+about|show\s+me\s+details\s+of)\s+(.+)$",
        cmd,
    )
    if details_match:
        product_name = re.sub(r"^(?:the|a|an)\s+", "", details_match.group(1)).strip()
        intent = ParsedIntent(intent="product_details", confidence=0.85)
        if product_name:
            intent.product_name = product_name
            intent.confidence = 0.9
        return intent

    # ── Search products (catch-all) ──
    intent = ParsedIntent(intent="search_products", confidence=0.6)

    # Extract price constraints
    price_match = re.search(r"\b(?:under|below|less\s+than|max|upto|up\s+to)\s*\$?\s*(\d+(?:\.\d+)?)\b", cmd)
    if price_match:
        intent.price_max = float(price_match.group(1))
        intent.confidence += 0.1

    price_min_match = re.search(r"\b(?:above|over|more\s+than|min|from|starting)\s*\$?\s*(\d+(?:\.\d+)?)\b", cmd)
    if price_min_match:
        intent.price_min = float(price_min_match.group(1))
        intent.confidence += 0.1

    price_range_match = re.search(r"\$?\s*(\d+(?:\.\d+)?)\s*(?:to|-)\s*\$?\s*(\d+(?:\.\d+)?)\b", cmd)
    if price_range_match:
        intent.price_min = float(price_range_match.group(1))
        intent.price_max = float(price_range_match.group(2))
        intent.confidence += 0.1

    # Extract color
    for color in COLORS:
        if re.search(rf"\b{color}\b", cmd):
            intent.color = color
            intent.confidence += 0.1
            break

    # Extract category — prefer longer matches (e.g. t-shirt before shirt)
    for cat in sorted(CATEGORIES, key=len, reverse=True):
        if re.search(rf"\b{re.escape(cat)}s?\b", cmd):
            intent.category = cat
            intent.confidence += 0.15
            break

    # Build query from remaining text after stripping command prefixes
    query = cmd
    query = re.sub(
        r"^(?:please\s+)?(?:show\s+me|find(?:\s+me)?|search\s+for|look\s+for|i\s+want(?:\s+to\s+buy)?|get\s+me|display|browse)\s+",
        "",
        query,
    )
    # Strip price constraints from free-text query
    if intent.price_max:
        query = re.sub(r"\b(?:under|below|less\s+than|max|upto|up\s+to)\s*\$?\s*\d+(?:\.\d+)?\b", "", query)
    if intent.price_min:
        query = re.sub(r"\b(?:above|over|more\s+than|min|from|starting)\s*\$?\s*\d+(?:\.\d+)?\b", "", query)
    query = re.sub(r"\s+", " ", query).strip()

    # Remove filler words; keep meaningful terms (including category/color words)
    if query:
        query = re.sub(r"\b(some|any|the|a|an|please|kind\s+of|sort\s+of|to\s+buy)\b", " ", query)
        query = re.sub(r"\s+", " ", query).strip()

    if query:
        intent.query = query

    return _finalize_search_intent(intent)


def _finalize_search_intent(intent: ParsedIntent) -> ParsedIntent:
    """Ensure search intents always carry a usable query string."""
    if intent.intent != "search_products":
        intent.confidence = min(intent.confidence, 1.0)
        return intent

    if not intent.query:
        intent.query = intent.category or intent.brand or intent.color

    if intent.query:
        intent.confidence = max(intent.confidence, 0.8)

    intent.confidence = min(intent.confidence, 1.0)
    return intent


# ── Groq LLM Parser ────────────────────────────────────────────────────────

GROQ_SYSTEM_PROMPT = """You are an intent parser for a voice-controlled e-commerce platform called VANI.

Given a user's voice command, extract the intent and parameters as JSON.

Supported intents:
- search_products: User wants to find/browse products
- add_to_cart: User wants to add a product to their cart
- remove_from_cart: User wants to remove a product from their cart
- open_cart: User wants to view their cart
- checkout: User wants to place an order / checkout
- next_page: User wants to see the next page of results
- previous_page: User wants to go to the previous page
- product_details: User wants to see details of a specific product

For search_products, extract these optional fields:
- category: product category (e.g., "shoes", "electronics")
- color: color filter (e.g., "blue", "red")
- brand: brand name (e.g., "Nike", "Sony")
- query: search query text
- price_min: minimum price (number)
- price_max: maximum price (number)

For add_to_cart/remove_from_cart:
- product_name: name of the product mentioned
- quantity: number of items (default 1)

Respond with ONLY valid JSON, no markdown, no explanation. Example:
{"intent": "search_products", "category": "shoes", "color": "blue", "price_max": 3000}
"""


async def _groq_parse(command: str) -> ParsedIntent:
    """Parse a voice command using Groq LLM as fallback."""
    if not GROQ_API_KEY:
        # No API key configured, return low-confidence rule parse
        result = _rule_based_parse(command)
        result.confidence = max(result.confidence, 0.4)
        return result

    try:
        from groq import AsyncGroq

        client = AsyncGroq(api_key=GROQ_API_KEY)

        response = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": GROQ_SYSTEM_PROMPT},
                {"role": "user", "content": command},
            ],
            temperature=0.1,
            max_tokens=256,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content
        if not content:
            raise ValueError("Empty response from Groq")

        parsed = json.loads(content)
        intent_str = parsed.get("intent", "search_products")

        result = ParsedIntent(
            intent=intent_str,
            confidence=0.85,
            parser_used="groq",
            category=parsed.get("category"),
            color=parsed.get("color"),
            brand=parsed.get("brand"),
            query=parsed.get("query"),
            product_name=parsed.get("product_name"),
            price_min=float(parsed["price_min"]) if parsed.get("price_min") else None,
            price_max=float(parsed["price_max"]) if parsed.get("price_max") else None,
            quantity=int(parsed["quantity"]) if parsed.get("quantity") else None,
        )
        if result.intent == "search_products":
            result = _finalize_search_intent(result)
        return result

    except Exception as e:
        print(f"[WARN] Groq parse failed: {e}")
        # Fall back to rule-based
        result = _rule_based_parse(command)
        result.confidence = max(result.confidence, 0.5)
        return result


# ── Public API ─────────────────────────────────────────────────────────────

CONFIDENCE_THRESHOLD = 0.7


async def parse_intent(command: str) -> ParsedIntent:
    """
    Parse a voice command using the hybrid approach:
    1. Try rule-based parser first
    2. If confidence < threshold, use Groq LLM
    """
    # Step 1: Rule-based parse
    result = _rule_based_parse(command)

    # Step 2: If confidence is high enough, use rule-based result
    if result.confidence >= CONFIDENCE_THRESHOLD:
        return result

    # Step 3: Fall back to Groq LLM
    groq_result = await _groq_parse(command)
    return groq_result
