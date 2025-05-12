from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import yfinance as yf
import time
import pandas as pd
import logging
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
    StockSearchResult,
)
from ..models.user import User

# Set up logger
logger = logging.getLogger(__name__)

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

async def get_stock_data(symbol: str, db: Session) -> StockDetail:
    """Get detailed stock data from Yahoo Finance and sync with database."""
    try:
        # Check if we have the stock in database
        db_stock = db.query(Stock).filter(Stock.symbol == symbol).first()
        logger.info(f"Database lookup for {symbol}: {'Found' if db_stock else 'Not found'}")
        
        # Get data from Yahoo Finance
        logger.info(f"Fetching data for symbol: {symbol}")
        ticker = yf.Ticker(symbol)
        
        # Get basic info first
        try:
            info = ticker.info
            logger.info(f"Successfully fetched basic info for {symbol}")
            logger.debug(f"Available info keys: {list(info.keys())}")
        except Exception as e:
            logger.error(f"Error fetching basic info for {symbol}: {str(e)}")
            raise HTTPException(
                status_code=404,
                detail=f"Could not fetch stock info for {symbol}: {str(e)}"
            )
        
        # Get historical data for the last 30 days
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)
        logger.info(f"Fetching historical data from {start_date} to {end_date}")
        
        try:
            hist = ticker.history(start=start_date, end=end_date, interval='1d')
            logger.info(f"Historical data shape: {hist.shape if not hist.empty else 'Empty'}")
            
            if hist.empty:
                logger.warning(f"No historical data available for {symbol} in 30-day range")
                # Try getting a shorter period if 30 days fails
                logger.info("Attempting to fetch 1-month period instead")
                hist = ticker.history(period="1mo", interval='1d')
                logger.info(f"1-month period data shape: {hist.shape if not hist.empty else 'Empty'}")
                
                if hist.empty:
                    logger.warning(f"Still no historical data available for {symbol}")
                    # Try one last time with a different interval
                    logger.info("Attempting to fetch with 1d interval")
                    hist = ticker.history(period="1mo", interval='1d', auto_adjust=True)
                    logger.info(f"Final attempt data shape: {hist.shape if not hist.empty else 'Empty'}")
        except Exception as e:
            logger.error(f"Error fetching historical data for {symbol}: {str(e)}")
            hist = pd.DataFrame()  # Empty DataFrame as fallback
        
        # Convert historical data to list of dicts
        historical_data = []
        if not hist.empty:
            for date, row in hist.iterrows():
                try:
                    historical_data.append({
                        'date': date.strftime('%Y-%m-%d'),
                        'price': float(row['Close'])
                    })
                except Exception as e:
                    logger.error(f"Error processing historical data point for {symbol}: {str(e)}")
                    continue
            
            logger.info(f"Successfully processed {len(historical_data)} historical data points")
            if len(historical_data) > 0:
                logger.debug(f"First data point: {historical_data[0]}")
                logger.debug(f"Last data point: {historical_data[-1]}")
        else:
            logger.warning(f"No historical data points available for {symbol}")
        
        current_time = datetime.utcnow()
        
        # Prepare stock data
        try:
            stock_data = {
                'symbol': symbol,
                'name': info.get('longName', symbol),
                'current_price': float(info.get('currentPrice', 0)),
                'change': float(info.get('regularMarketChange', 0)),
                'change_percent': float(info.get('regularMarketChangePercent', 0)),
                'volume': int(info.get('regularMarketVolume', 0)),
                'market_cap': float(info.get('marketCap', 0)),
                'fifty_two_week_high': float(info.get('fiftyTwoWeekHigh', 0)),
                'fifty_two_week_low': float(info.get('fiftyTwoWeekLow', 0)),
                'historical_data': historical_data,
                'last_updated': current_time
            }
            logger.info(f"Stock data prepared successfully for {symbol}")
            logger.debug(f"Stock data keys: {list(stock_data.keys())}")
        except Exception as e:
            logger.error(f"Error preparing stock data for {symbol}: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Error preparing stock data: {str(e)}"
            )
        
        # Update or create stock in database
        try:
            if db_stock:
                for key, value in stock_data.items():
                    if key not in ['historical_data', 'last_updated']:
                        setattr(db_stock, key, value)
                db_stock.last_updated = current_time
                logger.info(f"Updated existing stock record for {symbol}")
            else:
                db_stock = Stock(**{k: v for k, v in stock_data.items() if k not in ['historical_data', 'last_updated']})
                db_stock.last_updated = current_time
                db.add(db_stock)
                logger.info(f"Created new stock record for {symbol}")
            
            db.commit()
            db.refresh(db_stock)
        except Exception as e:
            logger.error(f"Database error for {symbol}: {str(e)}")
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Database error: {str(e)}"
            )
        
        # Create StockDetail with database ID and historical data
        try:
            stock_detail = StockDetail(
                id=db_stock.id,
                **stock_data
            )
            logger.info(f"Successfully created StockDetail for {symbol} with {len(stock_detail.historical_data)} historical data points")
            return stock_detail
        except Exception as e:
            logger.error(f"Error creating StockDetail for {symbol}: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Error creating stock detail: {str(e)}"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error fetching stock data for {symbol}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error: {str(e)}"
        )

