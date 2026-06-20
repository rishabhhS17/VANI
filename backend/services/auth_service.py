"""Authentication service — registration and login logic."""

from fastapi import HTTPException, status

from database.connection import get_database
from models.user import create_user_document
from utils.password_utils import hash_password, verify_password
from utils.jwt_handler import create_access_token


async def register_user(name: str, email: str, password: str) -> dict:
    """Register a new user. Returns auth response dict."""
    db = get_database()
    email = email.lower().strip()

    # Check for duplicate email
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    # Create and insert user
    password_hash = hash_password(password)
    user_doc = create_user_document(name, email, password_hash)
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    # Generate token
    token = create_access_token(user_id, email)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "name": name,
            "email": email,
        },
    }


async def login_user(email: str, password: str) -> dict:
    """Authenticate a user. Returns auth response dict."""
    db = get_database()
    email = email.lower().strip()

    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not verify_password(password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    user_id = str(user["_id"])
    token = create_access_token(user_id, email)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "name": user["name"],
            "email": user["email"],
        },
    }


async def get_user_profile(user_id: str) -> dict:
    """Get user profile by ID."""
    from bson import ObjectId

    db = get_database()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "email": user["email"],
    }
