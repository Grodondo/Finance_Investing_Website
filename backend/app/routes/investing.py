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
    NewsItem,
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

# News cache to avoid frequent API calls
news_cache: Dict[str, tuple[List[NewsItem], datetime]] = {}
MARKET_NEWS_CACHE_KEY = "market_news"
NEWS_CACHE_DURATION = timedelta(minutes=30)  # Cache news for 30 minutes

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
        
        # Get historical data
        end_date = datetime.now()
        
        # For 5-year data, we need to fetch a longer duration
        five_year_start_date = end_date - timedelta(days=365*5)  # 5 years
        one_year_start_date = end_date - timedelta(days=365)    # 1 year
        
        logger.info(f"Fetching 5-year historical data from {five_year_start_date} to {end_date}")
        logger.info(f"Fetching 1-year historical data from {one_year_start_date} to {end_date}")
        
        try:
            # Fetch intraday data for 1-day view with 5-minute intervals
            # First try to get 2 days of data to ensure we have enough points
            intraday_hist = ticker.history(period="2d", interval="5m")
            logger.info(f"Intraday data shape: {intraday_hist.shape if not intraday_hist.empty else 'Empty'}")
            
            if intraday_hist.empty:
                logger.warning(f"No intraday data available for {symbol}")
                # Try 1-hour interval as fallback
                intraday_hist = ticker.history(period="2d", interval="1h")
                logger.info(f"1-hour interval data shape: {intraday_hist.shape if not intraday_hist.empty else 'Empty'}")
                
                if intraday_hist.empty:
                    # If still no data, try 1-day interval - at least we'll have one point for today
                    intraday_hist = ticker.history(period="2d", interval="1d")
                    logger.info(f"1-day interval data shape: {intraday_hist.shape if not intraday_hist.empty else 'Empty'}")
            
            # Get 5-year daily data - try different approaches for reliability
            # First, use a specific date range
            five_year_hist = ticker.history(start=five_year_start_date, end=end_date, interval='1d')
            logger.info(f"5-year data shape: {five_year_hist.shape if not five_year_hist.empty else 'Empty'}")
            
            if five_year_hist.empty or len(five_year_hist) < 252*3:  # At least 3 years of data (approx 252 trading days per year)
                logger.warning(f"Insufficient 5-year data available for {symbol}, trying period='5y'")
                five_year_hist = ticker.history(period="5y", interval='1d')
                logger.info(f"5-year period data shape: {five_year_hist.shape if not five_year_hist.empty else 'Empty'}")
                
                if five_year_hist.empty or len(five_year_hist) < 252*3:
                    logger.warning(f"Still insufficient 5-year data for {symbol}, trying max period")
                    # Fall back to max data
                    five_year_hist = ticker.history(period="max", interval='1d')
                    logger.info(f"Max period data shape: {five_year_hist.shape if not five_year_hist.empty else 'Empty'}")
        except Exception as e:
            logger.error(f"Error fetching historical data for {symbol}: {str(e)}")
            intraday_hist = pd.DataFrame()
            five_year_hist = pd.DataFrame()
        
        # Convert historical data to list of dicts
        historical_data = []
        
        # Process 5-year daily data (we'll filter for other periods in the frontend)
        if not five_year_hist.empty:
            logger.info(f"Processing {len(five_year_hist)} daily data points")
            for date, row in five_year_hist.iterrows():
                try:
                    historical_data.append({
                        'date': date.strftime('%Y-%m-%d'),
                        'price': float(row['Close']),
                        'is_intraday': False  # Explicitly set to False for daily data
                    })
                except Exception as e:
                    logger.error(f"Error processing daily data point for {symbol}: {str(e)}")
                    continue
            logger.info(f"Successfully processed {len(historical_data)} daily data points")
            if len(historical_data) > 0:
                logger.debug(f"First daily point: {historical_data[0]}")
                logger.debug(f"Last daily point: {historical_data[-1]}")
        
        # Process intraday data (for 1D view)
        if not intraday_hist.empty:
            logger.info(f"Processing {len(intraday_hist)} intraday data points")
            # Filter to only include today's data
            today = datetime.now().date()
            intraday_hist = intraday_hist[intraday_hist.index.date == today]
            logger.info(f"Filtered to {len(intraday_hist)} intraday data points for today")
            
            for date, row in intraday_hist.iterrows():
                try:
                    # Format includes time for intraday data
                    historical_data.append({
                        'date': date.strftime('%Y-%m-%d %H:%M:%S'),
                        'price': float(row['Close']),
                        'is_intraday': True  # Explicitly set to True for intraday data
                    })
                except Exception as e:
                    logger.error(f"Error processing intraday data point for {symbol}: {str(e)}")
                    continue
            logger.info(f"Successfully processed {len(intraday_hist)} intraday data points")
            if len(intraday_hist) > 0:
                # Log the first and last intraday points
                intraday_points = [d for d in historical_data if d['is_intraday']]
                if intraday_points:
                    logger.debug(f"First intraday point: {intraday_points[0]}")
                    logger.debug(f"Last intraday point: {intraday_points[-1]}")
        else:
            logger.warning(f"No intraday data available for {symbol}")
        
        # Sort data by date
        historical_data.sort(key=lambda x: x['date'])
        logger.info(f"Total historical data points: {len(historical_data)}")
        logger.debug(f"Sample of historical data: {historical_data[:2]}")  # Log first two points
        logger.debug(f"Intraday points count: {sum(1 for d in historical_data if d['is_intraday'])}")
        logger.debug(f"Daily points count: {sum(1 for d in historical_data if not d['is_intraday'])}")
        
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
                db.add(db_stock)
                logger.info(f"Created new stock record for {symbol}")
            
            db.commit()
            db.refresh(db_stock)  # Refresh to get the ID if it's a new record
            logger.info(f"Database updated successfully for {symbol}")
            
            # Add the ID to the stock_data dictionary
            stock_data['id'] = db_stock.id
        except Exception as e:
            db.rollback()
            logger.error(f"Error updating database for {symbol}: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Error updating database: {str(e)}"
            )
        
        return StockDetail(**stock_data)
    except Exception as e:
        logger.error(f"Error in get_stock_data for {symbol}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching stock data: {str(e)}"
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


@router.get("/stocks/recommendations", response_model=List[StockDetail])
async def get_stock_recommendations(
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token)
):
    """Get top 5 stock recommendations based on various factors"""
    try:
        logger.info("Starting stock recommendations")
        # Get user from token
        user = db.query(User).filter(User.email == token["sub"]).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # List of stocks to analyze (you can expand this list)
        stocks_to_analyze = [
            "AAPL", "MSFT", "GOOGL", "AMZN", "META",  # Tech
            "JPM", "BAC", "WFC", "GS", "MS",          # Finance
            "JNJ", "PFE", "MRK", "UNH", "ABBV",       # Healthcare
            "XOM", "CVX", "COP", "SLB", "EOG",        # Energy
            "WMT", "TGT", "COST", "HD", "LOW"         # Retail
        ]
        
        logger.info(f"Analyzing {len(stocks_to_analyze)} stocks for recommendations")
        recommendations = []
        for symbol in stocks_to_analyze:
            try:
                logger.info(f"Analyzing {symbol} for recommendation")
                # Get stock data
                stock_data = await get_stock_data(symbol, db)
                
                # Calculate recommendation score based on various factors
                score = 0
                reasons = []

                # Factor 1: Price momentum (last 7 days)
                if len(stock_data.historical_data) >= 7:
                    daily_data = [d for d in stock_data.historical_data if not d.get('is_intraday', False)]
                    if len(daily_data) >= 7:
                        week_ago_price = daily_data[-7]['price']
                        current_price = stock_data.current_price
                        price_change = ((current_price - week_ago_price) / week_ago_price) * 100
                        
                        logger.debug(f"{symbol} price change over 7 days: {price_change:.1f}%")
                        
                        if price_change > 5:
                            score += 2
                            reasons.append(f"Strong positive momentum: +{price_change:.1f}% in 7 days")
                        elif price_change > 2:
                            score += 1
                            reasons.append(f"Positive momentum: +{price_change:.1f}% in 7 days")
                        elif price_change < -5:
                            score -= 1
                            reasons.append(f"Negative momentum: {price_change:.1f}% in 7 days")
                    else:
                        logger.debug(f"{symbol} has only {len(daily_data)} daily data points")
                else:
                    logger.debug(f"{symbol} has only {len(stock_data.historical_data)} historical data points")

                # Factor 2: Volume analysis
                avg_volume = stock_data.volume
                logger.debug(f"{symbol} volume: {avg_volume}")
                
                if avg_volume > 10000000:  # High volume
                    score += 1
                    reasons.append("High trading volume")
                elif avg_volume < 1000000:  # Low volume
                    score -= 1
                    reasons.append("Low trading volume")

                # Factor 3: Market cap consideration
                logger.debug(f"{symbol} market cap: {stock_data.market_cap}")
                if stock_data.market_cap > 100000000000:  # Large cap
                    score += 1
                    reasons.append("Large market cap")
                elif stock_data.market_cap < 10000000000:  # Small cap
                    score -= 1
                    reasons.append("Small market cap")

                # Factor 4: Price stability
                if len(stock_data.historical_data) >= 30:
                    daily_data = [d for d in stock_data.historical_data if not d.get('is_intraday', False)]
                    if len(daily_data) >= 30:
                        prices = [d['price'] for d in daily_data[-30:]]
                        volatility = (max(prices) - min(prices)) / min(prices) * 100
                        
                        logger.debug(f"{symbol} 30-day volatility: {volatility:.1f}%")
                        
                        if volatility < 10:
                            score += 1
                            reasons.append("Low volatility")
                        elif volatility > 30:
                            score -= 1
                            reasons.append("High volatility")
                    else:
                        logger.debug(f"{symbol} has only {len(daily_data)} daily data points for volatility calculation")
                else:
                    logger.debug(f"{symbol} has only {len(stock_data.historical_data)} historical data points for volatility calculation")
                
                logger.info(f"{symbol} score: {score}, reasons: {reasons}")

                # Always add a recommendation regardless of score for testing
                stock_data.recommendation = "BUY" if score >= 2 else "CONSIDER" if score > 0 else "HOLD"
                stock_data.recommendation_reason = " | ".join(reasons) if reasons else "Basic recommendation"
                recommendations.append(stock_data)

            except Exception as e:
                logger.error(f"Error analyzing {symbol}: {str(e)}")
                continue

        # Sort recommendations by score and take top 5
        if recommendations:
            logger.info(f"Found {len(recommendations)} potential recommendations")
            recommendations.sort(key=lambda x: len(x.recommendation_reason.split(" | ")), reverse=True)
            top_recommendations = recommendations[:5]
            logger.info(f"Returning top {len(top_recommendations)} recommendations")
            return top_recommendations
        else:
            logger.warning("No recommendations were generated")
            # Return a few default recommendations for testing
            default_symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "META"]
            default_recommendations = []
            for symbol in default_symbols:
                try:
                    stock_data = await get_stock_data(symbol, db)
                    stock_data.recommendation = "BUY"
                    stock_data.recommendation_reason = "Default recommendation for testing"
                    default_recommendations.append(stock_data)
                except Exception as e:
                    logger.error(f"Error creating default recommendation for {symbol}: {str(e)}")
            
            logger.info(f"Returning {len(default_recommendations)} default recommendations")
            return default_recommendations

    except Exception as e:
        logger.error(f"Error getting recommendations: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get recommendations: {str(e)}"
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

@router.get("/news/market", response_model=List[NewsItem])
async def get_market_news(
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token)
):
    """Get the latest general market news"""
    try:
        # Check cache first
        current_time = datetime.utcnow()
        if MARKET_NEWS_CACHE_KEY in news_cache:
            cached_news, cache_time = news_cache[MARKET_NEWS_CACHE_KEY]
            if current_time - cache_time < NEWS_CACHE_DURATION:
                logger.info("Returning cached market news")
                return cached_news
        
        logger.info("Fetching fresh market news")
        # Use Yahoo Finance to get market news
        market_tickers = ["^GSPC", "^DJI", "^IXIC"]  # S&P 500, Dow Jones, NASDAQ
        news_items = []
        
        for ticker_symbol in market_tickers:
            ticker = yf.Ticker(ticker_symbol)
            try:
                ticker_news = ticker.news
                if ticker_news:
                    # Log the entire first news item for debugging
                    logger.debug(f"Raw news data for {ticker_symbol}: {ticker_news[0]}")
                    
                    for item in ticker_news:
                        try:
                            # Log the raw item for debugging
                            logger.debug(f"Processing news item for {ticker_symbol}: {item}")
                            
                            # Extract fields with fallbacks
                            # Handle the new nested structure where content contains the actual news data
                            if 'content' in item:
                                # New structure
                                content = item['content']
                                title = content.get('title')
                                
                                # Publisher is now in provider.displayName
                                publisher = None
                                if 'provider' in content and isinstance(content['provider'], dict):
                                    publisher = content['provider'].get('displayName')
                                
                                # URL is now in canonicalUrl.url or clickThroughUrl.url
                                link = None
                                if 'canonicalUrl' in content and isinstance(content['canonicalUrl'], dict):
                                    link = content['canonicalUrl'].get('url')
                                elif 'clickThroughUrl' in content and isinstance(content['clickThroughUrl'], dict):
                                    link = content['clickThroughUrl'].get('url')
                                
                                # Published date is now in pubDate or displayTime
                                if 'pubDate' in content:
                                    published_date = datetime.fromisoformat(content['pubDate'].replace('Z', '+00:00'))
                                elif 'displayTime' in content:
                                    published_date = datetime.fromisoformat(content['displayTime'].replace('Z', '+00:00'))
                                else:
                                    published_date = datetime.utcnow()
                                
                                # Summary is now directly in content
                                summary = content.get('summary')
                                
                                # Thumbnail handling is similar but nested in content
                                thumbnail = None
                                if 'thumbnail' in content and isinstance(content['thumbnail'], dict):
                                    resolutions = content['thumbnail'].get('resolutions', [])
                                    if resolutions and isinstance(resolutions, list) and len(resolutions) > 0:
                                        thumbnail = resolutions[0].get('url')
                            else:
                                # Old structure (keep as fallback)
                                title = item.get('title') or item.get('headline') or None
                                publisher = item.get('publisher') or item.get('source') or None
                                link = item.get('link') or item.get('url') or None
                                
                                # Get published date with fallback
                                published_date = None
                                if 'providerPublishTime' in item:
                                    published_date = datetime.fromtimestamp(item['providerPublishTime'])
                                elif 'publishedAt' in item:
                                    published_date = datetime.fromtimestamp(item['publishedAt'])
                                else:
                                    published_date = datetime.utcnow()
                                
                                # Get thumbnail with fallback
                                thumbnail = None
                                if 'thumbnail' in item and isinstance(item['thumbnail'], dict):
                                    resolutions = item['thumbnail'].get('resolutions', [])
                                    if resolutions and isinstance(resolutions, list) and len(resolutions) > 0:
                                        thumbnail = resolutions[0].get('url')
                                        
                                summary = item.get('summary')
                            
                            # Skip items with missing required fields
                            if not all([title, publisher, link]):
                                logger.warning(f"Skipping news item with missing required fields for {ticker_symbol}")
                                continue
                            
                            # Ensure all required fields are strings
                            title = str(title).strip()
                            publisher = str(publisher).strip()
                            link = str(link).strip()
                            
                            # Double check after string conversion
                            if not all([title, publisher, link]):
                                logger.warning(f"Skipping news item with invalid string fields for {ticker_symbol}")
                                continue
                            
                            news_items.append(NewsItem(
                                title=title,
                                publisher=publisher,
                                link=link,
                                published_date=published_date,
                                summary=summary,
                                thumbnail=thumbnail,
                                related_symbols=item.get('relatedTickers', [])
                            ))
                        except Exception as e:
                            logger.error(f"Error processing news item: {str(e)}")
            except Exception as e:
                logger.error(f"Error fetching news for {ticker_symbol}: {str(e)}")
        
        # Sort by publication date (newest first) and remove duplicates
        unique_news = {}
        for item in news_items:
            if item.title not in unique_news:
                unique_news[item.title] = item
        
        sorted_news = sorted(
            unique_news.values(), 
            key=lambda x: x.published_date, 
            reverse=True
        )
        
        # Cache the results
        news_cache[MARKET_NEWS_CACHE_KEY] = (sorted_news, current_time)
        
        return sorted_news[:20]  # Return top 20 news
    except Exception as e:
        logger.error(f"Error getting market news: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get market news: {str(e)}"
        )

