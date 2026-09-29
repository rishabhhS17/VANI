# VANI — Node + Postgres Migration Plan

End-to-end plan for rewriting the FastAPI/MongoDB backend as Node/TypeScript on Postgres, while keeping the existing React frontend and its API contract unchanged.

---

## 1. Decision summary

| Question | Answer | One-line why |
|---|---|---|
| Move backend to Node? | Yes (user decision) | Unify language with the React/TS frontend |
| Move Mongo → Postgres? | **Yes** | Type-safe schema, native transactions (fixes atomic-order bug), native full-text search, real FKs — while the rewrite cost is already being paid |
| Keep document flexibility? | Yes, via **JSONB columns** | `rating_distribution`, `customer_reviews`, `all_images` stay schema-less |
| Framework | **Fastify** (default) or NestJS | Fast + TS-native validation; NestJS if you want structure |
| ORM | **Prisma** | Generated types, migrations, easy `$transaction` |
| Validation | **Zod** | Pydantic replacement, infers TS types |

**Hard constraint:** the JSON response shapes must stay byte-compatible with `frontend/src/api/client.ts` so the frontend needs zero changes. Keep field names exactly (`originalPrice`, `item_count`, `total_pages`, `parser_used`, etc.).

---

## 2. Proposed Postgres schema (Prisma)

```prisma
model User {
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  passwordHash String   @map("password_hash")
  createdAt    DateTime @default(now()) @map("created_at")
  cart         Cart?
  orders       Order[]
  voiceLogs    VoiceLog[]
  @@map("users")
}

model Product {
  id                 String   @id            // keep the existing string id
  name               String
  brand              String
  category           String
  image              String
  allImages          Json     @map("all_images")          // JSONB
  rating             Float
  reviews            Int
  price              Float
  originalPrice      Float?   @map("original_price")
  about              String   @default("")
  description        String   @default("")
  ratingDistribution Json     @map("rating_distribution")  // JSONB
  customerReviews    Json     @map("customer_reviews")     // JSONB
  cartItems          CartItem[]
  orderItems         OrderItem[]
  @@index([category])
  @@index([brand])
  @@index([price])
  @@map("products")
}

model Cart {
  id        String     @id @default(uuid())
  userId    String     @unique @map("user_id")
  user      User       @relation(fields: [userId], references: [id])
  items     CartItem[]
  updatedAt DateTime   @updatedAt @map("updated_at")
  @@map("carts")
}

model CartItem {
  id        String  @id @default(uuid())
  cartId    String  @map("cart_id")
  cart      Cart    @relation(fields: [cartId], references: [id], onDelete: Cascade)
  productId String  @map("product_id")
  product   Product @relation(fields: [productId], references: [id])
  quantity  Int
  @@unique([cartId, productId])   // replaces the "increment if exists" logic
  @@map("cart_items")
}

model Order {
  id              String      @id @default(uuid())
  userId          String      @map("user_id")
  user            User        @relation(fields: [userId], references: [id])
  total           Float
  status          String      @default("confirmed")
  shippingAddress Json        @map("shipping_address")  // JSONB
  items           OrderItem[]
  createdAt       DateTime    @default(now()) @map("created_at")
  @@index([userId])
  @@map("orders")
}

model OrderItem {
  id        String  @id @default(uuid())
  orderId   String  @map("order_id")
  order     Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId String  @map("product_id")
  product   Product @relation(fields: [productId], references: [id])
  name      String  // snapshot at purchase time
  price     Float   // snapshot
  quantity  Int
  image     String  // snapshot
  @@map("order_items")
}

model VoiceLog {
  id           String   @id @default(uuid())
  userId       String   @map("user_id")
  user         User     @relation(fields: [userId], references: [id])
  command      String
  intent       String
  parsedParams Json     @map("parsed_params")  // JSONB
  success      Boolean
  confidence   Float
  parserUsed   String   @map("parser_used")
  createdAt    DateTime @default(now()) @map("created_at")
  @@index([userId])
  @@index([createdAt])
  @@map("voice_logs")
}
```

**Design notes**
- Orders/cart normalized into item tables → real FKs, but order items keep the **snapshot columns** (name/price/image) so history is immutable — same behavior as today's denormalized Mongo doc.
- Semi-structured product fields (`all_images`, `rating_distribution`, `customer_reviews`) stay JSONB — no join explosion, keeps Mongo-like flexibility.
- Add a generated `tsvector` column for search (see §4).

---

## 3. Module mapping (Python → Node)

