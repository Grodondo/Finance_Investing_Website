from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import logging
import yfinance as yf
import json

from ..db.database import get_db
from ..auth.utils import verify_token
from ..services.stock_ai_controller import StockAIController
from ..services.stock_ai_presenter import StockAIPresenter
from ..models.investing import Stock
from ..schemas.ai_analysis import StockAnalysis, MarketAnalysis

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize controller and presenter
ai_controller = StockAIController()
ai_presenter = StockAIPresenter()

@router.get("/ai/stock/{symbol}", response_model=Dict)
async def get_stock_analysis(
    symbol: str,
    force_refresh: bool = False,
    include_details: bool = False,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token)
):
    """
    Get AI-powered analysis for a specific stock
    
    - **symbol**: Stock symbol
    - **force_refresh**: Force a fresh analysis even if recent results exist
    - **include_details**: Include detailed technical analysis data
    """
    try:
        # Normalize symbol
        symbol = symbol.upper()
        
        # Check if we have recent analysis already
        if not force_refresh:
            latest_analysis = await ai_controller.get_latest_stock_analysis(db, symbol)
            
            if latest_analysis and latest_analysis['created_at'] > datetime.utcnow() - timedelta(hours=24):
                logger.info(f"Using existing analysis for {symbol}")
                # Format the existing analysis data
                return ai_presenter.format_stock_analysis(latest_analysis, include_details)
        
        # If we need a fresh analysis, get the stock data
        stock = db.query(Stock).filter(Stock.symbol == symbol).first()
        
        if not stock:
            # Try to fetch the stock from Yahoo Finance
            try:
                ticker = yf.Ticker(symbol)
                info = ticker.info
                
                # If we get here, the stock exists but isn't in our database yet
                logger.warning(f"Stock {symbol} not in database but exists in Yahoo Finance")
                
                # Create a temporary stock object
                stock = Stock(
                    symbol=symbol,
                    name=info.get('longName', symbol),
                    current_price=info.get('regularMarketPrice', 0)
                )
                
                # Add to database
                db.add(stock)
                db.commit()
                logger.info(f"Added stock {symbol} to database")
                
            except Exception as e:
                logger.error(f"Error fetching stock {symbol}: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Stock {symbol} not found"
                )
        
        # Get historical data needed for analysis
        try:
            ticker = yf.Ticker(symbol)
            
            # Get basic info
            info = ticker.info
            
            # Get historical data for past year
            end_date = datetime.now()
            start_date = end_date - timedelta(days=365)
            historical = ticker.history(start=start_date, end=end_date, interval='1d')
            
            # Convert to list of dicts
            historical_data = []
            for date, row in historical.iterrows():
                historical_data.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'price': float(row['Close']),
                    'is_intraday': False
                })
            
            # Perform AI analysis
            analysis_results = await ai_controller.analyze_stock(
                db,
                symbol,
                historical_data,
                info,
                None  # No sentiment for now
            )
            
            # Format the results for presentation
            formatted_results = ai_presenter.format_stock_analysis(analysis_results, include_details)
            
            return formatted_results
            
        except Exception as e:
            logger.error(f"Error analyzing stock {symbol}: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error analyzing stock: {str(e)}"
            )
    
    except Exception as e:
        logger.error(f"Unexpected error in stock analysis: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(e)}"
        )

