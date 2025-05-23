from typing import List, Optional, Any, Literal, Union
from pydantic import BaseModel, Field, validator, constr, conint, EmailStr, HttpUrl
from datetime import datetime
from .user import UserBase
from ..models.forum import ForumSectionType, ForumReportReason

# Base schemas
class ForumTagBase(BaseModel):
    name: constr(min_length=1, max_length=50)


class ForumTagCreate(ForumTagBase):
    pass


class ForumTagUpdate(ForumTagBase):
    name: Optional[constr(min_length=1, max_length=50)] = None


class ForumTagRead(ForumTagBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


class ForumSectionBase(BaseModel):
    name: str
    description: Optional[str] = None
    section_type: Literal['general_discussion', 'investment_tips', 'budgeting_advice', 'admin_announcements']
    is_restricted: bool = False


class ForumSectionCreate(ForumSectionBase):
    pass


class ForumSectionUpdate(ForumSectionBase):
    name: Optional[str] = None
    description: Optional[str] = None
    section_type: Optional[Literal['general_discussion', 'investment_tips', 'budgeting_advice', 'admin_announcements']] = None
    is_restricted: Optional[bool] = None


class ForumSectionRead(ForumSectionBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True


class ForumImageBase(BaseModel):
    filename: str
    filepath: str
    file_size: int
    mime_type: str


class ForumImageCreate(ForumImageBase):
    pass


class ForumImageRead(ForumImageBase):
    id: int
    created_at: datetime
    
    class Config:
        orm_mode = True


class ForumPostBase(BaseModel):
    title: constr(min_length=1, max_length=255)
    content: str
    is_pinned: bool = False
    is_locked: bool = False


class ForumPostCreate(ForumPostBase):
    section_id: int
    tag_ids: Optional[List[int]] = []
    is_official: Optional[bool] = False


class ForumPostUpdate(BaseModel):
    title: Optional[constr(min_length=1, max_length=255)] = None
    content: Optional[str] = None
    section_id: Optional[int] = None
    tag_ids: Optional[List[int]] = None
    is_pinned: Optional[bool] = None
    is_locked: Optional[bool] = None


class ForumCommentBase(BaseModel):
    content: str


class ForumCommentCreate(ForumCommentBase):
    post_id: int
    parent_id: Optional[int] = None


class ForumCommentUpdate(ForumCommentBase):
    pass


class ForumReportBase(BaseModel):
    reason: ForumReportReason
    details: Optional[str] = None


class ForumReportCreate(ForumReportBase):
    post_id: Optional[int] = None
    comment_id: Optional[int] = None
    
    @validator('post_id', 'comment_id')
    def validate_report_target(cls, v, values, **kwargs):
        post_id = values.get('post_id')
        comment_id = values.get('comment_id')
        
        if post_id is None and comment_id is None:
            raise ValueError('Either post_id or comment_id must be provided')
        if post_id is not None and comment_id is not None:
            raise ValueError('Only one of post_id or comment_id should be provided')
        
        return v


class ForumReportUpdate(BaseModel):
    is_resolved: bool = True


# Read schemas with relationships
class ForumCommentRead(ForumCommentBase):
    id: int
    user_id: int
    post_id: int
    parent_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    user: UserBase
    like_count: int = 0
    is_liked_by_user: bool = False

    class Config:
        orm_mode = True


class ForumCommentReadWithReplies(ForumCommentRead):
    replies: List['ForumCommentReadWithReplies'] = []

    class Config:
        orm_mode = True


class ForumPostRead(ForumPostBase):
    id: int
    user_id: int
    section_id: int
    is_pinned: bool
    is_official: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    user: UserBase
    tags: List[ForumTagRead] = []
    images: List[ForumImageRead] = []
    comment_count: int = 0
    like_count: int = 0
    is_liked_by_user: bool = False

    class Config:
        orm_mode = True


class ForumPostDetailRead(ForumPostRead):
    comments: List[ForumCommentReadWithReplies] = []
    section: ForumSectionRead

    class Config:
        orm_mode = True


class ForumReportRead(ForumReportBase):
    id: int
    user_id: int
    post_id: Optional[int] = None
    comment_id: Optional[int] = None
    is_resolved: bool
    resolved_by: Optional[int] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None
    user: UserBase
    resolver: Optional[UserBase] = None

    class Config:
        orm_mode = True


# Custom response schemas
class ForumSectionWithStats(ForumSectionRead):
    post_count: int = 0
    latest_post: Optional[ForumPostRead] = None

    class Config:
        orm_mode = True


# Circular reference fix
ForumCommentReadWithReplies.update_forward_refs() 