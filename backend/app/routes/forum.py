from typing import List, Optional, Dict, Any, Tuple
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Body, Path
from sqlalchemy.orm import Session
from fastapi.responses import JSONResponse

from ..db.database import get_db
from ..models.user import User
from ..auth.utils import verify_token
from ..services import forum_service
from ..schemas.forum import (
    ForumSectionCreate, ForumSectionUpdate, ForumSectionRead, ForumSectionWithStats,
    ForumTagCreate, ForumTagRead,
    ForumPostCreate, ForumPostUpdate, ForumPostRead, ForumPostDetailRead,
    ForumCommentCreate, ForumCommentUpdate, ForumCommentRead,
    ForumReportCreate, ForumReportUpdate, ForumReportRead
)

router = APIRouter(prefix="/forum", tags=["forum"])

# Helper function to get current user from token
async def get_current_user_from_token(token_data: dict = Depends(verify_token), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == token_data["sub"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# Section routes
@router.post("/sections", response_model=ForumSectionRead, status_code=201)
async def create_section(
    section: ForumSectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token)
):
    """Create a new forum section (admin only)"""
    return forum_service.create_section(db, section, current_user)


@router.get("/sections", response_model=List[ForumSectionWithStats])
async def list_sections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token)
):
    """List all forum sections"""
    return forum_service.list_sections(db, current_user)


@router.get("/sections/{section_id}", response_model=ForumSectionRead)
async def get_section(
    section_id: int = Path(..., description="Section ID", gt=0),
    db: Session = Depends(get_db)
):
    """Get a single forum section by ID"""
    return forum_service.get_section(db, section_id)


@router.put("/sections/{section_id}", response_model=ForumSectionRead)
async def update_section(
    section: ForumSectionUpdate,
    section_id: int = Path(..., description="Section ID", gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token)
):
    """Update an existing forum section (admin only)"""
    return forum_service.update_section(db, section_id, section, current_user)


@router.delete("/sections/{section_id}")
async def delete_section(
    section_id: int = Path(..., description="Section ID", gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token)
):
    """Delete a forum section (admin only)"""
    return forum_service.delete_section(db, section_id, current_user)


# Tag routes
@router.post("/tags", response_model=ForumTagRead, status_code=201)
async def create_tag(
    tag: ForumTagCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token)
):
    """Create a new forum tag (admin only)"""
    return forum_service.create_tag(db, tag, current_user)


@router.get("/tags", response_model=List[ForumTagRead])
async def list_tags(
    db: Session = Depends(get_db)
):
    """List all forum tags"""
    return forum_service.list_tags(db)


@router.delete("/tags/{tag_id}")
async def delete_tag(
    tag_id: int = Path(..., description="Tag ID", gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token)
):
    """Delete a forum tag (admin only)"""
    return forum_service.delete_tag(db, tag_id, current_user)


# Post routes
@router.post("/posts", response_model=ForumPostDetailRead, status_code=201)
async def create_post(
    title: str = Form(..., description="Post title"),
    content: str = Form(..., description="Post content"),
    section_id: int = Form(..., description="Section ID"),
    tag_ids: Optional[List[int]] = Form(None, description="List of tag IDs"),
    is_official: Optional[bool] = Form(False, description="Whether the post is official (admin only)"),
    files: Optional[List[UploadFile]] = File(None, description="Images to upload"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token)
):
    """Create a new forum post with optional images and tags"""
    post_data = ForumPostCreate(
        title=title,
        content=content,
        section_id=section_id,
        tag_ids=tag_ids or [],
        is_official=is_official
    )
    return await forum_service.create_post(db, post_data, current_user, files)


