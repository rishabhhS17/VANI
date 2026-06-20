import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, Mic, Bell, MapPin, ChevronRight, ChevronLeft,
  Heart, ShoppingCart, Star, Plus, Minus, X, User,
  SlidersHorizontal, Volume2, Trash2, Check, Package,
  Tag, Filter, Sun, Moon, Facebook, Twitter, Linkedin, Instagram,
  Mail, Phone, MapPin as LocationIcon, ArrowRight, Truck, Shield, RotateCcw,
} from "lucide-react";
import { create } from "zustand";
import { productsApi, cartApi, voiceApi, authApi, ordersApi } from "../api/client";
import { BGPattern } from "./components/ui/bg-pattern";
import { Loader } from "./components/ui/loader";

// ─── Dark Mode Context ────────────────────────────────────────────────────────

const DarkCtx = createContext(false);
const useDark = () => useContext(DarkCtx);

// Theme helper — returns light or dark value
const th = (light: string, dark: string) => ({ light, dark });

// ─── Palette ──────────────────────────────────────────────────────────────────
// Cream #FFFCF2 | Linen #CCC5B9 | Charcoal #403D39
// Near Black #252422 | Vivid Orange #EB5E28

const P = {
  forest: "#1f1816ff",
  teal: "#8A7968",
  emerald: "#E6D5B8",
  sage: "#F9F6F0",
  frost: "#FFFFFF",
};

// Semantic tokens
const T = {
  pageBg: th("transparent", "transparent"),
  navBg: th("rgba(249, 246, 240, 0.8)", "rgba(43, 32, 29, 0.8)"),
  navBorder: th("transparent", "transparent"),
  cardBg: th("rgba(255, 255, 255, 0.6)", "rgba(138, 121, 104, 0.1)"),
  cardBorder: th("rgba(255, 255, 255, 0.4)", "rgba(138, 121, 104, 0.15)"),
  mutedBg: th("rgba(138, 121, 104, 0.1)", "rgba(138, 121, 104, 0.2)"),
  inputBg: th("rgba(255, 255, 255, 0.6)", "rgba(138, 121, 104, 0.15)"),
  inputBorder: th("transparent", "transparent"),
  hoverBg: th("rgba(138, 121, 104, 0.15)", "rgba(138, 121, 104, 0.25)"),
  textPrimary: th("#2B201D", "#F9F6F0"),
  textSecond: th("#8A7968", "#E6D5B8"),
  textMuted: th("#8A7968", "rgba(230, 213, 184, 0.6)"),
  border: th("rgba(138, 121, 104, 0.15)", "rgba(138, 121, 104, 0.25)"),
  accent: th("#2B201D", "#E6D5B8"),
  accentText: th("#F9F6F0", "#2B201D"),
  emerald: th("#8A7968", "#E6D5B8"),
  btnBg: th("#2B201D", "#E6D5B8"),
  btnText: th("#F9F6F0", "#2B201D"),
  greenBtn: th("#8A7968", "rgba(138, 121, 104, 0.3)"),
  greenText: th("#FFFFFF", "#E6D5B8"),
  dockBg: th("rgba(249, 246, 240, 0.85)", "rgba(43, 32, 29, 0.85)"),
  dockBorder: th("transparent", "transparent"),
};

function tv(token: { light: string; dark: string }, dark: boolean) {
  return dark ? token.dark : token.light;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string; name: string; brand: string; price: number;
  originalPrice?: number; image: string; rating: number;
  reviews: number; category: string; description: string;
  badge?: string;
}
interface CartItem extends Product { quantity: number; }

interface AuthUser {
  id: string; name: string; email: string;
}

function mapCartItem(item: Record<string, unknown>): CartItem {
  const id = String(item.product_id ?? item.id ?? "");
  return {
    id,
    name: String(item.name ?? ""),
    brand: String(item.brand ?? ""),
    price: Number(item.price ?? 0),
    originalPrice: item.originalPrice != null ? Number(item.originalPrice) : undefined,
    image: String(item.image ?? ""),
    rating: Number(item.rating ?? 0),
    reviews: Number(item.reviews ?? 0),
    category: String(item.category ?? ""),
    description: String(item.description ?? ""),
    quantity: Number(item.quantity ?? 1),
  };
}

function mapCartItems(items: unknown[]): CartItem[] {
  return (items || []).map((item) => mapCartItem(item as Record<string, unknown>));
}

function normalizeProduct(p: Record<string, unknown>): Product {
  return {
    id: String(p.id ?? p._id ?? ""),
    name: String(p.name ?? ""),
    brand: String(p.brand ?? ""),
    price: Number(p.price ?? 0),
    originalPrice: p.originalPrice != null ? Number(p.originalPrice) : undefined,
    image: String(p.image ?? ""),
    rating: Number(p.rating ?? 0),
    reviews: Number(p.reviews ?? 0),
    category: String(p.category ?? ""),
    description: String(p.description || p.about || ""),
    badge: p.badge ? String(p.badge) : undefined,
  };
}

interface AuthStore {
  user: AuthUser | null;
  authModalOpen: boolean;
  authMode: "login" | "register";
  authError: string;
  pendingProduct: Product | null;
  init: () => Promise<void>;
  openAuth: (mode?: "login" | "register", pendingProduct?: Product | null) => void;
  closeAuth: () => void;
  setAuthMode: (mode: "login" | "register") => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: () => boolean;
}

const useAuth = create<AuthStore>((set, get) => ({
  user: null,
  authModalOpen: false,
  authMode: "login",
  authError: "",
  pendingProduct: null,
  init: async () => {
    const stored = authApi.getUser();
    if (!stored || !authApi.isAuthenticated()) return;
    try {
      const profile = await authApi.getProfile();
      set({ user: profile });
    } catch {
      authApi.logout();
      set({ user: null });
    }
  },
  openAuth: (mode = "login", pendingProduct = null) => {
    set({ authModalOpen: true, authMode: mode, authError: "", pendingProduct });
  },
  closeAuth: () => set({ authModalOpen: false, authError: "", pendingProduct: null }),
  setAuthMode: (mode) => set({ authMode: mode, authError: "" }),
  login: async (email, password) => {
    const data = await authApi.login(email, password);
    set({ user: data.user, authModalOpen: false, authError: "" });
    const pending = get().pendingProduct;
    set({ pendingProduct: null });
    await useCart.getState().fetchCart();
    if (pending) await useCart.getState().addItem(pending);
  },
  register: async (name, email, password) => {
    const data = await authApi.register(name, email, password);
    set({ user: data.user, authModalOpen: false, authError: "" });
    const pending = get().pendingProduct;
    set({ pendingProduct: null });
    await useCart.getState().fetchCart();
    if (pending) await useCart.getState().addItem(pending);
  },
  logout: () => {
    authApi.logout();
    set({ user: null });
    useCart.getState().clearCart();
  },
  isAuthenticated: () => !!get().user && authApi.isAuthenticated(),
}));

interface CartStore {
  items: CartItem[]; wishlist: string[];
  addItem: (p: Product) => Promise<boolean>;
  removeItem: (id: string) => Promise<void>;
  updateQty: (id: string, qty: number) => Promise<void>;
  toggleWishlist: (id: string) => void;
  total: () => number; count: () => number;
  fetchCart: () => Promise<void>;
  clearCart: () => void;
}

const useCart = create<CartStore>((set, get) => ({
  items: [], wishlist: [],
  addItem: async (product) => {
    if (!useAuth.getState().isAuthenticated()) {
      useAuth.getState().openAuth("login", product);
      return false;
    }
    try {
      const data = await cartApi.addItem(product.id, 1);
      set({ items: mapCartItems(data.items || []) });
      return true;
    } catch (e) {
      console.error("Cart add error", e);
      return false;
    }
  },
  removeItem: async (id) => {
    if (!useAuth.getState().isAuthenticated()) return;
    try {
      const data = await cartApi.removeItem(id);
      set({ items: mapCartItems(data.items || []) });
    } catch (e) {
      console.error("Cart remove error", e);
    }
  },
  updateQty: async (id, qty) => {
    if (!useAuth.getState().isAuthenticated()) return;
    try {
      const data = await cartApi.updateQuantity(id, qty);
      set({ items: mapCartItems(data.items || []) });
    } catch (e) {
      console.error("Cart update error", e);
    }
  },
  toggleWishlist: (id) => set((s) => ({
    wishlist: s.wishlist.includes(id) ? s.wishlist.filter((w) => w !== id) : [...s.wishlist, id],
  })),
  total: () => get().items.reduce((s, i) => s + i.price * i.quantity, 0),
  count: () => get().items.reduce((s, i) => s + i.quantity, 0),
  fetchCart: async () => {
    if (!useAuth.getState().isAuthenticated()) {
      set({ items: [] });
      return;
    }
    try {
      const data = await cartApi.get();
      set({ items: mapCartItems(data.items || []) });
    } catch (e) {
      console.error("Cart fetch error", e);
    }
  },
  clearCart: () => set({ items: [] }),
}));


interface ProductStore {
  allProducts: Product[];
  heroProducts: Product[];
  recommendedProducts: Product[];
  recentlyViewed: Product[];
  trendingProducts: Product[];
  bestSellers: Product[];
  fetchProducts: () => Promise<void>;
}

const useProductStore = create<ProductStore>((set) => ({
  allProducts: [], heroProducts: [], recommendedProducts: [],
  recentlyViewed: [], trendingProducts: [], bestSellers: [],
  fetchProducts: async () => {
    try {
      const data = await productsApi.list({ limit: 100 });
      let products = (data.products || data.items || data).map((p: Record<string, unknown>) => normalizeProduct(p));
      products = products.sort(() => 0.5 - Math.random());
      set({
        allProducts: products,
        heroProducts: products.slice(0, 3),
        recommendedProducts: products.slice(3, 9),
        recentlyViewed: products.slice(9, 15),
        trendingProducts: products.slice(15, 21),
        bestSellers: products.slice(21, 27),
      });
    } catch (e) { console.error("Products fetch error", e); }
  }
}));


// ─── Mock Data ────────────────────────────────────────────────────────────────

const heroProducts: Product[] = [
  {
    id: "h1", name: "Premium Headphones", brand: "Sony", price: 2499, originalPrice: 3999,
    image: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080",
    rating: 4.8, reviews: 2341, category: "Electronics", description: "Block out the noise. Enjoy the music.", badge: "Best Seller"
  },
  {
    id: "h2", name: "Nike Air Max Excee", brand: "Nike", price: 1999, originalPrice: 2799,
    image: "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080",
    rating: 4.6, reviews: 1892, category: "Footwear", description: "Comfort you with everyday wear.", badge: "New Arrival"
  },
  {
    id: "h3", name: "Fossil Chronograph", brand: "Fossil", price: 7495, originalPrice: 9999,
    image: "https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080",
    rating: 4.9, reviews: 876, category: "Watches", description: "Ceramic design. Precision timekeeping.", badge: "Premium"
  },
];

const recommendedProducts: Product[] = [
  {
    id: "r1", name: "Hoodie Sweatshirt", brand: "Zara", price: 1750, originalPrice: 2499,
    image: "https://images.unsplash.com/photo-1620799140188-3b2a02fd9a77?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080",
    rating: 4.3, reviews: 542, category: "Clothing", description: "Soft-touch fleece hoodie"
  },
  {
    id: "r2", name: "Laptop Backpack", brand: "Samsonite", price: 1299, originalPrice: 1999,
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080",
    rating: 4.5, reviews: 1230, category: "Bags", description: "15.6\" slim fit carry"
  },
  {
    id: "r3", name: "Canvas Sneakers", brand: "Converse", price: 1299, originalPrice: 1799,
    image: "https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080",
    rating: 4.4, reviews: 3201, category: "Footwear", description: "Classic low-top streetwear"
  },
  {
    id: "r4", name: "Slim Fit Jeans", brand: "Levi's", price: 1499, originalPrice: 2199,
    image: "https://images.unsplash.com/photo-1631112230741-446762ee05ac?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080",
    rating: 4.2, reviews: 4572, category: "Clothing", description: "511 slim tapered fit denim"
  },
  {
    id: "r5", name: "Oversize T-Shirt", brand: "H&M", price: 699, originalPrice: 999,
    image: "https://images.unsplash.com/photo-1571455786673-9d9d6c194f90?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080",
    rating: 4.1, reviews: 2890, category: "Clothing", description: "100% cotton relaxed fit"
  },
  {
    id: "r6", name: "Smart Watch", brand: "Apple", price: 32999, originalPrice: 41900,
    image: "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080",
    rating: 4.9, reviews: 18430, category: "Electronics", description: "Health, fitness & connectivity"
  },
];

