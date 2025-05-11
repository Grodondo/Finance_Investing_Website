from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import List, Dict
from datetime import datetime, timedelta
from pydantic import BaseModel

from database import get_db
from models.transaction import Transaction
from auth.utils import verify_token
from models.user import User

router = APIRouter()

class CategoryInsight(BaseModel):
    category_id: int
    category_name: str
    total_amount: float
    transaction_count: int

class MonthlyInsight(BaseModel):
    month: str
    income: float
    expenses: float
    balance: float

class FinancialInsights(BaseModel):
    total_income: float
    total_expenses: float
    net_balance: float
    top_expense_categories: List[CategoryInsight]
    monthly_trends: List[MonthlyInsight]

@router.get("/insights", response_model=FinancialInsights)
async def get_financial_insights(
    token: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get financial insights for the authenticated user."""
    # Get user from token
    user = db.query(User).filter(User.email == token["sub"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get total income and expenses
    income_result = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == user.id,
        Transaction.type == "income"
    ).scalar() or 0.0
    
    expenses_result = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == user.id,
        Transaction.type == "expense"
    ).scalar() or 0.0
    
    # Get top expense categories
    top_categories = db.query(
        Transaction.category_id,
        func.count(Transaction.id).label('transaction_count'),
        func.sum(Transaction.amount).label('total_amount')
    ).filter(
        Transaction.user_id == user.id,
        Transaction.type == "expense"
    ).group_by(Transaction.category_id).order_by(func.sum(Transaction.amount).desc()).limit(5).all()
    
    # Get monthly trends for the last 6 months
    six_months_ago = datetime.utcnow() - timedelta(days=180)
    monthly_trends = db.query(
        func.date_trunc('month', Transaction.date).label('month'),
        func.sum(case((Transaction.type == "income", Transaction.amount), else_=0)).label('income'),
        func.sum(case((Transaction.type == "expense", Transaction.amount), else_=0)).label('expenses')
    ).filter(
        Transaction.user_id == user.id,
        Transaction.date >= six_months_ago
    ).group_by(func.date_trunc('month', Transaction.date)).order_by('month').all()
    
    # Format the response
    insights = FinancialInsights(
        total_income=float(income_result),
        total_expenses=float(expenses_result),
        net_balance=float(income_result - expenses_result),
        top_expense_categories=[
            CategoryInsight(
                category_id=cat.category_id,
                category_name=cat.category.name if cat.category else "Uncategorized",
                total_amount=float(cat.total_amount),
                transaction_count=cat.transaction_count
            ) for cat in top_categories
        ],
        monthly_trends=[
            MonthlyInsight(
                month=trend.month.strftime("%Y-%m"),
                income=float(trend.income or 0),
                expenses=float(trend.expenses or 0),
                balance=float((trend.income or 0) - (trend.expenses or 0))
            ) for trend in monthly_trends
        ]
    )
    
    return insights 