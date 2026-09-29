/**
 * Product service — list/filter, full-text search, detail, categories.
 * Mirrors services/product_service.py. Search uses the Postgres tsvector
 * `search_vector` column (created via raw migration) with an ILIKE fallback.
 */
import type { Prisma, Product } from "@prisma/client";
import { prisma } from "../../db.js";
import { notFound } from "../../lib/errors.js";
import { toProductWire, type ProductWire } from "../../lib/serialize.js";

export interface ProductListResult {
  products: ProductWire[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

function totalPages(total: number, limit: number): number {
  return total > 0 ? Math.ceil(total / limit) : 0;
}

function orderByFor(sortBy?: string): Prisma.ProductOrderByWithRelationInput {
  switch (sortBy) {
    case "price_asc":
      return { price: "asc" };
    case "price_desc":
      return { price: "desc" };
    case "rating":
      return { rating: "desc" };
    case "reviews":
      return { reviews: "desc" };
    default:
      return { createdAt: "desc" }; // "newest" / default
  }
}

export async function getProducts(q: {
  page: number;
  limit: number;
  category?: string;
  brand?: string;
  price_min?: number;
  price_max?: number;
  rating_min?: number;
  sort_by?: string;
}): Promise<ProductListResult> {
  const where: Prisma.ProductWhereInput = {};
  if (q.category)
    where.category = { contains: q.category, mode: "insensitive" };
  if (q.brand) where.brand = { contains: q.brand, mode: "insensitive" };
  if (q.price_min != null || q.price_max != null) {
    where.price = {};
    if (q.price_min != null) where.price.gte = q.price_min;
    if (q.price_max != null) where.price.lte = q.price_max;
  }
  if (q.rating_min != null) where.rating = { gte: q.rating_min };

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: orderByFor(q.sort_by),
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
  ]);

  return {
    products: rows.map(toProductWire),
    total,
    page: q.page,
    limit: q.limit,
    total_pages: totalPages(total, q.limit),
  };
}

export async function getProductById(id: string): Promise<ProductWire> {
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) throw notFound(`Product not found: ${id}`);
  return toProductWire(p);
}

export async function getCategories(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ category: string }[]>`
    SELECT DISTINCT category FROM products ORDER BY category ASC
  `;
  return rows.map((r) => r.category);
}

// ── Search ──────────────────────────────────────────────────────────────────

// Select list aliased to Prisma camelCase so rows feed toProductWire directly.
const PRODUCT_COLS = `
  id, name, brand, category, image,
  all_images        AS "allImages",
  rating, reviews, price,
  original_price     AS "originalPrice",
  about, description,
  rating_distribution AS "ratingDistribution",
  customer_reviews    AS "customerReviews",
  created_at          AS "createdAt"
`;

function buildFilterClauses(
  opts: {
    category?: string;
    color?: string;
    price_min?: number;
    price_max?: number;
    rating_min?: number;
  },
  params: unknown[],
): string[] {
  const clauses: string[] = [];
  if (opts.category) {
    params.push(opts.category);
    clauses.push(`category ILIKE '%' || $${params.length} || '%'`);
  }
  if (opts.color) {
    params.push(opts.color);
    const i = params.length;
    clauses.push(
      `(name ILIKE '%'||$${i}||'%' OR about ILIKE '%'||$${i}||'%' OR description ILIKE '%'||$${i}||'%')`,
    );
  }
  if (opts.price_min != null) {
    params.push(opts.price_min);
    clauses.push(`price >= $${params.length}`);
  }
  if (opts.price_max != null) {
    params.push(opts.price_max);
    clauses.push(`price <= $${params.length}`);
  }
  if (opts.rating_min != null) {
    params.push(opts.rating_min);
    clauses.push(`rating >= $${params.length}`);
  }
  return clauses;
}

function sortSql(sortBy: string | undefined, rankExpr: string): string {
  switch (sortBy) {
    case "price_asc":
      return "price ASC";
    case "price_desc":
      return "price DESC";
    case "rating":
      return "rating DESC";
    case "reviews":
      return "reviews DESC";
    default:
      return rankExpr;
  }
}

export async function searchProducts(q: {
  query: string;
  category?: string;
  color?: string;
  price_min?: number;
  price_max?: number;
  rating_min?: number;
  page: number;
  limit: number;
  sort_by?: string;
}): Promise<ProductListResult> {
  const skip = (q.page - 1) * q.limit;

  // ── Primary: full-text search on the generated tsvector column ──
  {
    const params: unknown[] = [q.query];
    const clauses = [
      `search_vector @@ websearch_to_tsquery('english', $1)`,
      ...buildFilterClauses(q, params),
    ];
    const where = clauses.join(" AND ");
    const order = sortSql(
      q.sort_by,
      `ts_rank(search_vector, websearch_to_tsquery('english', $1)) DESC`,
    );

    const countRows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*)::bigint AS count FROM products WHERE ${where}`,
      ...params,
    );
    const total = Number(countRows[0]?.count ?? 0);

    if (total > 0) {
      const rows = await prisma.$queryRawUnsafe<Product[]>(
        `SELECT ${PRODUCT_COLS} FROM products WHERE ${where} ORDER BY ${order} LIMIT ${q.limit} OFFSET ${skip}`,
        ...params,
      );
      return {
        products: rows.map(toProductWire),
        total,
        page: q.page,
        limit: q.limit,
        total_pages: totalPages(total, q.limit),
      };
    }
  }

  // ── Fallback: ILIKE across multiple fields (typo/partial tolerance) ──
  const params: unknown[] = [q.query];
  const i = 1;
  const textClause = `(name ILIKE '%'||$${i}||'%' OR brand ILIKE '%'||$${i}||'%' OR category ILIKE '%'||$${i}||'%' OR about ILIKE '%'||$${i}||'%' OR description ILIKE '%'||$${i}||'%')`;
  const clauses = [textClause, ...buildFilterClauses(q, params)];
  const where = clauses.join(" AND ");
  const order = sortSql(q.sort_by, "rating DESC");

  const countRows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS count FROM products WHERE ${where}`,
    ...params,
  );
  const total = Number(countRows[0]?.count ?? 0);

  const rows =
    total > 0
      ? await prisma.$queryRawUnsafe<Product[]>(
          `SELECT ${PRODUCT_COLS} FROM products WHERE ${where} ORDER BY ${order} LIMIT ${q.limit} OFFSET ${skip}`,
          ...params,
        )
      : [];

  return {
    products: rows.map(toProductWire),
    total,
    page: q.page,
    limit: q.limit,
    total_pages: totalPages(total, q.limit),
  };
}