const recentlyViewed: Product[] = [
  { ...heroProducts[0], id: "rv1" },
  { ...recommendedProducts[2], id: "rv2" },
  { ...heroProducts[2], id: "rv3" },
  { ...recommendedProducts[4], id: "rv4" },
  { ...recommendedProducts[1], id: "rv5" },
  { ...heroProducts[1], id: "rv6" },
];

const trendingProducts: Product[] = [
  {
    id: "t1", name: "Mechanical Keyboard", brand: "Keychron", price: 8999, originalPrice: 11999,
    image: "https://images.unsplash.com/photo-1595225476474-87563907a212?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080",
    rating: 4.8, reviews: 1542, category: "Electronics", description: "Wireless mechanical keyboard"
  },
  {
    id: "t2", name: "Aviator Sunglasses", brand: "Ray-Ban", price: 5499, originalPrice: 7999,
    image: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080",
    rating: 4.6, reviews: 310, category: "Fashion", description: "Classic aviator style"
  },
  {
    id: "t3", name: "Yoga Mat", brand: "Lululemon", price: 2999, originalPrice: 3499,
    image: "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080",
    rating: 4.9, reviews: 892, category: "Sports", description: "Non-slip exercise mat"
  },
  {
    id: "t4", name: "Wireless Mouse", brand: "Logitech", price: 1999, originalPrice: 2499,
    image: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080",
    rating: 4.5, reviews: 4120, category: "Electronics", description: "Ergonomic wireless mouse"
  },
  {
    id: "t5", name: "Denim Jacket", brand: "Levi's", price: 3499, originalPrice: 4999,
    image: "https://images.unsplash.com/photo-1495105787522-5334e3ffa0ef?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080",
    rating: 4.4, reviews: 654, category: "Clothing", description: "Classic trucker jacket"
  },
  {
    id: "t6", name: "Running Shoes", brand: "Adidas", price: 4999, originalPrice: 6999,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080",
    rating: 4.7, reviews: 11200, category: "Footwear", description: "Lightweight running sneakers"
  },
];

const bestSellers: Product[] = [
  {
    id: "b1", name: "Noise Cancelling Earbuds", brand: "Bose", price: 18999, originalPrice: 22999,
    image: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080",
    rating: 4.9, reviews: 8432, category: "Electronics", description: "QuietComfort Earbuds"
  },
  {
    id: "b2", name: "Leather Wallet", brand: "Tommy Hilfiger", price: 1299, originalPrice: 2499,
    image: "https://images.unsplash.com/photo-1627123424574-724758594e93?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080",
    rating: 4.5, reviews: 1243, category: "Accessories", description: "Genuine leather bi-fold"
  },
  {
    id: "b3", name: "Coffee Maker", brand: "Nespresso", price: 12499, originalPrice: 15999,
    image: "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080",
    rating: 4.7, reviews: 4521, category: "Home", description: "Espresso machine with frother"
  },
  {
    id: "b4", name: "Skincare Set", brand: "The Ordinary", price: 2199, originalPrice: 2999,
    image: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080",
    rating: 4.6, reviews: 8901, category: "Beauty", description: "Daily skincare routine kit"
  },
  {
    id: "b5", name: "Dumbbell Set", brand: "Bowflex", price: 14999, originalPrice: 18999,
    image: "https://images.unsplash.com/photo-1586401700864-42b71946f32e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080",
    rating: 4.8, reviews: 3120, category: "Sports", description: "Adjustable dumbbells"
  },
  {
    id: "b6", name: "Graphic T-Shirt", brand: "Vans", price: 1199, originalPrice: 1599,
    image: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080",
    rating: 4.3, reviews: 1560, category: "Clothing", description: "Classic logo print tee"
  },
];



// ─── Category Geometric Icons ─────────────────────────────────────────────────

