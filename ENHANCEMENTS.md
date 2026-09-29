# VANI — Enhancements

High-value features and improvements identified for VANI, ranked by **value × fit**
with the current stack (Node/Fastify + Postgres + Groq LLM + React/Web Speech API).
These are forward-looking; the core FastAPI→Node/Postgres migration is already done.

---

## Tier 1 — Signature features (biggest value)

### 1. Semantic search with `pgvector` + embeddings
**What:** Add a `pgvector` column to `products`, embed each product (name + about +
category) and the user's spoken query, and rank by vector similarity instead of
only keyword/full-text matching.
**Why it matters:** Turns the parser from "match keywords" into "understand
meaning." Queries like *"something to wear to a beach wedding"* or *"a gift for my
dad who likes tech"* start returning relevant products — impossible with the
current `tsvector`/ILIKE search.
**Fit:** Nearly free now that we're on Postgres — `pgvector` is a Postgres
extension, and Groq/an embeddings model produces the vectors. This is the flagship
upgrade.
**Effort:** M · **Verify:** curated query set returns semantically correct results
that keyword search misses.

### 2. Multi-turn conversational context
**What:** Keep a short per-session context (last query, last result set, last
product) so follow-up commands resolve against it.
**Why it matters:** Real voice shopping is a conversation:
*"show me shoes"* → *"only the blue ones"* → *"under 50"* → *"add the second one."*
Today every command is stateless (`parseIntent` takes a single string), which is
the biggest UX gap.
**Fit:** Extends the existing parser/dispatcher; context can live in the session or
a lightweight store.
**Effort:** M · **Verify:** a scripted multi-turn dialogue narrows results
correctly across turns.

### 3. Spoken responses (TTS) — close the hands-free loop
**What:** Speak every action's `message` back to the user via the browser
`speechSynthesis` API ("Found 12 blue shoes under $50", "Added Nike Air to cart").
**Why it matters:** The backend already returns a `message` on every action; today
it's only shown, not spoken. This is the difference between "voice input" and
"true hands-free," for a tiny amount of code.
**Fit:** Frontend-only; the data is already there.
**Effort:** S · **Verify:** each command produces an audible, correct spoken reply.

---

## Tier 2 — Differentiators

### 4. Multilingual / Hindi voice
**What:** Support Hindi and regional-language commands (e.g. *"mujhe neeli shirt
dikhao"*) — Web Speech API supports Hindi STT and Groq handles multilingual intent.
**Why it matters:** The catalog is already India-focused (kurta, saree, lehenga,
sherwani exist in the parser's categories). Almost no demo targets this market —
strong differentiator and interview talking point.
**Effort:** M · **Verify:** Hindi commands map to the same intents as their English
equivalents.

### 5. Accessibility as the headline use case
**What:** Position and polish VANI as assistive commerce for visually-impaired
users — full keyboard/voice navigation, TTS (feature #3), ARIA labels, focus
management.
**Why it matters:** A voice-first + TTS store is genuinely valuable for low-vision
users. This reframes the project from "cool voice toy" to "assistive commerce,"
which is far more compelling.
**Effort:** S–M · **Verify:** full purchase flow completable with voice + screen
reader, no mouse.

---

## Tier 3 — Data & catalog quality

### 6. Take ownership of product images (mirror off Amazon)
**What:** The 728 products currently **hotlink** images from `m.media-amazon.com`.
Download them once and re-host on Cloudinary (or S3 + CDN), then rewrite the URLs.
**Why it matters:** Hotlinked images can 403/break, rotate, or raise ToS issues in
production. Cloudinary also gives free resize/WebP/lazy-loading.
**Effort:** S · **Verify:** all image URLs point at your CDN; no external Amazon
dependency remains.

### 7. Backfill missing product descriptions with the LLM
**What:** 457 of 728 products have a blank `description` (but a rich `about`).
Batch-generate short descriptions with Groq from `name + brand + category + about`.
**Why it matters:** Fills a real catalog gap using infrastructure you already have;
also improves search relevance (description feeds search).
**Effort:** S · **Verify:** zero blank descriptions; spot-check a sample for quality.

---

## Tier 4 — Smaller adds (breadth)

- **Voice reorder** — *"order what I bought last time"* (order history already exists).
- **Voice wishlist / favorites.**
- **Admin analytics dashboard** — every command is already logged to `voice_logs`;
  surface trends, success rate, and top intents.
- **Inventory / stock** — add a `stock` column with transactional decrement on
  order (now safe to do thanks to the Postgres transaction added during migration).

---

## Suggested order of attack

1. **#3 TTS** — smallest change, transforms the feel.
2. **#1 Semantic search** — flagship feature; rides the Postgres migration already done.
3. **#2 Multi-turn context** — makes both of the above feel intelligent.
4. **#6/#7 image + description** — quick catalog-quality wins, good demo polish.
5. **#4/#5 multilingual + accessibility** — positioning and market differentiation.
