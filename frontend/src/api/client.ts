/**
 * VANI API Client — connects the React frontend to the FastAPI backend.
 *
 * Base URL defaults to http://localhost:8000/api
 * All authenticated requests include the JWT token from localStorage.
 */

const API_BASE = "http://localhost:8000/api";

// ── Token Management ──────────────────────────────────────────────────────

function getToken(): string | null {
  return localStorage.getItem("vani_token");
}

function setToken(token: string): void {
  localStorage.setItem("vani_token", token);
}

function clearToken(): void {
  localStorage.removeItem("vani_token");
}

function getStoredUser(): any | null {
  const raw = localStorage.getItem("vani_user");
  return raw ? JSON.parse(raw) : null;
}

function setStoredUser(user: any): void {
  localStorage.setItem("vani_user", JSON.stringify(user));
}

function clearStoredUser(): void {
  localStorage.removeItem("vani_user");
}

// ── HTTP Helpers ──────────────────────────────────────────────────────────

async function request(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = error.detail;
    const message = Array.isArray(detail)
      ? detail.map((e: { msg?: string }) => e.msg).filter(Boolean).join(", ")
      : typeof detail === "string"
        ? detail
        : `Request failed: ${res.status}`;
    throw new Error(message || `Request failed: ${res.status}`);
  }

  return res.json();
}

// ── Auth API ──────────────────────────────────────────────────────────────

export const authApi = {
  async register(name: string, email: string, password: string) {
    const data = await request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    setToken(data.access_token);
    setStoredUser(data.user);
    return data;
  },

  async login(email: string, password: string) {
    const data = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(data.access_token);
    setStoredUser(data.user);
    return data;
  },

  async getProfile() {
    return request("/auth/me");
  },

  logout() {
    clearToken();
    clearStoredUser();
  },

  isAuthenticated(): boolean {
    return !!getToken();
  },

  getUser() {
    return getStoredUser();
  },
};

// ── Products API ──────────────────────────────────────────────────────────

export const productsApi = {
  async list(params: {
    page?: number;
    limit?: number;
    category?: string;
    brand?: string;
    price_min?: number;
    price_max?: number;
    rating_min?: number;
    sort_by?: string;
  } = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.set(key, String(value));
      }
    });
    const qs = searchParams.toString();
    return request(`/products${qs ? `?${qs}` : ""}`);
  },

  async getById(productId: string) {
    return request(`/products/${productId}`);
  },

  async search(query: string, params: {
    category?: string;
    color?: string;
    brand?: string;
    price_min?: number;
    price_max?: number;
    rating_min?: number;
    sort_by?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const searchParams = new URLSearchParams({ q: query });
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.set(key, String(value));
      }
    });
    return request(`/products/search?${searchParams.toString()}`);
  },

  async getCategories(): Promise<string[]> {
    return request("/products/categories");
  },
};

// ── Cart API ──────────────────────────────────────────────────────────────

export const cartApi = {
  async get() {
    return request("/cart");
  },

  async addItem(productId: string, quantity: number = 1) {
    return request("/cart/add", {
      method: "POST",
      body: JSON.stringify({ product_id: productId, quantity }),
    });
  },

  async updateQuantity(productId: string, quantity: number) {
    return request("/cart/update", {
      method: "PUT",
      body: JSON.stringify({ product_id: productId, quantity }),
    });
  },

  async removeItem(productId: string) {
    return request(`/cart/${productId}`, { method: "DELETE" });
  },
};

// ── Orders API ────────────────────────────────────────────────────────────

export const ordersApi = {
  async create(shippingAddress: {
    name: string;
    street: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
  }) {
    return request("/orders", {
      method: "POST",
      body: JSON.stringify({ shipping_address: shippingAddress }),
    });
  },

  async list() {
    return request("/orders");
  },

  async getById(orderId: string) {
    return request(`/orders/${orderId}`);
  },
};

// ── Voice API ─────────────────────────────────────────────────────────────

export const voiceApi = {
  async processCommand(command: string) {
    return request("/voice/command", {
      method: "POST",
      body: JSON.stringify({ command }),
    });
  },

  async getAnalytics() {
    return request("/voice/analytics");
  },
};

// ── Health API ────────────────────────────────────────────────────────────

export const healthApi = {
  async check() {
    return request("/health");
  },
};
