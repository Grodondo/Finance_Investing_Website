from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import yfinance as yf
import time
from ..db.database import get_db
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

# Cache for stock data
stock_cache: Dict[str, tuple[StockDetail, datetime]] = {}
CACHE_DURATION = timedelta(minutes=5)  # Cache data for 5 minutes
RATE_LIMIT_WINDOW = 60  # 60 seconds window
MAX_REQUESTS_PER_WINDOW = 5  # Maximum requests per minute
BACKOFF_PERIOD = 30  # 30 seconds backoff when rate limited
last_request_times: List[float] = []
rate_limited_until: Optional[float] = None  # Timestamp until which we're rate limited

def check_rate_limit() -> bool:
    """Check if we're within rate limits"""
    global rate_limited_until, last_request_times
    
    current_time = time.time()
    
    # Check if we're in backoff period
    if rate_limited_until is not None:
        if current_time < rate_limited_until:
            remaining = int(rate_limited_until - current_time)
            print(f"Still in backoff period, {remaining} seconds remaining")  # Debug log
            return False
        else:
            print("Backoff period ended, resetting rate limit state")  # Debug log
            rate_limited_until = None
            last_request_times = []  # Reset request history after backoff
    
    # Remove requests older than the window
    while last_request_times and current_time - last_request_times[0] > RATE_LIMIT_WINDOW:
        last_request_times.pop(0)
    
    if len(last_request_times) >= MAX_REQUESTS_PER_WINDOW:
        rate_limited_until = current_time + BACKOFF_PERIOD
        print(f"Rate limit window full, entering {BACKOFF_PERIOD}s backoff period")  # Debug log
        return False
    
    last_request_times.append(current_time)
    return True

def handle_rate_limit(symbol: str) -> Optional[StockDetail]:
    """Handle rate limit by either returning cached data or raising an exception"""
    global rate_limited_until
    
    current_time = time.time()
    if rate_limited_until is None:
        rate_limited_until = current_time + BACKOFF_PERIOD
        print(f"Rate limit hit, entering {BACKOFF_PERIOD}s backoff period")  # Debug log
    
    # If we have cached data, return it even if expired
    if symbol in stock_cache:
        cache_age = datetime.utcnow() - stock_cache[symbol][1]
        print(f"Rate limit hit, returning cache for {symbol} (age: {cache_age.total_seconds():.0f}s)")  # Debug log
        return stock_cache[symbol][0]
    
    remaining = int(rate_limited_until - current_time)
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=f"Rate limit exceeded. Please try again in {remaining} seconds"
    )

