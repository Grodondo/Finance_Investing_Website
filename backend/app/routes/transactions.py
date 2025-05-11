from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from pydantic import BaseModel
from models.models import TransactionType

from database import get_db
from models.transaction import Transaction
from models.user import User
from auth.utils import verify_token

router = APIRouter()

class TransactionBase(BaseModel):
    amount: float
    description: str
    type: TransactionType
    category_id: int

class TransactionCreate(TransactionBase):
    pass

class TransactionResponse(TransactionBase):
    id: int
    date: datetime
    user_id: int

    class Config:
        from_attributes = True

@router.get("/transactions", response_model=List[TransactionResponse])
async def get_transactions(
    token: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get all transactions for the authenticated user."""
    user = db.query(User).filter(User.email == token["sub"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    transactions = db.query(Transaction).filter(Transaction.user_id == user.id).all()
    return transactions

@router.post("/transactions", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    transaction: TransactionCreate,
    token: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Create a new transaction for the authenticated user."""
    user = db.query(User).filter(User.email == token["sub"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    db_transaction = Transaction(
        **transaction.model_dump(),
        user_id=user.id
    )
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction

@router.get("/transactions/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: int,
    token: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get a specific transaction by ID."""
    user = db.query(User).filter(User.email == token["sub"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    transaction = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.user_id == user.id
    ).first()
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )
    return transaction

@router.put("/transactions/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: int,
    transaction: TransactionCreate,
    token: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Update a specific transaction."""
    user = db.query(User).filter(User.email == token["sub"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    db_transaction = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.user_id == user.id
    ).first()
    if not db_transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )
    
    for key, value in transaction.model_dump().items():
        setattr(db_transaction, key, value)
    
    db.commit()
    db.refresh(db_transaction)
    return db_transaction

@router.delete("/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: int,
    token: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Delete a specific transaction."""
    user = db.query(User).filter(User.email == token["sub"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    transaction = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.user_id == user.id
    ).first()
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )
    
    db.delete(transaction)
    db.commit()
    return None 