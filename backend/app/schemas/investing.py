from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum

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

class StockDetail(Stock):
    historical_data: List[StockHistoricalData]
    volume: int
    market_cap: float
    change: float
    change_percent: float

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
    symbol: str
    name: str
    current_price: float
    change: float
    change_percent: float

    class Config:
        from_attributes = True 