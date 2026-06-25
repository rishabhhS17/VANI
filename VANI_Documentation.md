# VANI — Technical Documentation
## Voice Assisted Navigation for Intelligent Commerce

> **Version:** 1.0.0 | **Stack:** FastAPI · MongoDB · React · Vite · Zustand · Groq LLM

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Structure](#2-repository-structure)
3. [System Architecture](#3-system-architecture)
4. [Backend — Deep Dive](#4-backend--deep-dive)
   - 4.1 [Entry Point (main.py)](#41-entry-point-mainpy)
   - 4.2 [Database Layer](#42-database-layer)
   - 4.3 [Authentication](#43-authentication)
   - 4.4 [Product Service](#44-product-service)
   - 4.5 [Cart Service](#45-cart-service)
   - 4.6 [Order Service](#46-order-service)
   - 4.7 [Intent Parser ← Core Voice Brain](#47-intent-parser--core-voice-brain)
   - 4.8 [Intent Dispatcher](#48-intent-dispatcher)
   - 4.9 [Voice Routes](#49-voice-routes)
5. [Frontend — Deep Dive](#5-frontend--deep-dive)
   - 5.1 [Tech Stack](#51-tech-stack)
   - 5.2 [State Management (Zustand Stores)](#52-state-management-zustand-stores)
   - 5.3 [Voice Command Flow (Frontend)](#53-voice-command-flow-frontend)
   - 5.4 [Key UI Components](#54-key-ui-components)
6. [Complete Voice Command Flow — End to End](#6-complete-voice-command-flow--end-to-end)
7. [All API Endpoints](#7-all-api-endpoints)
8. [Database Schema (MongoDB)](#8-database-schema-mongodb)
9. [Intent Parser — Complete Reference](#9-intent-parser--complete-reference)
   - 9.1 [Supported Intents](#91-supported-intents)
   - 9.2 [Rule-Based Parser Logic](#92-rule-based-parser-logic)
   - 9.3 [Groq LLM Fallback](#93-groq-llm-fallback)
   - 9.4 [Confidence Scoring](#94-confidence-scoring)
   - 9.5 [Worked Examples](#95-worked-examples)
10. [Environment Variables](#10-environment-variables)
11. [Setup & Run Instructions](#11-setup--run-instructions)
12. [Glossary](#12-glossary)

---

## 1. Project Overview

**VANI** (Voice Assisted Navigation for Intelligent Commerce) is a full-stack e-commerce platform where users shop entirely through **voice commands**. Instead of clicking buttons, a user can say:

- *"Show kurta"* → product results appear
- *"Add to cart"* → first visible product is added
- *"Remove from cart"* → last added item is removed
- *"Checkout"* → checkout form opens automatically

The platform has two layers:

| Layer | Technology | Purpose |
|---|---|---|
| **Backend** | Python / FastAPI | REST API, voice intent processing, database |
| **Frontend** | React / TypeScript / Vite | UI, voice recording, state management |

---

## 2. Repository Structure

```
VANI/
├── backend/                   ← FastAPI Python backend
│   ├── main.py                ← App entry point, CORS, router mounting
│   ├── requirements.txt       ← Python dependencies
│   ├── .env.example           ← Environment variable template
│   ├── seed_products.py       ← Script to populate MongoDB with products
│   │
│   ├── database/
│   │   └── connection.py      ← MongoDB connect/disconnect + get_database()
│   │
│   ├── middleware/
│   │   └── auth_middleware.py ← JWT Bearer token extraction (FastAPI Depends)
│   │
│   ├── models/                ← MongoDB document factory functions
│   │   ├── user.py
│   │   ├── cart.py
│   │   ├── order.py
│   │   ├── product.py
│   │   └── voice_log.py       ← Analytics log document shape
│   │
│   ├── routes/                ← HTTP route handlers (thin controllers)
│   │   ├── auth_routes.py     ← /api/auth/*
│   │   ├── product_routes.py  ← /api/products/*
│   │   ├── cart_routes.py     ← /api/cart/*
│   │   ├── order_routes.py    ← /api/orders/*
│   │   └── voice_routes.py    ← /api/voice/*
│   │
│   ├── schemas/               ← Pydantic request/response models
│   │   ├── auth_schema.py
│   │   ├── cart_schema.py
│   │   ├── order_schema.py
│   │   └── product_schema.py
│   │
│   ├── services/              ← Business logic (the real work happens here)
│   │   ├── auth_service.py    ← Register, login, JWT creation
│   │   ├── product_service.py ← Catalog browse, text search, filters
│   │   ├── cart_service.py    ← Add/remove/update cart items
│   │   ├── order_service.py   ← Create and list orders
│   │   ├── intent_parser.py   ← ★ Voice → structured intent (CORE)
│   │   └── intent_dispatcher.py ← Intent → service action (CORE)
│   │
│   ├── utils/
│   │   ├── jwt_handler.py     ← JWT encode/decode helpers
│   │   └── password_utils.py  ← bcrypt hash/verify
│   │
│   └── tests/
│       ├── test_intent_parser.py
│       └── test_intent_dispatch.py
│
└── frontend/                  ← React + Vite frontend
    ├── index.html
    ├── vite.config.ts
    ├── package.json
    │
    └── src/
        ├── main.tsx           ← React root mount
        ├── api/
        │   └── client.ts      ← All HTTP calls to backend (fetch wrapper)
        ├── app/
        │   ├── App.tsx        ← ★ Entire application (single-file, ~2600 lines)
        │   └── components/ui/ ← Shadcn/radix UI primitives
        ├── data/
        │   └── products.json  ← Fallback static product data
        └── styles/
            └── index.css      ← Global CSS, animations, fonts
```

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                              │
│                                                             │
│  ┌──────────────┐    Web Speech API    ┌─────────────────┐  │
│  │   React UI   │ ──── recording ───▶  │ SpeechRecognition│  │
│  │  (App.tsx)   │ ◀── transcript ────  │   (browser)     │  │
│  └──────┬───────┘                      └─────────────────┘  │
│         │  fetch (JWT in header)                            │
└─────────┼───────────────────────────────────────────────────┘
          │ HTTP
          ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI BACKEND                          │
│                                                             │
│  POST /api/voice/command                                    │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────┐     low confidence    ┌───────────────┐   │
│  │ Rule-Based   │ ───────────────────▶  │  Groq LLM     │   │
│  │ Intent Parser│ ◀── parsed intent ─── │  (llama-3.1)  │   │
│  └──────┬───────┘                       └───────────────┘   │
│         │  ParsedIntent                                      │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │   Intent     │ ──▶ product_service.search_products()     │
│  │  Dispatcher  │ ──▶ cart_service.add_to_cart()            │
│  │              │ ──▶ cart_service.remove_from_cart()       │
│  └──────┬───────┘                                           │
│         │  structured response + intent dict                │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │   MongoDB    │  collections: users, products,            │
│  │   Atlas      │              carts, orders, voice_logs    │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Backend — Deep Dive

### 4.1 Entry Point (`main.py`)

```python
app = FastAPI(title="VANI API", version="1.0.0")
```

**Responsibilities:**
- Creates the FastAPI application instance
- Registers CORS middleware (allows `localhost:5173` and `localhost:3000`)
- Mounts all 5 routers under the `/api` prefix
- Connects to MongoDB on startup, disconnects on shutdown (via `lifespan` context manager)

**CORS:** The backend explicitly allows the Vite dev server (`http://localhost:5173`) so browser fetch requests don't get blocked by same-origin policy.

---

### 4.2 Database Layer (`database/connection.py`)

Uses **Motor** (async MongoDB driver):

```python
client = AsyncIOMotorClient(MONGODB_URL)
db = client["vani_db"]
```

Three functions exposed:
- `connect_to_mongodb()` — establishes connection on app startup
- `close_mongodb_connection()` — closes cleanly on app shutdown
- `get_database()` — returns the `vani_db` database object (used inside services)

**Collections used:**

| Collection | Purpose |
|---|---|
| `users` | Registered user accounts |
| `products` | Product catalog (seeded via `seed_products.py`) |
| `carts` | One cart document per user |
| `orders` | Placed orders |
| `voice_logs` | Analytics: every voice command logged here |

---

### 4.3 Authentication

**Flow:**
1. User registers (`POST /api/auth/register`) → password hashed with **bcrypt** → user saved to MongoDB → **JWT returned**
2. User logs in (`POST /api/auth/login`) → password verified → **JWT returned**
3. Every protected route uses `Depends(get_current_user)` which:
   - Reads the `Authorization: Bearer <token>` header
   - Calls `verify_token(token)` → returns payload `{"sub": user_id, "name": ..., "email": ...}`
   - Injects `user` dict into the route handler

**JWT Handler (`utils/jwt_handler.py`):**
- Uses `python-jose` library
- Secret from `JWT_SECRET` env var
- Expiry: `JWT_EXPIRY_HOURS` (default 24h)
- Algorithm: `HS256`

**Why JWT and not sessions?** JWTs are stateless — the backend doesn't need to store session data in a database. The token is self-contained and verified cryptographically.

---

### 4.4 Product Service (`services/product_service.py`)

**`get_products()`** — paginated list with filters:
- `category`, `brand` → MongoDB regex (case-insensitive)
- `price_min`, `price_max` → MongoDB range query (`$gte`, `$lte`)
- `rating_min` → minimum rating filter
- Sort options: `price_asc`, `price_desc`, `rating`, `reviews`

**`search_products(query, ...)`** — two-stage search:

```
Stage 1: MongoDB $text search (uses a text index on name/brand/category/description)
         → fast, relevance-scored
         → if 0 results found, fall through to Stage 2

Stage 2: Regex fallback — searches across name, brand, category, about, description
         → slower but catches everything
```

This dual-stage approach means voice queries like *"kurta"* work even if the text index doesn't cover it exactly.

---

### 4.5 Cart Service (`services/cart_service.py`)

MongoDB document structure for a cart:
```json
{
  "user_id": "abc123",
  "items": [
    { "product_id": "prod_1", "quantity": 2 },
    { "product_id": "prod_2", "quantity": 1 }
  ],
  "updated_at": "2026-06-20T15:00:00Z"
}
```

**`get_cart(user_id)`:**
- Fetches cart document
- Enriches each item with full product details (name, brand, image, price) via a second DB query
- Returns `{ items: [...], total: float, item_count: int }`

**`add_to_cart(user_id, product_id, quantity)`:**
- Verifies product exists
- If cart doesn't exist → creates new cart document
- If product already in cart → increments quantity (`$inc`)
- If new product → pushes to items array (`$push`)

**`remove_from_cart(user_id, product_id)`:**
- Uses MongoDB `$pull` operator to remove item matching `product_id`

**`update_cart_quantity(user_id, product_id, quantity)`:**
- If `quantity == 0` → calls `remove_from_cart()`
- Otherwise → uses `$set` to update `items.$.quantity`

---

### 4.6 Order Service (`services/order_service.py`)

**`create_order(user_id, shipping_address)`:**
1. Fetches current cart
2. Validates cart is not empty
3. Creates order document with items snapshot + total
4. Clears the cart after order is placed

**`list_orders(user_id)`:**
- Returns all orders for a user, sorted by newest first

---

### 4.7 Intent Parser — Core Voice Brain

> This is the most important part of VANI. It converts raw voice text into structured, actionable data.

**File:** `backend/services/intent_parser.py`

#### Architecture: Hybrid Two-Stage Parser

```
Voice Text (string)
        │
        ▼
┌─────────────────────┐
│  Rule-Based Parser  │  Fast, deterministic regex + keyword matching
│  _rule_based_parse()│  Returns ParsedIntent with confidence score
└──────────┬──────────┘
           │
    confidence ≥ 0.70?
           │
    YES ───┘    NO
     │           │
     │           ▼
     │   ┌────────────────┐
     │   │  Groq LLM      │  llama-3.1-8b-instant model
     │   │  _groq_parse() │  Structured JSON output (response_format)
     │   └───────┬────────┘
     │           │
     └─────┬─────┘
           │
           ▼
    ParsedIntent (final)
```

**Why two stages?**
- Rule-based is instant (no network call, no cost)
- LLM handles ambiguous or complex commands rule-based can't parse
- Threshold `0.70` means: if rule-based is reasonably confident, skip the LLM

#### The `ParsedIntent` Dataclass

```python
@dataclass
class ParsedIntent:
    intent: str           # What the user wants to do
    confidence: float     # 0.0 – 1.0 (how sure we are)
    parser_used: str      # "rule" or "groq"
    category: str | None  # e.g. "kurta", "shoes", "electronics"
    color: str | None     # e.g. "blue", "red"
    brand: str | None     # e.g. "Nike", "Sony"
    query: str | None     # Full search text
    product_id: str | None
    product_name: str | None  # e.g. "Nike Air Max"
    price_min: float | None   # Lower price bound
    price_max: float | None   # Upper price bound
    quantity: int | None
    page_direction: str | None  # "next" or "previous"
```

---

### 4.8 Intent Dispatcher (`services/intent_dispatcher.py`)

Takes the `ParsedIntent` and calls the right service:

| Intent | Action |
|---|---|
| `search_products` | Calls `product_service.search_products()` with extracted params |
| `add_to_cart` (named product) | Searches for product → calls `cart_service.add_to_cart()` |
| `add_to_cart` (no product name) | Returns `action: "add_first_visible"` → frontend adds first shown product |
| `remove_from_cart` (named) | Finds product in cart by name → removes it |
| `remove_from_cart` (no name) | Removes the **last item** in the cart |
| `open_cart` | Fetches and returns full cart |
| `checkout` | Fetches cart, returns it with checkout message |
| `next_page` / `previous_page` | Returns direction signal for frontend |
| `product_details` | Searches for product → returns full product data |

**After every dispatch**, logs to `voice_logs` collection:
```json
{
  "user_id": "...",
  "command": "show kurta under 500",
  "intent": "search_products",
  "parsed_params": { "category": "kurta", "price_max": 500 },
  "success": true,
  "confidence": 0.85,
  "parser_used": "rule",
  "created_at": "2026-06-20T..."
}
```

---

### 4.9 Voice Routes (`routes/voice_routes.py`)

**`POST /api/voice/command`** (requires JWT):
```
Request:  { "command": "show kurta under 500" }

Response: {
  "action": "search_products",
  "message": "Found 12 kurta",
  "data": { "products": [...], "total": 12 },
  "search_query": "kurta",
  "intent": {
    "intent": "search_products",
    "confidence": 0.85,
    "category": "kurta",
    "price_max": 500.0,
    "query": "kurta"
  },
  "success": true
}
```

**`GET /api/voice/analytics`** (requires JWT):
Returns per-user stats: total commands, success rate, most-used intents, recent commands, parser distribution (rule vs groq).

---

## 5. Frontend — Deep Dive

### 5.1 Tech Stack

| Tool | Role |
|---|---|
| **React 18** | UI library |
| **TypeScript** | Type safety |
| **Vite** | Build tool & dev server (HMR) |
| **Zustand** | Lightweight state management |
| **Framer Motion** | Animations and transitions |
| **Lucide React** | Icon library |
| **Tailwind CSS** | Utility-class styling |

**Single-file architecture:** The entire app lives in `src/app/App.tsx` (~2,600 lines). This is intentional for a rapid-prototype approach — all components, stores, and logic are co-located.

---

### 5.2 State Management (Zustand Stores)

#### `useAuth` Store
```typescript
{
  user: AuthUser | null,
  authModalOpen: boolean,
  authMode: "login" | "register",
  pendingProduct: Product | null,  // product to add after login

  init()        // Checks localStorage for existing JWT, restores session
  login()       // Calls authApi, sets user + JWT
  register()    // Calls authApi, sets user + JWT
  logout()      // Clears JWT from localStorage, empties cart
  openAuth()    // Opens auth modal (optionally with a pending product)
  isAuthenticated()  // Returns true if user exists AND token valid
}
```

**Pending product pattern:** If a user tries to add to cart while logged out:
1. `openAuth("login", product)` is called → stores product in `pendingProduct`
2. User logs in
3. Login success handler automatically adds `pendingProduct` to cart

#### `useCart` Store
```typescript
{
  items: CartItem[],
  wishlist: string[],   // product IDs

  addItem(product)      // → POST /api/cart/add
  removeItem(id)        // → DELETE /api/cart/:id
  updateQty(id, qty)    // → PUT /api/cart/update
  toggleWishlist(id)    // Local only (not persisted to backend)
  fetchCart()           // → GET /api/cart (syncs with server)
  clearCart()           // Empties local state (called on logout)
  total()               // Computed: sum of price × quantity
  count()               // Computed: total item count
}
```

#### `useProductStore` Store
```typescript
{
  allProducts: Product[],
  heroProducts: Product[],        // First 3 (hero carousel)
  recommendedProducts: Product[], // Next 6
  recentlyViewed: Product[],      // Next 6
  trendingProducts: Product[],    // Next 6
  bestSellers: Product[],         // Next 6

  fetchProducts()  // → GET /api/products?limit=100, shuffles and slices
}
```

---

### 5.3 Voice Command Flow (Frontend)

```
User presses Mic button (BottomDock)
          │
          ▼
handleMicClick()
  └─ if not authenticated → openAuth("login") + show message
  └─ if listening → stopListening()
  └─ else → startListening()
          │
          ▼
startListening()
  ├─ Creates SpeechRecognition (Web Speech API, lang="en-IN")
  ├─ onstart: sets listening=true, opens VoicePopup
  ├─ onresult: updates transcript in real-time
  ├─ onerror: shows "Could not understand"
  └─ onend: calls processVoiceCommand(finalText)
          │
          ▼
processVoiceCommand(command: string)
  ├─ Calls voiceApi.processCommand(command) → POST /api/voice/command
  │
  ├─ res.action === "search_products"
  │    → update voiceSearchPrefill, visibleProductsRef
  │    → setSearch(query), setSubmittedSearch(query)
  │    → SearchResults panel opens
  │
  ├─ res.action === "add_first_visible"
  │    → addItem(visibleProductsRef.current[0])
  │    → setTranscript("Added X to your cart ✓")
  │
  ├─ res.action === "add_to_cart" (named product, backend added it)
  │    → fetchCart(), setCartOpen(true)
  │
  ├─ res.action === "remove_from_cart"
  │    → fetchCart(), setCartOpen(true)
  │
  ├─ res.action === "checkout"
  │    → fetchCart(), setCartOpen(true)
  │    → setTimeout 400ms → setVoiceCheckoutTrigger(true)
  │    → CartDrawer auto-opens checkout form
  │
  └─ setTimeout 3s → setVoiceOpen(false)
```

#### `visibleProductsRef` — The "First Shown Product" Tracker

This is a React `useRef<Product[]>` that always holds the **currently visible** products:

- **On app load:** initialized with `recommendedProducts` from the store
- **After a voice search:** updated with the search results
- **Purpose:** When user says "add to cart" with no product name, the frontend grabs `visibleProductsRef.current[0]` — the first product the user is looking at

---

### 5.4 Key UI Components

| Component | Description |
|---|---|
| `Navbar` | Logo, nav links, search bar (with mic button), user menu, dark mode toggle |
| `BottomDock` | Floating pill with Voice Train, Filters, Mic, Cart, Wishlist buttons |
| `VoicePopup` | Floating card showing live transcript and status (Listening / Processed) |
| `HeroCarousel` | 3D carousel of featured products, auto-rotates every 5.5s |
| `ProductCard` | Product tile with image, rating, price, wishlist heart, add-to-cart button |
| `CartDrawer` | Right-side slide-in drawer with cart items, quantity controls, checkout button |
| `SearchResults` | Overlay grid that appears when a search query is active |
| `AuthModal` | Login / Register modal (shared, togglable) |
| `FiltersPanel` | Left-side slide-in with category, price range, rating, brand filters |
| `WishlistDrawer` | Right-side drawer showing wishlisted items |
| `OrdersDrawer` | Right-side drawer showing order history |
| `NotificationPanel` | Dropdown notification list |

---

## 6. Complete Voice Command Flow — End to End

Here is the full journey of the command **"show kurta under 500"**:

```
1. USER speaks into mic

2. BROWSER (Web Speech API)
   → transcribes: "show kurta under 500"
   → fires onend event

3. FRONTEND processVoiceCommand("show kurta under 500")
   → calls POST /api/voice/command
      body: { "command": "show kurta under 500" }
      headers: Authorization: Bearer <JWT>

4. BACKEND: voice_routes.py
   → validates JWT via get_current_user dependency
   → calls parse_intent("show kurta under 500")

5. BACKEND: intent_parser.py → _rule_based_parse()
   → "checkout" patterns? NO
   → "add to cart" patterns? NO
   → "remove from cart" patterns? NO
   → "open cart" patterns? NO
   → falls through to search_products
   → extracts price_max=500 (from "under 500")
   → extracts category="kurta" (from CATEGORIES list)
   → builds query="kurta under 500" → strips price → query="kurta"
   → confidence = 0.60 (base) + 0.15 (category) + 0.10 (price) = 0.85
   → confidence 0.85 ≥ 0.70 threshold → returns rule result ✓

6. BACKEND: intent_parser.py → parse_intent() returns:
   ParsedIntent(
     intent="search_products",
     confidence=0.85,
     parser_used="rule",
     category="kurta",
     price_max=500.0,
     query="kurta"
   )

7. BACKEND: intent_dispatcher.py → dispatch_intent()
   → intent is "search_products"
   → search_query = "kurta"
   → calls product_service.search_products(
         query="kurta",
         price_max=500.0
      )

8. BACKEND: product_service.py → search_products()
   → tries MongoDB $text search for "kurta" with price ≤ 500
   → returns matching products

9. BACKEND: logs to voice_logs collection
   → { command, intent, confidence, success: true, ... }

10. BACKEND: returns HTTP 200:
    {
      "action": "search_products",
      "message": "Found 8 kurta",
      "data": { "products": [...8 kurtas...], "total": 8 },
      "search_query": "kurta",
      "intent": { "intent": "search_products", "category": "kurta", "price_max": 500 },
      "success": true
    }

11. FRONTEND: processVoiceCommand receives response
    → action = "search_products"
    → extracts products, sets voiceSearchPrefill
    → visibleProductsRef.current = [8 kurta products]
    → setSearch("kurta"), setSubmittedSearch("kurta")
    → SearchResults panel opens showing 8 kurtas
    → VoicePopup shows "Found 8 kurta"
    → After 3 seconds, VoicePopup closes

12. USER sees kurta results on screen ✓
```

---

## 7. All API Endpoints

### Auth — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | ❌ | Register new user, returns JWT |
| POST | `/api/auth/login` | ❌ | Login, returns JWT |
| GET | `/api/auth/me` | ✅ JWT | Get current user profile |

### Products — `/api/products`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/products` | ❌ | List products (paginated, filterable) |
| GET | `/api/products/{id}` | ❌ | Get single product by ID |
| GET | `/api/products/search?q=...` | ❌ | Text search with filters |
| GET | `/api/products/categories` | ❌ | List all distinct categories |

**Query params for `/api/products`:**
`page`, `limit`, `category`, `brand`, `price_min`, `price_max`, `rating_min`, `sort_by`

**Query params for `/api/products/search`:**
`q` (required), `category`, `color`, `brand`, `price_min`, `price_max`, `rating_min`, `sort_by`, `page`, `limit`

### Cart — `/api/cart`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/cart` | ✅ JWT | Get current cart |
| POST | `/api/cart/add` | ✅ JWT | Add item `{ product_id, quantity }` |
| PUT | `/api/cart/update` | ✅ JWT | Update quantity `{ product_id, quantity }` |
| DELETE | `/api/cart/{product_id}` | ✅ JWT | Remove item from cart |

### Orders — `/api/orders`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/orders` | ✅ JWT | Place order `{ shipping_address }` |
| GET | `/api/orders` | ✅ JWT | List all orders for user |
| GET | `/api/orders/{id}` | ✅ JWT | Get single order |

### Voice — `/api/voice`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/voice/command` | ✅ JWT | Process voice command `{ command }` |
| GET | `/api/voice/analytics` | ✅ JWT | Get voice usage analytics |

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | ❌ | Health check |
| GET | `/` | ❌ | API info |

---

## 8. Database Schema (MongoDB)

### `users` collection
```json
{
  "_id": ObjectId,
  "id": "uuid-string",
  "name": "Huntisonn",
  "email": "user@example.com",
  "password_hash": "$2b$12$...",
  "created_at": ISODate
}
```

### `products` collection
```json
{
  "_id": ObjectId,
  "id": "prod_uuid",
  "name": "Classic Kurta",
  "brand": "Fabindia",
  "price": 499,
  "originalPrice": 799,
  "image": "https://...",
  "rating": 4.5,
  "reviews": 1234,
  "category": "Kurta",
  "description": "...",
  "badge": "Best Seller"
}
```

> Text index on `name`, `brand`, `category`, `description` for fast `$text` search.

### `carts` collection
```json
{
  "_id": ObjectId,
  "user_id": "uuid-string",
  "items": [
    { "product_id": "prod_uuid", "quantity": 2 },
    { "product_id": "prod_uuid2", "quantity": 1 }
  ],
  "updated_at": ISODate
}
```
> One document per user. Items array is kept minimal (just IDs + quantity); product details are enriched on read.

### `orders` collection
```json
{
  "_id": ObjectId,
  "id": "order-uuid",
  "user_id": "uuid-string",
  "items": [
    {
      "product_id": "prod_uuid",
      "name": "Classic Kurta",
      "price": 499,
      "quantity": 2,
      "subtotal": 998
    }
  ],
  "total": 998,
  "status": "confirmed",
  "shipping_address": {
    "name": "Huntisonn",
    "street": "123 Main St",
    "city": "New Delhi",
    "state": "Delhi",
    "pincode": "110001",
    "phone": "9999999999"
  },
  "created_at": ISODate
}
```

### `voice_logs` collection
```json
{
  "_id": ObjectId,
  "user_id": "uuid-string",
  "command": "show kurta under 500",
  "intent": "search_products",
  "parsed_params": { "category": "kurta", "price_max": 500 },
  "success": true,
  "confidence": 0.85,
  "parser_used": "rule",
  "created_at": ISODate
}
```

---

## 9. Intent Parser — Complete Reference

### 9.1 Supported Intents

| Intent | Trigger Examples |
|---|---|
| `search_products` | "show kurta", "find shoes under 2000", "blue jeans" |
| `add_to_cart` | "add to cart", "add Nike shoes to cart", "put this in cart" |
| `remove_from_cart` | "remove from cart", "delete Nike from cart" |
| `open_cart` | "open cart", "show my cart", "view basket" |
| `checkout` | "checkout", "place order", "buy now", "pay" |
| `next_page` | "next page", "next results", "next" |
| `previous_page` | "previous page", "go back", "prev" |
| `product_details` | "details of Nike Air Max", "tell me about the watch" |

---

### 9.2 Rule-Based Parser Logic

The parser processes rules **in strict priority order**. The first matching rule wins:

```
Priority 1: CHECKOUT
  Pattern: checkout|check out|place order|buy now|purchase|pay
  → Returns immediately with confidence 0.95

Priority 2: ADD TO CART (shorthand)
  Pattern: ^(add|put) (it )?(to|in|into) (my )?(cart|basket)$
  → Returns add_to_cart, no product_name, confidence 0.95

Priority 3: ADD TO CART (with product name)
  Pattern: (add|put) [optional this/that/it] PRODUCT (to|in|into) (my) (cart|basket)
  → Extracts product_name from PRODUCT group
  → confidence 0.9

Priority 4: REMOVE FROM CART (shorthand)
  Pattern: ^(remove|delete|take out|take it out) (from )?(my )?(cart|basket)$
  → Returns remove_from_cart, no product_name, confidence 0.95

Priority 5: REMOVE FROM CART (with product name)
  Pattern: (remove|delete|take out) [the] PRODUCT (from )?(my) (cart|basket)
  → Extracts product_name

Priority 6: OPEN CART
  Pattern: (open|show|view|see|display) ... (cart|basket)
  Pattern: my (cart|basket) [without add/remove keywords]

Priority 7: PAGINATION
  Pattern: next/forward page|results → next_page
  Pattern: previous/prev page|go back  → previous_page

Priority 8: PRODUCT DETAILS
  Pattern: detail(s)?|more info|tell me about|show me about PRODUCT
  → Extracts product_name

Priority 9 (default): SEARCH PRODUCTS
  → Always matches as fallback
  → Extracts: price_max, price_min, price range, color, category, query
  → Confidence starts at 0.60, increases with each extraction:
       +0.10 for price_max
       +0.10 for price_min
       +0.10 for color
       +0.15 for category
```

#### Category Detection

The parser has a hardcoded `CATEGORIES` list sorted by length (longest first to prevent partial matches):

```python
CATEGORIES = [
  "electronics", "fashion", "footwear", "watches", "bags", "sports",
  "beauty", "books", "home", "gaming", "clothing", "accessories",
  "polos", "undershirts", "shirts", "shoes", "sneakers", "headphones",
  "earbuds", "keyboard", "mouse", "laptop", "phone", "camera",
  "jeans", "jacket", "t-shirt", "hoodie", "backpack", "wallet",
  "sunglasses", "watch", "yoga", "dumbbell",
  # Indian clothing
  "kurta", "kurti", "saree", "sari", "lehenga", "dupatta",
  "salwar", "kameez", "sherwani", "dhoti", "churidar", "anarkali",
  "ethnic", "traditional", "palazzo", "bandgala", "nehru jacket", "pathani",
]
```

Detection uses `re.search(rf"\b{re.escape(cat)}s?\b", cmd)` — matches singular and plural.

#### Color Detection

```python
COLORS = [
  "red", "blue", "green", "black", "white", "grey", "gray", "pink",
  "yellow", "orange", "purple", "brown", "navy", "beige", "maroon",
  "teal", "gold", "silver", "cream", "olive", "wine", "coral",
]
```

#### Query Cleaning

After extracting structured fields, the parser cleans the query text:
1. Removes command prefixes: `show me`, `find me`, `search for`, `look for`, `I want to buy`, `get me`
2. Removes price constraint phrases: `under 500`, `above 1000`
3. Removes filler words: `some`, `any`, `the`, `a`, `an`, `please`
4. Collapses multiple spaces

---

### 9.3 Groq LLM Fallback

When rule-based confidence < 0.70:

- Model: `llama-3.1-8b-instant` (fast, cheap, accurate for structured extraction)
- Temperature: `0.1` (low → deterministic, consistent output)
- Response format: JSON object (forced via `response_format={"type": "json_object"}`)
- Prompt instructs the model to output **only** JSON with supported intent fields

**System prompt tells the model:**
- All 8 supported intent names
- What fields to extract per intent
- Example JSON format

**Failure handling:** If Groq API call fails (no key, network error, parse error) → falls back to rule-based result with confidence bumped to 0.5.

---

### 9.4 Confidence Scoring

| Score | Meaning |
|---|---|
| 0.95 | Highly specific match (checkout, add to cart shorthand) |
| 0.90 | Clear pattern with product name |
| 0.85 | Clear pattern without product name / Groq result |
| 0.80 | Search with category or price |
| 0.70 | **Threshold** — below this, Groq is invoked |
| 0.60 | Base score for search_products (before enrichment) |

---

### 9.5 Worked Examples

| Voice Input | Parser Used | Intent | Extracted Fields |
|---|---|---|---|
| `"checkout"` | rule | `checkout` | — |
| `"add to cart"` | rule | `add_to_cart` | product_name=None |
| `"add Nike shoes to cart"` | rule | `add_to_cart` | product_name="Nike shoes" |
| `"remove from cart"` | rule | `remove_from_cart` | product_name=None |
| `"remove Nike from cart"` | rule | `remove_from_cart` | product_name="Nike" |
| `"show kurta"` | rule | `search_products` | category="kurta", query="kurta" |
| `"show kurta under 500"` | rule | `search_products` | category="kurta", price_max=500.0, query="kurta" |
| `"blue shoes under 2000"` | rule | `search_products` | color="blue", category="shoes", price_max=2000 |
| `"open my cart"` | rule | `open_cart` | — |
| `"next page"` | rule | `next_page` | page_direction="next" |
| `"details of Fossil watch"` | rule | `product_details` | product_name="Fossil watch" |
| `"I want something for my gym routine"` | groq | `search_products` | category="sports", query="gym" |

---

## 10. Environment Variables

File: `backend/.env`  
Template: `backend/.env.example`

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URL` | ✅ | MongoDB Atlas connection string |
| `JWT_SECRET` | ✅ | Secret key for signing JWTs (use a long random string in production) |
| `JWT_EXPIRY_HOURS` | ❌ | JWT lifetime in hours (default: 24) |
| `GROQ_API_KEY` | ❌ | Groq API key for LLM fallback. Without this, rule-based only |

Get a free Groq API key at: https://console.groq.com

---

## 11. Setup & Run Instructions

### Prerequisites

- Python 3.11+
- Node.js 18+
- A MongoDB Atlas account (free tier works)
- (Optional) Groq API key

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Copy and fill in environment variables
copy .env.example .env
# Edit .env with your MONGODB_URL, JWT_SECRET, GROQ_API_KEY

# (Optional) Seed product catalog
python seed_products.py

# Start server
python -m uvicorn main:app --reload --port 8000
```

Backend runs at: http://localhost:8000  
Swagger docs at: http://localhost:8000/docs

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs at: http://localhost:5173

### Running Both Together

Open two terminals:

**Terminal 1 (backend):**
```bash
cd backend && python -m uvicorn main:app --reload --port 8000
```

**Terminal 2 (frontend):**
```bash
cd frontend && npm run dev
```

Then open: **http://localhost:5173**

---

## 12. Glossary

| Term | Meaning |
|---|---|
| **Intent** | What the user wants to do (search, add to cart, checkout, etc.) |
| **ParsedIntent** | Python dataclass holding the structured result of parsing a voice command |
| **Confidence** | Float 0–1 indicating how certain the parser is about the intent |
| **Rule-Based Parser** | Regex/keyword matching — fast, deterministic, no external calls |
| **Groq LLM** | Large Language Model via Groq API — used as fallback for ambiguous commands |
| **Dispatcher** | Maps a ParsedIntent to the appropriate backend service call |
| **visibleProductsRef** | Frontend React ref tracking the currently shown products list |
| **voiceCheckoutTrigger** | React state flag that tells CartDrawer to auto-open checkout form |
| **JWT** | JSON Web Token — stateless auth token sent in every API request header |
| **Motor** | Async MongoDB driver for Python (used with FastAPI/asyncio) |
| **Zustand** | Minimal React state management library (alternative to Redux) |
| **Web Speech API** | Browser-native API for voice recording and speech-to-text |
| **HMR** | Hot Module Replacement — Vite feature that updates the browser without full reload |
| `$text` | MongoDB full-text search operator (requires a text index) |
| `$pull` | MongoDB operator to remove elements from an array |
| `$push` | MongoDB operator to add elements to an array |
| `$inc` | MongoDB operator to increment a numeric field |

---

*Documentation generated for VANI v1.0.0 — github.com/Huntisonn/vani_v1*