| Python file | Node equivalent | Notes |
|---|---|---|
| `main.py` | `src/app.ts` (Fastify instance) | CORS via `@fastify/cors`; lifespan → Fastify hooks |
| `database/connection.py` | `src/db.ts` (Prisma client singleton) | indexes handled by migrations, not startup code |
| `utils/jwt_handler.py` | `src/auth/jwt.ts` | `jsonwebtoken`; **fail fast if `JWT_SECRET` unset** (fix, don't port the default) |
| `utils/password_utils.py` | `src/auth/password.ts` | `argon2` (or bcrypt for parity) |
| `middleware/auth_middleware.py` | `src/auth/guard.ts` | Fastify `preHandler` hook |
| `services/auth_service.py` | `src/modules/auth/*` | — |
| `services/product_service.py` | `src/modules/products/*` | search → Postgres FTS (§4) |
| `services/cart_service.py` | `src/modules/cart/*` | `@@unique([cartId, productId])` replaces manual increment branch |
| `services/order_service.py` | `src/modules/orders/*` | **wrap in `prisma.$transaction`** (fix) |
| `services/intent_parser.py` | `src/modules/voice/intentParser.ts` | port regex (§5) |
| `services/intent_dispatcher.py` | `src/modules/voice/dispatcher.ts` | — |
| `routes/*` | `src/modules/*/routes.ts` | keep exact paths under `/api` |
| `schemas/*` (Pydantic) | `src/**/schema.ts` (Zod) | infer request/response types |
| `seed_products.py` | `prisma/seed.ts` | read the same products.json |

---

## 4. Search: replace `$text` + regex with Postgres FTS

Current Mongo search tries a text index then falls back to a multi-field regex collection scan (`product_service.py:119-165`). In Postgres:

```sql
ALTER TABLE products ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(name,'') || ' ' || coalesce(brand,'') || ' ' ||
      coalesce(category,'') || ' ' || coalesce(about,''))
  ) STORED;
CREATE INDEX products_search_idx ON products USING GIN (search_vector);
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- typo tolerance for the fallback
```

- Primary: `WHERE search_vector @@ websearch_to_tsquery('english', $1)` ranked by `ts_rank`.
- Fallback (typos / partial): `pg_trgm` similarity on `name`/`brand`.
- Color filter (currently regex over name/about/description) → `ILIKE '%color%'` or add color to the tsvector.
- This is strictly better than the current regex scan and needs no extra infra.

---

## 5. Porting the rule-based parser (the risky part)

The regex parser (`intent_parser.py:68-202`) is the one place a naive port introduces bugs. Watch:

- Python `re.escape()` → write a small JS `escapeRegex()` helper; JS has no built-in.
- `\b` word boundaries behave the same in JS `RegExp` for ASCII — fine here.
- Python `re.search(pattern, cmd)` (case handled via `.lower()`) → use `new RegExp(pattern, 'i')` or lowercase first as the Python does.
- The category loop sorts by length desc to prefer `t-shirt` over `shirt` — preserve that ordering.
- **De-risk with a golden test:** run the existing `backend/tests/test_intent_parser.py` cases through both implementations and assert identical `ParsedIntent` output before deleting the Python version.

---

## 6. Improvements to fold in during the rewrite (don't port the bugs)

Ranked; these are cheaper to fix now than to port and fix later.

1. **Fail fast on missing `JWT_SECRET`** (was: insecure hard-coded fallback, `jwt_handler.py:14`). Throw at boot if unset.
2. **Atomic order creation** — `prisma.$transaction([createOrder, clearCart])`. Add an idempotency key on `POST /api/orders`.
3. **Groq timeout** — wrap the LLM call in a 2s `AbortController`; fall back to rules on timeout (was: no timeout, `intent_parser.py:267`).
4. **Rate-limit `/api/voice/command`** — `@fastify/rate-limit`, per-user; the endpoint spends money on Groq.
5. **Auth hardening** — httpOnly+SameSite cookie or short-lived access + refresh token instead of `localStorage` (`client.ts:16`). This is the one change that touches the frontend.
6. **Structured logging + error tracking** — `pino` (built into Fastify) + Sentry; make `/api/health` actually query the DB (was: static, `main.py:75`).
7. **Real test coverage** on auth/cart/order money paths (Vitest + Supertest) — currently only the parser is tested.
8. **Add inventory/stock** (optional, product decision) — a `stock` column + transactional decrement on order; now trivial with Postgres transactions, was impossible to do safely without them.
9. **Shared types package** — a `packages/shared` with Zod schemas imported by both API and frontend, so the contract can't drift.
10. **Retire `frontend/src/data/products.json`** from the frontend source once `prisma/seed.ts` reads it from a backend/asset location.

---

## 7. Suggested repo shape (monorepo)

```
vani/
  apps/
    api/        # Fastify + Prisma + Zod (TypeScript)
    web/        # existing React/Vite app (mostly unchanged)
  packages/
    shared/     # Zod schemas + inferred types shared FE/BE
  prisma/       # schema.prisma, migrations, seed.ts
```
pnpm workspaces or Turborepo. The frontend moves under `apps/web` with only `client.ts` base-URL and (if you adopt #5) auth-cookie changes.

---

## 8. Migration sequence (suggested)

1. Stand up Postgres locally + `schema.prisma` + first migration.
2. `prisma/seed.ts` — load the 728 products (verify count + a spot-check product matches).
3. Auth module (register/login/me) + JWT guard → get one protected route green.
4. Products module + FTS → verify search parity against a few known queries.
5. Cart + Orders modules **with the transaction fix** → integration tests.
6. Voice module: port parser (golden test vs Python), dispatcher, analytics aggregation (Prisma `groupBy`).
7. Swap frontend `VITE_API_BASE_URL`; smoke-test every screen.
8. Fold in improvements #3, #4, #6; then #5 (touches frontend) last.
9. Delete the Python backend once parity + tests are green.

---

## 9. What does NOT change

- The React frontend UI and flows (Web Speech API STT stays in the browser).
- The public API surface (`/api/...` paths and JSON shapes) — must stay identical.
- The hybrid-parser *concept* (rule tier → Groq fallback at confidence < 0.7).
- Render deployment model (swap the API service runtime python → node; add a managed Postgres, e.g. Render Postgres or Neon/Supabase).
