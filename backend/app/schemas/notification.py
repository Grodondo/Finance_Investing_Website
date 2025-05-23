from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Literal

from .user import UserBase

NotificationType = Literal[
    'new_post_in_section', # New post in a subscribed section
    'reply_to_post',       # Reply to user's post
    'reply_to_comment',    # Reply to user's comment
    'mention_in_post',     # User mentioned in a post
    'mention_in_comment',  # User mentioned in a comment
    'post_liked',          # User's post liked
    'comment_liked',       # User's comment liked
    'admin_announcement',  # New admin announcement
    'report_update'        # Update on a report submitted by user or affecting user's content
]

class NotificationBase(BaseModel):
    type: NotificationType
    message: str
    link: Optional[str] = None # Link to the relevant content (post, comment, section)
    is_read: bool = False

class NotificationCreate(NotificationBase):
    user_id: int # The user who will receive the notification
    actor_id: Optional[int] = None # The user who triggered the notification (e.g., who replied or liked)
    post_id: Optional[int] = None
    comment_id: Optional[int] = None
    section_id: Optional[int] = None

class NotificationRead(NotificationBase):
    id: int
    user_id: int
    actor: Optional[UserBase] = None
    created_at: datetime
    
    class Config:
        orm_mode = True

class NotificationsResponse(BaseModel):
    notifications: list[NotificationRead]
    unread_count: int 