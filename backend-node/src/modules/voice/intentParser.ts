/**
 * Hybrid intent parser — rule-based with Groq LLM fallback.
 * Faithful port of backend/services/intent_parser.py.
 *
 *   Voice Command -> Rule-Based Parser -> confidence >= 0.7 ? execute
 *                                       -> else Groq Parser -> execute
 */
import Groq from "groq-sdk";
import { env } from "../../env.js";

export interface ParsedIntent {
  intent: string;
  confidence: number;
  parser_used: string;
  category?: string | null;
  color?: string | null;
  brand?: string | null;
  query?: string | null;
  product_id?: string | null;
  product_name?: string | null;
  price_min?: number | null;
  price_max?: number | null;
  quantity?: number | null;
  page_direction?: string | null;
}

function mk(intent: string, confidence = 0.0): ParsedIntent {
  return { intent, confidence, parser_used: "rule" };
}

/** Drop null/undefined keys, matching Python's ParsedIntent.to_dict(). */
export function toDict(p: ParsedIntent): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Categories and colors for rule matching (exact copy of Python lists) ──────

const CATEGORIES = [
  "electronics", "fashion", "footwear", "watches", "bags", "sports",
  "beauty", "books", "home", "gaming", "clothing", "accessories",
  "polos", "undershirts", "shirts", "shoes", "sneakers", "headphones",
  "earbuds", "keyboard", "mouse", "laptop", "phone", "camera",
  "jeans", "jacket", "t-shirt", "hoodie", "backpack", "wallet",
  "sunglasses", "watch", "yoga", "dumbbell",
  "kurta", "kurti", "saree", "sari", "lehenga", "dupatta", "salwar",
  "kameez", "sherwani", "dhoti", "churidar", "anarkali", "kurti",
  "ethnic", "traditional", "salwar suit", "palazzo", "kurti set",
  "indo western", "bandgala", "nehru jacket", "pathani",
];

const COLORS = [
  "red", "blue", "green", "black", "white", "grey", "gray", "pink",
  "yellow", "orange", "purple", "brown", "navy", "beige", "maroon",
  "teal", "gold", "silver", "cream", "olive", "wine", "coral",
];

// ── Rule-Based Parser ─────────────────────────────────────────────────────────

function ruleBasedParse(command: string): ParsedIntent {
  const cmd = command.toLowerCase().trim();

  // Checkout
  if (/\b(checkout|check\s*out|place\s*(my\s+)?order|buy\s+now|purchase|pay)\b/.test(cmd)) {
    return mk("checkout", 0.95);
  }

  // Add to cart shorthand (no product name)
  if (/^(?:please\s+)?(?:add|put)\s+(?:it\s+)?(?:to|in|into)\s+(?:my\s+)?(?:cart|basket)$/.test(cmd)) {
    return mk("add_to_cart", 0.95);
  }

  const addMatch = cmd.match(
    /\b(add|put)\b\s+(?:this|that|it|the)?\s*(.+?)\s+\b(?:to|in|into)\s+(?:my\s+)?(?:cart|basket)\b/,
  );
  if (addMatch) {
    const productName = (addMatch[2] ?? "").trim();
    const intent = mk("add_to_cart", 0.9);
    intent.product_name = productName || null;
    if (!productName || ["this", "that", "it", "the"].includes(productName)) {
      intent.product_name = null;
      intent.confidence = 0.85;
    }
    return intent;
  }

  if (/\b(add|put)\b\s+(?:this|that|it)\s+\b(?:to|in|into)\s+(?:my\s+)?(?:cart|basket)\b/.test(cmd)) {
    return mk("add_to_cart", 0.85);
  }

  // Remove from cart shorthand
  if (/^(?:please\s+)?(?:remove|delete|take\s+out|take\s+it\s+out)\s+(?:from\s+)?(?:my\s+)?(?:cart|basket)$/.test(cmd)) {
    return mk("remove_from_cart", 0.95);
  }

  const removeMatch = cmd.match(
    /\b(remove|delete|take\s+out)\b\s*(?:the)?\s*(.+?)\s+\b(?:from\s+)?(?:my\s+)?(?:cart|basket)\b/,
  );
  if (removeMatch) {
    const intent = mk("remove_from_cart", 0.9);
    intent.product_name = (removeMatch[2] ?? "").trim();
    return intent;
  }

  // Cart navigation
  if (/\b(open|show|view|see|display)\b.*\b(cart|basket)\b/.test(cmd)) {
    return mk("open_cart", 0.95);
  }
  if (/\b(my\s+)?(cart|basket)\b/.test(cmd) && !/\b(add|put|remove|delete)\b/.test(cmd)) {
    return mk("open_cart", 0.8);
  }

  // Pagination
  if (/\b(next|forward)\s+(?:page|results)\b/.test(cmd) || cmd === "next") {
    const i = mk("next_page", 0.9);
    i.page_direction = "next";
    return i;
  }
  if (
    /\b(previous|prev)\s+(?:page|results)\b/.test(cmd) ||
    /\bgo\s+back\b/.test(cmd) ||
    cmd === "previous" ||
    cmd === "prev"
  ) {
    const i = mk("previous_page", 0.9);
    i.page_direction = "previous";
    return i;
  }

  // Product details
  const detailsMatch = cmd.match(
    /\b(?:detail|details|more\s+info|tell\s+me\s+about|show\s+me\s+about|show\s+me\s+details\s+of)\s+(.+)$/,
  );
  if (detailsMatch) {
    const productName = (detailsMatch[1] ?? "")
      .replace(/^(?:the|a|an)\s+/, "")
      .trim();
    const intent = mk("product_details", 0.85);
    if (productName) {
      intent.product_name = productName;
      intent.confidence = 0.9;
    }
    return intent;
  }

  // Search products (catch-all)
  const intent = mk("search_products", 0.6);

  const priceMax = cmd.match(/\b(?:under|below|less\s+than|max|upto|up\s+to)\s*\$?\s*(\d+(?:\.\d+)?)\b/);
  if (priceMax) {
    intent.price_max = parseFloat(priceMax[1]!);
    intent.confidence += 0.1;
  }
  const priceMin = cmd.match(/\b(?:above|over|more\s+than|min|from|starting)\s*\$?\s*(\d+(?:\.\d+)?)\b/);
  if (priceMin) {
    intent.price_min = parseFloat(priceMin[1]!);
    intent.confidence += 0.1;
  }
  const priceRange = cmd.match(/\$?\s*(\d+(?:\.\d+)?)\s*(?:to|-)\s*\$?\s*(\d+(?:\.\d+)?)\b/);
  if (priceRange) {
    intent.price_min = parseFloat(priceRange[1]!);
    intent.price_max = parseFloat(priceRange[2]!);
    intent.confidence += 0.1;
  }

  for (const color of COLORS) {
    if (new RegExp(`\\b${color}\\b`).test(cmd)) {
      intent.color = color;
      intent.confidence += 0.1;
      break;
    }
  }

  const catsByLen = [...CATEGORIES].sort((a, b) => b.length - a.length);
  for (const cat of catsByLen) {
    if (new RegExp(`\\b${escapeRegex(cat)}s?\\b`).test(cmd)) {
      intent.category = cat;
      intent.confidence += 0.15;
      break;
    }
  }

  // Build query from remaining text
  let query = cmd;
  query = query.replace(
    /^(?:please\s+)?(?:show\s+me|find(?:\s+me)?|search\s+for|look\s+for|i\s+want(?:\s+to\s+buy)?|get\s+me|display|browse)\s+/,
    "",
  );
  if (intent.price_max != null) {
    query = query.replace(/\b(?:under|below|less\s+than|max|upto|up\s+to)\s*\$?\s*\d+(?:\.\d+)?\b/g, "");
  }
  if (intent.price_min != null) {
    query = query.replace(/\b(?:above|over|more\s+than|min|from|starting)\s*\$?\s*\d+(?:\.\d+)?\b/g, "");
  }
  query = query.replace(/\s+/g, " ").trim();

  if (query) {
    query = query.replace(/\b(some|any|the|a|an|please|kind\s+of|sort\s+of|to\s+buy)\b/g, " ");
    query = query.replace(/\s+/g, " ").trim();
  }
  if (query) intent.query = query;

  return finalizeSearchIntent(intent);
}

