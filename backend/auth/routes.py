from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import Optional
from pydantic import BaseModel, EmailStr

from database import get_db
from models.user import User, UserRole
from auth.utils import (
    verify_password,
    create_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    verify_token,
    get_password_hash
)

router = APIRouter()

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    db: Session = Depends(get_db)
):
    """Register a new user."""
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(request.password)
    new_user = User(
        email=request.email,
        username=request.name,  # Using name as username for simplicity
        hashed_password=hashed_password,
        role=UserRole.USER,
        is_active=True
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {"message": "User registered successfully"}

@router.post("/login")
async def login(
    request: LoginRequest,
    db: Session = Depends(get_db)
):
    # Try to authenticate with email
    user = db.query(User).filter(User.email == request.username).first()
    if not user:
        # Try to authenticate with username
        user = db.query(User).filter(User.username == request.username).first()
    
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "role": user.role
        }
    }

@router.get("/me")
async def read_users_me(token: str = Depends(verify_token), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == token["sub"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "role": user.role
    } 