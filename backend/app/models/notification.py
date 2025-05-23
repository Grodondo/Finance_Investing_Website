from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum as SQLAlchemyEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..db.database import Base
from ..schemas.notification import NotificationType # Import the Literal type

# Define NotificationType as an Enum for SQLAlchemy
class NotificationTypeEnum(SQLAlchemyEnum):
    pass

# This should match the Literal defined in schemas
NOTIFICATION_TYPES = [
    'new_post_in_section',
    'reply_to_post',
    'reply_to_comment',
    'mention_in_post',
    'mention_in_comment',
    'post_liked',
    'comment_liked',
    'admin_announcement',
    'report_update'
]

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True) # User who triggered the notification
    
    type = Column(NotificationTypeEnum(*NOTIFICATION_TYPES, name="notification_type_enum"), nullable=False)
    message = Column(String, nullable=False)
    link = Column(String, nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="notifications")
    actor = relationship("User", foreign_keys=[actor_id])

    # Optional relationships to forum content (if needed for context, or use link)
    post_id = Column(Integer, ForeignKey("forum_posts.id", ondelete="SET NULL"), nullable=True)
    comment_id = Column(Integer, ForeignKey("forum_comments.id", ondelete="SET NULL"), nullable=True)
    section_id = Column(Integer, ForeignKey("forum_sections.id", ondelete="SET NULL"), nullable=True)

    post = relationship("ForumPost") # Define if needed for direct access
    comment = relationship("ForumComment") # Define if needed
    section = relationship("ForumSection") # Define if needed 