function finalizeSearchIntent(intent: ParsedIntent): ParsedIntent {
  if (intent.intent !== "search_products") {
    intent.confidence = Math.min(intent.confidence, 1.0);
    return intent;
  }
  if (!intent.query) {
    intent.query = intent.category || intent.brand || intent.color || null;
  }
  if (intent.query) {
    intent.confidence = Math.max(intent.confidence, 0.8);
  }
  intent.confidence = Math.min(intent.confidence, 1.0);
  return intent;
}

// ── Groq LLM Parser ───────────────────────────────────────────────────────────

const GROQ_SYSTEM_PROMPT = `You are an intent parser for a voice-controlled e-commerce platform called VANI.

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
{"intent": "search_products", "category": "shoes", "color": "blue", "price_max": 3000}`;

const GROQ_TIMEOUT_MS = 2000;

async function groqParse(command: string): Promise<ParsedIntent> {
  if (!env.GROQ_API_KEY) {
    const result = ruleBasedParse(command);
    result.confidence = Math.max(result.confidence, 0.4);
    return result;
  }

  try {
    const client = new Groq({ apiKey: env.GROQ_API_KEY });
    const response = await client.chat.completions.create(
      {
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: GROQ_SYSTEM_PROMPT },
          { role: "user", content: command },
        ],
        temperature: 0.1,
        max_tokens: 256,
        response_format: { type: "json_object" },
      },
      { signal: AbortSignal.timeout(GROQ_TIMEOUT_MS) },
    );

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response from Groq");

    const parsed = JSON.parse(content) as Record<string, unknown>;
    const num = (v: unknown) =>
      v === undefined || v === null ? null : Number(v);

    const result: ParsedIntent = {
      intent: (parsed.intent as string) ?? "search_products",
      confidence: 0.85,
      parser_used: "groq",
      category: (parsed.category as string) ?? null,
      color: (parsed.color as string) ?? null,
      brand: (parsed.brand as string) ?? null,
      query: (parsed.query as string) ?? null,
      product_name: (parsed.product_name as string) ?? null,
      price_min: num(parsed.price_min),
      price_max: num(parsed.price_max),
      quantity:
        parsed.quantity === undefined || parsed.quantity === null
          ? null
          : Math.trunc(Number(parsed.quantity)),
    };
    if (result.intent === "search_products") return finalizeSearchIntent(result);
    return result;
  } catch (e) {
    // Timeout / network / bad-key / parse error -> graceful rule-based fallback.
    // eslint-disable-next-line no-console
    console.warn(`[WARN] Groq parse failed: ${(e as Error).message}`);
    const result = ruleBasedParse(command);
    result.confidence = Math.max(result.confidence, 0.5);
    return result;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

const CONFIDENCE_THRESHOLD = 0.7;

export async function parseIntent(command: string): Promise<ParsedIntent> {
  const result = ruleBasedParse(command);
  if (result.confidence >= CONFIDENCE_THRESHOLD) return result;
  return groqParse(command);
}

export { ruleBasedParse };
