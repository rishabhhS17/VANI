/** Product routes — /api/products. Mirrors backend/routes/product_routes.py. */
import type { FastifyInstance } from "fastify";
import { listQuerySchema, searchQuerySchema } from "./schema.js";
import {
  getProducts,
  getProductById,
  getCategories,
  searchProducts,
} from "./service.js";

export async function productRoutes(app: FastifyInstance): Promise<void> {
  // Static routes first (Fastify prioritizes static over parametric anyway).
  app.get("/search", async (req) => {
    const { q, color, ...rest } = searchQuerySchema.parse(req.query);
    return searchProducts({ query: q, color, ...rest });
  });

  app.get("/categories", async () => getCategories());

  app.get("/:productId", async (req) => {
    const { productId } = req.params as { productId: string };
    return getProductById(productId);
  });

  app.get("/", async (req) => {
    const query = listQuerySchema.parse(req.query);
    return getProducts(query);
  });
}
