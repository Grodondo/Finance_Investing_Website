from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from .database import Base

class OrderType(str, enum.Enum):
    BUY = "BUY"
    SELL = "SELL"

class Stock(Base):
    __tablename__ = "stocks"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, unique=True, index=True)
    name = Column(String)
    current_price = Column(Float)
    last_updated = Column(DateTime, default=datetime.utcnow)

    # Relationships
    holdings = relationship("Holding", back_populates="stock")
    orders = relationship("Order", back_populates="stock")

class Holding(Base):
    __tablename__ = "holdings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    stock_id = Column(Integer, ForeignKey("stocks.id"))
    shares = Column(Float)
    average_price = Column(Float)
    last_updated = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="holdings")
    stock = relationship("Stock", back_populates="holdings")

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    stock_id = Column(Integer, ForeignKey("stocks.id"))
    type = Column(Enum(OrderType))
    quantity = Column(Float)
    price = Column(Float)
    total_amount = Column(Float)
    status = Column(String)  # PENDING, COMPLETED, CANCELLED
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="orders")
    stock = relationship("Stock", back_populates="orders")

class Watchlist(Base):
    __tablename__ = "watchlist"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    stock_id = Column(Integer, ForeignKey("stocks.id"))
    added_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="watchlist")
    stock = relationship("Stock")

# Add relationships to User model
from .user import User

User.holdings = relationship("Holding", back_populates="user")
User.orders = relationship("Order", back_populates="user")
User.watchlist = relationship("Watchlist", back_populates="user") 