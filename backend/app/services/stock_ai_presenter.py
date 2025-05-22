import logging
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import json
from fastapi import HTTPException, status

# Configure logging
logger = logging.getLogger(__name__)

class StockAIPresenter:
    """
    The Presenter component of the MCP pattern for Stock AI Analysis.
    Responsible for formatting data for presentation to the UI.
    """
    
    def format_stock_analysis(self, analysis_data: Dict, include_technical_details: bool = False) -> Dict:
        """
        Format stock analysis data for presentation
        
        Args:
            analysis_data: Raw analysis data from controller
            include_technical_details: Whether to include detailed technical analysis
            
        Returns:
            Formatted analysis data
        """
        try:
            # Check for error
            if 'error' in analysis_data:
                return {
                    'success': False,
                    'error': analysis_data['error'],
                    'message': 'Analysis could not be completed'
                }
            
            # Extract key information
            symbol = analysis_data.get('symbol', 'Unknown')
            recommendation = analysis_data.get('recommendation', 'HOLD')
            reasoning = analysis_data.get('reasoning', '')
            confidence = analysis_data.get('confidence_score', 0.0)
            
            # Format prediction data
            prediction = analysis_data.get('prediction', {})
            formatted_predictions = self._format_predictions(prediction)
            
            # Create base response
            response = {
                'success': True,
                'symbol': symbol,
                'summary': {
                    'recommendation': recommendation,
                    'reasoning': reasoning,
                    'confidence': float(confidence),
                    'confidence_label': self._get_confidence_label(confidence)
                },
                'predictions': formatted_predictions
            }
            
            # Add technical details if requested
            if include_technical_details:
                technical = analysis_data.get('technical_analysis', {})
                fundamental = analysis_data.get('fundamental_analysis', {})
                sentiment = analysis_data.get('sentiment_analysis', {})
                
                response['details'] = {
                    'technical': self._format_technical_analysis(technical),
                    'fundamental': self._format_fundamental_analysis(fundamental) if fundamental else None,
                    'sentiment': self._format_sentiment_analysis(sentiment) if sentiment else None
                }
            
            return response
            
        except Exception as e:
            logger.error(f"Error formatting stock analysis: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': f"Error formatting analysis data: {str(e)}",
                'message': 'Could not format analysis results'
            }
    
    def format_market_analysis(self, analysis_data: Dict) -> Dict:
        """
        Format market analysis data for presentation
        
        Args:
            analysis_data: Raw market analysis data from controller
            
        Returns:
            Formatted market analysis data
        """
        try:
            # Check for error
            if 'error' in analysis_data:
                return {
                    'success': False,
                    'error': analysis_data['error'],
                    'message': 'Market analysis could not be completed'
                }
            
            # Extract key information
            market_trend = analysis_data.get('market_trend', 'NEUTRAL')
            volatility_index = analysis_data.get('volatility_index', 0.0)
            market_sentiment = analysis_data.get('market_sentiment', '')
            
            # Format sector performance
            sector_performance = {}
            raw_sector_data = analysis_data.get('sector_performance', {})
            
            if isinstance(raw_sector_data, str):
                try:
                    sector_performance = json.loads(raw_sector_data)
                except:
                    sector_performance = {}
            else:
                sector_performance = raw_sector_data
            
            # Sort sectors by performance
            sorted_sectors = sorted(
                sector_performance.items(),
                key=lambda x: x[1],
                reverse=True
            )
            
            # Create response
            response = {
                'success': True,
                'market_summary': {
                    'trend': market_trend,
                    'trend_description': self._get_trend_description(market_trend),
                    'volatility': {
                        'index': float(volatility_index),
                        'description': self._get_volatility_description(volatility_index)
                    },
                    'sentiment': market_sentiment
                },
                'sectors': {
                    'top_performers': sorted_sectors[:3] if len(sorted_sectors) >= 3 else sorted_sectors,
                    'bottom_performers': sorted_sectors[-3:] if len(sorted_sectors) >= 3 else [],
                    'all_sectors': dict(sorted_sectors)
                }
            }
            
            return response
            
        except Exception as e:
            logger.error(f"Error formatting market analysis: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': f"Error formatting market data: {str(e)}",
                'message': 'Could not format market analysis results'
            }
    
    def format_stock_list_with_analysis(self, stocks_data: List[Dict]) -> List[Dict]:
        """
        Format a list of stocks with their analysis data
        
        Args:
            stocks_data: List of stock data dictionaries with analysis
            
        Returns:
            Formatted list of stocks with analysis highlights
        """
        try:
            formatted_stocks = []
            
            for stock in stocks_data:
                # Extract basic stock info
                stock_info = {
                    'symbol': stock.get('symbol', ''),
                    'name': stock.get('name', ''),
                    'current_price': stock.get('current_price', 0.0),
                    'change': stock.get('change', 0.0),
                    'change_percent': stock.get('change_percent', 0.0)
                }
                
                # Extract analysis highlights if available
                analysis = stock.get('analysis', {})
                if analysis:
                    stock_info['analysis_highlights'] = {
                        'recommendation': analysis.get('recommendation', 'HOLD'),
                        'confidence': analysis.get('confidence_score', 0.0),
                        'prediction': analysis.get('prediction', {}).get('prediction_month', {}).get('price', 0.0),
                        'prediction_change_percent': analysis.get('prediction', {}).get('prediction_month', {}).get('change_percent', 0.0)
                    }
                
                formatted_stocks.append(stock_info)
            
            return formatted_stocks
            
        except Exception as e:
            logger.error(f"Error formatting stock list: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error formatting stock list: {str(e)}"
            )
    
    def _format_predictions(self, prediction_data: Dict) -> Dict:
        """Format prediction data for different time horizons"""
        try:
            current_price = prediction_data.get('current_price', 0.0)
            
            # Format daily prediction
            day_prediction = prediction_data.get('prediction_day', {})
            day_price = day_prediction.get('price', current_price)
            day_change = day_prediction.get('change_percent', 0.0)
            
            # Format weekly prediction
            week_prediction = prediction_data.get('prediction_week', {})
            week_price = week_prediction.get('price', current_price)
            week_change = week_prediction.get('change_percent', 0.0)
            
            # Format monthly prediction
            month_prediction = prediction_data.get('prediction_month', {})
            month_price = month_prediction.get('price', current_price)
            month_change = month_prediction.get('change_percent', 0.0)
            
            return {
                'current_price': float(current_price),
                'daily': {
                    'price': float(day_price),
                    'change_percent': float(day_change),
                    'date': day_prediction.get('date', 'Unknown')
                },
                'weekly': {
                    'price': float(week_price),
                    'change_percent': float(week_change),
                    'date': week_prediction.get('date', 'Unknown')
                },
                'monthly': {
                    'price': float(month_price),
                    'change_percent': float(month_change),
                    'date': month_prediction.get('date', 'Unknown')
                }
            }
        except Exception as e:
            logger.error(f"Error formatting predictions: {str(e)}", exc_info=True)
            return {
                'current_price': 0.0,
                'daily': {'price': 0.0, 'change_percent': 0.0, 'date': 'Unknown'},
                'weekly': {'price': 0.0, 'change_percent': 0.0, 'date': 'Unknown'},
                'monthly': {'price': 0.0, 'change_percent': 0.0, 'date': 'Unknown'}
            }
    
    def _format_technical_analysis(self, technical_data: Dict) -> Dict:
        """Format technical analysis data"""
        try:
            trend = technical_data.get('trend', 'SIDEWAYS')
            
            formatted_data = {
                'trend': trend,
                'trend_description': self._get_trend_description(trend),
                'moving_averages': technical_data.get('moving_averages', {}),
                'indicators': technical_data.get('indicators', {})
            }
            
            # Add support and resistance if available
            support = technical_data.get('support_level')
            if support:
                formatted_data['support_level'] = float(support)
                
            resistance = technical_data.get('resistance_level')
            if resistance:
                formatted_data['resistance_level'] = float(resistance)
            
            return formatted_data
        except Exception as e:
            logger.error(f"Error formatting technical analysis: {str(e)}", exc_info=True)
            return {'trend': 'UNKNOWN', 'error': str(e)}
    
    def _format_fundamental_analysis(self, fundamental_data: Dict) -> Dict:
        """Format fundamental analysis data"""
        try:
            metrics = fundamental_data.get('metrics', {})
            score = fundamental_data.get('fundamental_score', 0.5)
            
            # Get valuation assessment
            valuation = "Fairly valued"
            if score > 0.7:
                valuation = "Potentially undervalued"
            elif score < 0.3:
                valuation = "Potentially overvalued"
            
            return {
                'metrics': metrics,
                'fundamental_score': float(score),
                'valuation_assessment': valuation
            }
        except Exception as e:
            logger.error(f"Error formatting fundamental analysis: {str(e)}", exc_info=True)
            return {'fundamental_score': 0.5, 'error': str(e)}
    
    def _format_sentiment_analysis(self, sentiment_data: Dict) -> Dict:
        """Format sentiment analysis data"""
        try:
            sentiment_score = sentiment_data.get('sentiment_score', 0)
            sentiment = sentiment_data.get('sentiment', 'Neutral')
            market_impact = sentiment_data.get('market_impact', 'Neutral')
            
            return {
                'sentiment_score': float(sentiment_score),
                'sentiment': sentiment,
                'market_impact': market_impact
            }
        except Exception as e:
            logger.error(f"Error formatting sentiment analysis: {str(e)}", exc_info=True)
            return {'sentiment_score': 0, 'sentiment': 'Neutral', 'error': str(e)}
    
    def _get_confidence_label(self, confidence_score: float) -> str:
        """Convert numerical confidence score to descriptive label"""
        if confidence_score >= 0.8:
            return "Very High"
        elif confidence_score >= 0.6:
            return "High"
        elif confidence_score >= 0.4:
            return "Moderate"
        elif confidence_score >= 0.2:
            return "Low"
        else:
            return "Very Low"
    
    def _get_trend_description(self, trend: str) -> str:
        """Get description for trend types"""
        descriptions = {
            "UPTREND": "The stock is in a consistent upward trend, showing higher highs and higher lows.",
            "DOWNTREND": "The stock is in a consistent downward trend, showing lower highs and lower lows.",
            "SIDEWAYS": "The stock is moving sideways with no clear directional momentum.",
            "VOLATILE": "The stock is showing high volatility with large price swings.",
            "BULLISH": "The market is showing overall positive sentiment and upward momentum.",
            "BEARISH": "The market is showing overall negative sentiment and downward momentum.",
            "NEUTRAL": "The market is showing balanced forces with no clear directional bias."
        }
        return descriptions.get(trend, "No trend analysis available")
    
    def _get_volatility_description(self, volatility_index: float) -> str:
        """Get description for volatility index"""
        if volatility_index >= 30:
            return "Extremely high volatility, indicating significant market fear or uncertainty."
        elif volatility_index >= 20:
            return "High volatility, suggesting elevated market stress."
        elif volatility_index >= 15:
            return "Moderate volatility, typical of normal market conditions."
        else:
            return "Low volatility, indicating calm market conditions." 