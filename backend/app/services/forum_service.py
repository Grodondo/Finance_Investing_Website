from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_, and_
from fastapi import HTTPException, UploadFile, Depends, status
from datetime import datetime

from ..models.forum import (
    ForumSection, ForumTag, ForumPost, ForumComment, 
    ForumImage, ForumReport, post_tags, post_likes, comment_likes
)
from ..models.user import User, UserRole
from ..schemas.forum import (
    ForumSectionCreate, ForumSectionUpdate, ForumSectionWithStats,
    ForumTagCreate, ForumTagRead,
    ForumPostCreate, ForumPostUpdate, ForumPostRead, ForumPostDetailRead,
    ForumCommentCreate, ForumCommentUpdate, ForumCommentRead, ForumCommentReadWithReplies,
    ForumReportCreate, ForumReportUpdate, ForumReportRead
)
from . import image_service


# Section services
def create_section(db: Session, section_data: ForumSectionCreate, current_user: User) -> ForumSection:
    """Create a new forum section (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can create forum sections")
    
    db_section = ForumSection(**section_data.dict())
    db.add(db_section)
    db.commit()
    db.refresh(db_section)
    return db_section


def update_section(db: Session, section_id: int, section_data: ForumSectionUpdate, current_user: User) -> ForumSection:
    """Update an existing forum section (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can update forum sections")
    
    db_section = db.query(ForumSection).filter(ForumSection.id == section_id).first()
    if not db_section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    # Update section data
    for key, value in section_data.dict(exclude_unset=True).items():
        setattr(db_section, key, value)
    
    db.commit()
    db.refresh(db_section)
    return db_section


def delete_section(db: Session, section_id: int, current_user: User) -> Dict[str, bool]:
    """Delete a forum section (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can delete forum sections")
    
    db_section = db.query(ForumSection).filter(ForumSection.id == section_id).first()
    if not db_section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    db.delete(db_section)
    db.commit()
    return {"success": True}


def get_section(db: Session, section_id: int) -> ForumSection:
    """Get a single forum section by ID"""
    db_section = db.query(ForumSection).filter(ForumSection.id == section_id).first()
    if not db_section:
        raise HTTPException(status_code=404, detail="Section not found")
    return db_section


def list_sections(db: Session, current_user: User) -> List[ForumSectionWithStats]:
    """List all forum sections with stats"""
    # Include restricted sections only for admins
    query = db.query(ForumSection)
    if current_user.role != UserRole.ADMIN:
        query = query.filter(or_(
            ForumSection.is_restricted == False,
            ForumSection.section_type != "admin_announcements"
        ))
    
    sections = query.order_by(ForumSection.name).all()
    
    # Add stats for each section
    result = []
    for section in sections:
        post_count = db.query(func.count(ForumPost.id)).filter(
            ForumPost.section_id == section.id
        ).scalar()
        
        # Get the latest post with a simple query
        latest_post = db.query(ForumPost).filter(
            ForumPost.section_id == section.id
        ).order_by(ForumPost.created_at.desc()).first()
        
        # Handle the latest post and user relationship
        prepared_latest_post = None
        if latest_post:
            # Fetch the user separately to avoid relationship issues
            user = db.query(User).filter(User.id == latest_post.user_id).first()
            if user:
                # Create a dictionary representation of the post
                post_dict = {k: v for k, v in latest_post.__dict__.items() if not k.startswith('_')}
                # Add user information directly to the post dictionary
                post_dict['user'] = {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "role": user.role
                }
                prepared_latest_post = post_dict
        
        result.append(ForumSectionWithStats(
            **section.__dict__,
            post_count=post_count,
            latest_post=prepared_latest_post
        ))
    
    return result


# Tag services
def create_tag(db: Session, tag_data: ForumTagCreate, current_user: User) -> ForumTag:
    """Create a new forum tag (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can create forum tags")
    
    # Check if tag already exists
    existing_tag = db.query(ForumTag).filter(
        func.lower(ForumTag.name) == func.lower(tag_data.name)
    ).first()
    
    if existing_tag:
        raise HTTPException(status_code=400, detail="Tag with this name already exists")
    
    db_tag = ForumTag(**tag_data.dict())
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    return db_tag


def list_tags(db: Session) -> List[ForumTagRead]:
    """List all forum tags"""
    return db.query(ForumTag).order_by(ForumTag.name).all()


def delete_tag(db: Session, tag_id: int, current_user: User) -> Dict[str, bool]:
    """Delete a forum tag (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can delete forum tags")
    
    db_tag = db.query(ForumTag).filter(ForumTag.id == tag_id).first()
    if not db_tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    db.delete(db_tag)
    db.commit()
    return {"success": True}


# Post services
async def create_post(
    db: Session, 
    post_data: ForumPostCreate, 
    current_user: User,
    files: Optional[List[UploadFile]] = None
) -> ForumPostDetailRead:
    """Create a new forum post with optional images"""
    # Check if section exists and if user has access
    section = db.query(ForumSection).filter(ForumSection.id == post_data.section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    # Check if user can post in restricted section
    if section.is_restricted and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, 
            detail="You don't have permission to post in this section"
        )
    
    # Create post
    db_post = ForumPost(
        title=post_data.title,
        content=post_data.content,
        user_id=current_user.id,
        section_id=post_data.section_id,
        is_official=(current_user.role == UserRole.ADMIN and (post_data.is_official or section.section_type == "admin_announcements"))
    )
    db.add(db_post)
    db.flush()  # Flush to get the post ID
    
    # Add tags if provided
    if post_data.tag_ids:
        tags = db.query(ForumTag).filter(ForumTag.id.in_(post_data.tag_ids)).all()
        db_post.tags = tags
    
    # Add images if provided
    if files:
        for file in files:
            filepath, filename, file_size, mime_type = await image_service.save_image(file)
            db_image = ForumImage(
                filename=filename,
                filepath=filepath,
                post_id=db_post.id,
                uploaded_by=current_user.id,
                file_size=file_size,
                mime_type=mime_type
            )
            db.add(db_image)
    
    db.commit()
    db.refresh(db_post)
    
    # Return the post in the proper format (ForumPostDetailRead)
    # Use the get_post function to get all needed data
    return get_post(db, db_post.id, current_user)


async def update_post(
    db: Session, 
    post_id: int, 
    post_data: ForumPostUpdate, 
    current_user: User,
    files: Optional[List[UploadFile]] = None
) -> ForumPostDetailRead:
    """Update an existing forum post"""
    # Get post
    db_post = db.query(ForumPost).filter(ForumPost.id == post_id).first()
    if not db_post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check ownership or admin privileges
    if db_post.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="You don't have permission to edit this post")
    
    # Update post data
    for key, value in post_data.dict(exclude_unset=True, exclude={'tag_ids'}).items():
        setattr(db_post, key, value)
    
    # Update tags if provided
    if post_data.tag_ids is not None:
        tags = db.query(ForumTag).filter(ForumTag.id.in_(post_data.tag_ids)).all()
        db_post.tags = tags
    
    # Add new images if provided
    if files:
        for file in files:
            filepath, filename, file_size, mime_type = await image_service.save_image(file)
            db_image = ForumImage(
                filename=filename,
                filepath=filepath,
                post_id=db_post.id,
                uploaded_by=current_user.id,
                file_size=file_size,
                mime_type=mime_type
            )
            db.add(db_image)
    
    db.commit()
    db.refresh(db_post)
    
    # Return the post in the proper format (ForumPostDetailRead)
    return get_post(db, db_post.id, current_user)


async def delete_post(db: Session, post_id: int, current_user: User) -> Dict[str, bool]:
    """Delete a forum post"""
    # Get post
    db_post = db.query(ForumPost).filter(ForumPost.id == post_id).first()
    if not db_post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check ownership or admin privileges
    if db_post.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="You don't have permission to delete this post")
    
    # Delete all images associated with the post
    for image in db_post.images:
        await image_service.delete_image(image.filepath)
    
    # Delete the post (cascade deletes will handle comments, likes, etc.)
    db.delete(db_post)
    db.commit()
    return {"success": True}


def get_post(db: Session, post_id: int, current_user: User) -> ForumPostDetailRead:
    """Get a single forum post with comments"""
    # Get post with relationships
    db_post = db.query(ForumPost).filter(ForumPost.id == post_id).first()
    if not db_post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if user can view restricted section
    if db_post.section.is_restricted and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, 
            detail="You don't have permission to view posts in this section"
        )
    
    # Count likes
    like_count = db.query(func.count(post_likes.c.user_id)).filter(
        post_likes.c.post_id == post_id
    ).scalar()
    
    # Check if current user liked the post
    is_liked = db.query(post_likes).filter(
        post_likes.c.post_id == post_id,
        post_likes.c.user_id == current_user.id
    ).first() is not None
    
    # Get comment count
    comment_count = db.query(func.count(ForumComment.id)).filter(
        ForumComment.post_id == post_id
    ).scalar()
    
    # Get top-level comments
    comments = db.query(ForumComment).filter(
        ForumComment.post_id == post_id,
        ForumComment.parent_id == None
    ).order_by(ForumComment.created_at).all()
    
    # Process comments recursively (including like counts)
    processed_comments = []
    for comment in comments:
        processed_comment = process_comment_with_replies(db, comment, current_user)
        processed_comments.append(processed_comment)
    
    # Convert post to dict
    post_dict = {k: v for k, v in db_post.__dict__.items() if not k.startswith('_')}
    
    # Convert user to dict
    if db_post.user:
        post_dict['user'] = {
            'id': db_post.user.id,
            'username': db_post.user.username,
            'email': db_post.user.email,
            'role': db_post.user.role
        }
    
    # Convert tags to list of dicts
    post_dict['tags'] = [
        {
            'id': tag.id,
            'name': tag.name,
            'description': tag.description
        }
        for tag in db_post.tags
    ]
    
    # Convert images to list of dicts
    post_dict['images'] = [
        {
            'id': image.id,
            'filename': image.filename,
            'filepath': image.filepath,
            'file_size': image.file_size,
            'mime_type': image.mime_type,
            'created_at': image.created_at
        }
        for image in db_post.images
    ]
    
    # Create response with detailed post and comments
    result = ForumPostDetailRead(
        **post_dict,
        comments=processed_comments,
        like_count=like_count,
        is_liked_by_user=is_liked,
        comment_count=comment_count
    )
    
    return result


def process_comment_with_replies(db: Session, comment: ForumComment, current_user: User) -> ForumCommentReadWithReplies:
    """Process a comment and its replies recursively"""
    # Count comment likes
    comment_like_count = db.query(func.count(comment_likes.c.user_id)).filter(
        comment_likes.c.comment_id == comment.id
    ).scalar()
    
    # Check if current user liked the comment
    comment_is_liked = db.query(comment_likes).filter(
        comment_likes.c.comment_id == comment.id,
        comment_likes.c.user_id == current_user.id
    ).first() is not None
    
    # Process replies recursively
    processed_replies = []
    for reply in comment.replies:
        processed_reply = process_comment_with_replies(db, reply, current_user)
        processed_replies.append(processed_reply)
    
    # Convert comment to dict
    comment_dict = {k: v for k, v in comment.__dict__.items() if not k.startswith('_')}
    
    # Convert user to dict
    if comment.user:
        comment_dict['user'] = {
            'id': comment.user.id,
            'username': comment.user.username,
            'email': comment.user.email,
            'role': comment.user.role
        }
    
    # Create response
    return ForumCommentReadWithReplies(
        **comment_dict,
        replies=processed_replies,
        like_count=comment_like_count,
        is_liked_by_user=comment_is_liked
    )


def list_posts(
    db: Session, 
    section_id: Optional[int] = None,
    tag_id: Optional[int] = None,
    search: Optional[str] = None,
    skip: int = 0, 
    limit: int = 20,
    current_user: User = None
) -> Tuple[List[ForumPostRead], int]:
    """List forum posts with filtering and pagination"""
    # Base query
    query = db.query(ForumPost).options(
        joinedload(ForumPost.user),
        joinedload(ForumPost.tags),
        joinedload(ForumPost.images)
    )
    
    # Apply filters
    if section_id:
        # Check if section exists
        section = db.query(ForumSection).filter(ForumSection.id == section_id).first()
        if not section:
            raise HTTPException(status_code=404, detail="Section not found")
        
        # Check if user can access restricted section
        if section.is_restricted and current_user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=403, 
                detail="You don't have permission to view posts in this section"
            )
        
        query = query.filter(ForumPost.section_id == section_id)
    else:
        # For general listing, exclude posts from restricted sections for non-admins
        if current_user.role != UserRole.ADMIN:
            restricted_sections = db.query(ForumSection.id).filter(ForumSection.is_restricted == True)
            query = query.filter(~ForumPost.section_id.in_(restricted_sections))
    
    # Filter by tag
    if tag_id:
        query = query.filter(ForumPost.tags.any(ForumTag.id == tag_id))
    
    # Search in title and content
    if search:
        search_term = f"%{search}%"
        query = query.filter(or_(
            ForumPost.title.ilike(search_term),
            ForumPost.content.ilike(search_term)
        ))
    
    # Get total count
    total_count = query.count()
    
    # Order and paginate
    posts = query.order_by(ForumPost.is_pinned.desc(), ForumPost.created_at.desc()).offset(skip).limit(limit).all()
    
    # Enhance posts with additional data
    result = []
    for post in posts:
        # Count likes and comments
        like_count = db.query(func.count(post_likes.c.user_id)).filter(
            post_likes.c.post_id == post.id
        ).scalar()
        
        comment_count = db.query(func.count(ForumComment.id)).filter(
            ForumComment.post_id == post.id
        ).scalar()
        
        # Check if current user liked the post
        is_liked = db.query(post_likes).filter(
            post_likes.c.post_id == post.id,
            post_likes.c.user_id == current_user.id
        ).first() is not None
        
        # Convert post to dict and handle relationships
        post_dict = {k: v for k, v in post.__dict__.items() if not k.startswith('_')}
        
        # Convert user to dict
        if post.user:
            post_dict['user'] = {
                'id': post.user.id,
                'username': post.user.username,
                'email': post.user.email,
                'role': post.user.role
            }
        
        # Convert tags to list of dicts
        post_dict['tags'] = [
            {
                'id': tag.id,
                'name': tag.name,
                'description': tag.description
            }
            for tag in post.tags
        ]
        
        # Convert images to list of dicts
        post_dict['images'] = [
            {
                'id': image.id,
                'filename': image.filename,
                'filepath': image.filepath,
                'file_size': image.file_size,
                'mime_type': image.mime_type,
                'created_at': image.created_at
            }
            for image in post.images
        ]
        
        # Create enhanced post object
        enhanced_post = ForumPostRead(
            **post_dict,
            like_count=like_count,
            comment_count=comment_count,
            is_liked_by_user=is_liked
        )
        result.append(enhanced_post)
    
    return result, total_count


def toggle_pin_post(db: Session, post_id: int, current_user: User) -> ForumPost:
    """Toggle pin status for a post (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can pin posts")
    
    db_post = db.query(ForumPost).filter(ForumPost.id == post_id).first()
    if not db_post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    db_post.is_pinned = not db_post.is_pinned
    db.commit()
    db.refresh(db_post)
    return db_post


def toggle_post_like(db: Session, post_id: int, current_user: User) -> Dict[str, Any]:
    """Toggle like status for a post"""
    # Check if post exists
    db_post = db.query(ForumPost).filter(ForumPost.id == post_id).first()
    if not db_post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if user can access restricted section
    if db_post.section.is_restricted and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, 
            detail="You don't have permission to interact with posts in this section"
        )
    
    # Check if user already liked the post
    like_exists = db.query(post_likes).filter(
        post_likes.c.post_id == post_id,
        post_likes.c.user_id == current_user.id
    ).first() is not None
    
    # Toggle like status
    if like_exists:
        # Remove like
        db.execute(
            post_likes.delete().where(
                and_(
                    post_likes.c.post_id == post_id,
                    post_likes.c.user_id == current_user.id
                )
            )
        )
        action = "unliked"
    else:
        # Add like
        db.execute(
            post_likes.insert().values(
                post_id=post_id,
                user_id=current_user.id
            )
        )
        action = "liked"
    
    db.commit()
    
    # Get updated like count
    like_count = db.query(func.count(post_likes.c.user_id)).filter(
        post_likes.c.post_id == post_id
    ).scalar()
    
    return {
        "post_id": post_id,
        "action": action,
        "like_count": like_count,
        "is_liked": not like_exists
    }


# Comment services
def create_comment(db: Session, comment_data: ForumCommentCreate, current_user: User) -> ForumComment:
    """Create a new comment on a post or reply to another comment"""
    # Check if post exists
    post = db.query(ForumPost).filter(ForumPost.id == comment_data.post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if user can access restricted section
    if post.section.is_restricted and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, 
            detail="You don't have permission to comment on posts in this section"
        )
    
    # Check if parent comment exists if provided
    if comment_data.parent_id:
        parent_comment = db.query(ForumComment).filter(ForumComment.id == comment_data.parent_id).first()
        if not parent_comment:
            raise HTTPException(status_code=404, detail="Parent comment not found")
        
        # Ensure parent comment belongs to the same post
        if parent_comment.post_id != comment_data.post_id:
            raise HTTPException(
                status_code=400, 
                detail="Parent comment does not belong to the specified post"
            )
    
    # Create comment
    db_comment = ForumComment(
        content=comment_data.content,
        user_id=current_user.id,
        post_id=comment_data.post_id,
        parent_id=comment_data.parent_id
    )
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    return db_comment


def update_comment(db: Session, comment_id: int, comment_data: ForumCommentUpdate, current_user: User) -> ForumComment:
    """Update a comment"""
    # Get comment
    db_comment = db.query(ForumComment).filter(ForumComment.id == comment_id).first()
    if not db_comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Check ownership or admin privileges
    if db_comment.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="You don't have permission to edit this comment")
    
    # Update comment data
    db_comment.content = comment_data.content
    db.commit()
    db.refresh(db_comment)
    return db_comment


def delete_comment(db: Session, comment_id: int, current_user: User) -> Dict[str, bool]:
    """Delete a comment"""
    # Get comment
    db_comment = db.query(ForumComment).filter(ForumComment.id == comment_id).first()
    if not db_comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Check ownership or admin privileges
    if db_comment.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="You don't have permission to delete this comment")
    
    # Delete the comment
    db.delete(db_comment)
    db.commit()
    return {"success": True}


