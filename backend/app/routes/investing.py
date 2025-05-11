from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta
import yfinance as yf
from ..database import get_db
from ..auth.utils import verify_token
from ..models.investing import Stock, Holding, Order, Watchlist, OrderType
from ..schemas.investing import (
    StockDetail,
    Portfolio,
    OrderCreate,
    Order as OrderSchema,
    WatchlistCreate,
    Watchlist as WatchlistSchema,
    WatchlistItem,
)
from ..models.user import User

router = APIRouter()

async def get_stock_data(symbol: str) -> StockDetail:
    """Fetch stock data from Yahoo Finance"""
    try:
        stock = yf.Ticker(symbol)
        info = stock.info
        hist = stock.history(period="1y")
        
        # Calculate change and change percent
        current_price = info.get('currentPrice', 0)
        previous_close = info.get('previousClose', current_price)
        change = current_price - previous_close
        change_percent = (change / previous_close) * 100 if previous_close else 0

        # Format historical data
        historical_data = [
            {"date": index.to_pydatetime(), "price": row['Close']}
            for index, row in hist.iterrows()
        ]

        return StockDetail(
            symbol=symbol,
            name=info.get('longName', symbol),
            current_price=current_price,
            last_updated=datetime.utcnow(),
            historical_data=historical_data,
            volume=info.get('volume', 0),
            market_cap=info.get('marketCap', 0),
            change=change,
            change_percent=change_percent
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Failed to fetch stock data: {str(e)}"
        )

@router.get("/stocks/{symbol}", response_model=StockDetail)
async def get_stock(
    symbol: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_token)
):
    """Get detailed stock information"""
    return await get_stock_data(symbol)

@router.get("/portfolio", response_model=Portfolio)
async def get_portfolio(
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_token)
):
    """Get user's portfolio overview"""
    holdings = db.query(Holding).filter(Holding.user_id == current_user.id).all()
    
    # Calculate portfolio metrics
    total_value = 0
    previous_value = 0
    
    for holding in holdings:
        # Get current stock price
        stock_data = await get_stock_data(holding.stock.symbol)
        current_price = stock_data.current_price
        
        # Calculate holding value and gain/loss
        holding.total_value = holding.shares * current_price
        holding.gain_loss = holding.total_value - (holding.shares * holding.average_price)
        holding.gain_loss_percent = (holding.gain_loss / (holding.shares * holding.average_price)) * 100
        
        total_value += holding.total_value
        
        # Get previous day's value
        previous_price = stock_data.historical_data[-2]['price'] if len(stock_data.historical_data) > 1 else current_price
        previous_value += holding.shares * previous_price
    
    daily_change = total_value - previous_value
    daily_change_percent = (daily_change / previous_value) * 100 if previous_value else 0
    
    return Portfolio(
        total_value=total_value,
        daily_change=daily_change,
        daily_change_percent=daily_change_percent,
        holdings=holdings
    )

@router.post("/orders", response_model=OrderSchema)
async def create_order(
    order: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_token)
):
    """Create a new buy/sell order"""
    # Verify stock exists
    stock = db.query(Stock).filter(Stock.id == order.stock_id).first()
    if not stock:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stock not found"
        )
    
    # Get current stock price
    stock_data = await get_stock_data(stock.symbol)
    
    # Calculate total amount
    total_amount = order.quantity * stock_data.current_price
    
    # For sell orders, verify user has enough shares
    if order.type == OrderType.SELL:
        holding = db.query(Holding).filter(
            Holding.user_id == current_user.id,
            Holding.stock_id == order.stock_id
        ).first()
        
        if not holding or holding.shares < order.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Insufficient shares for sell order"
            )
    
    # Create order
    db_order = Order(
        user_id=current_user.id,
        stock_id=order.stock_id,
        type=order.type,
        quantity=order.quantity,
        price=stock_data.current_price,
        total_amount=total_amount,
        status="PENDING"
    )
    
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    
    # Process order immediately (in a real system, this would be handled by a background task)
    try:
        if order.type == OrderType.BUY:
            # Update or create holding
            holding = db.query(Holding).filter(
                Holding.user_id == current_user.id,
                Holding.stock_id == order.stock_id
            ).first()
            
            if holding:
                # Update existing holding
                total_shares = holding.shares + order.quantity
                total_cost = (holding.shares * holding.average_price) + total_amount
                holding.average_price = total_cost / total_shares
                holding.shares = total_shares
            else:
                # Create new holding
                holding = Holding(
                    user_id=current_user.id,
                    stock_id=order.stock_id,
                    shares=order.quantity,
                    average_price=stock_data.current_price
                )
                db.add(holding)
        else:  # SELL
            # Update holding
            holding = db.query(Holding).filter(
                Holding.user_id == current_user.id,
                Holding.stock_id == order.stock_id
            ).first()
            
            holding.shares -= order.quantity
            if holding.shares == 0:
                db.delete(holding)
        
        # Update order status
        db_order.status = "COMPLETED"
        db_order.completed_at = datetime.utcnow()
        
        db.commit()
        db.refresh(db_order)
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process order: {str(e)}"
        )
    
    return db_order

@router.get("/watchlist", response_model=List[WatchlistItem])
async def get_watchlist(
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_token)
):
    """Get user's watchlist"""
    watchlist_items = db.query(Watchlist).filter(Watchlist.user_id == current_user.id).all()
    
    result = []
    for item in watchlist_items:
        try:
            stock_data = await get_stock_data(item.stock.symbol)
            result.append(WatchlistItem(
                symbol=stock_data.symbol,
                name=stock_data.name,
                current_price=stock_data.current_price,
                change=stock_data.change,
                change_percent=stock_data.change_percent
            ))
        except Exception:
            continue
    
    return result

@router.post("/watchlist", response_model=WatchlistSchema)
async def add_to_watchlist(
    watchlist_item: WatchlistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_token)
):
    """Add a stock to user's watchlist"""
    # Verify stock exists
    stock = db.query(Stock).filter(Stock.id == watchlist_item.stock_id).first()
    if not stock:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stock not found"
        )
    
    # Check if already in watchlist
    existing = db.query(Watchlist).filter(
        Watchlist.user_id == current_user.id,
        Watchlist.stock_id == watchlist_item.stock_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stock already in watchlist"
        )
    
    # Add to watchlist
    db_watchlist = Watchlist(
        user_id=current_user.id,
        stock_id=watchlist_item.stock_id
    )
    
    db.add(db_watchlist)
    db.commit()
    db.refresh(db_watchlist)
    
    return db_watchlist

@router.delete("/watchlist/{stock_id}")
async def remove_from_watchlist(
    stock_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_token)
):
    """Remove a stock from user's watchlist"""
    watchlist_item = db.query(Watchlist).filter(
        Watchlist.user_id == current_user.id,
        Watchlist.stock_id == stock_id
    ).first()
    
    if not watchlist_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stock not found in watchlist"
        )
    
    db.delete(watchlist_item)
    db.commit()
    
    return {"message": "Stock removed from watchlist"} 