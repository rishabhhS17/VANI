"""JWT authentication middleware using FastAPI dependency injection."""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from utils.jwt_handler import verify_token

_security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
) -> dict:
    """
    FastAPI dependency that extracts and validates the JWT from the
    Authorization header. Returns the decoded token payload.

    Usage in routes:
        @router.get("/protected")
        async def protected_route(user: dict = Depends(get_current_user)):
            user_id = user["sub"]
    """
    token = credentials.credentials
    payload = verify_token(token)
    return payload