def toggle_comment_like(db: Session, comment_id: int, current_user: User) -> Dict[str, Any]:
    """Toggle like status for a comment"""
    # Check if comment exists
    db_comment = db.query(ForumComment).filter(ForumComment.id == comment_id).first()
    if not db_comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Check if user can access restricted section of the post
    post = db.query(ForumPost).filter(ForumPost.id == db_comment.post_id).first()
    if post.section.is_restricted and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, 
            detail="You don't have permission to interact with comments in this section"
        )
    
    # Check if user already liked the comment
    like_exists = db.query(comment_likes).filter(
        comment_likes.c.comment_id == comment_id,
        comment_likes.c.user_id == current_user.id
    ).first() is not None
    
    # Toggle like status
    if like_exists:
        # Remove like
        db.execute(
            comment_likes.delete().where(
                and_(
                    comment_likes.c.comment_id == comment_id,
                    comment_likes.c.user_id == current_user.id
                )
            )
        )
        action = "unliked"
    else:
        # Add like
        db.execute(
            comment_likes.insert().values(
                comment_id=comment_id,
                user_id=current_user.id
            )
        )
        action = "liked"
    
    db.commit()
    
    # Get updated like count
    like_count = db.query(func.count(comment_likes.c.user_id)).filter(
        comment_likes.c.comment_id == comment_id
    ).scalar()
    
    return {
        "comment_id": comment_id,
        "action": action,
        "like_count": like_count,
        "is_liked": not like_exists
    }