@router.get("/posts", response_model=Dict[str, Any])
async def list_posts(
    section_id: Optional[int] = Query(None, description="Filter by section ID"),
    tag_id: Optional[int] = Query(None, description="Filter by tag ID"),
    search: Optional[str] = Query(None, description="Search term for title/content"),
    page: int = Query(1, description="Page number", ge=1),
    page_size: int = Query(20, description="Items per page", ge=5, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token)
):
    """List forum posts with filtering and pagination"""
    skip = (page - 1) * page_size
    posts, total = forum_service.list_posts(
        db, section_id, tag_id, search, skip, page_size, current_user
    )
    return {
        "items": posts,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size
    }


@router.get("/posts/{post_id}", response_model=ForumPostDetailRead)
async def get_post(
    post_id: int = Path(..., description="Post ID", gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token)
):
    """Get a single forum post with comments"""
    return forum_service.get_post(db, post_id, current_user)


@router.put("/posts/{post_id}", response_model=ForumPostDetailRead)
async def update_post(
    post_id: int = Path(..., description="Post ID", gt=0),
    title: Optional[str] = Form(None, description="Post title"),
    content: Optional[str] = Form(None, description="Post content"),
    tag_ids: Optional[List[int]] = Form(None, description="List of tag IDs"),
    files: Optional[List[UploadFile]] = File(None, description="Images to upload"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token)
):
    """Update an existing forum post"""
    post_data = ForumPostUpdate(
        title=title,
        content=content,
        tag_ids=tag_ids
    )
    return await forum_service.update_post(db, post_id, post_data, current_user, files)


@router.delete("/posts/{post_id}")
async def delete_post(
    post_id: int = Path(..., description="Post ID", gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token)
):
    """Delete a forum post"""
    return await forum_service.delete_post(db, post_id, current_user)


@router.post("/posts/{post_id}/pin")
async def toggle_pin_post(
    post_id: int = Path(..., description="Post ID", gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token)
):
    """Toggle pin status for a post (admin only)"""
    return forum_service.toggle_pin_post(db, post_id, current_user)


@router.post("/posts/{post_id}/like")
async def toggle_post_like(
    post_id: int = Path(..., description="Post ID", gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token)
):
    """Toggle like status for a post"""
    return forum_service.toggle_post_like(db, post_id, current_user)


# Comment routes
@router.post("/comments", response_model=ForumCommentRead, status_code=201)
async def create_comment(
    comment: ForumCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token)
):
    """Create a new comment on a post or reply to another comment"""
    return forum_service.create_comment(db, comment, current_user)


@router.put("/comments/{comment_id}", response_model=ForumCommentRead)
async def update_comment(
    comment: ForumCommentUpdate,
    comment_id: int = Path(..., description="Comment ID", gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token)
):
    """Update a comment"""
    return forum_service.update_comment(db, comment_id, comment, current_user)


@router.delete("/comments/{comment_id}")
async def delete_comment(
    comment_id: int = Path(..., description="Comment ID", gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token)
):
    """Delete a comment"""
    return forum_service.delete_comment(db, comment_id, current_user)


@router.post("/comments/{comment_id}/like")
async def toggle_comment_like(
    comment_id: int = Path(..., description="Comment ID", gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token)
):
    """Toggle like status for a comment"""
    return forum_service.toggle_comment_like(db, comment_id, current_user)


# Report routes
@router.post("/reports", response_model=ForumReportRead, status_code=201)
async def create_report(
    report: ForumReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token)
):
    """Report a forum post or comment"""
    return forum_service.create_report(db, report, current_user)


@router.put("/reports/{report_id}", response_model=ForumReportRead)
async def resolve_report(
    report: ForumReportUpdate,
    report_id: int = Path(..., description="Report ID", gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token)
):
    """Resolve a report (admin only)"""
    return forum_service.resolve_report(db, report_id, report, current_user)


@router.get("/reports", response_model=List[ForumReportRead])
async def list_reports(
    resolved: Optional[bool] = Query(None, description="Filter by resolved status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token)
):
    """List all reports (admin only)"""
    return forum_service.list_reports(db, resolved, current_user) 