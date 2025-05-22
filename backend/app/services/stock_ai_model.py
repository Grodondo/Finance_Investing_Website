import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json
import logging
from typing import Dict, List, Tuple, Optional
from enum import Enum

# Configure logging
logger = logging.getLogger(__name__)

class TrendType(str, Enum):
    UPTREND = "UPTREND"
    DOWNTREND = "DOWNTREND"
    SIDEWAYS = "SIDEWAYS"
    VOLATILE = "VOLATILE"

class StockAIModel:
    """
    The Model component of the MCP pattern for Stock AI Analysis.
    Responsible for data processing, analysis, and predictions.
    """

    def __init__(self):
        self.model_weights = {
            'technical': 0.5,
            'fundamental': 0.3,
            'sentiment': 0.2
        }
    
    def analyze_stock(self, 
                      symbol: str, 
                      historical_data: List[Dict],
                      company_info: Dict = None,
                      news_sentiment: float = None) -> Dict:
        """
        Perform comprehensive analysis on a stock based on technical, fundamental, and sentiment indicators
        
        Args:
            symbol: Stock ticker symbol
            historical_data: List of historical price data points
            company_info: Dictionary containing company fundamental data
            news_sentiment: Sentiment score from news analysis (-1 to 1)
            
        Returns:
            Dictionary containing analysis results
        """
        try:
            # Convert historical data to pandas DataFrame for analysis
            if not historical_data:
                logger.warning(f"No historical data available for {symbol}")
                return self._create_error_response(f"Insufficient data for {symbol}")
            
            # Extract daily data (not intraday)
            daily_data = [d for d in historical_data if not d.get('is_intraday', False)]
            if not daily_data:
                logger.warning(f"No daily data available for {symbol}")
                return self._create_error_response(f"Insufficient daily data for {symbol}")
            
            # Create DataFrame
            df = pd.DataFrame(daily_data)
            df['date'] = pd.to_datetime(df['date'])
            df = df.sort_values('date')
            
            # Technical analysis
            technical_analysis = self._perform_technical_analysis(df)
            
            # Fundamental analysis (if data is available)
            fundamental_analysis = self._perform_fundamental_analysis(company_info) if company_info else None
            
            # Sentiment analysis (if data is available)
            sentiment_analysis = self._perform_sentiment_analysis(news_sentiment) if news_sentiment is not None else None
            
            # Generate prediction
            prediction_results = self._generate_prediction(df, technical_analysis, fundamental_analysis, sentiment_analysis)
            
            # Generate recommendation
            recommendation = self._generate_recommendation(
                technical_analysis, 
                fundamental_analysis, 
                sentiment_analysis,
                prediction_results
            )
            
            return {
                'symbol': symbol,
                'technical_analysis': technical_analysis,
                'fundamental_analysis': fundamental_analysis,
                'sentiment_analysis': sentiment_analysis,
                'prediction': prediction_results,
                'recommendation': recommendation['recommendation'],
                'reasoning': recommendation['reasoning'],
                'confidence_score': recommendation['confidence']
            }
            
        except Exception as e:
            logger.error(f"Error analyzing stock {symbol}: {str(e)}", exc_info=True)
            return self._create_error_response(f"Error analyzing stock: {str(e)}")
    
    def _perform_technical_analysis(self, df: pd.DataFrame) -> Dict:
        """Perform technical analysis on historical price data"""
        try:
            # Calculate moving averages
            df['SMA_20'] = df['price'].rolling(window=20).mean()
            df['SMA_50'] = df['price'].rolling(window=50).mean()
            df['SMA_200'] = df['price'].rolling(window=200).mean()
            
            # Calculate RSI (Relative Strength Index)
            delta = df['price'].diff()
            gain = delta.where(delta > 0, 0).rolling(window=14).mean()
            loss = -delta.where(delta < 0, 0).rolling(window=14).mean()
            rs = gain / loss
            df['RSI'] = 100 - (100 / (1 + rs))
            
            # Identify trend
            latest_price = df['price'].iloc[-1]
            trend = self._identify_trend(df)
            
            # Check for support and resistance levels
            support_level, resistance_level = self._identify_support_resistance(df)
            
            # Calculate volatility
            df['returns'] = df['price'].pct_change()
            volatility = df['returns'].std() * np.sqrt(252)  # Annualized volatility
            
            latest_data = df.iloc[-1]
            
            return {
                'trend': trend,
                'latest_price': float(latest_price),
                'moving_averages': {
                    'SMA_20': None if np.isnan(latest_data['SMA_20']) else float(latest_data['SMA_20']),
                    'SMA_50': None if np.isnan(latest_data['SMA_50']) else float(latest_data['SMA_50']),
                    'SMA_200': None if np.isnan(latest_data['SMA_200']) else float(latest_data['SMA_200'])
                },
                'indicators': {
                    'RSI': None if np.isnan(latest_data['RSI']) else float(latest_data['RSI']),
                    'volatility': float(volatility)
                },
                'support_level': float(support_level) if support_level else None,
                'resistance_level': float(resistance_level) if resistance_level else None
            }
        except Exception as e:
            logger.error(f"Error in technical analysis: {str(e)}", exc_info=True)
            return {
                'trend': TrendType.SIDEWAYS,
                'error': f"Technical analysis failed: {str(e)}"
            }
    
    def _identify_trend(self, df: pd.DataFrame) -> TrendType:
        """Identify the current price trend"""
        try:
            # Get last 30 days of data or less if not available
            lookback_period = min(30, len(df))
            recent_data = df.iloc[-lookback_period:]
            
            # Calculate simple linear regression slope
            x = np.arange(len(recent_data))
            y = recent_data['price'].values
            slope, _ = np.polyfit(x, y, 1)
            
            # Calculate volatility
            volatility = recent_data['price'].std() / recent_data['price'].mean()
            
            # Determine trend based on slope and volatility
            if volatility > 0.08:  # High volatility threshold
                return TrendType.VOLATILE
            if slope > 0.001:  # Positive slope
                return TrendType.UPTREND
            elif slope < -0.001:  # Negative slope
                return TrendType.DOWNTREND
            else:
                return TrendType.SIDEWAYS
        except Exception as e:
            logger.error(f"Error identifying trend: {str(e)}", exc_info=True)
            return TrendType.SIDEWAYS
    
    def _identify_support_resistance(self, df: pd.DataFrame) -> Tuple[Optional[float], Optional[float]]:
        """Identify support and resistance levels"""
        try:
            # Use last 90 days of data
            lookback_period = min(90, len(df))
            recent_data = df.iloc[-lookback_period:]
            
            prices = recent_data['price'].values
            latest_price = prices[-1]
            
            # Find local minima and maxima
            support_candidates = []
            resistance_candidates = []
            
            window_size = 5
            for i in range(window_size, len(prices) - window_size):
                window = prices[i-window_size:i+window_size+1]
                if prices[i] == min(window):
                    support_candidates.append(prices[i])
                if prices[i] == max(window):
                    resistance_candidates.append(prices[i])
            
            # Find closest support below current price
            supports_below = [s for s in support_candidates if s < latest_price]
            support_level = max(supports_below) if supports_below else None
            
            # Find closest resistance above current price
            resistances_above = [r for r in resistance_candidates if r > latest_price]
            resistance_level = min(resistances_above) if resistances_above else None
            
            return support_level, resistance_level
            
        except Exception as e:
            logger.error(f"Error identifying support/resistance: {str(e)}", exc_info=True)
            return None, None
    
    def _perform_fundamental_analysis(self, company_info: Dict) -> Dict:
        """Analyze company fundamentals"""
        try:
            # Extract relevant fundamental metrics
            pe_ratio = company_info.get('trailingPE')
            forward_pe = company_info.get('forwardPE')
            peg_ratio = company_info.get('pegRatio')
            price_to_book = company_info.get('priceToBook')
            debt_to_equity = company_info.get('debtToEquity')
            profit_margins = company_info.get('profitMargins')
            
            # Calculate fundamental score
            fundamental_score = 0
            metrics_count = 0
            
            # PE ratio analysis
            if pe_ratio is not None and not np.isnan(pe_ratio):
                if 0 < pe_ratio < 15:
                    fundamental_score += 1  # Potentially undervalued
                elif 15 <= pe_ratio < 25:
                    fundamental_score += 0.5  # Fair value
                metrics_count += 1
            
            # PEG ratio analysis
            if peg_ratio is not None and not np.isnan(peg_ratio):
                if 0 < peg_ratio < 1:
                    fundamental_score += 1  # Undervalued considering growth
                elif 1 <= peg_ratio < 2:
                    fundamental_score += 0.5  # Fair value considering growth
                metrics_count += 1
            
            # Price-to-Book analysis
            if price_to_book is not None and not np.isnan(price_to_book):
                if 0 < price_to_book < 1:
                    fundamental_score += 1  # Trading below book value
                elif 1 <= price_to_book < 3:
                    fundamental_score += 0.5  # Reasonable price to book
                metrics_count += 1
            
            # Profit margins
            if profit_margins is not None and not np.isnan(profit_margins):
                if profit_margins > 0.2:  # 20%+ profit margin
                    fundamental_score += 1
                elif profit_margins > 0.1:  # 10%+ profit margin
                    fundamental_score += 0.5
                metrics_count += 1
            
            # Normalize score
            normalized_score = fundamental_score / metrics_count if metrics_count > 0 else 0.5
            
            return {
                'metrics': {
                    'pe_ratio': None if pe_ratio is None or np.isnan(pe_ratio) else float(pe_ratio),
                    'forward_pe': None if forward_pe is None or np.isnan(forward_pe) else float(forward_pe),
                    'peg_ratio': None if peg_ratio is None or np.isnan(peg_ratio) else float(peg_ratio),
                    'price_to_book': None if price_to_book is None or np.isnan(price_to_book) else float(price_to_book),
                    'debt_to_equity': None if debt_to_equity is None or np.isnan(debt_to_equity) else float(debt_to_equity),
                    'profit_margins': None if profit_margins is None or np.isnan(profit_margins) else float(profit_margins)
                },
                'fundamental_score': float(normalized_score)
            }
        except Exception as e:
            logger.error(f"Error in fundamental analysis: {str(e)}", exc_info=True)
            return {
                'metrics': {},
                'fundamental_score': 0.5,
                'error': f"Fundamental analysis failed: {str(e)}"
            }
    
    def _perform_sentiment_analysis(self, sentiment_score: float) -> Dict:
        """Analyze sentiment based on provided score"""
        try:
            if sentiment_score >= 0.6:
                sentiment = "Very Positive"
                sentiment_impact = "Bullish"
            elif sentiment_score >= 0.2:
                sentiment = "Positive"
                sentiment_impact = "Mildly Bullish"
            elif sentiment_score > -0.2:
                sentiment = "Neutral"
                sentiment_impact = "Neutral"
            elif sentiment_score > -0.6:
                sentiment = "Negative"
                sentiment_impact = "Mildly Bearish"
            else:
                sentiment = "Very Negative"
                sentiment_impact = "Bearish"
            
            return {
                'sentiment_score': float(sentiment_score),
                'sentiment': sentiment,
                'market_impact': sentiment_impact
            }
        except Exception as e:
            logger.error(f"Error in sentiment analysis: {str(e)}", exc_info=True)
            return {
                'sentiment_score': 0,
                'sentiment': "Neutral",
                'market_impact': "Neutral",
                'error': f"Sentiment analysis failed: {str(e)}"
            }
    
    def _generate_prediction(self, 
                             df: pd.DataFrame,
                             technical_analysis: Dict,
                             fundamental_analysis: Optional[Dict],
                             sentiment_analysis: Optional[Dict]) -> Dict:
        """Generate price prediction"""
        try:
            # Get the last price
            last_price = df['price'].iloc[-1]
            
            # Get date of last entry
            last_date = df['date'].iloc[-1]
            
            # Calculate prediction dates
            next_day = last_date + timedelta(days=1)
            next_week = last_date + timedelta(days=7)
            next_month = last_date + timedelta(days=30)
            
            # Simple prediction model based on weighted factors
            # Technical factors
            technical_factor = 0
            
            # Trend factor
            if technical_analysis.get('trend') == TrendType.UPTREND:
                technical_factor += 0.02
            elif technical_analysis.get('trend') == TrendType.DOWNTREND:
                technical_factor -= 0.02
                
            # Moving average factor
            ma_20 = technical_analysis.get('moving_averages', {}).get('SMA_20')
            ma_50 = technical_analysis.get('moving_averages', {}).get('SMA_50')
            
            if ma_20 and ma_50:
                if ma_20 > ma_50:  # Golden cross (bullish)
                    technical_factor += 0.01
                elif ma_20 < ma_50:  # Death cross (bearish)
                    technical_factor -= 0.01
            
            # RSI factor
            rsi = technical_analysis.get('indicators', {}).get('RSI')
            if rsi:
                if rsi > 70:  # Overbought
                    technical_factor -= 0.01
                elif rsi < 30:  # Oversold
                    technical_factor += 0.01
            
            # Fundamental factor
            fundamental_factor = 0
            if fundamental_analysis:
                fundamental_score = fundamental_analysis.get('fundamental_score', 0.5)
                fundamental_factor = (fundamental_score - 0.5) * 0.02  # Convert 0-1 score to -1% to +1%
            
            # Sentiment factor
            sentiment_factor = 0
            if sentiment_analysis:
                sentiment_score = sentiment_analysis.get('sentiment_score', 0)
                sentiment_factor = sentiment_score * 0.01  # Convert -1 to 1 score to -1% to +1%
            
            # Calculate weighted prediction factors for different time horizons
            daily_change_pct = (
                self.model_weights['technical'] * technical_factor +
                self.model_weights['fundamental'] * fundamental_factor * 0.5 +  # Less impact on short-term
                self.model_weights['sentiment'] * sentiment_factor
            )
            
            weekly_change_pct = (
                self.model_weights['technical'] * technical_factor * 3 +
                self.model_weights['fundamental'] * fundamental_factor +
                self.model_weights['sentiment'] * sentiment_factor * 2
            )
            
            monthly_change_pct = (
                self.model_weights['technical'] * technical_factor * 5 +
                self.model_weights['fundamental'] * fundamental_factor * 3 +
                self.model_weights['sentiment'] * sentiment_factor * 2
            )
            
            # Calculate predicted prices
            prediction_day = last_price * (1 + daily_change_pct)
            prediction_week = last_price * (1 + weekly_change_pct)
            prediction_month = last_price * (1 + monthly_change_pct)
            
            # Calculate confidence (inversely related to volatility)
            volatility = technical_analysis.get('indicators', {}).get('volatility', 0.3)
            confidence = max(0.1, min(0.9, 1 - volatility))
            
            return {
                'current_price': float(last_price),
                'prediction_day': {
                    'date': next_day.strftime('%Y-%m-%d'),
                    'price': float(prediction_day),
                    'change_percent': float(daily_change_pct * 100)
                },
                'prediction_week': {
                    'date': next_week.strftime('%Y-%m-%d'),
                    'price': float(prediction_week),
                    'change_percent': float(weekly_change_pct * 100)
                },
                'prediction_month': {
                    'date': next_month.strftime('%Y-%m-%d'),
                    'price': float(prediction_month),
                    'change_percent': float(monthly_change_pct * 100)
                },
                'confidence': float(confidence)
            }
        except Exception as e:
            logger.error(f"Error generating prediction: {str(e)}", exc_info=True)
            return {
                'error': f"Prediction failed: {str(e)}",
                'confidence': 0.1
            }
    
    def _generate_recommendation(self,
                                technical_analysis: Dict,
                                fundamental_analysis: Optional[Dict],
                                sentiment_analysis: Optional[Dict],
                                prediction_results: Dict) -> Dict:
        """Generate buy/sell/hold recommendation based on analyses"""
        try:
            buy_signals = 0
            sell_signals = 0
            neutral_signals = 0
            reasons = []
            
            # Technical indicators
            trend = technical_analysis.get('trend')
            if trend == TrendType.UPTREND:
                buy_signals += 1
                reasons.append("Stock is in a technical uptrend")
            elif trend == TrendType.DOWNTREND:
                sell_signals += 1
                reasons.append("Stock is in a technical downtrend")
            else:
                neutral_signals += 1
                reasons.append("Stock is in a sideways or volatile trend")
            
            # Moving averages
            ma_20 = technical_analysis.get('moving_averages', {}).get('SMA_20')
            ma_50 = technical_analysis.get('moving_averages', {}).get('SMA_50')
            current_price = technical_analysis.get('latest_price')
            
            if ma_20 and ma_50 and current_price:
                if current_price > ma_20 and current_price > ma_50:
                    buy_signals += 1
                    reasons.append("Price is above major moving averages (bullish)")
                elif current_price < ma_20 and current_price < ma_50:
                    sell_signals += 1
                    reasons.append("Price is below major moving averages (bearish)")
                else:
                    neutral_signals += 1
                    reasons.append("Price is mixed relative to moving averages")
            
            # RSI
            rsi = technical_analysis.get('indicators', {}).get('RSI')
            if rsi:
                if rsi > 70:
                    sell_signals += 1
                    reasons.append(f"RSI is overbought at {rsi:.1f}")
                elif rsi < 30:
                    buy_signals += 1
                    reasons.append(f"RSI is oversold at {rsi:.1f}")
                else:
                    neutral_signals += 1
            
            # Support/Resistance
            support = technical_analysis.get('support_level')
            resistance = technical_analysis.get('resistance_level')
            
            if support and current_price and support / current_price > 0.95:
                buy_signals += 0.5
                reasons.append(f"Price is near support level ({support:.2f})")
            
            if resistance and current_price and current_price / resistance > 0.95:
                sell_signals += 0.5
                reasons.append(f"Price is near resistance level ({resistance:.2f})")
            
            # Fundamentals
            if fundamental_analysis:
                fundamental_score = fundamental_analysis.get('fundamental_score', 0.5)
                if fundamental_score > 0.7:
                    buy_signals += 1
                    reasons.append("Strong fundamental metrics")
                elif fundamental_score < 0.3:
                    sell_signals += 1
                    reasons.append("Weak fundamental metrics")
                else:
                    neutral_signals += 0.5
                    reasons.append("Average fundamental metrics")
            
            # Sentiment
            if sentiment_analysis:
                sentiment_score = sentiment_analysis.get('sentiment_score', 0)
                if sentiment_score > 0.3:
                    buy_signals += 0.5
                    reasons.append("Positive market sentiment")
                elif sentiment_score < -0.3:
                    sell_signals += 0.5
                    reasons.append("Negative market sentiment")
            
            # Prediction
            month_prediction = prediction_results.get('prediction_month', {})
            month_change = month_prediction.get('change_percent', 0)
            
            if month_change > 5:
                buy_signals += 1
                reasons.append(f"Bullish 30-day prediction ({month_change:.1f}% growth)")
            elif month_change < -5:
                sell_signals += 1
                reasons.append(f"Bearish 30-day prediction ({month_change:.1f}% decline)")
            else:
                neutral_signals += 0.5
                reasons.append(f"Neutral 30-day prediction ({month_change:.1f}% change)")
            
            # Determine recommendation based on signals
            total_signals = buy_signals + sell_signals + neutral_signals
            if total_signals == 0:
                recommendation = "HOLD"
                confidence = 0.1
            else:
                buy_ratio = buy_signals / total_signals
                sell_ratio = sell_signals / total_signals
                confidence = max(buy_ratio, sell_ratio) * prediction_results.get('confidence', 0.5)
                
                if buy_ratio > 0.6:
                    recommendation = "BUY"
                elif sell_ratio > 0.6:
                    recommendation = "SELL"
                else:
                    recommendation = "HOLD"
            
            # Generate reasoning text
            if recommendation == "BUY":
                reasoning_intro = "Consider buying based on: "
            elif recommendation == "SELL":
                reasoning_intro = "Consider selling based on: "
            else:
                reasoning_intro = "Consider holding based on: "
            
            reasoning = reasoning_intro + "; ".join(reasons[:3])
            
            return {
                'recommendation': recommendation,
                'confidence': float(confidence),
                'reasoning': reasoning
            }
            
        except Exception as e:
            logger.error(f"Error generating recommendation: {str(e)}", exc_info=True)
            return {
                'recommendation': "HOLD",
                'confidence': 0.1,
                'reasoning': f"Unable to generate recommendation due to error: {str(e)}"
            }
    
    def analyze_market(self, market_data: Dict) -> Dict:
        """
        Analyze overall market conditions
        
        Args:
            market_data: Dictionary containing market indices, sector performance data
            
        Returns:
            Dictionary containing market analysis results
        """
        try:
            # TODO: Implement market analysis
            # This would analyze major indices, sector performance, etc.
            return {
                'market_trend': "NEUTRAL",
                'volatility_index': 15.0,
                'sector_performance': {},
                'market_sentiment': "The market shows mixed signals with technology outperforming other sectors."
            }
        except Exception as e:
            logger.error(f"Error analyzing market: {str(e)}", exc_info=True)
            return {
                'market_trend': "NEUTRAL",
                'error': f"Market analysis failed: {str(e)}"
            }
    
    def _create_error_response(self, error_message: str) -> Dict:
        """Create an error response for failed analysis"""
        return {
            'error': error_message,
            'recommendation': "HOLD",
            'confidence_score': 0.1,
            'reasoning': f"Unable to generate recommendation: {error_message}"
        } 