# VANI — Voice Assisted Navigation for Intelligent Commerce

A voice-first e-commerce app. Speak a natural-language command ("show me blue shoes
under 50", "add to cart", "checkout") and VANI understands it, finds products, manages
your cart, and completes your order — hands-free.

## How it works

Speech is transcribed to text in the browser, sent to the API, and run through a
**hybrid intent parser**: a fast rule-based tier handles common commands, and only
low-confidence input (below a 0.7 threshold) is escalated to a Groq LLM. The parsed
intent is dispatched to the right service (search, cart, order, navigation) and every
command is logged for analytics.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        BROWSER  (React + Vite SPA)                        │
│                                                                          │
│   ┌────────────┐   Web Speech API    ┌──────────────────────────────┐    │
│   │ Microphone │ ──────────────────► │   Voice Input Component      │    │
│   └────────────┘   (speech → text)   └───────────────┬──────────────┘    │
│                                                       │ command text      │
│   ┌───────────────────────────────────────────────── ▼ ───────────────┐  │
│   │                     App.tsx  (Single-Page App)                     │  │
│   │   ProductGrid │ SearchResults │ ProductDetail │ CartDrawer │ Order │  │
│   └────────────────────────────┬───────────────────────────────────────┘  │
│                                 │  API Client (client.ts)                  │
└─────────────────────────────────┼─────────────────────────────────────────┘
                                  │  HTTPS / REST  (Bearer JWT)
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     API  (Node.js + Fastify + TypeScript)                 │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                 app.ts  →  CORS + { detail } error handler          │ │
│  └──────┬─────────┬──────────┬───────────┬──────────────┬──────────────┘ │
│    /auth│ /products│   /cart │  /orders  │   /voice     │                │
│         ▼         ▼          ▼           ▼              ▼                 │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │        Route handlers  →  Zod validation  →  requireAuth (JWT)      │ │
│  └────────────────────────────┬───────────────────────────────────────┘ │
│                                ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                          Service / module layer                     │ │
│  │  auth (argon2+JWT) │ products (full-text search) │ cart            │ │
│  │  orders (atomic tx + idempotency) │ intent parser │ dispatcher     │ │
│  └───────────────┬──────────────────────────────────┬─────────────────┘ │
│                  │  Prisma ORM                       │ hybrid parse      │
│                  ▼                                    ▼                   │
│  ┌───────────────────────────────────┐   rules → (confidence < 0.7)     │
│  │        PostgreSQL  (Prisma)        │            │                     │
│  │  users │ products (JSONB) │ carts  │            ▼                     │
│  │  cart_items │ orders │ order_items │   ┌────────────────────┐         │
│  │  voice_logs │ tsvector + pg_trgm   │   │   Groq Cloud LLM   │         │
│  └───────────────────────────────────┘   │  llama-3.1-8b (opt)│         │
│                                           └────────────────────┘         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Request lifecycle (voice command):** the browser transcribes speech and POSTs the
text with a Bearer JWT → Fastify validates the body with Zod and authenticates via the
`requireAuth` guard → the hybrid parser runs the rule tier first and only calls Groq
when confidence is below 0.7 → the dispatcher routes the parsed intent to the matching
service (search, cart, order, navigation), which reads or writes through Prisma → a
structured action plus data is returned as JSON, and the command is logged to
`voice_logs` for analytics.

- **Layered backend:** routes → services → Prisma. JWT auth guards protected routes.
- **Data:** relational tables for users/cart/orders; product sub-documents (images,
  reviews, rating breakdown) stored as JSONB. Orders keep a price snapshot and are
  created atomically in a transaction.
- **Search:** Postgres `tsvector` full-text with a trigram fallback.

> The backend was migrated from FastAPI + MongoDB to Node + Postgres. See
> `docs/NODE_MIGRATION_PLAN.md` and `docs/ARCHITECTURE_WALKTHROUGH.md` for details,
> and `ENHANCEMENTS.md` for the planned roadmap.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Web Speech API |
| Backend | Node.js, Fastify, TypeScript |
| Database | PostgreSQL, Prisma ORM, tsvector + pg_trgm search |
| Auth | JWT, argon2 |
| AI / NLU | Groq LLM (Llama 3.1) with rule-based fallback |
| Infra | Docker, Render |

## Local setup

**Prerequisites:** Node 20+, pnpm, Docker.

### 1. Backend (`backend-node/`)

```bash
cd backend-node
cp .env.example .env          # set JWT_SECRET (required); GROQ_API_KEY optional
pnpm install
docker compose up -d          # Postgres on host port 5439
pnpm prisma migrate deploy    # create tables + search indexes
pnpm seed                     # load 728 products
pnpm dev                      # API on http://localhost:8001
```

`DATABASE_URL` and `JWT_SECRET` are required — the server fails fast if either is
missing. Run tests with `pnpm test`.

### 2. Frontend (`frontend/`)

```bash
cd frontend
echo "VITE_API_BASE_URL=http://localhost:8001/api" > .env.local
pnpm install
pnpm dev                      # app on http://localhost:5173
```

Open the app, register an account, and start giving voice commands. Use a
Chromium-based browser for Web Speech API support.

## Project structure

```
backend-node/   Node + Fastify + Prisma API (current backend)
frontend/       React + Vite single-page app
docs/           architecture walkthrough + migration plan
backend/        legacy FastAPI backend (being retired)
```
