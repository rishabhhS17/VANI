/**
 * Seed products into Postgres from frontend/src/data/products.json.
 * Idempotent: clears the products table then re-inserts. Mirrors seed_products.py.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const PRODUCTS_PATH = fileURLToPath(
  new URL("../../frontend/src/data/products.json", import.meta.url),
);

interface RawProduct {
  id?: string;
  name?: string;
  brand?: string;
  category?: string;
  image?: string;
  all_images?: string[];
  rating?: number;
  reviews?: number;
  price?: number;
  originalPrice?: number | null;
  about?: string;
  description?: string;
  rating_distribution?: Record<string, unknown>;
  customer_reviews?: unknown[];
}

async function main(): Promise<void> {
  const raw = JSON.parse(readFileSync(PRODUCTS_PATH, "utf-8")) as RawProduct[];
  console.log(`Loaded ${raw.length} products from ${PRODUCTS_PATH}`);

  const data: Prisma.ProductCreateManyInput[] = raw.map((p) => ({
    id: p.id ?? "",
    name: p.name ?? "",
    brand: p.brand ?? "",
    category: p.category ?? "",
    image: p.image ?? "",
    allImages: (p.all_images ?? []) as Prisma.InputJsonValue,
    rating: Number(p.rating ?? 0),
    reviews: Number(p.reviews ?? 0),
    price: Number(p.price ?? 0),
    originalPrice: p.originalPrice != null ? Number(p.originalPrice) : null,
    about: p.about ?? "",
    description: p.description ?? "",
    ratingDistribution: (p.rating_distribution ?? {}) as Prisma.InputJsonValue,
    customerReviews: (p.customer_reviews ?? []) as Prisma.InputJsonValue,
  }));

  const deleted = await prisma.product.deleteMany({});
  console.log(`Cleared ${deleted.count} existing products`);

  const result = await prisma.product.createMany({ data });
  console.log(`Inserted ${result.count} products`);

  const categories = await prisma.product.findMany({
    distinct: ["category"],
    select: { category: true },
  });
  console.log(`Categories: ${categories.length}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
