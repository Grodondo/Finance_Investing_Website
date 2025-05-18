import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useForum } from '../../contexts/ForumContext';
import type { ForumPost, ForumComment } from '../../contexts/ForumContext';
import { useAuth } from '../../contexts/AuthContext';
import { 
  ChatBubbleLeftRightIcon, 
  ChevronLeftIcon,
  HeartIcon,
  TagIcon,
  ClockIcon,
  UserCircleIcon,
  PencilIcon,
  TrashIcon,
  FlagIcon,
  EllipsisVerticalIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import PageTitle from '../../components/PageTitle';
import Loader from '../../components/Loader';

// Simple comment component
const CommentItem: React.FC<{
  comment: ForumComment;
  postId: number;
  onReply: (commentId: number) => void;
  onEdit: (comment: ForumComment) => void;
  onDelete: (commentId: number) => void;
  onReport: (commentId: number) => void;
  onLike: (commentId: number) => void;
  currentUserId: number;
  isAdmin: boolean;
  level?: number;
}> = ({ 
  comment, 
  postId, 
  onReply, 
  onEdit, 
  onDelete, 
  onReport, 
  onLike,
  currentUserId,
  isAdmin,
  level = 0 
}) => {
  const [showMenu, setShowMenu] = useState(false);
  
  // Format date for comment
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const canModify = comment.user_id === currentUserId || isAdmin;
  
  return (
    <div className={`border-l-2 ${level > 0 ? 'border-indigo-100 dark:border-indigo-900' : 'border-transparent'} pl-4 mb-4`}>
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
        <div className="flex justify-between">
          <div className="flex items-center text-sm mb-2">
            <UserCircleIcon className="h-5 w-5 mr-1 text-gray-700 dark:text-gray-300" />
            <span className="font-medium text-gray-900 dark:text-white mr-2">
              {comment.user.username}
            </span>
            <span className="text-gray-500 dark:text-gray-400 text-xs">
              {formatDate(comment.created_at)}
            </span>
          </div>
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <EllipsisVerticalIcon className="h-5 w-5" />
            </button>
            
            {showMenu && (
              <div className="absolute right-0 mt-1 w-48 rounded-md shadow-lg bg-white dark:bg-gray-700 ring-1 ring-black ring-opacity-5 z-10">
                <div className="py-1" role="menu" aria-orientation="vertical">
                  <button
                    onClick={() => {
                      onReply(comment.id);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                    role="menuitem"
                  >
                    Reply
                  </button>
                  
                  {canModify && (
                    <>
                      <button
                        onClick={() => {
                          onEdit(comment);
                          setShowMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                        role="menuitem"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          onDelete(comment.id);
                          setShowMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                        role="menuitem"
                      >
                        Delete
                      </button>
                    </>
                  )}
                  
                  {!canModify && (
                    <button
                      onClick={() => {
                        onReport(comment.id);
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                      role="menuitem"
                    >
                      Report
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="prose prose-sm dark:prose-invert max-w-none mb-3">
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
            {comment.content}
          </p>
        </div>
        
        <div className="flex justify-between items-center">
          <button
            onClick={() => onLike(comment.id)}
            className={`flex items-center text-sm ${
              comment.is_liked_by_user
                ? 'text-red-500 dark:text-red-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400'
            }`}
          >
            {comment.is_liked_by_user ? (
              <HeartIconSolid className="h-4 w-4 mr-1" />
            ) : (
              <HeartIcon className="h-4 w-4 mr-1" />
            )}
            <span>{comment.like_count}</span>
          </button>
          
          <button
            onClick={() => onReply(comment.id)}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
          >
            Reply
          </button>
        </div>
      </div>
      
      {/* Render replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 ml-4">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              postId={postId}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onReport={onReport}
              onLike={onLike}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ForumPost: React.FC = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    loadPost,
    toggleLikePost,
    createComment,
    updateComment,
    deleteComment,
    toggleLikeComment,
    reportContent,
    deletePost,
    loading,
    error,
    isAdmin
  } = useForum();
  
  const [post, setPost] = useState<ForumPost | null>(null);
  const [commentText, setCommentText] = useState('');
  const [replyToId, setReplyToId] = useState<number | null>(null);
  const [editingComment, setEditingComment] = useState<ForumComment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportTarget, setReportTarget] = useState<{ type: 'post' | 'comment', id: number } | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load post data
  useEffect(() => {
    const fetchPost = async () => {
      try {
        if (postId) {
          const data = await loadPost(Number(postId));
          setPost(data);
        }
      } catch (error) {
        console.error('Error loading post:', error);
      }
    };

    fetchPost();
  }, [postId, loadPost]);

  // Handle like toggle
  const handleLikePost = async () => {
    if (!post) return;
    
    try {
      const result = await toggleLikePost(post.id);
      setPost(prev => prev ? { ...prev, like_count: result.like_count, is_liked_by_user: result.is_liked } : null);
    } catch (error) {
      console.error('Error toggling post like:', error);
    }
  };

  // Handle comment submission
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!post || !commentText.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      if (editingComment) {
        // Update existing comment
        await updateComment(editingComment.id, commentText);
        // Reload post to get updated comments
        const updatedPost = await loadPost(post.id);
        setPost(updatedPost);
        setEditingComment(null);
      } else {
        // Create new comment
        await createComment(post.id, commentText, replyToId || undefined);
        // Reload post to get updated comments
        const updatedPost = await loadPost(post.id);
        setPost(updatedPost);
        setReplyToId(null);
      }
      setCommentText('');
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle comment like toggle
  const handleLikeComment = async (commentId: number) => {
    try {
      await toggleLikeComment(commentId);
      // Reload post to get updated comments
      if (post) {
        const updatedPost = await loadPost(post.id);
        setPost(updatedPost);
      }
    } catch (error) {
      console.error('Error toggling comment like:', error);
    }
  };

  // Handle comment deletion
  const handleDeleteComment = async (commentId: number) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    
    try {
      await deleteComment(commentId);
      // Reload post to get updated comments
      if (post) {
        const updatedPost = await loadPost(post.id);
        setPost(updatedPost);
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  // Handle reply to comment
  const handleReplyToComment = (commentId: number) => {
    setReplyToId(commentId);
    setEditingComment(null);
    setCommentText('');
    // Scroll to comment form
    document.getElementById('comment-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle edit comment
  const handleEditComment = (comment: ForumComment) => {
    setEditingComment(comment);
    setReplyToId(null);
    setCommentText(comment.content);
    // Scroll to comment form
    document.getElementById('comment-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle reporting content
  const handleOpenReportModal = (type: 'post' | 'comment', id: number) => {
    setReportTarget({ type, id });
    setReportReason('');
    setReportDetails('');
    setShowReportModal(true);
  };

  // Submit report
  const handleSubmitReport = async () => {
    if (!reportTarget || !reportReason) return;
    
    try {
      if (reportTarget.type === 'post') {
        await reportContent(reportReason, reportDetails, reportTarget.id);
      } else {
        await reportContent(reportReason, reportDetails, undefined, reportTarget.id);
      }
      setShowReportModal(false);
      alert('Thank you for your report. Our moderators will review it shortly.');
    } catch (error) {
      console.error('Error submitting report:', error);
    }
  };

  // Handle post deletion
  const handleDeletePost = async () => {
    if (!post) return;
    
    try {
      await deletePost(post.id);
      setShowDeleteConfirm(false);
      navigate(`/forum/section/${post.section_id}`);
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Fix the user ID comparison
  const canEditPost = () => {
    if (!user || !post) return false;
    return post.user_id === Number(user.id) || isAdmin;
  };

  if (loading && !post) {
    return <Loader />;
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg p-4 text-red-700 dark:text-red-400">
          <p>Error loading post: {error}</p>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-4 text-yellow-700 dark:text-yellow-400">
          <p>Post not found or you don't have access to this post.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/forum/section/${post.section_id}`)}
          className="mb-4 inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon className="h-4 w-4 mr-1" />
          Back to Section
        </button>
      </div>

      {/* Post details */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden mb-8">
        <div className="p-6">
          <div className="flex justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{post.title}</h1>
            
            <div className="flex items-center space-x-2">
              {canEditPost() && (
                <>
                  <Link 
                    to={`/forum/edit/${post.id}`}
                    className="text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                    title="Edit post"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </Link>
                  
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    title="Delete post"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </>
              )}
              
              {!canEditPost() && (
                <button
                  onClick={() => handleOpenReportModal('post', post.id)}
                  className="text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400"
                  title="Report post"
                >
                  <FlagIcon className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
          
          <div className="flex items-center mb-6">
            <UserCircleIcon className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-white mr-2">
              {post.user.username}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Posted on {formatDate(post.created_at)}
            </span>
          </div>
          
          <div className="prose prose-indigo max-w-none dark:prose-invert mb-6">
            <div className="text-gray-800 dark:text-gray-200 whitespace-pre-line">
              {post.content}
            </div>
          </div>
          
          {post.images && post.images.length > 0 && (
            <div className="mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {post.images.map((image) => (
                  <div key={image.id} className="relative">
                    <img 
                      src={`/uploads/forum/${image.filename}`} 
                      alt="Post attachment" 
                      className="rounded-lg w-full h-auto object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex flex-wrap gap-2 mb-4">
            {post.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"
              >
                <TagIcon className="h-3 w-3 mr-1" />
                {tag.name}
              </span>
            ))}
          </div>
          
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleLikePost}
                className={`flex items-center space-x-1 ${
                  post.is_liked_by_user
                    ? 'text-red-500 dark:text-red-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400'
                }`}
              >
                {post.is_liked_by_user ? (
                  <HeartIconSolid className="h-5 w-5" />
                ) : (
                  <HeartIcon className="h-5 w-5" />
                )}
                <span>{post.like_count}</span>
              </button>
              
              <div className="flex items-center space-x-1 text-gray-500 dark:text-gray-400">
                <ChatBubbleLeftRightIcon className="h-5 w-5" />
                <span>{post.comment_count}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Comments section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Comments ({post.comment_count})
        </h2>
        
        {post.comments.length > 0 ? (
          <div className="space-y-4">
            {post.comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                postId={post.id}
                onReply={handleReplyToComment}
                onEdit={handleEditComment}
                onDelete={handleDeleteComment}
                onReport={(commentId) => handleOpenReportModal('comment', commentId)}
                onLike={handleLikeComment}
                currentUserId={user ? Number(user.id) : 0}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6 text-center">
            <p className="text-gray-500 dark:text-gray-400">No comments yet. Be the first to comment!</p>
          </div>
        )}
      </div>

      {/* Comment form */}
      <div id="comment-form" className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          {editingComment ? 'Edit comment' : replyToId ? 'Reply to comment' : 'Add a comment'}
        </h3>
        
        {replyToId && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md flex justify-between items-center">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Replying to comment
            </span>
            <button
              onClick={() => setReplyToId(null)}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Cancel reply
            </button>
          </div>
        )}
        
        {editingComment && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md flex justify-between items-center">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Editing comment
            </span>
            <button
              onClick={() => {
                setEditingComment(null);
                setCommentText('');
              }}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Cancel edit
            </button>
          </div>
        )}
        
        <form onSubmit={handleSubmitComment}>
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Write your comment..."
            rows={4}
            className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm mb-4"
            required
          />
          
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !commentText.trim()}
              className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                isSubmitting || !commentText.trim() ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? 'Submitting...' : editingComment ? 'Update Comment' : 'Post Comment'}
            </button>
          </div>
        </form>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Confirm Deletion</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Are you sure you want to delete this post? This action cannot be undone and all comments will be permanently deleted.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePost}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report modal */}
      {showReportModal && (
        <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Report Content</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reason for reporting
              </label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                required
              >
                <option value="">Select a reason</option>
                <option value="spam">Spam</option>
                <option value="offensive">Offensive content</option>
                <option value="irrelevant">Irrelevant content</option>
                <option value="duplicate">Duplicate content</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Additional details (optional)
              </label>
              <textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                rows={3}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowReportModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReport}
                disabled={!reportReason}
                className={`px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 ${
                  !reportReason ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ForumPost; 