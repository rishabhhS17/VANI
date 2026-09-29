-- Full-text search support for products (not modeled by Prisma).
-- Generated tsvector column + GIN index, plus pg_trgm for typo/partial fallback.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "products" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce("name", '') || ' ' ||
      coalesce("brand", '') || ' ' ||
      coalesce("category", '') || ' ' ||
      coalesce("about", ''))
  ) STORED;

CREATE INDEX "products_search_idx" ON "products" USING GIN ("search_vector");

-- Trigram indexes to speed up the ILIKE fallback on the tiny catalog.
CREATE INDEX "products_name_trgm_idx" ON "products" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "products_brand_trgm_idx" ON "products" USING GIN ("brand" gin_trgm_ops);
