from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from ..db.database import Base


class StockAnalysis(Base):
    __tablename__ = "stock_analyses"

    id = Column(Integer, primary_key=True, index=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"))
    prediction_price = Column(Float)
    confidence_score = Column(Float)
    trend_analysis = Column(Text)
    recommendation = Column(String)  # BUY, SELL, HOLD
    reasoning = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    stock = relationship("Stock", backref="analyses")


class MarketAnalysis(Base):
    __tablename__ = "market_analyses"
    
    id = Column(Integer, primary_key=True, index=True)
    market_trend = Column(String)  # BULLISH, BEARISH, NEUTRAL
    volatility_index = Column(Float)
    sector_performance = Column(Text)  # JSON serialized sector performance data
    market_sentiment = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow) 