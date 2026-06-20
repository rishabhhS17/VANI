"""Tests for the VANI hybrid intent parser."""

import asyncio
import pytest

from services.intent_parser import _rule_based_parse, parse_intent, CONFIDENCE_THRESHOLD


SEARCH_CASES = [
    ("show me jeans", {"intent": "search_products", "query": "jeans"}),
    ("show me blue jeans under 50", {"intent": "search_products", "query": "blue jeans", "color": "blue", "price_max": 50.0}),
    ("find headphones", {"intent": "search_products", "query": "headphones"}),
    ("search for red shoes", {"intent": "search_products", "color": "red"}),
    ("show me electronics", {"intent": "search_products", "query": "electronics"}),
    ("jeans", {"intent": "search_products", "query": "jeans"}),
    ("show me some jeans", {"intent": "search_products", "query": "jeans"}),
    ("look for laptop under 1000", {"intent": "search_products", "category": "laptop", "price_max": 1000.0}),
    ("show me blue nike shoes under 100", {"intent": "search_products", "color": "blue", "price_max": 100.0}),
    ("find t-shirts", {"intent": "search_products", "query": "t-shirts"}),
    ("show me backpack", {"intent": "search_products", "query": "backpack"}),
    ("i want to buy shoes", {"intent": "search_products", "query": "shoes"}),
]

ACTION_CASES = [
    ("open my cart", {"intent": "open_cart"}),
    ("show my cart", {"intent": "open_cart"}),
    ("checkout", {"intent": "checkout"}),
    ("add nike shoes to cart", {"intent": "add_to_cart", "product_name": "nike shoes"}),
    ("add this to cart", {"intent": "add_to_cart"}),
    ("put it in my cart", {"intent": "add_to_cart"}),
    ("put the blue jeans in my cart", {"intent": "add_to_cart", "product_name": "blue jeans"}),
    ("remove jeans from cart", {"intent": "remove_from_cart", "product_name": "jeans"}),
    ("next page", {"intent": "next_page"}),
    ("previous page", {"intent": "previous_page"}),
    ("go back", {"intent": "previous_page"}),
]

DETAIL_CASES = [
    ("tell me about jeans", {"intent": "product_details", "product_name": "jeans"}),
    ("show me details of nike shoes", {"intent": "product_details", "product_name": "nike shoes"}),
    ("show me about the watch", {"intent": "product_details", "product_name": "watch"}),
]


def _assert_fields(result, expected: dict):
    assert result.intent == expected["intent"]
    for key, value in expected.items():
        if key == "intent":
            continue
        assert getattr(result, key) == value, f"{key}: expected {value!r}, got {getattr(result, key)!r}"


@pytest.mark.parametrize("command,expected", SEARCH_CASES)
def test_search_intents(command, expected):
    result = _rule_based_parse(command)
    _assert_fields(result, expected)
    assert result.confidence >= CONFIDENCE_THRESHOLD
    assert result.query, f"search command {command!r} must produce a query"


@pytest.mark.parametrize("command,expected", ACTION_CASES)
def test_action_intents(command, expected):
    result = _rule_based_parse(command)
    _assert_fields(result, expected)
    assert result.confidence >= CONFIDENCE_THRESHOLD


@pytest.mark.parametrize("command,expected", DETAIL_CASES)
def test_product_details(command, expected):
    result = _rule_based_parse(command)
    _assert_fields(result, expected)


def test_show_me_back_is_search_not_pagination():
    result = _rule_based_parse("show me back")
    assert result.intent == "search_products"
    assert result.query == "back"


@pytest.mark.asyncio
async def test_parse_intent_uses_rule_parser_for_jeans():
    result = await parse_intent("show me jeans")
    assert result.intent == "search_products"
    assert result.query == "jeans"
    assert result.parser_used == "rule"
    assert result.confidence >= CONFIDENCE_THRESHOLD
