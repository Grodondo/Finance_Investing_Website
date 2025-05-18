from sqlalchemy import Boolean, Column, Integer, String, Text, ForeignKey, Enum, DateTime, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from ..db.database import Base

class ForumSectionType(str, enum.Enum):
    GENERAL = "general_discussion"
    INVESTMENT = "investment_tips"
    BUDGETING = "budgeting_advice"
    ANNOUNCEMENTS = "admin_announcements"

class ForumReportReason(str, enum.Enum):
    SPAM = "spam"
    OFFENSIVE = "offensive"
    IRRELEVANT = "irrelevant"
    DUPLICATE = "duplicate"
    OTHER = "other"

# Many-to-many relationship for post tags
post_tags = Table(
    "post_tags",
    Base.metadata,
    Column("post_id", Integer, ForeignKey("forum_posts.id")),
    Column("tag_id", Integer, ForeignKey("forum_tags.id"))
)

# Many-to-many relationship for post likes
post_likes = Table(
    "post_likes",
    Base.metadata,
    Column("post_id", Integer, ForeignKey("forum_posts.id")),
    Column("user_id", Integer, ForeignKey("users.id"))
)

# Many-to-many relationship for comment likes
comment_likes = Table(
    "comment_likes",
    Base.metadata,
    Column("comment_id", Integer, ForeignKey("forum_comments.id")),
    Column("user_id", Integer, ForeignKey("users.id"))
)

class ForumSection(Base):
    __tablename__ = "forum_sections"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    section_type = Column(Enum(ForumSectionType), nullable=False)
    is_restricted = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    posts = relationship("ForumPost", back_populates="section")

class ForumTag(Base):
    __tablename__ = "forum_tags"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    posts = relationship("ForumPost", secondary=post_tags, back_populates="tags")

class ForumPost(Base):
    __tablename__ = "forum_posts"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    section_id = Column(Integer, ForeignKey("forum_sections.id"), nullable=False)
    is_pinned = Column(Boolean, default=False)
    is_official = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="forum_posts")
    section = relationship("ForumSection", back_populates="posts")
    comments = relationship("ForumComment", back_populates="post", cascade="all, delete-orphan")
    images = relationship("ForumImage", back_populates="post", cascade="all, delete-orphan")
    tags = relationship("ForumTag", secondary=post_tags, back_populates="posts")
    likes = relationship("User", secondary=post_likes)
    reports = relationship("ForumReport", back_populates="post", cascade="all, delete-orphan")

class ForumComment(Base):
    __tablename__ = "forum_comments"
    
    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    post_id = Column(Integer, ForeignKey("forum_posts.id"), nullable=False)
    parent_id = Column(Integer, ForeignKey("forum_comments.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="forum_comments")
    post = relationship("ForumPost", back_populates="comments")
    replies = relationship("ForumComment", back_populates="parent", cascade="all, delete-orphan")
    parent = relationship("ForumComment", back_populates="replies", remote_side=[id])
    likes = relationship("User", secondary=comment_likes)
    reports = relationship("ForumReport", back_populates="comment", cascade="all, delete-orphan")

class ForumImage(Base):
    __tablename__ = "forum_images"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    filepath = Column(String, nullable=False)
    post_id = Column(Integer, ForeignKey("forum_posts.id"), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    post = relationship("ForumPost", back_populates="images")
    user = relationship("User", back_populates="forum_images")

class ForumReport(Base):
    __tablename__ = "forum_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    reason = Column(Enum(ForumReportReason), nullable=False)
    details = Column(Text, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    post_id = Column(Integer, ForeignKey("forum_posts.id"), nullable=True)
    comment_id = Column(Integer, ForeignKey("forum_comments.id"), nullable=True)
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="forum_reports")
    post = relationship("ForumPost", back_populates="reports")
    comment = relationship("ForumComment", back_populates="reports")
    resolver = relationship("User", foreign_keys=[resolved_by]) 