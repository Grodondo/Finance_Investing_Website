from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta
import yfinance as yf
import logging
from ..db.database import get_db
from ..auth.utils import verify_token
from ..models.user import User
from ..models.investing import Stock, Watchlist
from ..schemas.investing import NewsItem

# Set up logger
logger = logging.getLogger(__name__)

router = APIRouter()

# News cache to avoid frequent API calls
news_cache = {}
MARKET_NEWS_CACHE_KEY = "market_news"
NEWS_CACHE_DURATION = timedelta(minutes=30)  # Cache news for 30 minutes

@router.get("/market", response_model=List[NewsItem])
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
                    for item in ticker_news:
                        try:
                            # Validate required fields
                            title = item.get('title')
                            publisher = item.get('publisher')
                            link = item.get('link')
                            
                            # Skip items with missing required fields
                            if not all([title, publisher, link]):
                                logger.warning(f"Skipping news item with missing required fields for {ticker_symbol}")
                                continue
                                
                            news_items.append(NewsItem(
                                title=title,
                                publisher=publisher,
                                link=link,
                                published_date=datetime.fromtimestamp(item.get('providerPublishTime', 0)),
                                summary=item.get('summary'),
                                thumbnail=item.get('thumbnail', {}).get('resolutions', [{}])[0].get('url'),
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

@router.get("/watchlist", response_model=List[NewsItem])
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
                            
                            # Log the extracted values
                            logger.debug(f"Extracted fields: title={title}, publisher={publisher}, link={link}")
                            
                            # Skip items with missing required fields
                            if not all([title, publisher, link]):
                                logger.warning(f"Skipping news item with missing required fields")
                                continue
                            
                            # Ensure all required fields are strings
                            title = str(title).strip()
                            publisher = str(publisher).strip()
                            link = str(link).strip()
                            
                            # Double check after string conversion
                            if not all([title, publisher, link]):
                                logger.warning(f"Skipping news item with invalid string fields")
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