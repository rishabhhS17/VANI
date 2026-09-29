/** Intent dispatcher — routes parsed intents to services and logs commands.
 *  Faithful port of backend/services/intent_dispatcher.py. */
import type { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import type { ParsedIntent } from "./intentParser.js";
import { toDict } from "./intentParser.js";
import * as products from "../products/service.js";
import * as cart from "../cart/service.js";

function searchQueryOf(intent: ParsedIntent): string {
  return (intent.query || intent.category || intent.brand || "").trim();
}

function categoryFilter(intent: ParsedIntent, searchQuery: string): string | undefined {
  if (!intent.category) return undefined;
  if (intent.category.toLowerCase() === searchQuery.toLowerCase()) return undefined;
  return intent.category;
}

export interface DispatchResult {
  action: string;
  message: string;
  data: unknown;
  intent: Record<string, unknown>;
  success: boolean;
  search_query?: string;
}

export async function dispatchIntent(
  intent: ParsedIntent,
  userId: string,
  command = "",
): Promise<DispatchResult> {
  let success = true;
  let responseData: Omit<DispatchResult, "intent" | "success"> = {
    action: "unknown",
    message: "",
    data: null,
  };

  try {
    switch (intent.intent) {
      case "search_products": {
        const searchQuery = searchQueryOf(intent);
        const result = await products.searchProducts({
          query: searchQuery,
          category: categoryFilter(intent, searchQuery),
          color: intent.color ?? undefined,
          price_min: intent.price_min ?? undefined,
          price_max: intent.price_max ?? undefined,
          page: 1,
          limit: 50,
        });
        const label = searchQuery || intent.color || "products";
        responseData = {
          action: "search_products",
          message: `Found ${result.total} ${label}`,
          data: result,
          search_query: searchQuery,
        };
        break;
      }

      case "add_to_cart": {
        if (intent.product_name) {
          const found = await products.searchProducts({
            query: intent.product_name,
            page: 1,
            limit: 1,
          });
          if (found.products.length > 0) {
            const product = found.products[0]!;
            const updated = await cart.addToCart(userId, product.id, intent.quantity ?? 1);
            responseData = {
              action: "add_to_cart",
              message: `Added ${product.name} to cart`,
              data: updated,
            };
          } else {
            success = false;
            responseData = {
              action: "add_to_cart",
              message: `Could not find product: ${intent.product_name}`,
              data: null,
            };
          }
        } else {
          responseData = {
            action: "add_first_visible",
            message: "Adding first shown product to cart",
            data: null,
          };
        }
        break;
      }

      case "remove_from_cart": {
        const current = await cart.getCart(userId);
        if (intent.product_name) {
          const match = current.items.find((i) =>
            i.name.toLowerCase().includes(intent.product_name!.toLowerCase()),
          );
          if (match) {
            const updated = await cart.removeFromCart(userId, match.product_id);
            responseData = {
              action: "remove_from_cart",
              message: `Removed ${match.name} from cart`,
              data: updated,
            };
          } else {
            success = false;
            responseData = {
              action: "remove_from_cart",
              message: `Could not find '${intent.product_name}' in your cart`,
              data: null,
            };
          }
        } else if (current.items.length > 0) {
          const last = current.items[current.items.length - 1]!;
          const updated = await cart.removeFromCart(userId, last.product_id);
          responseData = {
            action: "remove_from_cart",
            message: `Removed ${last.name} from cart`,
            data: updated,
          };
        } else {
          success = false;
          responseData = {
            action: "remove_from_cart",
            message: "Your cart is already empty",
            data: null,
          };
        }
        break;
      }

      case "open_cart": {
        const c = await cart.getCart(userId);
        responseData = {
          action: "open_cart",
          message: `Your cart has ${c.item_count} items`,
          data: c,
        };
        break;
      }

      case "checkout": {
        const c = await cart.getCart(userId);
        responseData = {
          action: "checkout",
          message: "Opening checkout. Please confirm your shipping address.",
          data: c,
        };
        break;
      }

      case "next_page":
        responseData = {
          action: "next_page",
          message: "Showing next page",
          data: { direction: "next" },
        };
        break;

      case "previous_page":
        responseData = {
          action: "previous_page",
          message: "Showing previous page",
          data: { direction: "previous" },
        };
        break;

      case "product_details": {
        if (intent.product_name) {
          const found = await products.searchProducts({
            query: intent.product_name,
            page: 1,
            limit: 1,
          });
          if (found.products.length > 0) {
            const product = found.products[0]!;
            responseData = {
              action: "product_details",
              message: `Showing details for ${product.name}`,
              data: product,
            };
          } else {
            success = false;
            responseData = {
              action: "product_details",
              message: `Could not find product: ${intent.product_name}`,
              data: null,
            };
          }
        } else {
          responseData = {
            action: "product_details",
            message: "Please specify which product",
            data: null,
          };
        }
        break;
      }

      default:
        success = false;
        responseData = {
          action: "unknown",
          message:
            "I didn't understand that command. Try saying 'show me shoes under 50'.",
          data: null,
        };
    }
  } catch (e) {
    success = false;
    responseData = {
      action: intent.intent,
      message: `An error occurred: ${(e as Error).message}`,
      data: null,
    };
  }

  // Log the voice command for analytics.
  await prisma.voiceLog.create({
    data: {
      userId,
      command: command || intent.query || "",
      intent: intent.intent,
      parsedParams: toDict(intent) as Prisma.InputJsonValue,
      success,
      confidence: intent.confidence,
      parserUsed: intent.parser_used,
    },
  });

  return {
    ...responseData,
    intent: toDict(intent),
    success,
  };
}
