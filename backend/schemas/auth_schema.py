"""Authentication request/response schemas."""

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    """Schema for user registration."""
    name: str = Field(..., min_length=2, max_length=100, examples=["John Doe"])
    email: EmailStr = Field(..., examples=["john@example.com"])
    password: str = Field(..., min_length=6, max_length=128, examples=["securePassword123"])


class LoginRequest(BaseModel):
    """Schema for user login."""
    email: EmailStr = Field(..., examples=["john@example.com"])
    password: str = Field(..., examples=["securePassword123"])


class UserResponse(BaseModel):
    """Schema for user info in responses."""
    id: str
    name: str
    email: str


class AuthResponse(BaseModel):
    """Schema for authentication response with token."""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
