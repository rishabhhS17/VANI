"""Authentication routes — register, login, profile."""

from fastapi import APIRouter, Depends

from schemas.auth_schema import RegisterRequest, LoginRequest, AuthResponse, UserResponse
from services import auth_service
from middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(request: RegisterRequest):
    """Register a new user account."""
    result = await auth_service.register_user(
        name=request.name,
        email=request.email,
        password=request.password,
    )
    return result


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    """Login with email and password to get an access token."""
    result = await auth_service.login_user(
        email=request.email,
        password=request.password,
    )
    return result


@router.get("/me", response_model=UserResponse)
async def get_profile(user: dict = Depends(get_current_user)):
    """Get the current authenticated user's profile."""
    result = await auth_service.get_user_profile(user["sub"])
    return result
