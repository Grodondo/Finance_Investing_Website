from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base
from models.models import TransactionType

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Float, nullable=False)
    description = Column(String)
    date = Column(DateTime, default=datetime.utcnow)
    type = Column(Enum(TransactionType), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Relationships
    user = relationship("User", back_populates="transactions")
    category = relationship("Category", back_populates="transactions") 