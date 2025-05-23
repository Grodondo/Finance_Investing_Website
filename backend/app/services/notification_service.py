from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional

from ..models.notification import Notification
from ..models.user import User
from ..schemas.notification import NotificationCreate, NotificationRead, NotificationsResponse

async def create_notification(db: Session, notification_data: NotificationCreate) -> NotificationRead:
    """Create a new notification."""
    db_notification = Notification(**notification_data.model_dump())
    db.add(db_notification)
    db.commit()
    db.refresh(db_notification)
    # Eager load actor for the response
    db_notification = db.query(Notification).options(joinedload(Notification.actor)).filter(Notification.id == db_notification.id).first()
    return NotificationRead.from_orm(db_notification)

async def get_notifications_for_user(
    db: Session, user_id: int, limit: int = 20, offset: int = 0, include_read: bool = False
) -> NotificationsResponse:
    """Get notifications for a specific user with unread count."""
    query = db.query(Notification).filter(Notification.user_id == user_id)
    
    if not include_read:
        query = query.filter(Notification.is_read == False)
        
    notifications_db = (
        query.options(joinedload(Notification.actor))
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    
    unread_count = db.query(func.count(Notification.id)).filter(
        Notification.user_id == user_id, 
        Notification.is_read == False
    ).scalar()
    
    notifications_read = [NotificationRead.from_orm(n) for n in notifications_db]
    
    return NotificationsResponse(notifications=notifications_read, unread_count=unread_count)

async def mark_notification_as_read(db: Session, notification_id: int, user_id: int) -> Optional[NotificationRead]:
    """Mark a specific notification as read."""
    notification = db.query(Notification).filter(
        Notification.id == notification_id, 
        Notification.user_id == user_id
    ).first()
    
    if notification:
        notification.is_read = True
        db.commit()
        db.refresh(notification)
        # Eager load actor for the response
        notification = db.query(Notification).options(joinedload(Notification.actor)).filter(Notification.id == notification.id).first()
        return NotificationRead.from_orm(notification)
    return None

async def mark_all_notifications_as_read(db: Session, user_id: int) -> int:
    """Mark all unread notifications for a user as read. Returns the count of updated notifications."""
    unread_notifications = db.query(Notification).filter(
        Notification.user_id == user_id, 
        Notification.is_read == False
    )
    
    updated_count = 0
    for notification in unread_notifications.all():
        notification.is_read = True
        updated_count += 1
        
    if updated_count > 0:
        db.commit()
        
    return updated_count

# Utility function to be called from other services (e.g., forum_service)
async def send_notification(
    db: Session,
    user_to_notify_id: int,
    notification_type: str, # Should match NotificationType Literal
    message: str,
    actor_id: Optional[int] = None,
    link: Optional[str] = None,
    post_id: Optional[int] = None,
    comment_id: Optional[int] = None,
    section_id: Optional[int] = None
):
    """Helper function to create and send a notification."""
    notification_data = NotificationCreate(
        user_id=user_to_notify_id,
        actor_id=actor_id,
        type=notification_type,
        message=message,
        link=link,
        post_id=post_id,
        comment_id=comment_id,
        section_id=section_id,
        is_read=False # Ensure new notifications are unread
    )
    await create_notification(db, notification_data)
    # Here you might also integrate with a real-time system (e.g., WebSockets)
    # For now, it just saves to DB.
    print(f"Notification created for user {user_to_notify_id}: {message}") # For logging 