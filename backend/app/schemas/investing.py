from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum
from decimal import Decimal

class OrderType(str, Enum):
    BUY = "BUY"
    SELL = "SELL"

class StockBase(BaseModel):
    symbol: str
    name: str
    current_price: float

class StockCreate(StockBase):
    pass

class Stock(StockBase):
    id: int
    last_updated: datetime

    class Config:
        from_attributes = True

class StockHistoricalData(BaseModel):
    date: datetime
    price: float

class HistoricalDataPoint(BaseModel):
    date: str
    price: float
    is_intraday: bool = False

    class Config:
        from_attributes = True

class StockDetail(BaseModel):
    id: int
    symbol: str
    name: str
    current_price: float
    change: float
    change_percent: float
    volume: int
    market_cap: float
    fifty_two_week_high: Optional[float] = None
    fifty_two_week_low: Optional[float] = None
    historical_data: List[HistoricalDataPoint] = Field(default_factory=list)
    last_updated: datetime
    recommendation: Optional[str] = None
    recommendation_reason: Optional[str] = None

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class NewsItem(BaseModel):
    title: str
    publisher: str
    link: str
    published_date: datetime
    summary: Optional[str] = None
    thumbnail: Optional[str] = None
    related_symbols: List[str] = Field(default_factory=list)
    source: str = "Yahoo Finance"

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class HoldingBase(BaseModel):
    stock_id: int
    shares: float
    average_price: float

class HoldingCreate(HoldingBase):
    pass

class Holding(HoldingBase):
    id: int
    user_id: int
    last_updated: datetime
    stock: Stock
    total_value: float
    gain_loss: float
    gain_loss_percent: float

    class Config:
        from_attributes = True

class OrderBase(BaseModel):
    stock_id: int
    type: OrderType
    quantity: float = Field(gt=0)
    price: float = Field(gt=0)

class OrderCreate(OrderBase):
    pass

class Order(OrderBase):
    id: int
    user_id: int
    total_amount: float
    status: str
    created_at: datetime
    completed_at: Optional[datetime]
    stock: Stock

    class Config:
        from_attributes = True

class WatchlistBase(BaseModel):
    stock_id: int

class WatchlistCreate(WatchlistBase):
    pass

class Watchlist(WatchlistBase):
    id: int
    user_id: int
    added_at: datetime
    stock: Stock

    class Config:
        from_attributes = True

class Portfolio(BaseModel):
    total_value: float
    daily_change: float
    daily_change_percent: float
    holdings: List[Holding]

    class Config:
        from_attributes = True

class WatchlistItem(BaseModel):
    id: int  # Stock ID
    symbol: str
    name: str
    current_price: float
    change: float
    change_percent: float
    volume: int
    market_cap: float
    shares_owned: float = 0  # Number of shares owned by the user
    total_value: float = 0  # Total value of owned shares

    class Config:
        from_attributes = True

class StockSearchResult(BaseModel):
    """Schema for stock search results"""
    symbol: str
    name: str

    class Config:
        from_attributes = True 