@router.get("/stocks/search", response_model=List[StockSearchResult])
async def search_stocks(
    q: str,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token)
):
    """Search for stocks by symbol or name using database search"""
    if not q or len(q) < 2:
        return []
    
    try:
        # Search in database for matching symbols or names
        search_query = f"%{q}%"
        stocks = db.query(Stock).filter(
            (Stock.symbol.ilike(search_query)) | (Stock.name.ilike(search_query))
        ).limit(10).all()
        
        # If we have results in database, return them
        if stocks:
            return [StockSearchResult(symbol=stock.symbol, name=stock.name) for stock in stocks]
        
        # If no results in database, try to fetch from Yahoo Finance
        try:
            # Try to get stock info directly
            ticker = yf.Ticker(q)
            info = ticker.info
            
            if info and 'symbol' in info:
                symbol = info['symbol']
                name = info.get('longName') or info.get('shortName') or symbol
                
                # Create new stock in database
                stock = Stock(
                    symbol=symbol,
                    name=name,
                    current_price=info.get('currentPrice', 0),
                    last_updated=datetime.utcnow()
                )
                db.add(stock)
                db.commit()
                db.refresh(stock)
                
                return [StockSearchResult(symbol=symbol, name=name)]
            
            return []
            
        except Exception as e:
            print(f"Error fetching stock info: {str(e)}")
            return []
            
    except Exception as e:
        print(f"Error searching stocks: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search stocks: {str(e)}"
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
    return await get_stock_data(symbol, db)

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
        stock_data = await get_stock_data(holding.stock.symbol, db)
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
    stock_data = await get_stock_data(stock.symbol, db)
    
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
    """Get user's watchlist with detailed stock information"""
    # Get user from token
    user = db.query(User).filter(User.email == token["sub"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    try:
        # Get watchlist items with stock information
        watchlist_items = (
            db.query(Watchlist)
            .join(Stock, Watchlist.stock_id == Stock.id)
            .filter(Watchlist.user_id == user.id)
            .all()
        )
        
        result = []
        for item in watchlist_items:
            try:
                # Get fresh stock data
                stock_data = await get_stock_data(item.stock.symbol, db)
                
                # Get user's holdings for this stock if any
                holding = db.query(Holding).filter(
                    Holding.user_id == user.id,
                    Holding.stock_id == item.stock.id
                ).first()
                
                result.append(WatchlistItem(
                    id=item.stock.id,  # Add stock ID for reference
                    symbol=stock_data.symbol,
                    name=stock_data.name,
                    current_price=stock_data.current_price,
                    change=stock_data.change,
                    change_percent=stock_data.change_percent,
                    volume=stock_data.volume,
                    market_cap=stock_data.market_cap,
                    shares_owned=holding.shares if holding else 0,  # Add shares owned
                    total_value=holding.shares * stock_data.current_price if holding else 0  # Add total value
                ))
            except Exception as e:
                print(f"Error fetching stock data for {item.stock.symbol}: {str(e)}")
                # Include basic stock info even if we can't get fresh data
                result.append(WatchlistItem(
                    id=item.stock.id,
                    symbol=item.stock.symbol,
                    name=item.stock.name,
                    current_price=item.stock.current_price,
                    change=0,
                    change_percent=0,
                    volume=0,
                    market_cap=0,
                    shares_owned=0,
                    total_value=0
                ))
                continue
        
        return result
    except Exception as e:
        print(f"Error fetching watchlist: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch watchlist: {str(e)}"
        )

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