@router.get("/ai/market", response_model=Dict)
async def get_market_analysis(
    force_refresh: bool = False,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token)
):
    """
    Get AI-powered market analysis
    
    - **force_refresh**: Force a fresh analysis even if recent results exist
    """
    try:
        # Check if we have recent analysis already
        if not force_refresh:
            latest_analysis = await ai_controller.get_latest_market_analysis(db)
            
            if latest_analysis and latest_analysis['created_at'] > datetime.utcnow() - timedelta(hours=12):
                logger.info("Using existing market analysis")
                # Format the existing analysis data
                return ai_presenter.format_market_analysis(latest_analysis)
        
        # Get market data
        try:
            # Get major indices
            indices = {'^GSPC': 'S&P 500', '^DJI': 'Dow Jones', '^IXIC': 'NASDAQ', '^RUT': 'Russell 2000'}
            market_data = {'indices': {}}
            
            for symbol, name in indices.items():
                try:
                    ticker = yf.Ticker(symbol)
                    history = ticker.history(period="5d")
                    if not history.empty:
                        latest = history.iloc[-1]
                        prev_day = history.iloc[-2] if len(history) > 1 else latest
                        
                        change = latest['Close'] - prev_day['Close']
                        change_percent = (change / prev_day['Close']) * 100
                        
                        market_data['indices'][name] = {
                            'price': float(latest['Close']),
                            'change': float(change),
                            'change_percent': float(change_percent)
                        }
                except Exception as e:
                    logger.error(f"Error fetching index {symbol}: {str(e)}")
            
            # Get sector performance
            sector_etfs = {
                'XLK': 'Technology', 'XLF': 'Financial', 'XLV': 'Healthcare',
                'XLP': 'Consumer Staples', 'XLY': 'Consumer Discretionary',
                'XLE': 'Energy', 'XLI': 'Industrial', 'XLB': 'Materials',
                'XLRE': 'Real Estate', 'XLU': 'Utilities', 'XLC': 'Communication Services'
            }
            
            market_data['sectors'] = {}
            
            for symbol, sector in sector_etfs.items():
                try:
                    ticker = yf.Ticker(symbol)
                    history = ticker.history(period="5d")
                    if not history.empty:
                        latest = history.iloc[-1]
                        prev_day = history.iloc[-2] if len(history) > 1 else latest
                        
                        change = latest['Close'] - prev_day['Close']
                        change_percent = (change / prev_day['Close']) * 100
                        
                        market_data['sectors'][sector] = float(change_percent)
                except Exception as e:
                    logger.error(f"Error fetching sector ETF {symbol}: {str(e)}")
            
            # Perform market analysis
            analysis_results = await ai_controller.analyze_market(db, market_data)
            
            # Format the results
            formatted_results = ai_presenter.format_market_analysis(analysis_results)
            
            return formatted_results
            
        except Exception as e:
            logger.error(f"Error analyzing market: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error analyzing market: {str(e)}"
            )
    
    except Exception as e:
        logger.error(f"Unexpected error in market analysis: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(e)}"
        )

