# VANI API — Node (Fastify + Prisma + Postgres)

TypeScript port of the FastAPI/MongoDB backend. Built to run **alongside** the
Python `backend/` until validated end-to-end, then replace it. HTTP contract is
byte-compatible with the existing React frontend (`frontend/src/api/client.ts`).

## Stack
- **Fastify 5** (HTTP), **Prisma 5** (ORM), **Postgres 16**
- **Zod** validation, **argon2** password hashing, **jsonwebtoken** (HS256)
- **groq-sdk** for the LLM parser fallback, **pino** logging (Fastify built-in)

## Prerequisites
- Node 20+ and pnpm
- Docker (for local Postgres) — or any Postgres reachable via `DATABASE_URL`

## Setup

```bash
cd backend-node
cp .env.example .env          # then set JWT_SECRET (required) and GROQ_API_KEY (optional)
pnpm install
docker compose up -d          # Postgres on host port 5439
pnpm prisma migrate deploy    # create tables + full-text search migration
pnpm seed                     # load 728 products from ../frontend/src/data/products.json
pnpm dev                      # http://localhost:8001
```

`.env` must define `DATABASE_URL` and `JWT_SECRET` — the app **fails fast** at
boot if either is missing (no insecure fallback, unlike the Python version).

## Scripts
| Command | Purpose |
|---|---|
| `pnpm dev` | Watch-mode server on `:8001` |
| `pnpm start` | Run server once |
| `pnpm build` | Typecheck (`tsc --noEmit`) |
| `pnpm test` | Vitest — parser golden test + API integration tests |
| `pnpm prisma:migrate` | Create/apply a dev migration |
| `pnpm seed` | Seed products |

## What changed vs. the Python backend (fixes folded in)
- **Atomic checkout** — order creation + cart clear run in one `prisma.$transaction`.
- **Idempotency** — `POST /api/orders` honors an `Idempotency-Key` header.
- **Fail-fast config** — no hard-coded JWT secret default.
- **Groq timeout** — 2s `AbortController`; falls back to the rule parser.
- **Rate limiting** — 30 req/min per user on `/api/voice/command`.
- **Real health check** — `/api/health` pings Postgres (503 if down).
- **Search** — Postgres `tsvector` full-text with ILIKE/trigram fallback (replaces Mongo `$text` + regex scan).

## Pointing the frontend here
Set the frontend env and run it:
```bash
# frontend/.env.local
VITE_API_BASE_URL=http://localhost:8001/api
```
Users must re-register (fresh DB — no data migrated from MongoDB).

## Layout
```
prisma/schema.prisma        models (JSONB for product sub-docs)
prisma/migrations/          init + product_search_vector (tsvector/pg_trgm)
prisma/seed.ts              product seeder
src/app.ts                  Fastify factory: CORS, { detail } error handler, routes
src/env.ts                  fail-fast env validation
src/lib/serialize.ts        DTO mappers -> exact wire shapes (contract parity)
src/auth/                   jwt, password (argon2), guard
src/modules/{auth,products,cart,orders,voice}/
```
