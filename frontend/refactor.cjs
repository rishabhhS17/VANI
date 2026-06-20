const fs = require('fs');
const path = 'C:/Users/BIT/Desktop/VANI/frontend/src/app/App.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add API imports
content = content.replace(
  'import { create } from "zustand";',
  'import { create } from "zustand";\nimport { productsApi, cartApi, voiceApi } from "../api/client";'
);

// 2. Refactor CartStore
const cartStoreOld = 'interface CartStore {\n  items: CartItem[]; wishlist: string[];\n  addItem: (p: Product) => void; removeItem: (id: string) => void;\n  updateQty: (id: string, qty: number) => void; toggleWishlist: (id: string) => void;\n  total: () => number; count: () => number;\n}';

const cartStoreNew = 'interface CartStore {\n  items: CartItem[]; wishlist: string[];\n  addItem: (p: Product) => Promise<void>; removeItem: (id: string) => Promise<void>;\n  updateQty: (id: string, qty: number) => Promise<void>; toggleWishlist: (id: string) => void;\n  total: () => number; count: () => number;\n  fetchCart: () => Promise<void>;\n}';
content = content.replace(cartStoreOld, cartStoreNew);

const useCartOld = `const useCart = create<CartStore>((set, get) => ({
  items: [], wishlist: [],
  addItem: (product) => set((s) => {
    const ex = s.items.find((i) => i.id === product.id);
    return ex
      ? { items: s.items.map((i) => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i) }
      : { items: [...s.items, { ...product, quantity: 1 }] };
  }),
  removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  updateQty: (id, qty) => set((s) => ({
    items: qty === 0 ? s.items.filter((i) => i.id !== id)
      : s.items.map((i) => i.id === id ? { ...i, quantity: qty } : i),
  })),
  toggleWishlist: (id) => set((s) => ({
    wishlist: s.wishlist.includes(id) ? s.wishlist.filter((w) => w !== id) : [...s.wishlist, id],
  })),
  total: () => get().items.reduce((s, i) => s + i.price * i.quantity, 0),
  count: () => get().items.reduce((s, i) => s + i.quantity, 0),
}));`;

const useCartNew = `const useCart = create<CartStore>((set, get) => ({
  items: [], wishlist: [],
  fetchCart: async () => {
    try {
      const cart = await cartApi.get();
      if (cart && cart.items) {
        const items = cart.items.map((i: any) => ({ ...i.product, quantity: i.quantity, id: i.product.id || i.product._id }));
        set({ items });
      }
    } catch(e) { console.error("Cart fetch error", e); }
  },
  addItem: async (product) => {
    const ex = get().items.find((i) => i.id === product.id);
    if (ex) {
      set({ items: get().items.map((i) => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i) });
    } else {
      set({ items: [...get().items, { ...product, quantity: 1 }] });
    }
    try { await cartApi.addItem(product.id, 1); } catch (e) { console.error(e); }
  },
  removeItem: async (id) => {
    set({ items: get().items.filter((i) => i.id !== id) });
    try { await cartApi.removeItem(id); } catch (e) { console.error(e); }
  },
  updateQty: async (id, qty) => {
    if (qty === 0) {
      set({ items: get().items.filter((i) => i.id !== id) });
      try { await cartApi.removeItem(id); } catch (e) { console.error(e); }
    } else {
      set({ items: get().items.map((i) => i.id === id ? { ...i, quantity: qty } : i) });
      try { await cartApi.updateQuantity(id, qty); } catch (e) { console.error(e); }
    }
  },
  toggleWishlist: (id) => set((s) => ({
    wishlist: s.wishlist.includes(id) ? s.wishlist.filter((w) => w !== id) : [...s.wishlist, id],
  })),
  total: () => get().items.reduce((s, i) => s + i.price * i.quantity, 0),
  count: () => get().items.reduce((s, i) => s + i.quantity, 0),
}));`;
content = content.replace(useCartOld, useCartNew);

// 3. Inject useProductStore
const useProductStoreText = `

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
      const products = (data.items || data).map((p: any) => ({ ...p, id: p.id || p._id }));
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

`;

content = content.replace('// ─── Mock Data ────────────────────────────────────────────────────────────────', '// ─── Store Integration ────────────────────────────────────────────────────────\n' + useProductStoreText + '\n// ─── Mock Data ────────────────────────────────────────────────────────────────');

// 4. Update components to use the store instead of global arrays
content = content.replace(/function HeroCarousel\(\{ onAddToCart, onProductClick \}:[^{]*\{/g, 'function HeroCarousel({ onAddToCart, onProductClick }: { onAddToCart: (p: Product) => void; onProductClick: (p: Product) => void }) {\n  const { heroProducts } = useProductStore();');
content = content.replace(/function RecommendedSection\(\{ onAddToCart, onProductClick \}:[^{]*\{/g, 'function RecommendedSection({ onAddToCart, onProductClick }: { onAddToCart: (p: Product) => void; onProductClick: (p: Product) => void }) {\n  const { recommendedProducts } = useProductStore();');
content = content.replace(/function RecentlyViewedSection\(\{ onAddToCart, onProductClick \}:[^{]*\{/g, 'function RecentlyViewedSection({ onAddToCart, onProductClick }: { onAddToCart: (p: Product) => void; onProductClick: (p: Product) => void }) {\n  const dark = useDark();\n  const { recentlyViewed } = useProductStore();');
content = content.replace(/function TrendingSection\(\{ onAddToCart, onProductClick \}:[^{]*\{/g, 'function TrendingSection({ onAddToCart, onProductClick }: { onAddToCart: (p: Product) => void; onProductClick: (p: Product) => void }) {\n  const { trendingProducts } = useProductStore();');
content = content.replace(/function BestSellersSection\(\{ onAddToCart, onProductClick \}:[^{]*\{/g, 'function BestSellersSection({ onAddToCart, onProductClick }: { onAddToCart: (p: Product) => void; onProductClick: (p: Product) => void }) {\n  const { bestSellers } = useProductStore();');
content = content.replace(/function WishlistDrawer\(\{ open, onClose, onAddToCart \}:[^{]*\{/g, 'function WishlistDrawer({ open, onClose, onAddToCart }: { open: boolean; onClose: () => void; onAddToCart: (p: Product) => void }) {\n  const dark = useDark();\n  const { allProducts } = useProductStore();');
content = content.replace(/const wishlistProducts = allProducts\.filter\(p => wishlist\.includes\(p\.id\)\);/g, 'const wishlistProducts = allProducts.filter((p: Product) => wishlist.includes(p.id));');

// Delete the old global arrays if we want, or just leave them. We'll leave them but they will be shadowed or just unused by the components since we fetch them. Actually the mock data might still be used if we don't remove it. But let's just delete the 'const allProducts = ...' line at least.
content = content.replace(/const allProducts = \[...heroProducts, ...recommendedProducts, ...recentlyViewed, ...trendingProducts, ...bestSellers\];/g, '');

// 5. Update App component to fetch data on mount
content = content.replace(
  '  useEffect(() => {\n    const handleOnline = () => setIsOffline(false);',
  '  useEffect(() => {\n    useProductStore.getState().fetchProducts();\n    useCart.getState().fetchCart();\n\n    const handleOnline = () => setIsOffline(false);'
);

// 6. Fix SearchResults which takes allProducts as prop! Wait, App passes allProducts to SearchResults
content = content.replace(
  '            allProducts={allProducts}',
  '            allProducts={useProductStore().allProducts}'
);


fs.writeFileSync(path, content, 'utf8');
console.log('App.tsx refactored successfully.');
