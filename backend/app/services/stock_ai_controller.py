import logging
from datetime import datetime
from typing import Dict, List, Optional
from sqlalchemy.orm import Session

from .stock_ai_model import StockAIModel
from ..models.investing import Stock
from ..models.ai_analysis import StockAnalysis, MarketAnalysis
from ..schemas.ai_analysis import StockAnalysisCreate, MarketAnalysisCreate

# Configure logging
logger = logging.getLogger(__name__)

class StockAIController:
    """
    The Controller component of the MCP pattern for Stock AI Analysis.
    Responsible for handling requests, coordinating data flow, and managing persistence.
    """
    
    def __init__(self):
        self.model = StockAIModel()
    
    async def analyze_stock(self, 
                      db: Session, 
                      symbol: str, 
                      historical_data: List[Dict],
                      company_info: Optional[Dict] = None,
                      news_sentiment: Optional[float] = None,
                      save_results: bool = True) -> Dict:
        """
        Analyze a stock and optionally save the analysis to the database
        
        Args:
            db: Database session
            symbol: Stock ticker symbol
            historical_data: List of historical price data points
            company_info: Optional company fundamental data
            news_sentiment: Optional sentiment score from news (-1 to 1)
            save_results: Whether to save results to the database
            
        Returns:
            Dictionary containing analysis results
        """
        try:
            # Perform analysis using the model
            analysis_results = self.model.analyze_stock(
                symbol, 
                historical_data, 
                company_info, 
                news_sentiment
            )
            
            # If save_results is True and there's no error, save to database
            if save_results and 'error' not in analysis_results:
                await self._save_stock_analysis(db, symbol, analysis_results)
            
            return analysis_results
        
        except Exception as e:
            logger.error(f"Controller: Error analyzing stock {symbol}: {str(e)}", exc_info=True)
            return {
                'error': f"Failed to analyze stock: {str(e)}",
                'recommendation': "HOLD",
                'confidence_score': 0.1,
                'reasoning': f"Analysis error: {str(e)}"
            }
    
    async def analyze_market(self, 
                       db: Session, 
                       market_data: Dict,
                       save_results: bool = True) -> Dict:
        """
        Analyze market conditions and optionally save the analysis
        
        Args:
            db: Database session
            market_data: Dictionary containing market indices and sector data
            save_results: Whether to save results to the database
            
        Returns:
            Dictionary containing market analysis results
        """
        try:
            # Perform market analysis using the model
            analysis_results = self.model.analyze_market(market_data)
            
            # If save_results is True and there's no error, save to database
            if save_results and 'error' not in analysis_results:
                await self._save_market_analysis(db, analysis_results)
            
            return analysis_results
            
        except Exception as e:
            logger.error(f"Controller: Error analyzing market: {str(e)}", exc_info=True)
            return {
                'error': f"Failed to analyze market: {str(e)}",
                'market_trend': "NEUTRAL",
                'market_sentiment': f"Analysis error: {str(e)}"
            }
    
    async def get_latest_stock_analysis(self, db: Session, symbol: str) -> Optional[Dict]:
        """
        Retrieve the latest analysis for a given stock
        
        Args:
            db: Database session
            symbol: Stock ticker symbol
            
        Returns:
            Dictionary containing the latest analysis or None if not found
        """
        try:
            # Get stock ID from symbol
            stock = db.query(Stock).filter(Stock.symbol == symbol).first()
            if not stock:
                logger.warning(f"Stock {symbol} not found in database")
                return None
            
            # Get latest analysis for this stock
            latest_analysis = db.query(StockAnalysis)\
                .filter(StockAnalysis.stock_id == stock.id)\
                .order_by(StockAnalysis.created_at.desc())\
                .first()
            
            if not latest_analysis:
                logger.info(f"No analysis found for stock {symbol}")
                return None
            
            # Convert to dictionary
            return {
                'symbol': symbol,
                'prediction_price': latest_analysis.prediction_price,
                'confidence_score': latest_analysis.confidence_score,
                'trend_analysis': latest_analysis.trend_analysis,
                'recommendation': latest_analysis.recommendation,
                'reasoning': latest_analysis.reasoning,
                'created_at': latest_analysis.created_at
            }
            
        except Exception as e:
            logger.error(f"Error retrieving analysis for {symbol}: {str(e)}", exc_info=True)
            return None
    
    async def get_latest_market_analysis(self, db: Session) -> Optional[Dict]:
        """
        Retrieve the latest market analysis
        
        Args:
            db: Database session
            
        Returns:
            Dictionary containing the latest market analysis or None if not found
        """
        try:
            # Get latest market analysis
            latest_analysis = db.query(MarketAnalysis)\
                .order_by(MarketAnalysis.created_at.desc())\
                .first()
            
            if not latest_analysis:
                logger.info("No market analysis found")
                return None
            
            # Convert to dictionary
            return {
                'market_trend': latest_analysis.market_trend,
                'volatility_index': latest_analysis.volatility_index,
                'sector_performance': latest_analysis.sector_performance,
                'market_sentiment': latest_analysis.market_sentiment,
                'created_at': latest_analysis.created_at
            }
            
        except Exception as e:
            logger.error(f"Error retrieving market analysis: {str(e)}", exc_info=True)
            return None
    
    async def _save_stock_analysis(self, db: Session, symbol: str, analysis_results: Dict) -> bool:
        """
        Save stock analysis results to database
        
        Args:
            db: Database session
            symbol: Stock ticker symbol
            analysis_results: Analysis results from model
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Get stock ID from symbol
            stock = db.query(Stock).filter(Stock.symbol == symbol).first()
            if not stock:
                logger.warning(f"Stock {symbol} not found in database, cannot save analysis")
                return False
            
            # Extract relevant data from analysis results
            prediction = analysis_results.get('prediction', {})
            month_prediction = prediction.get('prediction_month', {})
            
            # Create new analysis record
            new_analysis = StockAnalysis(
                stock_id=stock.id,
                prediction_price=month_prediction.get('price', 0.0),
                confidence_score=analysis_results.get('confidence_score', 0.0),
                trend_analysis=str(analysis_results.get('technical_analysis', {}).get('trend', 'UNKNOWN')),
                recommendation=analysis_results.get('recommendation', 'HOLD'),
                reasoning=analysis_results.get('reasoning', 'No reasoning provided'),
                created_at=datetime.utcnow()
            )
            
            # Add to database
            db.add(new_analysis)
            db.commit()
            logger.info(f"Saved analysis for stock {symbol}")
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error saving analysis for {symbol}: {str(e)}", exc_info=True)
            return False
    
    async def _save_market_analysis(self, db: Session, analysis_results: Dict) -> bool:
        """
        Save market analysis results to database
        
        Args:
            db: Database session
            analysis_results: Analysis results from model
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Create new market analysis record
            new_analysis = MarketAnalysis(
                market_trend=analysis_results.get('market_trend', 'NEUTRAL'),
                volatility_index=analysis_results.get('volatility_index', 0.0),
                sector_performance=str(analysis_results.get('sector_performance', {})),
                market_sentiment=analysis_results.get('market_sentiment', 'No sentiment available'),
                created_at=datetime.utcnow()
            )
            
            # Add to database
            db.add(new_analysis)
            db.commit()
            logger.info("Saved market analysis")
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error saving market analysis: {str(e)}", exc_info=True)
            return False 