# VANI — Voice Assisted Navigation for Intelligent Commerce

> **A full-stack, voice-first e-commerce platform.** Speak a command, VANI understands it, finds the products, manages your cart, and completes your order — all hands-free.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
   - [High-Level System Design](#21-high-level-system-design)
   - [Backend Architecture](#22-backend-architecture)
   - [Frontend Architecture](#23-frontend-architecture)
   - [Request Lifecycle](#24-request-lifecycle)
3. [Tech Stack](#3-tech-stack)
4. [Directory Structure](#4-directory-structure)
5. [Hybrid Intent Parser — Deep Dive](#5-hybrid-intent-parser--deep-dive)
   - [Parse Flow](#51-parse-flow)
   - [Rule-Based Parser](#52-rule-based-parser)
   - [Groq LLM Fallback](#53-groq-llm-fallback)
   - [ParsedIntent Dataclass](#54-parsedintent-dataclass)
   - [Intent Dispatcher](#55-intent-dispatcher)
   - [Supported Intents Reference](#56-supported-intents-reference)
6. [Database Design](#6-database-design)
   - [Collections & Schemas](#61-collections--schemas)
   - [Indexes](#62-indexes)
7. [API Reference](#7-api-reference)
   - [Authentication](#71-authentication)
   - [Products](#72-products)
   - [Cart](#73-cart)
   - [Orders](#74-orders)
   - [Voice](#75-voice)
8. [Pydantic Schemas](#8-pydantic-schemas)
9. [Authentication & Security](#9-authentication--security)
10. [Frontend API Client](#10-frontend-api-client)
11. [Environment Variables](#11-environment-variables)
12. [Getting Started](#12-getting-started)
13. [Running Tests](#13-running-tests)
14. [Voice Command Examples](#14-voice-command-examples)

---

## 1. Overview

VANI is a **voice-controlled e-commerce application** where users interact entirely through natural-language speech (transcribed to text). The system:

- Transcribes the user's voice to text in the browser using the **Web Speech API**
- Sends the text to the FastAPI backend
- Runs it through a **hybrid intent parser** (rule-based first, Groq LLM fallback)
- Dispatches the parsed intent to the right service (search, cart, order, navigation)
- Returns a structured action response to the React frontend
- Logs every command for analytics

---

## 2. Architecture

### 2.1 High-Level System Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          BROWSER (React + Vite)                         │
│                                                                         │
│   ┌──────────────┐   Web Speech API   ┌────────────────────────────┐   │
│   │  Microphone  │ ─────────────────► │   Voice Input Component    │   │
│   └──────────────┘                    └────────────┬───────────────┘   │
│                                                    │ command text       │
│   ┌─────────────────────────────────────────────── ▼ ────────────────┐ │
│   │                    App.tsx (Single-Page App)                      │ │
│   │                                                                   │ │
│   │  ProductGrid ◄──────┐         CartDrawer ◄──────┐                │ │
│   │  ProductDetail ◄────┤         OrderFlow ◄───────┤                │ │
│   │  SearchResults ◄────┤                           │                │ │
│   └────────────────────┬┘                           │                │ │
│                        │     API Client (client.ts) │                │ │
│                        └─────────────┬──────────────┘                │ │
└──────────────────────────────────────┼──────────────────────────────────┘
                                       │ HTTP / REST (Bearer JWT)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          FastAPI Backend (Python)                        │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                         main.py / CORS                           │  │
│  └──────┬──────────┬───────────┬──────────────┬─────────────────────┘  │
│         │          │           │              │                         │
│   /auth │  /products│   /cart  │   /orders   │  /voice                │
│         ▼          ▼           ▼              ▼    ▼                   │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                   Route Handlers (FastAPI APIRouter)           │    │
│  └────────────────────────────┬───────────────────────────────────┘    │
│                               │  Depends(get_current_user) → JWT       │
│                               ▼                                         │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                        Services Layer                          │    │
│  │   auth_service  │  product_service  │  cart_service           │    │
│  │   order_service │  intent_parser    │  intent_dispatcher      │    │
│  └────────────────────────────┬───────────────────────────────────┘    │
│                               │  Motor (async)                         │
│                               ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │                  MongoDB (vani_db)                          │       │
│  │  users │ products │ carts │ orders │ voice_logs            │       │
│  └─────────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────┘
                               │
                               │ GROQ_API_KEY (optional)
                               ▼
                    ┌────────────────────┐
                    │  Groq Cloud API    │
                    │  llama-3.1-8b-inst │
                    └────────────────────┘
```

### 2.2 Backend Architecture

The backend follows a **layered architecture** with clear separation of concerns:

| Layer | Files | Responsibility |
|---|---|---|
| **Entry Point** | `main.py` | FastAPI app init, CORS, router mounting, lifespan |
| **Routes** | `routes/*.py` | HTTP endpoint definitions, request/response binding |
| **Middleware** | `middleware/auth_middleware.py` | JWT extraction and verification via DI |
| **Schemas** | `schemas/*.py` | Pydantic request/response validation models |
| **Services** | `services/*.py` | Core business logic — stateless, async functions |
| **Models** | `models/*.py` | MongoDB document factory functions |
| **Database** | `database/connection.py` | Motor async client, index creation |
| **Utils** | `utils/*.py` | JWT creation/verification, password hashing |

### 2.3 Frontend Architecture

The frontend is a **single React application** (`App.tsx`) built with Vite and TypeScript:

| Layer | Files | Responsibility |
|---|---|---|
| **Entry** | `main.tsx` | React root mount |
| **App** | `app/App.tsx` | All pages, state, routing, voice handling |
| **API Client** | `api/client.ts` | Typed wrappers for every backend endpoint |
| **UI Components** | `app/components/ui/` | shadcn/ui + Radix primitives |
| **Styles** | `styles/` | Tailwind CSS v4 |

### 2.4 Request Lifecycle

The complete journey of a voice command from mic to response:

```
1. [Browser]  User speaks → Web Speech API transcribes to text string
2. [Browser]  App.tsx calls voiceApi.processCommand("show me blue shoes under 50")
3. [Network]  POST /api/voice/command  {command: "show me blue shoes under 50"}
               → Authorization: Bearer <JWT>
4. [Backend]  auth_middleware.get_current_user() verifies JWT → user_id
5. [Backend]  parse_intent("show me blue shoes under 50")
              ├─ _rule_based_parse() → ParsedIntent{
              │     intent="search_products",
              │     color="blue", category="shoes",
              │     price_max=50.0, query="blue shoes",
              │     confidence=0.95, parser_used="rule"
              │  }
              └─ confidence >= 0.7? YES → skip Groq
6. [Backend]  dispatch_intent(parsed, user_id)
              └─ product_service.search_products(
                   query="blue shoes", color="blue", price_max=50.0
                 )
7. [Backend]  MongoDB: $text search + $regex color filter + price filter
8. [Backend]  Voice log written to voice_logs collection
9. [Network]  Response: {action, message, data:{products:[...]}, intent, success}
10.[Browser]  App.tsx updates product grid from response data
```

---

## 3. Tech Stack

### Backend

| Technology | Version | Purpose |
|---|---|---|
| **Python** | 3.11+ | Runtime |
| **FastAPI** | 0.115.0 | Async HTTP framework |
| **Uvicorn** | 0.30.0 | ASGI server |
| **Motor** | 3.6.0 | Async MongoDB driver |
| **PyMongo** | 4.9.0 | MongoDB toolkit |
| **Pydantic** | 2.9.0 | Data validation & serialization |
| **python-jose** | 3.3.0 | JWT signing & verification (HS256) |
| **bcrypt** | 4.2.1 | Password hashing |
| **Groq SDK** | 0.11.0 | LLM fallback (`llama-3.1-8b-instant`) |
| **python-dotenv** | 1.0.1 | Environment variable loading |
| **httpx** | 0.27.0 | Async HTTP client |
| **pytest** | 8.3.0 | Test framework |
| **pytest-asyncio** | 0.24.0 | Async test support |

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| **React** | 18.3.1 | UI framework |
| **TypeScript** | — | Type safety |
| **Vite** | 6.3.5 | Build tool & dev server |
| **Tailwind CSS** | 4.1.12 | Utility-first styling |
| **Radix UI** | various | Accessible headless components |
| **Motion** | 12.23.24 | Animations (Framer Motion successor) |
| **Zustand** | 5.0.14 | Lightweight state management |
| **React Router** | 7.13.0 | Client-side routing |
| **Recharts** | 2.15.2 | Analytics charts |
| **Sonner** | 2.0.3 | Toast notifications |
| **Lucide React** | 0.487.0 | Icon library |
| **shadcn/ui** | — | Component system (Radix + Tailwind) |

### Infrastructure

| Technology | Purpose |
|---|---|
| **MongoDB Atlas** | Hosted NoSQL database |
| **Groq Cloud** | LLM inference (intent fallback) |
| **Web Speech API** | In-browser voice recognition |

---

## 4. Directory Structure

```
VANI/
├── README.md
├── .gitignore
├── VANI_Documentation.md          # Extended design docs
│
├── backend/
│   ├── main.py                    # FastAPI app, CORS, router registration
│   ├── requirements.txt
│   ├── .env.example
│   ├── seed_products.py           # Seed script for product catalog
│   │
│   ├── database/
│   │   └── connection.py          # Motor async client + index creation
│   │
│   ├── middleware/
│   │   └── auth_middleware.py     # JWT Bearer dependency
│   │
│   ├── models/                    # MongoDB document factories
│   │   ├── cart.py
│   │   ├── order.py
│   │   ├── product.py
│   │   ├── user.py
│   │   └── voice_log.py
│   │
│   ├── routes/                    # FastAPI route handlers
│   │   ├── auth_routes.py         # POST /auth/register, /auth/login, GET /auth/me
│   │   ├── cart_routes.py         # GET|POST|PUT|DELETE /cart
│   │   ├── order_routes.py        # POST|GET /orders
│   │   ├── product_routes.py      # GET /products, /products/search, /products/{id}
│   │   └── voice_routes.py        # POST /voice/command, GET /voice/analytics
│   │
│   ├── schemas/                   # Pydantic request/response models
│   │   ├── auth_schema.py
│   │   ├── cart_schema.py
│   │   ├── order_schema.py
│   │   └── product_schema.py
│   │
│   ├── services/                  # Business logic
│   │   ├── auth_service.py        # register, login, profile
│   │   ├── cart_service.py        # add, remove, update, get cart
│   │   ├── intent_dispatcher.py   # Routes ParsedIntent to service calls
│   │   ├── intent_parser.py       # Hybrid rule-based + Groq LLM parser
│   │   ├── order_service.py       # create order, get history
│   │   └── product_service.py     # search, list, filter products
│   │
│   ├── utils/
│   │   ├── jwt_handler.py         # create_access_token, verify_token
│   │   └── password_utils.py      # bcrypt hash & verify
│   │
│   └── tests/
│       ├── test_intent_parser.py  # 30+ parametrized parser tests
│       └── test_intent_dispatch.py
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── postcss.config.mjs
    │
    └── src/
        ├── main.tsx               # React root
        ├── api/
        │   └── client.ts          # authApi, productsApi, cartApi, ordersApi, voiceApi
        ├── app/
        │   ├── App.tsx            # Entire SPA — pages, voice UI, state
        │   └── components/
        │       └── ui/            # 50+ shadcn/ui component files
        ├── data/                  # Static product seed data (JSON)
        └── styles/                # Global CSS
```

---

## 5. Hybrid Intent Parser — Deep Dive

The intent parser is the **brain of VANI**. It lives in `backend/services/intent_parser.py` and transforms a raw text string into a structured `ParsedIntent` object.

### 5.1 Parse Flow

```
Voice Command (string)
        │
        ▼
┌───────────────────────────┐
│    _rule_based_parse()    │  ← Regex + keyword matching
└───────────────┬───────────┘
                │
        confidence >= 0.7?
       /                  \
     YES                   NO
      │                     │
      ▼                     ▼
  Return result      ┌──────────────────┐
                     │  _groq_parse()   │  ← Groq llama-3.1-8b-instant
                     └────────┬─────────┘
                              │
                   Parse JSON from LLM
                              │
                    Groq API available?
                   /                   \
                  YES                   NO (or error)
                   │                     │
                   ▼                     ▼
           Return ParsedIntent    rule result with
           (parser_used="groq")   boosted confidence
```

**Confidence threshold:** `CONFIDENCE_THRESHOLD = 0.7`

### 5.2 Rule-Based Parser

`_rule_based_parse(command: str) → ParsedIntent`

The rule-based parser applies regex patterns **in priority order**. Early returns prevent intent misclassification.

#### Priority Order

| Priority | Intent | Example Commands | Regex Pattern |
|---|---|---|---|
| 1 | `checkout` | "checkout", "place order", "buy now", "pay" | `\b(checkout\|check\s*out\|place\s*(my\s+)?order\|buy\s+now\|purchase\|pay)\b` |
| 2 | `add_to_cart` (shorthand) | "add to cart", "put it in cart" | `^(?:please\s+)?(?:add\|put)\s+(?:it\s+)?(?:to\|in\|into)\s+(?:my\s+)?(?:cart\|basket)$` |
| 3 | `add_to_cart` (named) | "add nike shoes to cart" | `\b(add\|put)\b\s+(.+?)\s+\b(?:to\|in\|into)\s+(?:my\s+)?(?:cart\|basket)\b` |
| 4 | `remove_from_cart` (shorthand) | "remove from cart" | `^(?:please\s+)?(?:remove\|delete\|take\s+out).*(?:cart\|basket)$` |
| 5 | `remove_from_cart` (named) | "remove jeans from cart" | `\b(remove\|delete\|take\s+out)\b\s*(.+?)\s+\b(?:from\s+)?(?:my\s+)?(?:cart\|basket)\b` |
| 6 | `open_cart` | "open cart", "show my cart", "view basket" | `\b(open\|show\|view\|see\|display)\b.*\b(cart\|basket)\b` |
| 7 | `next_page` | "next page", "next results", "next" | `\b(next\|forward)\s+(?:page\|results)\b` |
| 8 | `previous_page` | "previous page", "go back", "prev" | `\b(previous\|prev)\s+(?:page\|results)\b \| \bgo\s+back\b` |
| 9 | `product_details` | "tell me about jeans", "details of watch" | `\b(?:detail\|details\|more\s+info\|tell\s+me\s+about\|show\s+me\s+about)\s+(.+)$` |
| 10 | `search_products` | Everything else | Catch-all with field extraction |

#### Search Product Extraction

For the `search_products` catch-all, the parser progressively extracts fields and **accumulates confidence**:

```
Base confidence: 0.6

+0.10  → price_max extracted (e.g. "under 50")
+0.10  → price_min extracted (e.g. "above 100")
+0.10  → price range extracted (e.g. "500 to 1000")
+0.10  → color matched (e.g. "blue", "red", "navy")
+0.15  → category matched (e.g. "shoes", "laptop", "kurta")

Max cap: 1.0
```

**Category List** (sorted longest-first to prefer `t-shirt` over `shirt`):
```python
CATEGORIES = [
    "electronics", "fashion", "footwear", "watches", "bags", "sports",
    "beauty", "books", "home", "gaming", "clothing", "accessories",
    "polos", "undershirts", "shirts", "shoes", "sneakers", "headphones",
    "earbuds", "keyboard", "mouse", "laptop", "phone", "camera",
    "jeans", "jacket", "t-shirt", "hoodie", "backpack", "wallet",
    "sunglasses", "watch", "yoga", "dumbbell",
    # Indian clothing & fashion
    "kurta", "kurti", "saree", "sari", "lehenga", "dupatta", "salwar",
    "kameez", "sherwani", "dhoti", "churidar", "anarkali",
    "ethnic", "traditional", "salwar suit", "palazzo", "kurti set",
    "indo western", "bandgala", "nehru jacket", "pathani",
]

COLORS = [
    "red", "blue", "green", "black", "white", "grey", "gray", "pink",
    "yellow", "orange", "purple", "brown", "navy", "beige", "maroon",
    "teal", "gold", "silver", "cream", "olive", "wine", "coral",
]
```

#### Query Cleaning Pipeline

```
raw command
    │  strip command prefixes ("show me", "find me", "search for", etc.)
    │  strip price constraint tokens ("under 50", "above 100", etc.)
    │  strip filler words ("some", "any", "the", "a", "please", "kind of")
    │  collapse whitespace
    ▼
clean query string  →  intent.query
```

#### `_finalize_search_intent()`

Ensures `search_products` always has a usable query:
```
if intent.query is None:
    intent.query = intent.category OR intent.brand OR intent.color

if intent.query is not None:
    intent.confidence = max(intent.confidence, 0.8)

intent.confidence = min(intent.confidence, 1.0)
```

### 5.3 Groq LLM Fallback

`_groq_parse(command: str) → ParsedIntent` (async)

When the rule-based parser's confidence is below `0.7`, the system calls the Groq API with `llama-3.1-8b-instant`.

**System Prompt:**
```
You are an intent parser for a voice-controlled e-commerce platform called VANI.

Given a user's voice command, extract the intent and parameters as JSON.

Supported intents:
- search_products, add_to_cart, remove_from_cart, open_cart,
  checkout, next_page, previous_page, product_details

For search_products, extract: category, color, brand, query, price_min, price_max
For add_to_cart/remove_from_cart: product_name, quantity
Respond with ONLY valid JSON, no markdown, no explanation.
```

**Groq API Config:**
- Model: `llama-3.1-8b-instant`
- Temperature: `0.1` (near-deterministic)
- Max tokens: `256`
- Response format: `{"type": "json_object"}`
- Resulting confidence: `0.85` (if successful)

**Fallback chain:**
```
GROQ_API_KEY not set → rule result with confidence boosted to max(original, 0.4)
Groq call fails      → rule result with confidence boosted to max(original, 0.5)
```

### 5.4 ParsedIntent Dataclass

```python
@dataclass
class ParsedIntent:
    intent: str                       # Required — the intent label
    confidence: float = 0.0           # 0.0–1.0 parse confidence score
    parser_used: str = "rule"         # "rule" | "groq"

    # Search / filter fields
    category: Optional[str] = None    # e.g. "shoes", "electronics"
    color: Optional[str] = None       # e.g. "blue", "red"
    brand: Optional[str] = None       # e.g. "Nike", "Sony"
    query: Optional[str] = None       # Full text search query
    price_min: Optional[float] = None # Price lower bound
    price_max: Optional[float] = None # Price upper bound

    # Cart / order fields
    product_name: Optional[str] = None  # Product mentioned by name
    quantity: Optional[int] = None      # Quantity (default 1 in dispatcher)
    product_id: Optional[str] = None    # Specific product ID

    # Navigation
    page_direction: Optional[str] = None  # "next" | "previous"
```

`to_dict()` strips all `None` values for clean JSON serialization.

### 5.5 Intent Dispatcher

`dispatch_intent(intent: ParsedIntent, user_id: str, command: str) → dict`

The dispatcher translates `ParsedIntent` objects into service calls and always:
1. Calls the appropriate service
2. Writes a voice log entry to MongoDB
3. Returns a structured response

#### Dispatch Table

| Intent | Service Call | Special Behavior |
|---|---|---|
| `search_products` | `product_service.search_products(query, category, color, price_min, price_max)` | `_category_filter()` avoids redundant category constraint when it duplicates the query |
| `add_to_cart` (named) | `product_service.search_products(product_name, limit=1)` → `cart_service.add_to_cart(user_id, product_id)` | Fuzzy product lookup by name |
| `add_to_cart` (no name) | Returns `action: "add_first_visible"` | Frontend adds the first visible product |
| `remove_from_cart` (named) | `cart_service.get_cart()` → name match → `cart_service.remove_from_cart()` | Case-insensitive substring match against cart items |
| `remove_from_cart` (no name) | `cart_service.remove_from_cart(last item)` | Removes most recently added cart item |
| `open_cart` | `cart_service.get_cart(user_id)` | Returns full enriched cart |
| `checkout` | `cart_service.get_cart(user_id)` | Frontend triggers checkout flow |
| `next_page` | — | Returns `{direction: "next"}` signal to frontend |
| `previous_page` | — | Returns `{direction: "previous"}` signal to frontend |
| `product_details` | `product_service.search_products(product_name, limit=1)` | Returns first matched product |

#### Response Shape

```json
{
  "action": "search_products",
  "message": "Found 12 blue shoes",
  "data": { "products": [...], "total": 12, "page": 1 },
  "intent": {
    "intent": "search_products",
    "confidence": 0.95,
    "parser_used": "rule",
    "color": "blue",
    "category": "shoes",
    "price_max": 50.0,
    "query": "blue shoes"
  },
  "success": true
}
```

### 5.6 Supported Intents Reference

| Intent Label | User Says | Extracted Fields |
|---|---|---|
| `search_products` | "show me red sneakers under 2000" | `color`, `category`, `price_max`, `query` |
| `add_to_cart` | "add nike air max to cart" | `product_name`, `quantity` |
| `remove_from_cart` | "remove jeans from cart" | `product_name` |
| `open_cart` | "open my cart" / "show cart" | — |
| `checkout` | "checkout" / "place order" / "buy now" | — |
| `next_page` | "next page" / "next" | `page_direction: "next"` |
| `previous_page` | "go back" / "previous page" | `page_direction: "previous"` |
| `product_details` | "tell me about the watch" | `product_name` |

---

## 6. Database Design

Database: **MongoDB**, database name: `vani_db`

### 6.1 Collections & Schemas

#### `users`

```js
{
  _id: ObjectId,
  name: String,               // Display name
  email: String,              // Unique, lowercased
  password_hash: String,      // bcrypt hash
  created_at: ISODate,
  updated_at: ISODate
}
```

#### `products`

```js
{
  _id: ObjectId,
  id: String,                 // Unique string ID (e.g. "prod_001")
  name: String,               // Full product name — TEXT INDEXED
  brand: String,              // Brand name — TEXT INDEXED
  category: String,           // Category string — TEXT INDEXED
  about: String,              // Short description — TEXT INDEXED
  description: String,        // Long description — TEXT INDEXED
  image: String,              // Primary image URL
  all_images: [String],       // All product image URLs
  price: Float,               // Current price — B-TREE INDEXED
  originalPrice: Float|null,  // Original price (for discount display)
  rating: Float,              // Average rating 0–5
  reviews: Int,               // Total review count
  rating_distribution: {
    "5": Int, "4": Int, "3": Int, "2": Int, "1": Int
  },
  customer_reviews: [
    {
      author: String,
      rating: Int,
      title: String,
      body: String,
      date: String
    }
  ]
}
```

#### `carts`

```js
{
  _id: ObjectId,
  user_id: String,            // Unique per user
  items: [
    {
      product_id: String,     // References products.id
      quantity: Int
    }
  ],
  updated_at: ISODate
}
```

> Cart items are **sparse** — only `product_id` and `quantity` are stored. Product details are **joined at read time** via `product_service.get_cart()`.

#### `orders`

```js
{
  _id: ObjectId,
  user_id: String,            // References users._id (as string)
  items: [
    {
      product_id: String,
      name: String,           // Snapshotted at order time
      price: Float,           // Snapshotted at order time
      quantity: Int,
      image: String
    }
  ],
  total: Float,
  status: String,             // "confirmed" (default)
  shipping_address: {
    name: String,
    street: String,
    city: String,
    state: String,
    pincode: String,
    phone: String
  },
  created_at: ISODate
}
```

> Order items **snapshot** the product name and price at the moment of purchase — protecting against catalog price changes.

#### `voice_logs`

```js
{
  _id: ObjectId,
  user_id: String,
  command: String,            // Raw voice command text
  intent: String,             // Detected intent label
  parsed_params: Object,      // Full ParsedIntent.to_dict()
  success: Boolean,           // Whether dispatch succeeded
  confidence: Float,          // Parser confidence score
  parser_used: String,        // "rule" | "groq"
  created_at: ISODate
}
```

### 6.2 Indexes

Created automatically on startup by `database/connection.py`:

| Collection | Index | Type | Notes |
|---|---|---|---|
| `users` | `email` | Unique | Enforces unique email |
| `products` | `id` | Unique | Business ID lookup |
| `products` | `category` | B-Tree | Filter by category |
| `products` | `price` | B-Tree | Price range filter |
| `products` | `brand` | B-Tree | Filter by brand |
| `products` | `name, brand, category, about` | **Text** | Full-text search via `$text` |
| `carts` | `user_id` | Unique | One cart per user |
| `orders` | `user_id` | B-Tree | User order history |
| `voice_logs` | `user_id` | B-Tree | User analytics queries |
| `voice_logs` | `created_at` | B-Tree | Chronological log retrieval |

---

## 7. API Reference

Base URL: `http://localhost:8000/api`  
Interactive docs: `http://localhost:8000/docs`

### 7.1 Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | None | Register new user |
| `POST` | `/auth/login` | None | Login, receive JWT |
| `GET` | `/auth/me` | Bearer | Get current user profile |

**Register / Login Response:**
```json
{
  "access_token": "<JWT>",
  "token_type": "bearer",
  "user": { "id": "...", "name": "...", "email": "..." }
}
```

### 7.2 Products

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/products` | None | List products (paginated, filterable) |
| `GET` | `/products/search?q=...` | None | Full-text + filter search |
| `GET` | `/products/categories` | None | All distinct category strings |
| `GET` | `/products/{product_id}` | None | Single product by ID |

**List / Search Query Params:**

| Param | Type | Description |
|---|---|---|
| `q` | string | Search query (**required** for `/search`) |
| `category` | string | Filter by category (regex, case-insensitive) |
| `color` | string | Filter by color (searches name/about/description) |
| `brand` | string | Filter by brand |
| `price_min` | float | Minimum price |
| `price_max` | float | Maximum price |
| `rating_min` | float | Minimum rating (0–5) |
| `sort_by` | string | `price_asc`, `price_desc`, `rating`, `reviews` |
| `page` | int | Page number (default 1) |
| `limit` | int | Page size (default 20, max 100) |

**Product Search Strategy:**
1. Try MongoDB `$text` index search (ranked by text score)
2. Fall back to multi-field `$regex` search across `name`, `brand`, `category`, `about`, `description`

### 7.3 Cart

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/cart` | Bearer | Get enriched cart |
| `POST` | `/cart/add` | Bearer | Add item `{product_id, quantity}` |
| `PUT` | `/cart/update` | Bearer | Update quantity `{product_id, quantity}` (0 = remove) |
| `DELETE` | `/cart/{product_id}` | Bearer | Remove specific item |

**Cart Response:**
```json
{
  "items": [
    {
      "product_id": "...",
      "name": "Nike Air Max",
      "brand": "Nike",
      "image": "...",
      "price": 4999.0,
      "originalPrice": 6999.0,
      "quantity": 2,
      "subtotal": 9998.0
    }
  ],
  "total": 9998.0,
  "item_count": 2
}
```

### 7.4 Orders

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/orders` | Bearer | Create order from current cart |
| `GET` | `/orders` | Bearer | Order history |
| `GET` | `/orders/{order_id}` | Bearer | Single order details |

**Create Order Request:**
```json
{
  "shipping_address": {
    "name": "John Doe",
    "street": "123 MG Road",
    "city": "Bengaluru",
    "state": "Karnataka",
    "pincode": "560001",
    "phone": "9876543210"
  }
}
```

### 7.5 Voice

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/voice/command` | Bearer | Process a voice command |
| `GET` | `/voice/analytics` | Bearer | User command analytics |

**Voice Command Request:**
```json
{ "command": "show me blue shoes under 50" }
```

**Analytics Response:**
```json
{
  "total_commands": 42,
  "success_rate": 95.2,
  "most_used_intents": [
    { "intent": "search_products", "count": 28 },
    { "intent": "add_to_cart", "count": 8 }
  ],
  "recent_commands": [...],
  "failed_commands": [...],
  "parser_distribution": { "rule": 38, "groq": 4 }
}
```

---

## 8. Pydantic Schemas

### Auth Schemas (`schemas/auth_schema.py`)

```python
class RegisterRequest(BaseModel):
    name: str                   # 2–100 chars
    email: EmailStr
    password: str               # 6–128 chars

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
```

### Product Schemas (`schemas/product_schema.py`)

```python
class ProductResponse(BaseModel):
    id: str
    name: str
    brand: str
    category: str
    image: str
    all_images: list[str] = []
    rating: float
    reviews: int
    price: float
    originalPrice: Optional[float] = None
    about: str = ""
    description: str = ""
    rating_distribution: dict = {}
    customer_reviews: list[dict] = []

class ProductListResponse(BaseModel):
    products: list[ProductResponse]
    total: int
    page: int
    limit: int
    total_pages: int

class ProductSearchParams(BaseModel):
    query: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    color: Optional[str] = None
    price_min: Optional[float] = Field(None, ge=0)
    price_max: Optional[float] = Field(None, ge=0)
    rating_min: Optional[float] = Field(None, ge=0, le=5)
    sort_by: Optional[str] = Field(None, pattern="^(price_asc|price_desc|rating|newest|reviews)$")
    page: int = Field(1, ge=1)
    limit: int = Field(20, ge=1, le=100)
```

### Cart Schemas (`schemas/cart_schema.py`)

```python
class AddToCartRequest(BaseModel):
    product_id: str
    quantity: int = Field(1, ge=1, le=99)

class UpdateCartRequest(BaseModel):
    product_id: str
    quantity: int = Field(..., ge=0, le=99)   # 0 triggers removal

class CartItemResponse(BaseModel):
    product_id: str
    name: str
    brand: str
    image: str
    price: float
    originalPrice: Optional[float] = None
    quantity: int
    subtotal: float

class CartResponse(BaseModel):
    items: list[CartItemResponse]
    total: float
    item_count: int
```

### Order Schemas (`schemas/order_schema.py`)

```python
class ShippingAddress(BaseModel):
    name: str    # min 2 chars
    street: str  # min 5 chars
    city: str    # min 2 chars
    state: str   # min 2 chars
    pincode: str # 4–10 chars
    phone: str   # 10–15 chars

class CreateOrderRequest(BaseModel):
    shipping_address: ShippingAddress

class OrderItemResponse(BaseModel):
    product_id: str
    name: str
    price: float
    quantity: int
    image: str

class OrderResponse(BaseModel):
    id: str
    items: list[OrderItemResponse]
    total: float
    status: str
    shipping_address: dict
    created_at: datetime

class OrderListResponse(BaseModel):
    orders: list[OrderResponse]
    total: int
```

---

## 9. Authentication & Security

### JWT Flow

```
Registration/Login
       │
       ▼
auth_service → bcrypt.verify(password, hash)
       │
       ▼
jwt_handler.create_access_token(user_id, email)
  payload = { sub: user_id, email: email, exp: now+24h, iat: now }
  signed with HS256 + JWT_SECRET
       │
       ▼
Client stores token in localStorage ("vani_token")
       │
       ▼
Every protected request:
  Authorization: Bearer <token>
       │
       ▼
auth_middleware.get_current_user(credentials)
  → jwt_handler.verify_token(token)
  → returns decoded payload dict
  → user_id = payload["sub"]
```

### Security Configuration

| Setting | Default | Environment Variable |
|---|---|---|
| JWT Algorithm | `HS256` | — |
| JWT Expiry | `24 hours` | `JWT_EXPIRY_HOURS` |
| Secret Key | `fallback-dev-secret-change-in-production` | `JWT_SECRET` |
| Password Hash | bcrypt (adaptive rounds) | — |

> ⚠️ **Always set `JWT_SECRET` to a strong random value in production.**

### CORS

Configured in `main.py`:
- Allowed origins: `http://localhost:5173`, `http://localhost:3000`, `http://127.0.0.1:5173`, `http://127.0.0.1:3000`
- Methods: `*`
- Headers: `*`
- Credentials: `true`

---

## 10. Frontend API Client

`frontend/src/api/client.ts` provides typed namespaced API modules. All authenticated calls automatically attach the stored JWT Bearer token.

```typescript
// Auth
authApi.register(name, email, password)
authApi.login(email, password)
authApi.getProfile()
authApi.logout()
authApi.isAuthenticated() → boolean
authApi.getUser() → stored user object

// Products
productsApi.list({ page, limit, category, brand, price_min, price_max, rating_min, sort_by })
productsApi.getById(productId)
productsApi.search(query, { category, color, brand, price_min, price_max, rating_min, sort_by, page, limit })
productsApi.getCategories() → string[]

// Cart
cartApi.get()
cartApi.addItem(productId, quantity?)
cartApi.updateQuantity(productId, quantity)
cartApi.removeItem(productId)

// Orders
ordersApi.create({ name, street, city, state, pincode, phone })
ordersApi.list()
ordersApi.getById(orderId)

// Voice
voiceApi.processCommand(command)
voiceApi.getAnalytics()
```

Token storage keys:
- `vani_token` — JWT access token
- `vani_user` — serialized user object

---

## 11. Environment Variables

Copy `backend/.env.example` to `backend/.env`:

```env
# Required
MONGODB_URL=mongodb+srv://<username>:<password>@cluster0.example.mongodb.net/?appName=Cluster0
JWT_SECRET=your-super-secret-key-change-this-in-production

# Optional (defaults shown)
JWT_EXPIRY_HOURS=24

# Optional — enables LLM fallback for ambiguous commands
GROQ_API_KEY=your-groq-api-key-here
```

> Without `GROQ_API_KEY`, all commands are parsed by the rule engine only. Ambiguous commands get a confidence boost but remain rule-parsed.

---

## 12. Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+ / pnpm
- MongoDB Atlas account (or local MongoDB)
- Groq API key (optional, for LLM fallback)

### Backend Setup

```bash
# 1. Navigate to backend
cd backend

# 2. Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate         # Windows
# source .venv/bin/activate    # macOS/Linux

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
copy .env.example .env
# Edit .env with your MongoDB URL, JWT secret, Groq key

# 5. Seed the product catalog
python seed_products.py

# 6. Start the API server
uvicorn main:app --reload --port 8000
```

The API will be live at `http://localhost:8000`  
Interactive docs at `http://localhost:8000/docs`

### Frontend Setup

```bash
# 1. Navigate to frontend
cd frontend

# 2. Install dependencies
pnpm install

# 3. Start the dev server
pnpm dev
```

The app will be live at `http://localhost:5173`

---

## 13. Running Tests

```bash
cd backend

# Run all tests
pytest

# Run with verbose output
pytest -v

# Run only intent parser tests
pytest tests/test_intent_parser.py -v

# Run only dispatcher tests
pytest tests/test_intent_dispatch.py -v
```

### Test Coverage

**`tests/test_intent_parser.py`** — 30+ parametrized tests:

| Category | Examples |
|---|---|
| `SEARCH_CASES` | "show me jeans", "blue shoes under 50", "i want to buy shoes" |
| `ACTION_CASES` | "open my cart", "checkout", "add nike shoes to cart", "next page" |
| `DETAIL_CASES` | "tell me about jeans", "show me details of nike shoes" |
| Edge cases | "show me back" must be `search_products`, not `previous_page` |
| Async | `parse_intent()` uses rule parser and returns correct result |

---

## 14. Voice Command Examples

| Say This | Intent | What Happens |
|---|---|---|
| "Show me blue jeans under 2000" | `search_products` | Filters products by color=blue, category=jeans, price_max=2000 |
| "Find Nike sneakers" | `search_products` | Searches for Nike sneakers |
| "Show me electronics above 5000" | `search_products` | Electronics priced > ₹5000 |
| "Search for red kurta" | `search_products` | Searches Indian ethnic wear in red |
| "Add Nike shoes to cart" | `add_to_cart` | Looks up Nike shoes, adds first result |
| "Add to cart" / "Add it to cart" | `add_to_cart` | Frontend adds first visible product |
| "Remove jeans from cart" | `remove_from_cart` | Finds and removes jeans from cart |
| "Remove from cart" | `remove_from_cart` | Removes last-added item |
| "Open my cart" / "Show cart" | `open_cart` | Opens cart drawer |
| "Checkout" / "Place my order" | `checkout` | Opens checkout flow |
| "Next page" / "Next" | `next_page` | Loads next product page |
| "Previous page" / "Go back" | `previous_page` | Loads previous page |
| "Tell me about the watch" | `product_details` | Shows watch product details |
| "Details of Sony headphones" | `product_details` | Shows Sony headphone details |

---

## Design Decisions

### Why a Hybrid Parser?

- **Rule-based is fast, free, and deterministic** — ~95% of common e-commerce voice commands follow predictable patterns
- **LLM handles ambiguity** — edge cases, unusual phrasing, multi-intent sentences
- **Cost efficiency** — Groq calls only happen when rules are insufficient (confidence < 0.7)
- **Offline resilience** — system degrades gracefully without a Groq API key

### Why MongoDB?

- **Flexible product schema** — products have varied attributes (electronics vs. fashion)
- **Built-in text search** — `$text` index covers name, brand, category, descriptions
- **Embedded cart/order items** — denormalized reads are fast for single-user queries
- **Voice log analytics** — MongoDB aggregation pipeline is well-suited for usage stats

### Why Motor (Async)?

FastAPI is async-first. Motor provides a native async MongoDB driver, enabling full coroutine-based request handling with no thread pool overhead.

---

*Built with ❤️ — VANI: Voice Assisted Navigation for Intelligent Commerce*