# Report services
def create_report(db: Session, report_data: ForumReportCreate, current_user: User) -> ForumReport:
    """Create a new report for a post or comment"""
    # Check if post or comment exists based on what's being reported
    if report_data.post_id:
        post = db.query(ForumPost).filter(ForumPost.id == report_data.post_id).first()
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
    elif report_data.comment_id:
        comment = db.query(ForumComment).filter(ForumComment.id == report_data.comment_id).first()
        if not comment:
            raise HTTPException(status_code=404, detail="Comment not found")
    else:
        raise HTTPException(status_code=400, detail="Either post_id or comment_id must be provided")
    
    # Create report
    db_report = ForumReport(
        reason=report_data.reason,
        details=report_data.details,
        user_id=current_user.id,
        post_id=report_data.post_id,
        comment_id=report_data.comment_id,
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report


def resolve_report(db: Session, report_id: int, report_data: ForumReportUpdate, current_user: User) -> ForumReport:
    """Resolve a report (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can resolve reports")
    
    # Get report
    db_report = db.query(ForumReport).filter(ForumReport.id == report_id).first()
    if not db_report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Update report
    db_report.is_resolved = report_data.is_resolved
    db_report.resolved_by = current_user.id
    db_report.resolved_at = datetime.now()
    
    db.commit()
    db.refresh(db_report)
    return db_report


def list_reports(db: Session, current_user: User, resolved: Optional[bool] = None) -> List[ForumReportRead]:
    """List reports (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can view reports")
    
    # Base query
    query = db.query(ForumReport)
    
    # Filter by resolved status if provided
    if resolved is not None:
        query = query.filter(ForumReport.is_resolved == resolved)
    
    # Order by created date, unresolved first
    reports = query.order_by(ForumReport.is_resolved, ForumReport.created_at.desc()).all()
    return reports 