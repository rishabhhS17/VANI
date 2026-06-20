"""End-to-end tests for intent parsing + dispatch."""

import asyncio

import pytest

from database.connection import close_mongodb_connection, connect_to_mongodb
from services.intent_dispatcher import dispatch_intent
from services.intent_parser import parse_intent


@pytest.mark.asyncio
async def test_dispatch_search_jeans():
    await connect_to_mongodb()
    try:
        parsed = await parse_intent("show me jeans")
        result = await dispatch_intent(parsed, user_id="test-user", command="show me jeans")

        assert result["action"] == "search_products"
        assert result["success"] is True
        assert result["search_query"] == "jeans"
        assert result["intent"]["query"] == "jeans"
        assert result["data"]["total"] > 0
        assert len(result["data"]["products"]) > 0
        assert "jean" in result["data"]["products"][0]["name"].lower()
    finally:
        await close_mongodb_connection()


@pytest.mark.asyncio
async def test_dispatch_product_details():
    await connect_to_mongodb()
    try:
        parsed = await parse_intent("tell me about jeans")
        result = await dispatch_intent(parsed, user_id="test-user", command="tell me about jeans")

        assert parsed.intent == "product_details"
        assert parsed.product_name == "jeans"
        assert result["action"] == "product_details"
        assert result["success"] is True
        assert result["data"] is not None
    finally:
        await close_mongodb_connection()


@pytest.mark.asyncio
async def test_dispatch_add_to_cart_extracts_product():
    await connect_to_mongodb()
    try:
        parsed = await parse_intent("add nike shoes to cart")
        assert parsed.intent == "add_to_cart"
        assert parsed.product_name == "nike shoes"
    finally:
        await close_mongodb_connection()
