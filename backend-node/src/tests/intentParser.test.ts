/**
 * Golden test for the rule-based parser — the same cases as the Python suite
 * (backend/tests/test_intent_parser.py). Node output must match field-for-field.
 */
import { describe, it, expect } from "vitest";
import { ruleBasedParse } from "../modules/voice/intentParser.js";

const CONFIDENCE_THRESHOLD = 0.7;

const SEARCH_CASES: [string, Record<string, unknown>][] = [
  ["show me jeans", { intent: "search_products", query: "jeans" }],
  ["show me blue jeans under 50", { intent: "search_products", query: "blue jeans", color: "blue", price_max: 50.0 }],
  ["find headphones", { intent: "search_products", query: "headphones" }],
  ["search for red shoes", { intent: "search_products", color: "red" }],
  ["show me electronics", { intent: "search_products", query: "electronics" }],
  ["jeans", { intent: "search_products", query: "jeans" }],
  ["show me some jeans", { intent: "search_products", query: "jeans" }],
  ["look for laptop under 1000", { intent: "search_products", category: "laptop", price_max: 1000.0 }],
  ["show me blue nike shoes under 100", { intent: "search_products", color: "blue", price_max: 100.0 }],
  ["find t-shirts", { intent: "search_products", query: "t-shirts" }],
  ["show me backpack", { intent: "search_products", query: "backpack" }],
  ["i want to buy shoes", { intent: "search_products", query: "shoes" }],
];

const ACTION_CASES: [string, Record<string, unknown>][] = [
  ["open my cart", { intent: "open_cart" }],
  ["show my cart", { intent: "open_cart" }],
  ["checkout", { intent: "checkout" }],
  ["add nike shoes to cart", { intent: "add_to_cart", product_name: "nike shoes" }],
  ["add this to cart", { intent: "add_to_cart" }],
  ["put it in my cart", { intent: "add_to_cart" }],
  ["put the blue jeans in my cart", { intent: "add_to_cart", product_name: "blue jeans" }],
  ["remove jeans from cart", { intent: "remove_from_cart", product_name: "jeans" }],
  ["next page", { intent: "next_page" }],
  ["previous page", { intent: "previous_page" }],
  ["go back", { intent: "previous_page" }],
];

const DETAIL_CASES: [string, Record<string, unknown>][] = [
  ["tell me about jeans", { intent: "product_details", product_name: "jeans" }],
  ["show me details of nike shoes", { intent: "product_details", product_name: "nike shoes" }],
  ["show me about the watch", { intent: "product_details", product_name: "watch" }],
];

function assertFields(result: Record<string, unknown>, expected: Record<string, unknown>) {
  expect(result.intent).toBe(expected.intent);
  for (const [k, v] of Object.entries(expected)) {
    if (k === "intent") continue;
    expect(result[k], `${k}`).toBe(v);
  }
}

describe("search intents", () => {
  it.each(SEARCH_CASES)("%s", (command, expected) => {
    const r = ruleBasedParse(command) as unknown as Record<string, unknown>;
    assertFields(r, expected);
    expect(r.confidence as number).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
    expect(r.query).toBeTruthy();
  });
});

describe("action intents", () => {
  it.each(ACTION_CASES)("%s", (command, expected) => {
    const r = ruleBasedParse(command) as unknown as Record<string, unknown>;
    assertFields(r, expected);
    expect(r.confidence as number).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
  });
});

describe("product details", () => {
  it.each(DETAIL_CASES)("%s", (command, expected) => {
    const r = ruleBasedParse(command) as unknown as Record<string, unknown>;
    assertFields(r, expected);
  });
});

describe("edge cases", () => {
  it("'show me back' is a search, not pagination", () => {
    const r = ruleBasedParse("show me back");
    expect(r.intent).toBe("search_products");
    expect(r.query).toBe("back");
  });
});
