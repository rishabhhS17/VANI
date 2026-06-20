"""
VANI API — Voice Assisted Navigation for Intelligent Commerce

Production-ready FastAPI backend for the VANI voice-commerce platform.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database.connection import connect_to_mongodb, close_mongodb_connection
from routes.auth_routes import router as auth_router
from routes.product_routes import router as product_router
from routes.cart_routes import router as cart_router
from routes.order_routes import router as order_router
from routes.voice_routes import router as voice_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle — startup and shutdown events."""
    # Startup
    await connect_to_mongodb()
    yield
    # Shutdown
    await close_mongodb_connection()


app = FastAPI(
    title="VANI API",
    description=(
        "Voice Assisted Navigation for Intelligent Commerce. "
        "A production-ready backend for voice-controlled e-commerce."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",    # Vite dev server
        "http://localhost:3000",    # Alternate dev port
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount Routers ──────────────────────────────────────────────────────────

app.include_router(auth_router, prefix="/api")
app.include_router(product_router, prefix="/api")
app.include_router(cart_router, prefix="/api")
app.include_router(order_router, prefix="/api")
app.include_router(voice_router, prefix="/api")


# ── Health Check ───────────────────────────────────────────────────────────

@app.get("/api/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "VANI API",
        "version": "1.0.0",
    }


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint — API info."""
    return {
        "message": "Welcome to VANI API — Voice Assisted Navigation for Intelligent Commerce",
        "docs": "/docs",
        "health": "/api/health",
    }