@router.get("/ai/portfolio/recommendations", response_model=List[Dict])
async def get_portfolio_recommendations(
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token)
):
    """
    Get AI-powered recommendations for the user's portfolio
    """
    try:
        # Get user ID from token
        user_id = token.get('user_id')
        
        # Query user's current holdings
        query = """
            SELECT s.id, s.symbol, s.name, s.current_price, h.shares, h.average_price
            FROM holdings h
            JOIN stocks s ON h.stock_id = s.id
            WHERE h.user_id = :user_id AND h.shares > 0
        """
        
        result = db.execute(query, {"user_id": user_id})
        holdings = [dict(row) for row in result]
        
        if not holdings:
            return []
        
        # Get analysis for each holding
        recommendations = []
        
        for holding in holdings:
            symbol = holding['symbol']
            shares = holding['shares']
            avg_price = holding['average_price']
            current_price = holding['current_price']
            
            # Get analysis for this stock
            latest_analysis = await ai_controller.get_latest_stock_analysis(db, symbol)
            
            if not latest_analysis:
                # No analysis available, use the stock API route to get one
                ticker = yf.Ticker(symbol)
                info = ticker.info
                
                # Get historical data
                end_date = datetime.now()
                start_date = end_date - timedelta(days=365)
                historical = ticker.history(start=start_date, end=end_date, interval='1d')
                
                # Convert to list of dicts
                historical_data = []
                for date, row in historical.iterrows():
                    historical_data.append({
                        'date': date.strftime('%Y-%m-%d'),
                        'price': float(row['Close']),
                        'is_intraday': False
                    })
                
                # Perform analysis
                latest_analysis = await ai_controller.analyze_stock(
                    db,
                    symbol,
                    historical_data,
                    info,
                    None,  # No sentiment
                    True   # Save results
                )
            
            # Calculate performance metrics
            total_value = shares * current_price
            total_cost = shares * avg_price
            profit_loss = total_value - total_cost
            profit_loss_percent = (profit_loss / total_cost) * 100 if total_cost > 0 else 0
            
            # Get recommendation info
            recommendation = latest_analysis.get('recommendation', 'HOLD')
            reasoning = latest_analysis.get('reasoning', '')
            
            # Get prediction
            prediction = latest_analysis.get('prediction', {})
            month_prediction = prediction.get('prediction_month', {})
            predicted_price = month_prediction.get('price', current_price)
            predicted_change = month_prediction.get('change_percent', 0)
            
            # Add to recommendations list
            recommendations.append({
                'symbol': symbol,
                'name': holding['name'],
                'shares': shares,
                'average_price': avg_price,
                'current_price': current_price,
                'total_value': total_value,
                'profit_loss': profit_loss,
                'profit_loss_percent': profit_loss_percent,
                'recommendation': recommendation,
                'reasoning': reasoning,
                'predicted_price': predicted_price,
                'predicted_change_percent': predicted_change
            })
        
        # Sort by predicted performance (descending)
        recommendations.sort(key=lambda x: x['predicted_change_percent'], reverse=True)
        
        return recommendations
    
    except Exception as e:
        logger.error(f"Error generating portfolio recommendations: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating portfolio recommendations: {str(e)}"
        )

@router.get("/ai/watchlist/recommendations", response_model=List[Dict])
async def get_watchlist_recommendations(
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token)
):
    """
    Get AI-powered recommendations for stocks in user's watchlist
    """
    try:
        # Get user ID from token
        user_id = token.get('user_id')
        
        # Query user's watchlist
        query = """
            SELECT s.id, s.symbol, s.name, s.current_price
            FROM watchlist w
            JOIN stocks s ON w.stock_id = s.id
            WHERE w.user_id = :user_id
        """
        
        result = db.execute(query, {"user_id": user_id})
        watchlist = [dict(row) for row in result]
        
        if not watchlist:
            return []
        
        # Get analysis for each watchlist item
        recommendations = []
        
        for item in watchlist:
            symbol = item['symbol']
            current_price = item['current_price']
            
            # Get analysis for this stock
            latest_analysis = await ai_controller.get_latest_stock_analysis(db, symbol)
            
            if not latest_analysis:
                # Skip stocks without analysis to keep the API fast
                # These will be analyzed when specifically requested
                continue
            
            # Get recommendation info
            recommendation = latest_analysis.get('recommendation', 'HOLD')
            reasoning = latest_analysis.get('reasoning', '')
            confidence = latest_analysis.get('confidence_score', 0.0)
            
            # Get prediction
            prediction = latest_analysis.get('prediction', {})
            month_prediction = prediction.get('prediction_month', {})
            predicted_price = month_prediction.get('price', current_price)
            predicted_change = month_prediction.get('change_percent', 0)
            
            # Add to recommendations list
            recommendations.append({
                'symbol': symbol,
                'name': item['name'],
                'current_price': current_price,
                'recommendation': recommendation,
                'confidence': confidence,
                'reasoning': reasoning,
                'predicted_price': predicted_price,
                'predicted_change_percent': predicted_change
            })
        
        # Sort by predicted performance (descending)
        recommendations.sort(key=lambda x: x['predicted_change_percent'], reverse=True)
        
        return recommendations
    
    except Exception as e:
        logger.error(f"Error generating watchlist recommendations: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating watchlist recommendations: {str(e)}"
        ) 