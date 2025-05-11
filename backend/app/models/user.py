from sqlalchemy import Boolean, Column, Integer, String, Enum
from sqlalchemy.orm import relationship
import enum
from ..db.database import Base

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    USER = "user"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    role = Column(Enum(UserRole), default=UserRole.USER)
    
    # Relationships
    transactions = relationship("Transaction", back_populates="user")
    budgets = relationship("Budget", back_populates="user")
    categories = relationship("Category", back_populates="user")
    holdings = relationship("Holding", back_populates="user")
    orders = relationship("Order", back_populates="user")
    watchlist = relationship("Watchlist", back_populates="user") 