from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.orm import Session
from typing import List, Dict

from ..db.database import get_db
from ..models.user import User
from ..auth.utils import verify_token # Assuming you have this for user auth
from ..services import notification_service
from ..schemas.notification import NotificationRead, NotificationsResponse

router = APIRouter(prefix="/notifications", tags=["notifications"])

# Helper function to get current user from token (similar to forum.py)
async def get_current_user_from_token(token_data: dict = Depends(verify_token), db: Session = Depends(get_db)) -> User:
    user = db.query(User).filter(User.email == token_data["sub"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.get("/", response_model=NotificationsResponse)
async def get_my_notifications(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    include_read: bool = Query(False, description="Set to true to include read notifications"),
    current_user: User = Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Get notifications for the current authenticated user."""
    return await notification_service.get_notifications_for_user(
        db, user_id=current_user.id, limit=limit, offset=offset, include_read=include_read
    )

@router.patch("/{notification_id}/read", response_model=NotificationRead)
async def mark_as_read(
    notification_id: int = Path(..., description="ID of the notification to mark as read", gt=0),
    current_user: User = Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Mark a specific notification as read."""
    notification = await notification_service.mark_notification_as_read(
        db, notification_id=notification_id, user_id=current_user.id
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found or not yours.")
    return notification

@router.post("/mark-all-read", response_model=Dict[str, int])
async def mark_all_as_read(
    current_user: User = Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Mark all unread notifications for the current user as read."""
    updated_count = await notification_service.mark_all_notifications_as_read(db, user_id=current_user.id)
    return {"updated_count": updated_count} 