@router.get("/news/watchlist", response_model=List[NewsItem])
async def get_watchlist_news(
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token)
):
    """Get news related to stocks in the user's watchlist"""
    try:
        # Get user from token
        user = db.query(User).filter(User.email == token["sub"]).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Get user's watchlist
        watchlist_items = db.query(Watchlist).filter(Watchlist.user_id == user.id).all()
        if not watchlist_items:
            return []
        
        # Get stock symbols from watchlist
        stock_ids = [item.stock_id for item in watchlist_items]
        stocks = db.query(Stock).filter(Stock.id.in_(stock_ids)).all()
        symbols = [stock.symbol for stock in stocks]
        
        # Check cache first
        cache_key = f"watchlist_news_{'-'.join(sorted(symbols))}"
        current_time = datetime.utcnow()
        if cache_key in news_cache:
            cached_news, cache_time = news_cache[cache_key]
            if current_time - cache_time < NEWS_CACHE_DURATION:
                logger.info(f"Returning cached watchlist news for {symbols}")
                return cached_news
        
        logger.info(f"Fetching fresh news for watchlist stocks: {symbols}")
        news_items = []
        
        # Fetch news for each symbol in the watchlist
        for symbol in symbols:
            try:
                # Cache key for individual stock news
                stock_cache_key = f"stock_news_{symbol}"
                
                # Check if this stock's news is in cache
                if stock_cache_key in news_cache:
                    stock_news, cache_time = news_cache[stock_cache_key]
                    if current_time - cache_time < NEWS_CACHE_DURATION:
                        logger.info(f"Using cached news for {symbol}")
                        news_items.extend(stock_news)
                        continue
                
                logger.info(f"Fetching fresh news for {symbol}")
                ticker = yf.Ticker(symbol)
                ticker_news = ticker.news
                
                stock_news = []
                if ticker_news:
                    # Log the entire first news item for debugging
                    logger.debug(f"Raw news data for {symbol}: {ticker_news[0]}")
                    
                    for item in ticker_news:
                        try:
                            # Log the raw item for debugging
                            logger.debug(f"Processing news item for {symbol}: {item}")
                            
                            # Extract fields with fallbacks
                            # Handle the new nested structure where content contains the actual news data
                            if 'content' in item:
                                # New structure
                                content = item['content']
                                title = content.get('title')
                                
                                # Publisher is now in provider.displayName
                                publisher = None
                                if 'provider' in content and isinstance(content['provider'], dict):
                                    publisher = content['provider'].get('displayName')
                                
                                # URL is now in canonicalUrl.url or clickThroughUrl.url
                                link = None
                                if 'canonicalUrl' in content and isinstance(content['canonicalUrl'], dict):
                                    link = content['canonicalUrl'].get('url')
                                elif 'clickThroughUrl' in content and isinstance(content['clickThroughUrl'], dict):
                                    link = content['clickThroughUrl'].get('url')
                                
                                # Published date is now in pubDate or displayTime
                                if 'pubDate' in content:
                                    published_date = datetime.fromisoformat(content['pubDate'].replace('Z', '+00:00'))
                                elif 'displayTime' in content:
                                    published_date = datetime.fromisoformat(content['displayTime'].replace('Z', '+00:00'))
                                else:
                                    published_date = datetime.utcnow()
                                
                                # Summary is now directly in content
                                summary = content.get('summary')
                                
                                # Thumbnail handling is similar but nested in content
                                thumbnail = None
                                if 'thumbnail' in content and isinstance(content['thumbnail'], dict):
                                    resolutions = content['thumbnail'].get('resolutions', [])
                                    if resolutions and isinstance(resolutions, list) and len(resolutions) > 0:
                                        thumbnail = resolutions[0].get('url')
                            else:
                                # Old structure (keep as fallback)
                                title = item.get('title') or item.get('headline') or None
                                publisher = item.get('publisher') or item.get('source') or None
                                link = item.get('link') or item.get('url') or None
                                
                                # Get published date with fallback
                                published_date = None
                                if 'providerPublishTime' in item:
                                    published_date = datetime.fromtimestamp(item['providerPublishTime'])
                                elif 'publishedAt' in item:
                                    published_date = datetime.fromtimestamp(item['publishedAt'])
                                else:
                                    published_date = datetime.utcnow()
                                
                                # Get thumbnail with fallback
                                thumbnail = None
                                if 'thumbnail' in item and isinstance(item['thumbnail'], dict):
                                    resolutions = item['thumbnail'].get('resolutions', [])
                                    if resolutions and isinstance(resolutions, list) and len(resolutions) > 0:
                                        thumbnail = resolutions[0].get('url')
                                        
                                summary = item.get('summary')
                            
                            # Skip items with missing required fields
                            if not all([title, publisher, link]):
                                logger.warning(f"Skipping news item with missing required fields for {symbol}")
                                continue
                            
                            # Ensure all required fields are strings
                            title = str(title).strip()
                            publisher = str(publisher).strip()
                            link = str(link).strip()
                            
                            # Double check after string conversion
                            if not all([title, publisher, link]):
                                logger.warning(f"Skipping news item with invalid string fields for {symbol}")
                                continue
                            
                            news_item = NewsItem(
                                title=title,
                                publisher=publisher,
                                link=link,
                                published_date=published_date,
                                summary=summary,
                                thumbnail=thumbnail,
                                related_symbols=item.get('relatedTickers', [])
                            )
                            stock_news.append(news_item)
                        except Exception as e:
                            logger.error(f"Error processing news item for {symbol}: {str(e)}")
                
                # Cache individual stock news
                news_cache[stock_cache_key] = (stock_news, current_time)
                news_items.extend(stock_news)
                
            except Exception as e:
                logger.error(f"Error fetching news for {symbol}: {str(e)}")
        
        # Sort by publication date (newest first) and remove duplicates
        unique_news = {}
        for item in news_items:
            if item.title not in unique_news:
                unique_news[item.title] = item
        
        sorted_news = sorted(
            unique_news.values(), 
            key=lambda x: x.published_date, 
            reverse=True
        )
        
        # Cache the combined results
        news_cache[cache_key] = (sorted_news, current_time)
        
        return sorted_news[:30]  # Return top 30 news
    except Exception as e:
        logger.error(f"Error getting watchlist news: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get watchlist news: {str(e)}"
        )

