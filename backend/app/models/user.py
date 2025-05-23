from sqlalchemy import Boolean, Column, Integer, String, Enum
from sqlalchemy.orm import relationship
import enum
from ..db.database import Base
from .notification import Notification

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    USER = "user"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    username = Column(String)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    role = Column(String, default="user")
    profile_picture_url = Column(String, nullable=True)
    
    # Relationships
    transactions = relationship("Transaction", back_populates="user")
    budgets = relationship("Budget", back_populates="user")
    categories = relationship("Category", back_populates="user")
    holdings = relationship("Holding", back_populates="user")
    orders = relationship("Order", back_populates="user")
    watchlist = relationship("Watchlist", back_populates="user") 
    
    # Forum relationships
    forum_posts = relationship("ForumPost", back_populates="user")
    forum_comments = relationship("ForumComment", back_populates="user")
    forum_images = relationship("ForumImage", back_populates="user")
    forum_reports = relationship("ForumReport", foreign_keys="[ForumReport.user_id]", back_populates="user")
    resolved_reports = relationship("ForumReport", foreign_keys="[ForumReport.resolved_by]", back_populates="resolver") 
    notifications = relationship(Notification, foreign_keys=[Notification.user_id], back_populates="user", cascade="all, delete-orphan") 