const CatIcon = ({ id, color }: { id: string; color: string }) => {
  const s = { stroke: color, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const icons: Record<string, JSX.Element> = {
    c1: ( // Electronics — concentric arcs + dot (signal/chip)
      <svg viewBox="0 0 32 32" width="28" height="28">
        <circle cx="16" cy="16" r="3" fill={color} />
        <path d="M10 16 a6 6 0 0 1 12 0" {...s} strokeWidth="2" />
        <path d="M6 16 a10 10 0 0 1 20 0" {...s} strokeWidth="1.5" />
        <line x1="16" y1="5" x2="16" y2="8" {...s} strokeWidth="2" />
        <line x1="16" y1="24" x2="16" y2="27" {...s} strokeWidth="2" />
      </svg>
    ),
    c2: ( // Fashion — diamond with inner lines (fabric/crystal)
      <svg viewBox="0 0 32 32" width="28" height="28">
        <polygon points="16,4 28,16 16,28 4,16" {...s} strokeWidth="1.8" />
        <polygon points="16,9 23,16 16,23 9,16" {...s} strokeWidth="1.4" />
        <line x1="16" y1="4" x2="16" y2="28" {...s} strokeWidth="1" strokeOpacity="0.4" />
        <line x1="4" y1="16" x2="28" y2="16" {...s} strokeWidth="1" strokeOpacity="0.4" />
      </svg>
    ),
    c3: ( // Footwear — angled parallel lines + curve (motion/sole)
      <svg viewBox="0 0 32 32" width="28" height="28">
        <path d="M4 22 Q10 10 20 10 L28 14" {...s} strokeWidth="2.2" />
        <line x1="7" y1="25" x2="25" y2="25" {...s} strokeWidth="2" />
        <line x1="12" y1="14" x2="9" y2="22" {...s} strokeWidth="1.4" strokeOpacity="0.5" />
        <line x1="17" y1="12" x2="14" y2="22" {...s} strokeWidth="1.4" strokeOpacity="0.5" />
        <line x1="22" y1="12" x2="19" y2="22" {...s} strokeWidth="1.4" strokeOpacity="0.5" />
      </svg>
    ),
    c4: ( // Watches — circle + tick marks + hands
      <svg viewBox="0 0 32 32" width="28" height="28">
        <circle cx="16" cy="16" r="10" {...s} strokeWidth="1.8" />
        <rect x="13" y="4" width="6" height="3" rx="1" {...s} strokeWidth="1.4" />
        <rect x="13" y="25" width="6" height="3" rx="1" {...s} strokeWidth="1.4" />
        <line x1="16" y1="16" x2="16" y2="10" {...s} strokeWidth="2" />
        <line x1="16" y1="16" x2="21" y2="18" {...s} strokeWidth="1.6" />
        <circle cx="16" cy="16" r="1.2" fill={color} />
      </svg>
    ),
    c5: ( // Bags — trapezoid body + handle arc
      <svg viewBox="0 0 32 32" width="28" height="28">
        <path d="M10 13 L8 26 L24 26 L22 13 Z" {...s} strokeWidth="1.8" />
        <path d="M12 13 Q12 7 20 7 Q20 7 20 13" {...s} strokeWidth="1.8" />
        <line x1="8" y1="18" x2="24" y2="18" {...s} strokeWidth="1.2" strokeOpacity="0.5" />
      </svg>
    ),
    c6: ( // Sports — hexagon + inner triangle (energy/motion)
      <svg viewBox="0 0 32 32" width="28" height="28">
        <polygon points="16,4 27,10 27,22 16,28 5,22 5,10" {...s} strokeWidth="1.8" />
        <polygon points="16,11 22,19 10,19" {...s} strokeWidth="1.5" />
      </svg>
    ),
    c7: ( // Beauty — nested circles + cross lines (symmetry/bloom)
      <svg viewBox="0 0 32 32" width="28" height="28">
        <circle cx="16" cy="16" r="10" {...s} strokeWidth="1.8" />
        <circle cx="16" cy="16" r="4" {...s} strokeWidth="1.4" />
        <line x1="16" y1="6" x2="16" y2="12" {...s} strokeWidth="1.4" strokeOpacity="0.6" />
        <line x1="16" y1="20" x2="16" y2="26" {...s} strokeWidth="1.4" strokeOpacity="0.6" />
        <line x1="6" y1="16" x2="12" y2="16" {...s} strokeWidth="1.4" strokeOpacity="0.6" />
        <line x1="20" y1="16" x2="26" y2="16" {...s} strokeWidth="1.4" strokeOpacity="0.6" />
      </svg>
    ),
    c8: ( // Books — stacked rectangles offset (pages)
      <svg viewBox="0 0 32 32" width="28" height="28">
        <rect x="7" y="8" width="16" height="20" rx="2" {...s} strokeWidth="1.8" />
        <rect x="10" y="5" width="16" height="20" rx="2" {...s} strokeWidth="1.4" strokeOpacity="0.5" />
        <line x1="10" y1="14" x2="20" y2="14" {...s} strokeWidth="1.3" strokeOpacity="0.6" />
        <line x1="10" y1="18" x2="20" y2="18" {...s} strokeWidth="1.3" strokeOpacity="0.6" />
        <line x1="10" y1="22" x2="16" y2="22" {...s} strokeWidth="1.3" strokeOpacity="0.6" />
      </svg>
    ),
    c9: ( // Home — triangle roof + square body + door rect
      <svg viewBox="0 0 32 32" width="28" height="28">
        <polygon points="16,5 28,16 4,16" {...s} strokeWidth="1.8" />
        <rect x="8" y="16" width="16" height="12" rx="1" {...s} strokeWidth="1.8" />
        <rect x="13" y="21" width="6" height="7" rx="1" {...s} strokeWidth="1.4" />
      </svg>
    ),
    c10: ( // Gaming — plus/cross shape with circles at ends
      <svg viewBox="0 0 32 32" width="28" height="28">
        <rect x="12" y="6" width="8" height="20" rx="4" {...s} strokeWidth="1.8" />
        <rect x="6" y="12" width="20" height="8" rx="4" {...s} strokeWidth="1.8" />
        <circle cx="22" cy="14" r="1.5" fill={color} />
        <circle cx="22" cy="18" r="1.5" fill={color} />
        <circle cx="10" cy="16" r="1.5" fill={color} />
        <circle cx="16" cy="8" r="1.5" fill={color} />
      </svg>
    ),
  };
  return icons[id] ?? null;
};

// ─── Categories Data ──────────────────────────────────────────────────────────

const categories = [
  { id: "c1", label: "Electronics", color: "#F3F4F6", darkColor: "#1A1A1A", iconColor: "#101010" },
  { id: "c2", label: "Fashion", color: "#F3F4F6", darkColor: "#1A1A1A", iconColor: "#101010" },
  { id: "c3", label: "Footwear", color: "#F3F4F6", darkColor: "#1A1A1A", iconColor: "#101010" },
  { id: "c4", label: "Watches", color: "#F3F4F6", darkColor: "#1A1A1A", iconColor: "#101010" },
  { id: "c5", label: "Bags", color: "#F3F4F6", darkColor: "#1A1A1A", iconColor: "#101010" },
  { id: "c6", label: "Sports", color: "#F3F4F6", darkColor: "#1A1A1A", iconColor: "#101010" },
  { id: "c7", label: "Beauty", color: "#F3F4F6", darkColor: "#1A1A1A", iconColor: "#101010" },
  { id: "c8", label: "Books", color: "#F3F4F6", darkColor: "#1A1A1A", iconColor: "#101010" },
  { id: "c9", label: "Home", color: "#F3F4F6", darkColor: "#1A1A1A", iconColor: "#101010" },
  { id: "c10", label: "Gaming", color: "#F3F4F6", darkColor: "#1A1A1A", iconColor: "#101010" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => "₹" + n.toLocaleString("en-IN");

const Stars = ({ rating }: { rating: number }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => (
      <Star key={s} size={11}
        style={s <= Math.round(rating)
          ? { fill: P.teal, color: P.teal }
          : { fill: "#EAEAEA", color: "#EAEAEA" }} />
    ))}
  </div>
);

// ─── Search Suggestions Dropdown ──────────────────────────────────────────────

function SearchSuggestions({
  query, suggestions, dark, onSuggestionClick, onAddToCart, allProducts
}: {
  query: string; suggestions: Product[]; dark: boolean;
  onSuggestionClick: (p: Product) => void; onAddToCart: (p: Product) => void; allProducts: Product[];
}) {
  if (query.trim() === "" || suggestions.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}
      className="absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-2xl z-50 overflow-hidden transition-colors duration-300"
      style={{ background: tv(T.navBg, dark), border: `1px solid ${tv(T.cardBorder, dark)}` }}>

      <div className="max-h-[380px] overflow-y-auto p-2 space-y-1">
        {suggestions.map((p) => (
          <div key={p.id}
            onClick={() => onSuggestionClick(p)}
            className="w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors duration-200 text-left cursor-pointer hover:opacity-80"
            style={{ background: tv(T.hoverBg, dark) }}>

            <img src={p.image} alt={p.name}
              className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />

            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold transition-colors duration-300"
                style={{ color: tv(T.textPrimary, dark) }}>{p.name}</div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] transition-colors duration-300"
                  style={{ color: tv(T.textSecond, dark) }}>{p.brand}</span>
                <span className="text-[10px] transition-colors duration-300"
                  style={{ color: tv(T.textMuted, dark) }}>{p.category}</span>
              </div>
              <div className="text-xs font-bold mt-0.5 transition-colors duration-300"
                style={{ color: P.teal }}>{fmt(p.price)}</div>
            </div>

            <button onClick={(e) => { e.stopPropagation(); onAddToCart(p); }}
              className="w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0"
              style={{ background: tv(T.btnBg, dark), color: tv(T.btnText, dark) }}>
              <Plus size={12} />
            </button>
          </div>
        ))}
      </div>

      <div className="px-3 py-2.5 text-[11px] font-medium transition-colors duration-300 text-center"
        style={{ borderTop: `1px solid ${tv(T.border, dark)}`, color: tv(T.textMuted, dark) }}>
        Press <span className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-[10px]">Enter</span> to see all results
      </div>
    </motion.div>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar({
  onLocationOpen, onNotifOpen, onVoiceClick, onToggleDark,
  search, onSearchChange, onSearchSubmit, suggestions,
  currentPage, onNavigate, onHomeClick,
  user, onSignIn, onSignUp, onLogout, onOrders,
  onAddToCart, onProductClick,
}: {
  onLocationOpen: () => void; onNotifOpen: () => void;
  onVoiceClick: () => void; onToggleDark: () => void;
  search: string; onSearchChange: (val: string) => void;
  onSearchSubmit: () => void; suggestions: Product[];
  currentPage: string; onNavigate: (page: string) => void; onHomeClick: () => void;
  user: AuthUser | null;
  onSignIn: () => void; onSignUp: () => void; onLogout: () => void; onOrders: () => void;
  onAddToCart: (p: Product) => void; onProductClick: (p: Product) => void;
}) {
  const dark = useDark();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSearchSubmit();
    }
  };

  return (
    <div className="sticky top-0 z-50 pt-4 px-4 md:px-6 w-full">
      <header
        className="max-w-[1400px] mx-auto h-[72px] flex items-center justify-between px-6 rounded-2xl backdrop-blur-2xl transition-colors duration-300 shadow-sm border"
        style={{ background: dark ? "rgba(43, 32, 29, 0.6)" : "rgba(249, 246, 240, 0.6)", borderColor: tv(T.border, dark) }}
      >
        <div className="max-w-[1400px] w-full h-full flex items-center justify-between">
          {/* Logo */}
          <button onClick={onHomeClick} className="flex-shrink-0 flex flex-col leading-none justify-center text-left">
            <span
              className="text-[30px] font-medium tracking-wide"
              style={{
                fontFamily: "'LEMON MILK', 'Lemon Milk Pro', sans-serif",
                color: tv(T.textPrimary, dark),
              }}
            >
              V A N I
            </span>
            {/* slogan removed per design request */}
          </button>

          {/* Links (Hidden on mobile) */}
          <div className="hidden lg:flex items-center gap-6 px-6 ml-4">
            {["home", "categories", "deals", "about"].map((page) => (
              <button key={page} onClick={() => onNavigate(page)} className="text-sm font-semibold transition-colors capitalize hover:opacity-70" style={{ color: currentPage === page ? "#EB5E28" : tv(T.textPrimary, dark) }}>{page}</button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 max-w-2xl mx-auto relative px-8">
            <div className="relative flex items-center rounded-full border transition-colors duration-300"
              style={{ background: tv(T.inputBg, dark), borderColor: tv(T.inputBorder, dark) }}>
              <Search size={16} className="absolute left-4" style={{ color: tv(T.textSecond, dark) }} />
              <input value={search} onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="In case you wanna type..."
                className="w-full bg-transparent py-2.5 pl-10 pr-10 text-sm outline-none transition-colors duration-300"
                style={{ color: tv(T.textPrimary, dark) }} />
              <button onClick={onVoiceClick} className="absolute right-3 transition-colors duration-300"
                style={{ color: tv(T.textSecond, dark) }}>
                <Mic size={16} />
              </button>
            </div>

            {/* Suggestions Dropdown */}
            <AnimatePresence>
              <SearchSuggestions
                query={search}
                suggestions={suggestions}
                dark={dark}
                onSuggestionClick={(p) => { onSearchChange(""); onProductClick(p); }}
                onAddToCart={onAddToCart}
                allProducts={suggestions}
              />
            </AnimatePresence>
          </div>

          {/* Right */}
          <div className="flex-shrink-0 flex items-center gap-3 relative">
            <button onClick={onNotifOpen} className="relative p-2 transition-colors duration-300"
              style={{ color: tv(T.textSecond, dark) }}>
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: P.teal }} />
            </button>

            <button onClick={onLocationOpen}
              className="flex items-center gap-1.5 text-xs transition-colors duration-300 hidden sm:flex"
              style={{ color: tv(T.textPrimary, dark) }}>
              <MapPin size={14} style={{ color: P.teal }} />
              <div className="text-left">
                <div className="text-[10px] font-medium" style={{ color: tv(T.textSecond, dark) }}>Deliver to</div>
                <div className="text-xs font-semibold leading-tight">New Delhi, 110001</div>
              </div>
            </button>

            <motion.button whileTap={{ scale: 0.88, rotate: 20 }} onClick={onToggleDark}
              className="p-2 transition-colors duration-300 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: tv(T.textSecond, dark) }}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </motion.button>

            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-300 relative z-10"
                style={{ background: tv(T.btnBg, dark), color: tv(T.btnText, dark) }}>
                <User size={14} />
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-0" onClick={() => setUserMenuOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-48 rounded-2xl shadow-2xl overflow-hidden transition-colors duration-300 z-50 backdrop-blur-xl"
                      style={{ background: tv(T.navBg, dark), border: `1px solid ${tv(T.cardBorder, dark)}` }}
                    >
                      <div className="p-2 space-y-1">
                        {user ? (
                          <>
                            <div className="px-3 py-2 text-xs" style={{ color: tv(T.textSecond, dark) }}>
                              Signed in as <span className="font-semibold" style={{ color: tv(T.textPrimary, dark) }}>{user.name}</span>
                            </div>
                            <button className="w-full text-left px-3 py-2 text-xs rounded-xl transition-colors duration-200"
                              style={{ color: tv(T.textSecond, dark) }}
                              onClick={() => { setUserMenuOpen(false); onOrders(); }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = tv(T.hoverBg, dark))}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                              Orders
                            </button>
                            <button className="w-full text-left px-3 py-2.5 text-sm font-semibold rounded-xl transition-colors duration-200"
                              style={{ color: tv(T.textPrimary, dark) }}
                              onClick={() => { setUserMenuOpen(false); onLogout(); }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = tv(T.hoverBg, dark))}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                              Sign Out
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="w-full text-left px-3 py-2.5 text-sm font-semibold rounded-xl transition-colors duration-200"
                              style={{ color: tv(T.textPrimary, dark) }}
                              onClick={() => { setUserMenuOpen(false); onSignIn(); }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = tv(T.hoverBg, dark))}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                              Sign In
                            </button>
                            <button className="w-full text-left px-3 py-2.5 text-sm font-semibold rounded-xl transition-colors duration-200"
                              style={{ color: tv(T.textPrimary, dark) }}
                              onClick={() => { setUserMenuOpen(false); onSignUp(); }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = tv(T.hoverBg, dark))}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                              Sign Up
                            </button>
                          </>
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, action }: { title: string; action?: string }) {
  const dark = useDark();
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="w-1 h-4 rounded-full transition-colors duration-300"
          style={{ background: tv(T.textPrimary, dark) }} />
        <h2 className="text-base font-semibold transition-colors duration-300"
          style={{ color: tv(T.textPrimary, dark) }}>{title}</h2>
      </div>
      {action && (
        <button className="text-xs font-medium flex items-center gap-1 transition-colors duration-300"
          style={{ color: tv(T.textSecond, dark) }}>
          {action} <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}

// ─── Categories Section ───────────────────────────────────────────────────────

function CategoriesSection() {
  const dark = useDark();
  const [active, setActive] = useState<string | null>(null);

  return (
    <section className="max-w-[1400px] mx-auto px-6 pb-6">
      <SectionHeader title="Shop by Category" />
      <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {categories.map((cat, i) => {
          const isActive = active === cat.id;
          const pillBg = dark ? cat.darkColor : cat.color;
          const activeIconColor = isActive ? (dark ? cat.iconColor : "#FFFFFF") : cat.iconColor;

          return (
            <motion.button
              key={cat.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -3, scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActive(isActive ? null : cat.id)}
              className="flex-shrink-0 flex flex-col items-center gap-2.5 px-4 py-3.5 rounded-2xl transition-all duration-200 cursor-pointer"
              style={{
                background: isActive ? (dark ? "#F5F5F7" : "#111111") : tv(T.cardBg, dark),
                border: `1.5px solid ${isActive ? "transparent" : tv(T.cardBorder, dark)}`,
                boxShadow: isActive
                  ? `0 6px 20px ${cat.iconColor}55`
                  : `0 2px 8px rgba(0,0,0,0.04)`,
                minWidth: 88,
              }}
            >
              {/* Geometric icon inside tinted pill */}
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200"
                style={{ background: isActive ? (dark ? "#2C2C2E" : "rgba(255,255,255,0.15)") : pillBg }}
              >
                <CatIcon id={cat.id} color={activeIconColor} />
              </div>
              <span
                className="text-[11px] font-semibold whitespace-nowrap transition-colors duration-200"
                style={{ color: isActive ? (dark ? "#0D0D0D" : "#FFFFFF") : tv(T.textPrimary, dark) }}
              >
                {cat.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

// ─── Brand Tagline Section ────────────────────────────────────────────────────

function BrandTagline() {
  const dark = useDark();

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="max-w-7xl mx-auto px-6 py-6 md:py-10 text-center"
    >
      <div className="space-y-2 md:space-y-3">
        {/* Main Tagline */}
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className={`text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-glow-animated ${dark ? 'dark' : 'light'}`}
          style={{ fontFamily: "'Clash Display', sans-serif" }}
        >
          More than a Market Place
        </motion.h1>

        {/* Decorative Line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="h-1.5 w-24 mx-auto rounded-full"
          style={{ background: P.teal }}
        />

        {/* Slogan */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="text-lg md:text-xl font-semibold"
          style={{ color: tv(T.textPrimary, dark) }}
        >
          Say "HEY VANI" to start shopping with your voice
        </motion.p>

        {/* Subtle Description */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="text-sm md:text-base"
          style={{ color: tv(T.textSecond, dark) }}
        >
          Discover premium products, incredible deals, and seamless shopping experience
        </motion.p>
      </div>
    </motion.section>
  );
}

// ─── Hero Carousel ────────────────────────────────────────────────────────────

function HeroCarousel({ onAddToCart, onProductClick }: { onAddToCart: (p: Product) => void; onProductClick: (p: Product) => void }) {
  const { heroProducts } = useProductStore();
  const dark = useDark();
  const [current, setCurrent] = useState(0);
  const total = heroProducts.length;
  const paused = useRef(false);

  const next = useCallback(() => setCurrent((c) => (c + 1) % total), [total]);
  const prev = () => setCurrent((c) => (c - 1 + total) % total);

  useEffect(() => {
    const id = setInterval(() => { if (!paused.current) next(); }, 5500);
    return () => clearInterval(id);
  }, [next]);

  const bgColors = dark
    ? ["#1A1A1A", "#141414", "#1F1F1F"]
    : ["#F3F4F6", "#F9FAFB", "#F3F4F6"];

  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-6 pb-4">


      <div
        className="relative flex items-center justify-center"
        style={{ height: 380 }}
        onMouseEnter={() => { paused.current = true; }}
        onMouseLeave={() => { paused.current = false; }}
      >
        {heroProducts.map((product, idx) => {
          const offset = ((idx - current + total) % total + total) % total;
          const pos = offset === 0 ? 0 : offset === 1 ? 1 : -1;
          const isCenter = pos === 0;

          return (
            <motion.div
              key={product.id}
              className="absolute cursor-pointer"
              style={{ width: isCenter ? 572 : 400, originY: 0.5 }}
              animate={{
                x: pos * 390, y: 0,
                scale: isCenter ? 1 : 0.78,
                zIndex: isCenter ? 20 : 10,
                opacity: isCenter ? 1 : 0.72,
                filter: isCenter
                  ? "blur(0px) brightness(1) drop-shadow(0 20px 48px rgba(0,0,0,0.18))"
                  : `blur(0.6px) brightness(${dark ? "0.6" : "0.88"})`,
              }}
              transition={{
                x: { type: "spring", stiffness: 220, damping: 28, mass: 1.1 },
                scale: { type: "spring", stiffness: 260, damping: 30 },
                opacity: { duration: 0.38, ease: "easeOut" },
                filter: { duration: 0.38, ease: "easeOut" },
              }}
              onClick={() => {
                if (!isCenter) setCurrent(idx);
                else onProductClick(product);
              }}
            >
              <HeroCard
                product={product}
                bg={bgColors[idx % bgColors.length]}
                onAdd={() => onAddToCart(product)}
                active={isCenter}
              />
            </motion.div>
          );
        })}

        <button onClick={prev}
          className="absolute left-0 w-8 h-8 rounded-full shadow-md flex items-center justify-center transition-all z-30"
          style={{ background: tv(T.cardBg, dark), color: tv(T.textSecond, dark) }}>
          <ChevronLeft size={16} />
        </button>
        <button onClick={next}
          className="absolute right-0 w-8 h-8 rounded-full shadow-md flex items-center justify-center transition-all z-30"
          style={{ background: tv(T.cardBg, dark), color: tv(T.textSecond, dark) }}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="flex justify-center gap-1.5 mt-4">
        {heroProducts.map((_, i) => (
          <button key={i} onClick={() => setCurrent(i)}
            className="h-1.5 rounded-full transition-all"
            style={{ width: i === current ? 20 : 6, background: i === current ? P.teal : tv(T.border, dark) }} />
        ))}
      </div>
    </section>
  );
}

// ─── Hero Card ────────────────────────────────────────────────────────────────

function HeroCard({ product, bg, onAdd, active }: { product: Product; bg: string; onAdd: () => void; active: boolean }) {
  const dark = useDark();
  const [added, setAdded] = useState(false);

  const activeBg = active
    ? (dark ? "rgba(138, 121, 104, 0.95)" : "rgba(255, 255, 255, 1)")
    : tv(T.cardBg, dark);

  const handleAdd = () => { onAdd(); setAdded(true); setTimeout(() => setAdded(false), 1500); };

  return (
    <motion.div
      whileHover={active ? { y: -4 } : {}}
      transition={{ duration: 0.25 }}
      className="rounded-2xl overflow-hidden transition-colors duration-300"
      style={{ background: activeBg }}
    >
      <div className="relative flex items-center justify-center overflow-hidden" style={{ background: bg, height: 260 }}>
        {product.badge && (
          <span className="absolute top-3 left-3 z-10 text-[10px] font-semibold px-2 py-1 rounded-full shadow-sm"
            style={{ background: tv(T.cardBg, dark), color: tv(T.textPrimary, dark) }}>
            {product.badge}
          </span>
        )}
        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
      </div>
      <div className="p-4">
        <div className="text-[10px] font-medium uppercase tracking-wider mb-0.5 transition-colors duration-300"
          style={{ color: tv(T.textSecond, dark) }}>{product.brand}</div>
        <h3 className="text-sm font-semibold mb-1 transition-colors duration-300"
          style={{ color: tv(T.textPrimary, dark) }}>{product.name}</h3>
        <p className="text-[11px] mb-3 transition-colors duration-300"
          style={{ color: tv(T.textSecond, dark) }}>{product.description}</p>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-bold transition-colors duration-300"
              style={{ color: tv(T.textPrimary, dark) }}>{fmt(product.price)}</div>
            {product.originalPrice && (
              <div className="text-[11px] line-through transition-colors duration-300"
                style={{ color: tv(T.textMuted, dark) }}>{fmt(product.originalPrice)}</div>
            )}
          </div>
          <motion.button whileTap={{ scale: 0.93 }} onClick={handleAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200"
            style={{ background: added ? P.teal : tv(T.btnBg, dark), color: added ? "#fff" : tv(T.btnText, dark) }}>
            {added ? <><Check size={12} /> Added</> : "Shop Now"}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({ product, onAdd, onClick }: { product: Product; onAdd: () => void; onClick?: () => void }) {
  const dark = useDark();
  const { wishlist, toggleWishlist } = useCart();
  const isWishlisted = wishlist.includes(product.id);
  const [added, setAdded] = useState(false);

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation(); onAdd(); setAdded(true); setTimeout(() => setAdded(false), 1500);
  };

  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0;

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ y: -3, boxShadow: "0 12px 32px rgba(0,0,0,0.40)" }}
      transition={{ duration: 0.2 }}
      className="rounded-xl overflow-hidden cursor-pointer group transition-colors duration-300 backdrop-blur-lg"
      style={{ background: tv(T.cardBg, dark), border: `1px solid ${tv(T.cardBorder, dark)}` }}
    >
      <div className="relative aspect-square overflow-hidden transition-colors duration-300"
        style={{ background: tv(T.mutedBg, dark) }}>
        <img src={product.image} alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        {discount > 0 && (
          <span className="absolute top-2 left-2 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: P.teal }}>
            -{discount}%
          </span>
        )}
        <button onClick={(e) => { e.stopPropagation(); toggleWishlist(product.id); }}
          className="absolute top-2 right-2 w-7 h-7 rounded-full shadow-sm flex items-center justify-center transition-colors duration-300"
          style={{ background: tv(T.cardBg, dark) }}>
          <Heart size={13} className={isWishlisted ? "fill-red-500 text-red-500" : "text-gray-400"} />
        </button>
      </div>
      <div className="p-3">
        <div className="text-[9px] font-semibold uppercase tracking-wider mb-0.5 transition-colors duration-300"
          style={{ color: tv(T.textSecond, dark) }}>{product.brand}</div>
        <h4 className="text-[12px] font-semibold leading-tight mb-1 line-clamp-1 transition-colors duration-300"
          style={{ color: tv(T.textPrimary, dark) }}>{product.name}</h4>
        <div className="flex items-center gap-1 mb-2">
          <Stars rating={product.rating} />
          <span className="text-[9px] transition-colors duration-300"
            style={{ color: tv(T.textSecond, dark) }}>({product.reviews.toLocaleString()})</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold transition-colors duration-300"
              style={{ color: tv(T.textPrimary, dark) }}>{fmt(product.price)}</div>
            {product.originalPrice && (
              <div className="text-[10px] line-through transition-colors duration-300"
                style={{ color: tv(T.textMuted, dark) }}>{fmt(product.originalPrice)}</div>
            )}
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={handleAdd}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200"
            style={{ background: added ? P.teal : tv(T.btnBg, dark), color: added ? "#fff" : tv(T.btnText, dark) }}>
            {added ? <Check size={12} /> : <Plus size={13} />}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Recommended Section ──────────────────────────────────────────────────────

function RecommendedSection({ onAddToCart, onProductClick }: { onAddToCart: (p: Product) => void; onProductClick: (p: Product) => void }) {
  const { recommendedProducts } = useProductStore();
  return (
    <section className="max-w-[1400px] mx-auto px-6 pb-8">
      <SectionHeader title="Recommended For You" action="View all" />
      <div className="grid grid-cols-6 gap-4">
        {recommendedProducts.map((p) => (
          <ProductCard key={p.id} product={p} onAdd={() => onAddToCart(p)} onClick={() => onProductClick(p)} />
        ))}
      </div>
    </section>
  );
}

// ─── Recently Viewed ──────────────────────────────────────────────────────────

function RecentlyViewedSection({ onAddToCart, onProductClick }: { onAddToCart: (p: Product) => void; onProductClick: (p: Product) => void }) {
  const { recentlyViewed } = useProductStore();
  const dark = useDark();

  return (
    <section className="max-w-[1400px] mx-auto px-6 pb-12">
      <SectionHeader title="Recently Viewed" action="Clear" />
      <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
        {recentlyViewed.map((product, i) => (
          <motion.div key={product.id}
            onClick={() => onProductClick(product)}
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex-shrink-0 w-[180px] rounded-xl overflow-hidden cursor-pointer group transition-colors duration-300"
            style={{ background: tv(T.cardBg, dark), boxShadow: dark ? "0 2px 12px rgba(0,0,0,0.3)" : "0 2px 12px rgba(0,0,0,0.06)" }}
            whileHover={{ y: -3, boxShadow: dark ? "0 10px 28px rgba(0,0,0,0.5)" : "0 10px 28px rgba(0,0,0,0.11)" }}
          >
            <div className="relative h-[140px] overflow-hidden">
              <img src={product.image} alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-black/20 to-transparent" />
            </div>
            <div className="p-3">
              <div className="text-[9px] font-semibold uppercase tracking-wider mb-0.5 transition-colors duration-300"
                style={{ color: tv(T.textSecond, dark) }}>{product.brand}</div>
              <div className="text-xs font-semibold line-clamp-1 mb-1 transition-colors duration-300"
                style={{ color: tv(T.textPrimary, dark) }}>{product.name}</div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold transition-colors duration-300"
                  style={{ color: tv(T.textPrimary, dark) }}>{fmt(product.price)}</span>
                <motion.button whileTap={{ scale: 0.88 }} onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
                  className="w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200"
                  style={{ background: tv(T.btnBg, dark), color: tv(T.btnText, dark) }}>
                  <Plus size={11} />
                </motion.button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ─── Trending Now ─────────────────────────────────────────────────────────────

function TrendingSection({ onAddToCart, onProductClick }: { onAddToCart: (p: Product) => void; onProductClick: (p: Product) => void }) {
  const { trendingProducts } = useProductStore();
  return (
    <section className="max-w-[1400px] mx-auto px-6 pb-12">
      <SectionHeader title="Trending Now" action="Discover" />
      <div className="grid grid-cols-6 gap-4">
        {trendingProducts.map((p) => (
          <ProductCard key={p.id} product={p} onAdd={() => onAddToCart(p)} onClick={() => onProductClick(p)} />
        ))}
      </div>
    </section>
  );
}

// ─── Best Sellers ─────────────────────────────────────────────────────────────

function BestSellersSection({ onAddToCart, onProductClick }: { onAddToCart: (p: Product) => void; onProductClick: (p: Product) => void }) {
  const { bestSellers } = useProductStore();
  return (
    <section className="max-w-[1400px] mx-auto px-6 pb-12">
      <SectionHeader title="Best Sellers" action="View all" />
      <div className="grid grid-cols-6 gap-4">
        {bestSellers.map((p) => (
          <ProductCard key={p.id} product={p} onAdd={() => onAddToCart(p)} onClick={() => onProductClick(p)} />
        ))}
      </div>
    </section>
  );
}

// ─── Wishlist Drawer ────────────────────────────────────────────────────────────

function WishlistDrawer({ open, onClose, onAddToCart }: { open: boolean; onClose: () => void; onAddToCart: (p: Product) => void }) {
  const { allProducts } = useProductStore();
  const dark = useDark();
  const { wishlist, toggleWishlist } = useCart();
  const wishlistProducts = allProducts.filter((p: Product) => wishlist.includes(p.id));

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-[380px] z-50 shadow-2xl flex flex-col transition-colors duration-300"
            style={{ background: tv(T.navBg, dark) }}
          >
            <div className="flex items-center justify-between p-5 transition-colors duration-300"
              style={{ borderBottom: `1px solid ${tv(T.border, dark)}` }}>
              <div className="flex items-center gap-2">
                <Heart size={18} style={{ color: tv(T.textPrimary, dark) }} />
                <h3 className="font-semibold transition-colors duration-300" style={{ color: tv(T.textPrimary, dark) }}>
                  Your Wishlist
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: tv(T.btnBg, dark), color: tv(T.btnText, dark) }}>
                  {wishlistProducts.length}
                </span>
              </div>
              <button onClick={onClose} style={{ color: tv(T.textSecond, dark) }}><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {wishlistProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                  <Heart size={40} style={{ color: tv(T.border, dark) }} />
                  <p className="text-sm" style={{ color: tv(T.textSecond, dark) }}>Your wishlist is empty</p>
                  <button onClick={onClose} className="text-xs font-semibold" style={{ color: P.teal }}>Explore Products</button>
                </div>
              ) : (
                wishlistProducts.map((item) => (
                  <motion.div key={item.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3 p-3 rounded-xl transition-colors duration-300"
                    style={{ background: tv(T.mutedBg, dark) }}>
                    <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-wider transition-colors duration-300"
                        style={{ color: tv(T.textSecond, dark) }}>{item.brand}</div>
                      <div className="text-xs font-semibold line-clamp-1 transition-colors duration-300"
                        style={{ color: tv(T.textPrimary, dark) }}>{item.name}</div>
                      <div className="text-sm font-bold mt-0.5 transition-colors duration-300"
                        style={{ color: tv(T.textPrimary, dark) }}>{fmt(item.price)}</div>
                      <div className="flex items-center justify-between mt-1.5">
                        <button onClick={() => { onAddToCart(item); toggleWishlist(item.id); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5"
                          style={{ background: tv(T.btnBg, dark), color: tv(T.btnText, dark) }}>
                          <ShoppingCart size={11} /> Move to Cart
                        </button>
                        <button onClick={() => toggleWishlist(item.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Auth Modal ───────────────────────────────────────────────────────────────

function AuthModal() {
  const dark = useDark();
  const { authModalOpen, authMode, closeAuth, setAuthMode, login, register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authModalOpen) {
      setName("");
      setEmail("");
      setPassword("");
      setError("");
    }
  }, [authModalOpen, authMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (authMode === "login") {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {authModalOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={closeAuth} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md z-[61] rounded-2xl shadow-2xl p-6"
            style={{ background: tv(T.navBg, dark), border: `1px solid ${tv(T.border, dark)}` }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold" style={{ color: tv(T.textPrimary, dark) }}>
                {authMode === "login" ? "Sign In" : "Create Account"}
              </h3>
              <button onClick={closeAuth} style={{ color: tv(T.textSecond, dark) }}><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {authMode === "register" && (
                <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2}
                  placeholder="Full name" className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: tv(T.inputBg, dark), color: tv(T.textPrimary, dark) }} />
              )}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                placeholder="Email address" className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: tv(T.inputBg, dark), color: tv(T.textPrimary, dark) }} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                placeholder="Password" className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: tv(T.inputBg, dark), color: tv(T.textPrimary, dark) }} />

              {error && <p className="text-xs text-red-500">{error}</p>}

              <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-60"
                style={{ background: tv(T.btnBg, dark), color: tv(T.btnText, dark) }}>
                {loading ? "Please wait..." : authMode === "login" ? "Sign In" : "Create Account"}
              </motion.button>
            </form>

            <p className="text-xs text-center mt-4" style={{ color: tv(T.textSecond, dark) }}>
              {authMode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
              <button type="button" className="font-semibold underline"
                onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
                style={{ color: tv(T.textPrimary, dark) }}>
                {authMode === "login" ? "Sign up" : "Sign in"}
              </button>
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Orders Drawer ────────────────────────────────────────────────────────────

function OrdersDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dark = useDark();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !useAuth.getState().isAuthenticated()) return;
    setLoading(true);
    ordersApi.list()
      .then((data) => setOrders(data.orders || []))
      .catch((e) => console.error("Orders fetch error", e))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-[380px] z-50 shadow-2xl flex flex-col"
            style={{ background: tv(T.navBg, dark) }}
          >
            <div className="flex items-center justify-between p-5" style={{ borderBottom: `1px solid ${tv(T.border, dark)}` }}>
              <h3 className="font-semibold" style={{ color: tv(T.textPrimary, dark) }}>Your Orders</h3>
              <button onClick={onClose} style={{ color: tv(T.textSecond, dark) }}><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {loading ? (
                <div className="flex justify-center py-10"><Loader color={tv(T.textPrimary, dark)} size={32} /></div>
              ) : orders.length === 0 ? (
                <p className="text-sm text-center py-10" style={{ color: tv(T.textSecond, dark) }}>No orders yet</p>
              ) : (
                orders.map((order) => (
                  <div key={order.id} className="p-3 rounded-xl" style={{ background: tv(T.mutedBg, dark) }}>
                    <div className="flex justify-between text-xs mb-2">
                      <span className="font-semibold" style={{ color: tv(T.textPrimary, dark) }}>#{order.id.slice(-8)}</span>
                      <span style={{ color: P.teal }}>{order.status}</span>
                    </div>
                    <div className="text-sm font-bold mb-1" style={{ color: tv(T.textPrimary, dark) }}>{fmt(order.total)}</div>
                    <div className="text-xs" style={{ color: tv(T.textSecond, dark) }}>
                      {order.items?.length ?? 0} item(s)
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Cart Drawer ──────────────────────────────────────────────────────────────

function CartDrawer({ open, onClose, checkoutTrigger, onCheckoutTriggered }: {
  open: boolean;
  onClose: () => void;
  checkoutTrigger?: boolean;
  onCheckoutTriggered?: () => void;
}) {
  const dark = useDark();
  const { items, removeItem, updateQty, total, fetchCart } = useCart();
  const user = useAuth((s) => s.user);
  const openAuth = useAuth((s) => s.openAuth);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [shipping, setShipping] = useState({
    name: "", street: "", city: "New Delhi", state: "Delhi", pincode: "110001", phone: "",
  });

  useEffect(() => {
    if (open && user) {
      setShipping((s) => ({ ...s, name: user.name }));
    }
  }, [open, user]);

  const handleCheckout = () => {
    if (!useAuth.getState().isAuthenticated()) {
      openAuth("login");
      return;
    }
    setCheckoutError("");
    setOrderPlaced(false);
    setCheckoutOpen(true);
  };

  // Auto-trigger checkout when voice command says "checkout"
  useEffect(() => {
    if (open && checkoutTrigger && items.length > 0) {
      if (!useAuth.getState().isAuthenticated()) {
        openAuth("login");
      } else {
        setCheckoutError("");
        setOrderPlaced(false);
        setCheckoutOpen(true);
      }
      onCheckoutTriggered?.();
    }
  }, [open, checkoutTrigger, items.length]);

  const placeOrder = async () => {
    setCheckoutLoading(true);
    setCheckoutError("");
    try {
      await ordersApi.create(shipping);
      setOrderPlaced(true);
      await fetchCart();
      setTimeout(() => {
        setCheckoutOpen(false);
        onClose();
        setOrderPlaced(false);
      }, 2000);
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-[380px] z-50 shadow-2xl flex flex-col transition-colors duration-300"
            style={{ background: tv(T.navBg, dark) }}
          >
            <div className="flex items-center justify-between p-5 transition-colors duration-300"
              style={{ borderBottom: `1px solid ${tv(T.border, dark)}` }}>
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} style={{ color: tv(T.textPrimary, dark) }} />
                <h3 className="font-semibold transition-colors duration-300" style={{ color: tv(T.textPrimary, dark) }}>
                  Your Cart
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: tv(T.btnBg, dark), color: tv(T.btnText, dark) }}>
                  {items.length}
                </span>
              </div>
              <button onClick={onClose} style={{ color: tv(T.textSecond, dark) }}><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                  <Package size={40} style={{ color: tv(T.border, dark) }} />
                  <p className="text-sm" style={{ color: tv(T.textSecond, dark) }}>Your cart is empty</p>
                  <button onClick={onClose} className="text-xs font-semibold" style={{ color: P.teal }}>Continue Shopping</button>
                </div>
              ) : (
                items.map((item) => (
                  <motion.div key={item.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3 p-3 rounded-xl transition-colors duration-300"
                    style={{ background: tv(T.mutedBg, dark) }}>
                    <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-wider transition-colors duration-300"
                        style={{ color: tv(T.textSecond, dark) }}>{item.brand}</div>
                      <div className="text-xs font-semibold line-clamp-1 transition-colors duration-300"
                        style={{ color: tv(T.textPrimary, dark) }}>{item.name}</div>
                      <div className="text-sm font-bold mt-0.5 transition-colors duration-300"
                        style={{ color: tv(T.textPrimary, dark) }}>{fmt(item.price)}</div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <button onClick={() => updateQty(item.id, item.quantity - 1)}
                          className="w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-300"
                          style={{ background: tv(T.cardBg, dark), border: `1px solid ${tv(T.border, dark)}`, color: tv(T.textPrimary, dark) }}>
                          <Minus size={10} />
                        </button>
                        <span className="text-xs font-semibold w-4 text-center transition-colors duration-300"
                          style={{ color: tv(T.textPrimary, dark) }}>{item.quantity}</span>
                        <button onClick={() => updateQty(item.id, item.quantity + 1)}
                          className="w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200"
                          style={{ background: tv(T.btnBg, dark), color: tv(T.btnText, dark) }}>
                          <Plus size={10} />
                        </button>
                        <button onClick={() => removeItem(item.id)}
                          className="ml-auto text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="p-5 transition-colors duration-300" style={{ borderTop: `1px solid ${tv(T.border, dark)}` }}>
                <div className="flex justify-between text-sm mb-1">
                  <span style={{ color: tv(T.textSecond, dark) }}>Subtotal</span>
                  <span className="font-bold" style={{ color: tv(T.textPrimary, dark) }}>{fmt(total())}</span>
                </div>
                <div className="flex justify-between text-xs mb-4">
                  <span style={{ color: tv(T.textMuted, dark) }}>Delivery</span>
                  <span className="font-semibold" style={{ color: P.teal }}>FREE</span>
                </div>
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleCheckout}
                  className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200"
                  style={{ background: tv(T.btnBg, dark), color: tv(T.btnText, dark) }}>
                  Checkout — {fmt(total())}
                </motion.button>
              </div>
            )}
          </motion.div>

          <AnimatePresence>
            {checkoutOpen && (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={() => setCheckoutOpen(false)} className="fixed inset-0 bg-black/50 z-[55]" />
                <motion.div
                  initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
                  className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md z-[56] rounded-2xl p-6 shadow-2xl"
                  style={{ background: tv(T.navBg, dark), border: `1px solid ${tv(T.border, dark)}` }}
                >
                  {orderPlaced ? (
                    <div className="text-center py-6">
                      <Check size={40} className="mx-auto mb-3" style={{ color: P.teal }} />
                      <h3 className="font-semibold text-lg" style={{ color: tv(T.textPrimary, dark) }}>Order Placed!</h3>
                      <p className="text-sm mt-2" style={{ color: tv(T.textSecond, dark) }}>Thank you for shopping with VANI</p>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-semibold text-lg mb-4" style={{ color: tv(T.textPrimary, dark) }}>Shipping Details</h3>
                      <div className="space-y-3">
                        {(["name", "street", "city", "state", "pincode", "phone"] as const).map((field) => (
                          <input key={field} value={shipping[field]}
                            onChange={(e) => setShipping((s) => ({ ...s, [field]: e.target.value }))}
                            placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                            style={{ background: tv(T.inputBg, dark), color: tv(T.textPrimary, dark) }} />
                        ))}
                      </div>
                      {checkoutError && <p className="text-xs text-red-500 mt-3">{checkoutError}</p>}
                      <motion.button whileTap={{ scale: 0.97 }} onClick={placeOrder} disabled={checkoutLoading}
                        className="w-full py-3 mt-4 rounded-xl font-semibold text-sm disabled:opacity-60"
                        style={{ background: tv(T.btnBg, dark), color: tv(T.btnText, dark) }}>
                        {checkoutLoading ? "Placing order..." : `Place Order — ${fmt(total())}`}
                      </motion.button>
                    </>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Filters Panel ────────────────────────────────────────────────────────────

function FiltersPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dark = useDark();
  const [priceRange, setPriceRange] = useState(50000);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [selectedRating, setSelectedRating] = useState(0);
  const cats = ["Electronics", "Clothing", "Footwear", "Watches", "Bags"];
  const toggleCat = (c: string) => setSelectedCats((p) => p.includes(c) ? p.filter((x) => x !== c) : [...p, c]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
          <motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed left-0 top-0 h-full w-[320px] z-50 shadow-2xl flex flex-col transition-colors duration-300"
            style={{ background: tv(T.navBg, dark) }}>
            <div className="flex items-center justify-between p-5 transition-colors duration-300"
              style={{ borderBottom: `1px solid ${tv(T.border, dark)}` }}>
              <div className="flex items-center gap-2">
                <Filter size={16} style={{ color: tv(T.textPrimary, dark) }} />
                <h3 className="font-semibold transition-colors duration-300" style={{ color: tv(T.textPrimary, dark) }}>Filters</h3>
              </div>
              <button onClick={onClose} style={{ color: tv(T.textSecond, dark) }}><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-3 transition-colors duration-300"
                  style={{ color: tv(T.textPrimary, dark) }}>Category</h4>
                <div className="space-y-2">
                  {cats.map((c) => (
                    <label key={c} className="flex items-center gap-2.5 cursor-pointer">
                      <div onClick={() => toggleCat(c)}
                        className="w-4 h-4 rounded border-2 flex items-center justify-center transition-all"
                        style={{
                          background: selectedCats.includes(c) ? tv(T.btnBg, dark) : "transparent",
                          borderColor: selectedCats.includes(c) ? tv(T.btnBg, dark) : tv(T.border, dark)
                        }}>
                        {selectedCats.includes(c) && <Check size={10} style={{ color: tv(T.btnText, dark) }} />}
                      </div>
                      <span className="text-sm transition-colors duration-300" style={{ color: tv(T.textPrimary, dark) }}>{c}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-3 transition-colors duration-300"
                  style={{ color: tv(T.textPrimary, dark) }}>Price Range</h4>
                <input type="range" min={0} max={50000} value={priceRange}
                  onChange={(e) => setPriceRange(+e.target.value)}
                  className="w-full" style={{ accentColor: P.teal }} />
                <div className="flex justify-between text-xs mt-1 transition-colors duration-300"
                  style={{ color: tv(T.textSecond, dark) }}>
                  <span>₹0</span><span>{fmt(priceRange)}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-3 transition-colors duration-300"
                  style={{ color: tv(T.textPrimary, dark) }}>Minimum Rating</h4>
                <div className="space-y-1.5">
                  {[4, 3, 2, 1].map((r) => (
                    <button key={r} onClick={() => setSelectedRating(r)}
                      className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors duration-200"
                      style={{ background: selectedRating === r ? tv(T.hoverBg, dark) : "transparent", color: tv(T.textSecond, dark) }}>
                      <Stars rating={r} /> <span>& above</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-3 transition-colors duration-300"
                  style={{ color: tv(T.textPrimary, dark) }}>Brands</h4>
                <div className="flex flex-wrap gap-2">
                  {["Nike", "Apple", "Sony", "Zara", "Levi's", "H&M", "Fossil", "Converse"].map((b) => (
                    <button key={b}
                      className="px-3 py-1 text-xs font-medium rounded-full border transition-colors duration-200"
                      style={{ borderColor: tv(T.border, dark), color: tv(T.textSecond, dark), background: "transparent" }}>
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 flex gap-3 transition-colors duration-300"
              style={{ borderTop: `1px solid ${tv(T.border, dark)}` }}>
              <button onClick={() => { setSelectedCats([]); setSelectedRating(0); setPriceRange(50000); }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-colors duration-200"
                style={{ border: `1px solid ${tv(T.border, dark)}`, color: tv(T.textSecond, dark) }}>
                Clear All
              </button>
              <button onClick={onClose}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
                style={{ background: tv(T.btnBg, dark), color: tv(T.btnText, dark) }}>
                Apply
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Location Modal ───────────────────────────────────────────────────────────

function LocationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dark = useDark();
  const [city, setCity] = useState("New Delhi");
  const [pincode, setPincode] = useState("110001");

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <motion.div initial={{ scale: 0.94, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 10 }}
            transition={{ type: "spring", damping: 24, stiffness: 350 }}
            onClick={(e) => e.stopPropagation()}
            className="rounded-2xl w-[360px] p-6 shadow-2xl transition-colors duration-300"
            style={{ background: tv(T.navBg, dark) }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <MapPin size={18} style={{ color: P.teal }} />
                <h3 className="font-semibold transition-colors duration-300" style={{ color: tv(T.textPrimary, dark) }}>
                  Delivery Location
                </h3>
              </div>
              <button onClick={onClose} style={{ color: tv(T.textSecond, dark) }}><X size={18} /></button>
            </div>
            {[{ label: "City", val: city, set: setCity }, { label: "PIN Code", val: pincode, set: setPincode }].map(({ label, val, set }) => (
              <div key={label} className="mb-3">
                <label className="text-xs font-medium mb-1 block transition-colors duration-300"
                  style={{ color: tv(T.textSecond, dark) }}>{label}</label>
                <input value={val} onChange={(e) => set(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors duration-300"
                  style={{ border: `1px solid ${tv(T.border, dark)}`, background: tv(T.inputBg, dark), color: tv(T.textPrimary, dark) }} />
              </div>
            ))}
            <motion.button whileTap={{ scale: 0.97 }} onClick={onClose}
              className="w-full mt-2 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200"
              style={{ background: tv(T.btnBg, dark), color: tv(T.btnText, dark) }}>
              Save Address
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Notification Panel ───────────────────────────────────────────────────────

const notifications = [
  { id: 1, title: "Order Shipped!", body: "Your Sony Headphones are on the way.", time: "2m ago", icon: Package },
  { id: 2, title: "Flash Sale — 40% Off", body: "Premium watches for next 2 hours only.", time: "15m ago", icon: Tag },
  { id: 3, title: "Abandoned Cart", body: "You left Nike Air Max in your cart.", time: "1h ago", icon: ShoppingCart },
];

function NotificationPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dark = useDark();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 z-50" />
          <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }} transition={{ duration: 0.18 }}
            className="fixed top-16 right-6 w-[340px] rounded-2xl shadow-2xl z-50 overflow-hidden transition-colors duration-300"
            style={{ background: tv(T.navBg, dark), border: `1px solid ${tv(T.border, dark)}` }}>
            <div className="flex items-center justify-between px-4 py-3 transition-colors duration-300"
              style={{ borderBottom: `1px solid ${tv(T.border, dark)}` }}>
              <h4 className="font-semibold text-sm transition-colors duration-300" style={{ color: tv(T.textPrimary, dark) }}>
                Notifications
              </h4>
              <button className="text-[10px] font-semibold" style={{ color: P.teal }}>Mark all read</button>
            </div>
            <div className="transition-colors duration-300" style={{ borderTop: `1px solid ${tv(T.border, dark)}` }}>
              {notifications.map((n) => {
                const Icon = n.icon;
                return (
                  <div key={n.id} className="flex gap-3 p-4 cursor-pointer transition-colors duration-200"
                    style={{ borderBottom: `1px solid ${tv(T.border, dark)}` }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = tv(T.hoverBg, dark))}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-300"
                      style={{ background: tv(T.hoverBg, dark) }}>
                      <Icon size={15} style={{ color: tv(T.textPrimary, dark) }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold transition-colors duration-300" style={{ color: tv(T.textPrimary, dark) }}>{n.title}</div>
                      <div className="text-[11px] mt-0.5 line-clamp-1 transition-colors duration-300" style={{ color: tv(T.textSecond, dark) }}>{n.body}</div>
                      <div className="text-[10px] mt-0.5 transition-colors duration-300" style={{ color: tv(T.textMuted, dark) }}>{n.time}</div>
                    </div>
                    <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: "#EB5E28" }} />
                  </div>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Voice Popup ──────────────────────────────────────────────────────────────

function VoicePopup({ open, transcript, listening, onClose }: {
  open: boolean; transcript: string; listening: boolean; onClose: () => void;
}) {
  const dark = useDark();

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }} transition={{ type: "spring", damping: 24, stiffness: 350 }}
          className="fixed bottom-28 left-1/2 -translate-x-1/2 w-[400px] rounded-2xl shadow-2xl z-40 p-5 transition-colors duration-300"
          style={{ background: tv(T.navBg, dark), border: `1px solid ${tv(T.border, dark)}` }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${listening ? "animate-pulse" : ""}`}
                style={{ background: listening ? "#EB5E28" : "#CCC5B9" }} />
              <span className="text-xs font-semibold transition-colors duration-300" style={{ color: tv(T.textPrimary, dark) }}>
                {listening ? "Listening..." : "Voice Command"}
              </span>
            </div>
            <button onClick={onClose} style={{ color: tv(T.textMuted, dark) }}><X size={16} /></button>
          </div>
          <div className="min-h-[48px] rounded-xl px-4 py-3 text-sm transition-colors duration-300"
            style={{ background: tv(T.inputBg, dark), color: tv(T.textPrimary, dark) }}>
            {transcript || (
              <span style={{ color: tv(T.textMuted, dark) }} className="italic">
                Say something like "Show shoes under 2000"
              </span>
            )}
          </div>
          {!listening && transcript && (
            <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: P.teal }}>
              <Check size={13} /> Command processed
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Bottom Dock ──────────────────────────────────────────────────────────────

function BottomDock({ onFilters, onCart, onWishlist, onVoiceTrain, cartCount, wishlistCount, listening, onMicClick }: {
  onFilters: () => void; onCart: () => void; onWishlist: () => void; onVoiceTrain: () => void;
  cartCount: number; wishlistCount: number; listening: boolean; onMicClick: () => void;
}) {
  const dark = useDark();

  const items = [
    { label: "Voice Train", icon: <Volume2 size={15} />, onClick: onVoiceTrain },
    { label: "Filters", icon: <SlidersHorizontal size={15} />, onClick: onFilters },
    { label: "Cart", icon: <ShoppingCart size={15} />, onClick: onCart, badge: cartCount },
    { label: "Wishlist", icon: <Heart size={15} />, onClick: onWishlist, badge: wishlistCount },
  ];

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40">
      <motion.div
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 22, stiffness: 250, delay: 0.3 }}
        className="backdrop-blur-2xl rounded-full shadow-2xl px-6 py-3 flex items-center gap-2 transition-colors duration-300 border"
        style={{ background: dark ? "rgba(43, 32, 29, 0.75)" : "rgba(138, 121, 104, 0.75)", borderColor: dark ? "rgba(230, 213, 184, 0.15)" : "rgba(255,255,255,0.2)" }}
      >
        {/* Left items */}
        {items.slice(0, 2).map((item, idx) => (
          <div key={idx} className="relative group">
            <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.93 }}
              onClick={item.onClick}
              className="relative flex items-center justify-center w-10 h-10 rounded-full transition-colors duration-200"
              style={{ color: "#FFFFFF" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              {item.icon && React.cloneElement(item.icon as any, { size: 22 })}
            </motion.button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-black/80 text-white text-xs font-semibold rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
              {item.label}
            </div>
          </div>
        ))}

        {/* Center MIC / ORB */}
        <div className="mx-3 relative flex items-center justify-center" style={{ width: 56, height: 56 }}>



          {/* Mic button — always in dock */}
          <motion.button
            onClick={onMicClick}
            whileTap={{ scale: 0.88 }}
            animate={{
              scale: listening ? 0.82 : 1,
              boxShadow: listening
                ? "0 0 0 3px #ff3e1c66, 0 0 16px #ff3e1c44"
                : "0 4px 20px rgba(0,0,0,0.25)",
            }}
            transition={{ duration: 0.3 }}
            className="rounded-full flex items-center justify-center"
            style={{
              width: 52, height: 52,
              background: listening ? "#0a0a0a" : tv(T.btnBg, dark),
              flexShrink: 0,
            }}
          >
            <Mic size={20} style={{ color: listening ? "#ff3e1c" : tv(T.btnText, dark) }} />
          </motion.button>
        </div>

        {/* Right items */}
        {items.slice(2).map((item, idx) => (
          <div key={idx} className="relative group">
            <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.93 }}
              onClick={item.onClick}
              className="relative flex items-center justify-center w-10 h-10 rounded-full transition-colors duration-200"
              style={{ color: "#FFFFFF" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              {item.icon && React.cloneElement(item.icon as any, { size: 22 })}
              {"badge" in item && item.badge! > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 text-white text-[9px] font-bold rounded-full flex items-center justify-center" style={{ background: P.forest, fontSize: "10px" }}>
                  {item.badge}
                </span>
              )}
            </motion.button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-black/80 text-white text-xs font-semibold rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
              {item.label}
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// ─── Search Results Panel ────────────────────────────────────────────────────

function SearchResults({
  open, query, onClose, onAddToCart, onProductClick, allProducts,
  prefetchedResults, prefetchedTotal,
}: {
  open: boolean; query: string; onClose: () => void;
  onAddToCart: (p: Product) => void; onProductClick: (p: Product) => void;
  allProducts: Product[];
  prefetchedResults?: Product[] | null;
  prefetchedTotal?: number | null;
}) {
  const dark = useDark();
  const [results, setResults] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || query.trim() === "") {
      setResults([]);
      setTotal(0);
      return;
    }

    if (prefetchedResults != null) {
      setResults(prefetchedResults);
      setTotal(prefetchedTotal ?? prefetchedResults.length);
      setLoading(false);
      return;
    }

    const q = query.trim().toLowerCase();
    const localFallback = allProducts.filter((p) =>
      p.name.toLowerCase().includes(q)
      || p.brand.toLowerCase().includes(q)
      || p.category.toLowerCase().includes(q)
      || p.description.toLowerCase().includes(q)
    );

    setLoading(true);
    productsApi.search(query.trim(), { limit: 50 })
      .then((data) => {
        const products = (data.products || []).map((p: Record<string, unknown>) => normalizeProduct(p));
        setResults(products);
        setTotal(data.total ?? products.length);
      })
      .catch(() => {
        setResults(localFallback);
        setTotal(localFallback.length);
      })
      .finally(() => setLoading(false));
  }, [open, query, allProducts, prefetchedResults, prefetchedTotal]);

  return (
    <AnimatePresence>
      {open && query.trim() !== "" && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-45" />
          <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }} transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="fixed top-20 left-1/2 -translate-x-1/2 w-[min(90vw,800px)] max-h-[60vh] rounded-2xl shadow-2xl z-50 overflow-hidden transition-colors duration-300 flex flex-col"
            style={{ background: tv(T.navBg, dark), border: `1px solid ${tv(T.cardBorder, dark)}` }}>

            {/* Header */}
            <div className="p-5 transition-colors duration-300"
              style={{ borderBottom: `1px solid ${tv(T.border, dark)}` }}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold transition-colors duration-300" style={{ color: tv(T.textPrimary, dark) }}>
                    Search Results
                  </h3>
                  <p className="text-xs transition-colors duration-300" style={{ color: tv(T.textSecond, dark) }}>
                    Found {total} {total === 1 ? "product" : "products"}
                  </p>
                </div>
                <button onClick={onClose} style={{ color: tv(T.textSecond, dark) }}><X size={18} /></button>
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-5">
              {loading ? (
                <div className="flex justify-center py-16"><Loader color={tv(T.textPrimary, dark)} size={36} /></div>
              ) : results.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                  <Search size={40} style={{ color: tv(T.border, dark) }} />
                  <p className="text-sm transition-colors duration-300" style={{ color: tv(T.textSecond, dark) }}>
                    No products match "{query}"
                  </p>
                  <p className="text-xs transition-colors duration-300" style={{ color: tv(T.textMuted, dark) }}>
                    Try searching for a different product or category
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  {results.map((p) => (
                    <ProductCard key={p.id} product={p}
                      onAdd={() => onAddToCart(p)}
                      onClick={() => { onProductClick(p); onClose(); }} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Footer Component ─────────────────────────────────────────────────────────

function Footer() {
  const dark = useDark();

  const footerSections = [
    {
      title: "Shop",
      links: ["Electronics", "Fashion", "Footwear", "Watches", "Bags", "Sports"]
    },
    {
      title: "Support",
      links: ["Contact Us", "FAQ", "Shipping Info", "Returns", "Track Order", "Warranty"]
    },
    {
      title: "Company",
      links: ["About Us", "Careers", "Blog", "Press", "Sustainability", "Investors"]
    },
    {
      title: "Legal",
      links: ["Privacy Policy", "Terms of Service", "Cookie Policy", "Accessibility", "Contact", "Sitemap"]
    }
  ];

  const socialLinks = [
    { icon: Facebook, link: "#", label: "Facebook" },
    { icon: Twitter, link: "#", label: "Twitter" },
    { icon: Instagram, link: "#", label: "Instagram" },
    { icon: Linkedin, link: "#", label: "LinkedIn" },
  ];

  const trustBadges = [
    { icon: Truck, label: "Free Shipping", desc: "On orders over ₹999" },
    { icon: Shield, label: "Secure Payment", desc: "100% protected transactions" },
    { icon: RotateCcw, label: "Easy Returns", desc: "30-day return policy" },
    { icon: Package, label: "Fast Delivery", desc: "2-3 days nationwide" },
  ];

  return (
    <footer className="transition-colors duration-300 backdrop-blur-xl" style={{ background: tv(T.navBg, dark) }}>
      {/* Trust Badges Section */}
      <div className="border-b transition-colors duration-300" style={{ borderColor: tv(T.navBorder, dark) }}>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {trustBadges.map((badge) => (
              <div key={badge.label} className="flex items-center gap-4 p-4 rounded-lg transition-colors duration-300"
                style={{ background: tv(T.mutedBg, dark) }}>
                <div style={{ color: tv(T.accent, dark) }}>
                  <badge.icon size={28} />
                </div>
                <div>
                  <div className="font-semibold text-sm transition-colors duration-300" style={{ color: tv(T.textPrimary, dark) }}>
                    {badge.label}
                  </div>
                  <div className="text-xs transition-colors duration-300" style={{ color: tv(T.textMuted, dark) }}>
                    {badge.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Newsletter Section */}
      <div className="border-b transition-colors duration-300" style={{ borderColor: tv(T.navBorder, dark) }}>
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-bold mb-2 transition-colors duration-300" style={{ color: tv(T.textPrimary, dark) }}>
                Subscribe to Our Newsletter
              </h3>
              <p className="text-sm transition-colors duration-300" style={{ color: tv(T.textMuted, dark) }}>
                Get exclusive deals, new arrivals & special offers directly to your inbox.
              </p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <input type="email" placeholder="Enter your email"
                className="flex-1 md:flex-none px-4 py-2.5 rounded-lg transition-colors duration-300 outline-none"
                style={{
                  background: tv(T.inputBg, dark),
                  color: tv(T.textPrimary, dark),
                  borderColor: tv(T.inputBorder, dark),
                  border: `1px solid ${tv(T.inputBorder, dark)}`
                }}
              />
              <button className="px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 hover:shadow-lg"
                style={{ background: tv(T.accent, dark), color: tv(T.accentText, dark) }}>
                Subscribe
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

    </footer>
  );
}

// ─── Product Details View ───────────────────────────────────────────────────────

function ProductDetailsView({ product, onBack, onAddToCart }: { product: Product; onBack: () => void; onAddToCart: (p: Product) => void }) {
  const dark = useDark();
  const { wishlist, toggleWishlist } = useCart();
  const isWishlisted = wishlist.includes(product.id);
  const [added, setAdded] = useState(false);

  const handleAdd = () => { onAddToCart(product); setAdded(true); setTimeout(() => setAdded(false), 1500); };

  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
      className="max-w-[1200px] mx-auto px-6 py-8 min-h-[80vh]">
      <button onClick={onBack} className="flex items-center gap-2 mb-8 font-semibold transition-colors hover:opacity-80" style={{ color: tv(T.textSecond, dark) }}>
        <ChevronLeft size={20} /> Back to Products
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
        {/* Image Gallery */}
        <div className="relative rounded-3xl overflow-hidden aspect-square shadow-xl border" style={{ background: tv(T.mutedBg, dark), borderColor: tv(T.border, dark) }}>
          <img src={product.image} alt={product.name} className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" />
          {discount > 0 && (
            <span className="absolute top-5 left-5 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg" style={{ background: P.teal }}>
              -{discount}% OFF
            </span>
          )}
          <button onClick={() => toggleWishlist(product.id)}
            className="absolute top-5 right-5 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110"
            style={{ background: tv(T.cardBg, dark) }}>
            <Heart size={22} className={isWishlisted ? "fill-red-500 text-red-500" : "text-gray-400"} />
          </button>
        </div>

        {/* Details */}
        <div className="flex flex-col gap-6">
          <div>
            <div className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: P.teal }}>{product.brand}</div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: "'Crox LightX', sans-serif", color: tv(T.textPrimary, dark) }}>{product.name}</h1>
            <div className="flex items-center gap-4 mb-2">
              <Stars rating={product.rating} />
              <span className="text-sm font-semibold" style={{ color: tv(T.textSecond, dark) }}>{product.rating} ({product.reviews.toLocaleString()} reviews)</span>
            </div>
          </div>

          <div>
            <div className="flex items-end gap-3 mb-2">
              <span className="text-4xl font-bold" style={{ color: tv(T.textPrimary, dark) }}>{fmt(product.price)}</span>
              {product.originalPrice && (
                <span className="text-xl line-through mb-1" style={{ color: tv(T.textMuted, dark) }}>{fmt(product.originalPrice)}</span>
              )}
            </div>
            <p className="text-sm font-semibold" style={{ color: tv(T.textSecond, dark) }}>Inclusive of all taxes</p>
          </div>

          <div className="w-full h-[1px]" style={{ background: tv(T.border, dark) }} />

          <div>
            <h3 className="text-xl font-bold mb-3" style={{ color: tv(T.textPrimary, dark) }}>Description</h3>
            <p className="leading-relaxed text-base" style={{ color: tv(T.textSecond, dark) }}>
              {product.description}. Designed to deliver an unparalleled experience, this premium product combines sophisticated aesthetics with cutting-edge functionality. A must-have for those who appreciate the finer things.
            </p>
          </div>

          <div className="pt-4">
            <motion.button whileTap={{ scale: 0.98 }} onClick={handleAdd}
              className="w-full py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-300 shadow-2xl"
              style={{ background: added ? P.greenBtn : tv(T.btnBg, dark), color: added ? "#fff" : tv(T.btnText, dark) }}>
              {added ? <><Check size={22} /> Added to Cart</> : <><ShoppingCart size={22} /> Add to Cart</>}
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [cartOpen, setCartOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [dark, setDark] = useState(false);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [voiceSearchPrefill, setVoiceSearchPrefill] = useState<{ results: Product[]; total: number } | null>(null);
  const [currentPage, setCurrentPage] = useState<"home" | "categories" | "deals" | "about">("home");
  const [voiceCheckoutTrigger, setVoiceCheckoutTrigger] = useState(false);
  const recognitionRef = useRef<any>(null);
  // Tracks the first product currently visible on screen — used by "add to cart" voice command
  const visibleProductsRef = useRef<Product[]>([]);

  const goHome = () => {
    setSelectedProduct(null);
    setCurrentPage("home");
  };

  const handleNavigate = (page: string) => {
    setSelectedProduct(null);
    setCurrentPage(page as any);
  };
  const { allProducts } = useProductStore();
  const { addItem, count, wishlist } = useCart();
  const user = useAuth((s) => s.user);
  const openAuth = useAuth((s) => s.openAuth);
  const logout = useAuth((s) => s.logout);
  const [appLoading, setAppLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    (async () => {
      await useAuth.getState().init();
      useProductStore.getState().fetchProducts();
      await useCart.getState().fetchCart();
    })();

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Simulate initial loading sequence for luxury feel
    const timer = setTimeout(() => setAppLoading(false), 2000);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearTimeout(timer);
    };
  }, []);

  // Keep visibleProductsRef in sync with the home page recommended products
  // so "add to cart" voice command always has a product to add even without searching
  useEffect(() => {
    const { recommendedProducts } = useProductStore.getState();
    if (recommendedProducts.length > 0 && visibleProductsRef.current.length === 0) {
      visibleProductsRef.current = recommendedProducts;
    }
  }, [allProducts]);

  // Get suggestions - top 6 matching products while typing
  const suggestions = search.trim() === ""
    ? []
    : allProducts.filter((p) => {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q)
        || p.brand.toLowerCase().includes(q)
        || p.category.toLowerCase().includes(q)
        || p.description.toLowerCase().includes(q);
    }).slice(0, 6);

  const handleSearchSubmit = () => {
    if (search.trim()) {
      setVoiceSearchPrefill(null);
      setSubmittedSearch(search);
    }
  };

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const processVoiceCommand = useCallback(async (command: string) => {
    const skipMessages = [
      "Voice recognition not supported.",
      "Could not understand. Please try again.",
      "Please sign in to use voice commands.",
    ];
    if (!command.trim() || skipMessages.includes(command)) return;

    try {
      const res = await voiceApi.processCommand(command);
      const intentData = res.intent || {};
      const intentName = intentData.intent || res.action;
      const actionName = res.action;

      if (actionName === "search_products" || intentName === "search_products") {
        // "show kurta" → search and display results
        const query =
          (res as { search_query?: string }).search_query
          || intentData.query
          || intentData.category
          || intentData.brand
          || intentData.color
          || command;
        const data = res.data as { products?: Record<string, unknown>[]; total?: number } | null;
        if (data?.products) {
          const prods = data.products.map((p) => normalizeProduct(p));
          setVoiceSearchPrefill({
            results: prods,
            total: data.total ?? prods.length,
          });
          // Update visible products ref so "add to cart" picks up the first search result
          visibleProductsRef.current = prods;
        } else {
          setVoiceSearchPrefill(null);
          // Filter local products by query for visible ref
          const q = query.toLowerCase();
          const local = useProductStore.getState().allProducts.filter((p) =>
            p.name.toLowerCase().includes(q)
            || p.brand.toLowerCase().includes(q)
            || p.category.toLowerCase().includes(q)
          );
          visibleProductsRef.current = local;
        }
        setSelectedProduct(null);
        setCurrentPage("home");
        setSearch(query);
        setSubmittedSearch(query);

      } else if (actionName === "add_first_visible" || (intentName === "add_to_cart" && !intentData.product_name)) {
        // "add to cart" with no product name → add first visible product
        const firstProduct = visibleProductsRef.current[0];
        if (firstProduct) {
          const success = await useCart.getState().addItem(firstProduct);
          if (success) {
            setTranscript(`Added "${firstProduct.name}" to your cart ✓`);
          } else {
            setTranscript("Please sign in to add items to your cart.");
          }
        } else {
          setTranscript("No products visible to add. Try saying 'show kurta' first.");
        }

      } else if (actionName === "add_to_cart" || intentName === "add_to_cart") {
        // Backend found and added a named product
        await useCart.getState().fetchCart();
        setCartOpen(true);

      } else if (actionName === "remove_from_cart" || intentName === "remove_from_cart") {
        // Backend removed the item (last or named) — refresh cart
        await useCart.getState().fetchCart();
        setCartOpen(true);

      } else if (actionName === "open_cart" || intentName === "open_cart") {
        await useCart.getState().fetchCart();
        setCartOpen(true);

      } else if (actionName === "checkout" || intentName === "checkout") {
        // "checkout" → open cart AND immediately show checkout form
        await useCart.getState().fetchCart();
        setCartOpen(true);
        // Small delay to let cart drawer render, then trigger checkout
        setTimeout(() => setVoiceCheckoutTrigger(true), 400);

      } else if (intentName === "product_details" && res.data) {
        setSelectedProduct(normalizeProduct(res.data as Record<string, unknown>));
        setCurrentPage("home");
      }

      if (res.message) {
        setTranscript(res.message);
      }

      setTimeout(() => setVoiceOpen(false), 3000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Voice command failed";
      setTranscript(msg.includes("authenticated") || msg.includes("Not authenticated")
        ? "Please sign in to use voice commands."
        : msg);
      if (msg.includes("authenticated") || msg.includes("Not authenticated")) {
        openAuth("login");
      }
    }
  }, [openAuth]);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setTranscript("Voice recognition not supported."); setVoiceOpen(true); return; }
    const r = new SR();
    let finalText = "";
    r.lang = "en-IN"; r.continuous = false; r.interimResults = true;
    r.onstart = () => { setListening(true); setVoiceOpen(true); setTranscript(""); finalText = ""; };
    r.onresult = (e: any) => {
      finalText = Array.from(e.results).map((x: any) => x[0].transcript).join("");
      setTranscript(finalText);
    };
    r.onerror = () => { setListening(false); setTranscript("Could not understand. Please try again."); };
    r.onend = () => {
      setListening(false);
      const cmd = finalText.trim();
      if (cmd) processVoiceCommand(cmd);
    };
    recognitionRef.current = r;
    r.start();
  }, [processVoiceCommand]);

  const stopListening = useCallback(() => { recognitionRef.current?.stop(); setListening(false); }, []);
  const handleMicClick = () => {
    if (!useAuth.getState().isAuthenticated()) {
      openAuth("login");
      setTranscript("Please sign in to use voice commands.");
      setVoiceOpen(true);
      return;
    }
    listening ? stopListening() : startListening();
  };

  if (appLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#2B201D] text-[#F9F6F0]">
        <Loader color="#E6D5B8" size={60} />
        <div className="mt-8 text-sm tracking-widest uppercase" style={{ fontFamily: "'Crox LightX', sans-serif" }}>
          Initializing VANI
        </div>
      </div>
    );
  }

  return (
    <DarkCtx.Provider value={dark}>
      <AnimatePresence>
        {isOffline && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md text-[#F9F6F0]">
            <Loader color="#EB5E28" size={60} />
            <div className="mt-8 text-xl font-semibold tracking-widest uppercase" style={{ fontFamily: "'Crox LightX', sans-serif" }}>Network Unavailable</div>
            <div className="mt-2 text-sm text-gray-400">Waiting for connection...</div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className={`animated-bg ${dark ? "dark-bg" : "light-bg"}`} />
      <div className="noise-overlay" />
      <div className="fixed inset-0 pointer-events-none z-0">
        <BGPattern variant="grid" mask="fade-edges" size={48} fill={dark ? "rgba(230, 213, 184, 0.07)" : "rgba(43, 32, 29, 0.05)"} />
      </div>
      <div className="min-h-screen relative overflow-clip transition-colors duration-300"
        style={{
          fontFamily: "Inter, sans-serif",
          backgroundColor: tv(T.pageBg, dark)
        }}>
        <div className="relative" style={{ zIndex: 10 }}>
          <Navbar
            onLocationOpen={() => setLocationOpen(true)}
            onNotifOpen={() => setNotifOpen(!notifOpen)}
            onVoiceClick={handleMicClick}
            onToggleDark={() => setDark((d) => !d)}
            search={search}
            onSearchChange={setSearch}
            onSearchSubmit={handleSearchSubmit}
            suggestions={suggestions}
            currentPage={currentPage}
            onNavigate={handleNavigate}
            onHomeClick={goHome}
            user={user}
            onSignIn={() => openAuth("login")}
            onSignUp={() => openAuth("register")}
            onLogout={logout}
            onOrders={() => {
              if (!useAuth.getState().isAuthenticated()) {
                openAuth("login");
                return;
              }
              setOrdersOpen(true);
            }}
            onAddToCart={addItem}
            onProductClick={setSelectedProduct}
          />

          <main className="pb-32 pt-8">
            <AnimatePresence mode="wait">
              {selectedProduct ? (
                <ProductDetailsView key="details" product={selectedProduct} onBack={() => setSelectedProduct(null)} onAddToCart={addItem} />
              ) : currentPage === "categories" ? (
                <motion.div key="categories" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                  <CategoriesSection />
                  <TrendingSection onAddToCart={addItem} onProductClick={setSelectedProduct} />
                </motion.div>
              ) : currentPage === "deals" ? (
                <motion.div key="deals" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                  <BestSellersSection onAddToCart={addItem} onProductClick={setSelectedProduct} />
                  <RecommendedSection onAddToCart={addItem} onProductClick={setSelectedProduct} />
                </motion.div>
              ) : currentPage === "about" ? (
                <motion.div key="about" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-[800px] mx-auto px-6 py-20 text-center">
                  <h1 className="text-5xl font-bold mb-8" style={{ fontFamily: "'Crox LightX', sans-serif", color: tv(T.textPrimary, dark) }}>About VANI</h1>
                  <p className="text-lg leading-relaxed mb-6" style={{ color: tv(T.textSecond, dark) }}>
                    VANI stands for <strong style={{ color: tv(T.textPrimary, dark) }}>Voice Assisted Navigation for Intelligent commerce</strong>. We are redefining the luxury e-commerce experience by merging cutting-edge voice AI with breathtaking, seamless design.
                  </p>
                  <p className="text-lg leading-relaxed" style={{ color: tv(T.textSecond, dark) }}>
                    Every element of our platform is crafted to provide a calm, frictionless, and premium shopping journey. Just speak, and VANI will guide you.
                  </p>
                </motion.div>
              ) : (
                <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <BrandTagline />
                  <HeroCarousel onAddToCart={addItem} onProductClick={setSelectedProduct} />
                  <RecommendedSection onAddToCart={addItem} onProductClick={setSelectedProduct} />
                  <TrendingSection onAddToCart={addItem} onProductClick={setSelectedProduct} />
                  <BestSellersSection onAddToCart={addItem} onProductClick={setSelectedProduct} />
                  <RecentlyViewedSection onAddToCart={addItem} onProductClick={setSelectedProduct} />
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          <Footer />

          <BottomDock
            onFilters={() => setFiltersOpen(true)}
            onCart={() => setCartOpen(true)}
            onWishlist={() => setWishlistOpen(true)}
            onVoiceTrain={handleMicClick}
            cartCount={count()}
            wishlistCount={wishlist.length}
            listening={listening}
            onMicClick={handleMicClick}
          />

          <CartDrawer open={cartOpen} onClose={() => { setCartOpen(false); setVoiceCheckoutTrigger(false); }} checkoutTrigger={voiceCheckoutTrigger} onCheckoutTriggered={() => setVoiceCheckoutTrigger(false)} />
          <OrdersDrawer open={ordersOpen} onClose={() => setOrdersOpen(false)} />
          <AuthModal />
          <WishlistDrawer open={wishlistOpen} onClose={() => setWishlistOpen(false)} onAddToCart={addItem} />
          <FiltersPanel open={filtersOpen} onClose={() => setFiltersOpen(false)} />
          <LocationModal open={locationOpen} onClose={() => setLocationOpen(false)} />
          <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
          <VoicePopup open={voiceOpen} transcript={transcript} listening={listening} onClose={() => setVoiceOpen(false)} />
          <SearchResults
            open={submittedSearch.trim() !== ""}
            query={submittedSearch}
            onClose={() => { setSubmittedSearch(""); setVoiceSearchPrefill(null); }}
            onAddToCart={addItem}
            onProductClick={setSelectedProduct}
            allProducts={allProducts}
            prefetchedResults={voiceSearchPrefill?.results}
            prefetchedTotal={voiceSearchPrefill?.total}
          />
        </div>
      </div>
    </DarkCtx.Provider>
  );
}