@router.get("/news/stock/{symbol}", response_model=List[NewsItem])
async def get_stock_news(
    symbol: str,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token)
):
    """Get news for a specific stock"""
    try:
        # Check cache first
        cache_key = f"stock_news_{symbol}"
        current_time = datetime.utcnow()
        if cache_key in news_cache:
            cached_news, cache_time = news_cache[cache_key]
            if current_time - cache_time < NEWS_CACHE_DURATION:
                logger.info(f"Returning cached news for {symbol}")
                return cached_news
        
        logger.info(f"Fetching fresh news for {symbol}")
        ticker = yf.Ticker(symbol)
        ticker_news = ticker.news
        
        news_items = []
        if ticker_news:
            # Log the entire first news item for debugging
            logger.debug(f"Raw news data for {symbol}: {ticker_news[0]}")
            
            for item in ticker_news:
                try:
                    # Log the raw item for debugging
                    logger.debug(f"Processing news item for {symbol}: {item}")
                    
                    # Extract fields with fallbacks
                    # Handle the new nested structure where content contains the actual news data
                    if 'content' in item:
                        # New structure
                        content = item['content']
                        title = content.get('title')
                        
                        # Publisher is now in provider.displayName
                        publisher = None
                        if 'provider' in content and isinstance(content['provider'], dict):
                            publisher = content['provider'].get('displayName')
                        
                        # URL is now in canonicalUrl.url or clickThroughUrl.url
                        link = None
                        if 'canonicalUrl' in content and isinstance(content['canonicalUrl'], dict):
                            link = content['canonicalUrl'].get('url')
                        elif 'clickThroughUrl' in content and isinstance(content['clickThroughUrl'], dict):
                            link = content['clickThroughUrl'].get('url')
                        
                        # Published date is now in pubDate or displayTime
                        if 'pubDate' in content:
                            published_date = datetime.fromisoformat(content['pubDate'].replace('Z', '+00:00'))
                        elif 'displayTime' in content:
                            published_date = datetime.fromisoformat(content['displayTime'].replace('Z', '+00:00'))
                        else:
                            published_date = datetime.utcnow()
                        
                        # Summary is now directly in content
                        summary = content.get('summary')
                        
                        # Thumbnail handling is similar but nested in content
                        thumbnail = None
                        if 'thumbnail' in content and isinstance(content['thumbnail'], dict):
                            resolutions = content['thumbnail'].get('resolutions', [])
                            if resolutions and isinstance(resolutions, list) and len(resolutions) > 0:
                                thumbnail = resolutions[0].get('url')
                    else:
                        # Old structure (keep as fallback)
                        title = item.get('title') or item.get('headline') or None
                        publisher = item.get('publisher') or item.get('source') or None
                        link = item.get('link') or item.get('url') or None
                        
                        # Get published date with fallback
                        published_date = None
                        if 'providerPublishTime' in item:
                            published_date = datetime.fromtimestamp(item['providerPublishTime'])
                        elif 'publishedAt' in item:
                            published_date = datetime.fromtimestamp(item['publishedAt'])
                        else:
                            published_date = datetime.utcnow()
                        
                        # Get thumbnail with fallback
                        thumbnail = None
                        if 'thumbnail' in item and isinstance(item['thumbnail'], dict):
                            resolutions = item['thumbnail'].get('resolutions', [])
                            if resolutions and isinstance(resolutions, list) and len(resolutions) > 0:
                                thumbnail = resolutions[0].get('url')
                                
                        summary = item.get('summary')
                    
                    # Skip items with missing required fields
                    if not all([title, publisher, link]):
                        logger.warning(f"Skipping news item with missing required fields for {symbol}")
                        continue
                    
                    # Ensure all required fields are strings
                    title = str(title).strip()
                    publisher = str(publisher).strip()
                    link = str(link).strip()
                    
                    # Double check after string conversion
                    if not all([title, publisher, link]):
                        logger.warning(f"Skipping news item with invalid string fields for {symbol}")
                        continue
                    
                    news_items.append(NewsItem(
                        title=title,
                        publisher=publisher,
                        link=link,
                        published_date=published_date,
                        summary=summary,
                        thumbnail=thumbnail,
                        related_symbols=item.get('relatedTickers', [])
                    ))
                except Exception as e:
                    logger.error(f"Error processing news item for {symbol}: {str(e)}")
        
        # Sort by publication date (newest first)
        sorted_news = sorted(news_items, key=lambda x: x.published_date, reverse=True)
        
        # Cache the results
        news_cache[cache_key] = (sorted_news, current_time)
        
        return sorted_news
    except Exception as e:
        logger.error(f"Error getting news for {symbol}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get news for {symbol}: {str(e)}"
        )