async def get_stock_data(symbol: str) -> StockDetail:
    """Fetch stock data from Yahoo Finance with caching and rate limiting"""
    try:
        # Format and validate symbol
        symbol = symbol.strip().upper()
        if not symbol:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Stock symbol cannot be empty"
            )
        
        # Check cache first
        if symbol in stock_cache:
            cached_data, cache_time = stock_cache[symbol]
            if datetime.utcnow() - cache_time < CACHE_DURATION:
                print(f"Returning cached data for {symbol}")  # Debug log
                return cached_data
        
        # Check rate limit
        if not check_rate_limit():
            return handle_rate_limit(symbol)
        
        print(f"Fetching stock data for symbol: {symbol}")  # Debug log
        stock = yf.Ticker(symbol)
        print(f"Got Ticker object for {symbol}")  # Debug log
        
        # Verify the stock exists by trying to get its info
        try:
            print(f"Attempting to get stock info for {symbol}")  # Debug log
            info = stock.info
            print(f"Stock info keys: {list(info.keys()) if info else 'None'}")  # Debug log
            if not info:
                print(f"No info returned for {symbol}")  # Debug log
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Stock symbol {symbol} not found"
                )
        except Exception as e:
            print(f"Error getting stock info for {symbol}: {str(e)}")  # Debug log
            # Check if it's a rate limit error
            if "429" in str(e) or "Too Many Requests" in str(e):
                return handle_rate_limit(symbol)
            # For other errors, try to use cache if available
            if symbol in stock_cache:
                print(f"Error fetching new data, returning expired cache for {symbol}")  # Debug log
                return stock_cache[symbol][0]
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Invalid stock symbol {symbol}: {str(e)}"
            )
        
        # Get historical data
        try:
            print(f"Attempting to get historical data for {symbol}")  # Debug log
            hist = stock.history(period="1y")
            print(f"Historical data shape: {hist.shape if not hist.empty else 'Empty'}")  # Debug log
            if hist.empty:
                print(f"No historical data for {symbol}")  # Debug log
                # If we have cached data, return it even if expired
                if symbol in stock_cache:
                    print(f"No historical data, returning expired cache for {symbol}")  # Debug log
                    return stock_cache[symbol][0]
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No historical data available for {symbol}"
                )
        except Exception as e:
            print(f"Error getting historical data for {symbol}: {str(e)}")  # Debug log
            # Check if it's a rate limit error
            if "429" in str(e) or "Too Many Requests" in str(e):
                return handle_rate_limit(symbol)
            # For other errors, try to use cache if available
            if symbol in stock_cache:
                print(f"Error fetching historical data, returning expired cache for {symbol}")  # Debug log
                return stock_cache[symbol][0]
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Failed to fetch historical data for {symbol}: {str(e)}"
            )
        
        # Calculate change and change percent
        current_price = info.get('currentPrice', 0)
        if current_price == 0:
            current_price = info.get('regularMarketPrice', 0)
        if current_price == 0:
            # If we have cached data, return it even if expired
            if symbol in stock_cache:
                print(f"No current price, returning expired cache for {symbol}")  # Debug log
                return stock_cache[symbol][0]
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Could not get current price for {symbol}"
            )
            
        previous_close = info.get('previousClose', current_price)
        change = current_price - previous_close
        change_percent = (change / previous_close) * 100 if previous_close else 0

        # Format historical data
        historical_data = [
            {"date": index.to_pydatetime(), "price": row['Close']}
            for index, row in hist.iterrows()
        ]

        stock_detail = StockDetail(
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
        
        # Cache the result
        stock_cache[symbol] = (stock_detail, datetime.utcnow())
        print(f"Cached new data for {symbol}")  # Debug log
        
        return stock_detail
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching stock data for {symbol}: {str(e)}")  # Debug log
        # If we have cached data, return it even if expired
        if symbol in stock_cache:
            print(f"Unexpected error, returning expired cache for {symbol}")  # Debug log
            return stock_cache[symbol][0]
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch stock data: {str(e)}"
        )

@router.get("/stocks/{symbol}", response_model=StockDetail)
async def get_stock(
    symbol: str,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token)
):
    """Get detailed stock information"""
    # Get user from token
    user = db.query(User).filter(User.email == token["sub"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return await get_stock_data(symbol)

@router.get("/portfolio", response_model=Portfolio)
async def get_portfolio(
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token)
):
    """Get user's portfolio overview"""
    # Get user from token
    user = db.query(User).filter(User.email == token["sub"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    holdings = db.query(Holding).filter(Holding.user_id == user.id).all()
    
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
    token: dict = Depends(verify_token)
):
    """Create a new buy/sell order"""
    # Get user from token
    user = db.query(User).filter(User.email == token["sub"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
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
            Holding.user_id == user.id,
            Holding.stock_id == order.stock_id
        ).first()
        
        if not holding or holding.shares < order.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Insufficient shares for sell order"
            )
    
    # Create order
    db_order = Order(
        user_id=user.id,
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
                Holding.user_id == user.id,
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
                    user_id=user.id,
                    stock_id=order.stock_id,
                    shares=order.quantity,
                    average_price=stock_data.current_price
                )
                db.add(holding)
        else:  # SELL
            # Update holding
            holding = db.query(Holding).filter(
                Holding.user_id == user.id,
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
    token: dict = Depends(verify_token)
):
    """Get user's watchlist"""
    # Get user from token
    user = db.query(User).filter(User.email == token["sub"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    watchlist_items = db.query(Watchlist).filter(Watchlist.user_id == user.id).all()
    
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
    token: dict = Depends(verify_token)
):
    """Add a stock to user's watchlist"""
    # Get user from token
    user = db.query(User).filter(User.email == token["sub"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Verify stock exists
    stock = db.query(Stock).filter(Stock.id == watchlist_item.stock_id).first()
    if not stock:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stock not found"
        )
    
    # Check if already in watchlist
    existing = db.query(Watchlist).filter(
        Watchlist.user_id == user.id,
        Watchlist.stock_id == watchlist_item.stock_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stock already in watchlist"
        )
    
    # Add to watchlist
    db_watchlist = Watchlist(
        user_id=user.id,
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
    token: dict = Depends(verify_token)
):
    """Remove a stock from user's watchlist"""
    # Get user from token
    user = db.query(User).filter(User.email == token["sub"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    watchlist_item = db.query(Watchlist).filter(
        Watchlist.user_id == user.id,
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