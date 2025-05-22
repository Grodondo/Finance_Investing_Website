from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class TrendDirection(str, Enum):
    BULLISH = "BULLISH"
    BEARISH = "BEARISH"
    NEUTRAL = "NEUTRAL"


class RecommendationType(str, Enum):
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"


class StockAnalysisBase(BaseModel):
    prediction_price: float
    confidence_score: float
    trend_analysis: str
    recommendation: RecommendationType
    reasoning: str


class StockAnalysisCreate(StockAnalysisBase):
    stock_id: int


class StockAnalysis(StockAnalysisBase):
    id: int
    stock_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class MarketAnalysisBase(BaseModel):
    market_trend: TrendDirection
    volatility_index: float
    sector_performance: Dict[str, float]
    market_sentiment: str


class MarketAnalysisCreate(MarketAnalysisBase):
    pass


class MarketAnalysis(MarketAnalysisBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class HistoricalPrediction(BaseModel):
    date: datetime
    predicted_price: float
    actual_price: float
    accuracy: float
    
    class Config:
        from_attributes = True 