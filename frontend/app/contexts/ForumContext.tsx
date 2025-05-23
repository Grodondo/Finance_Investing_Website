import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';

// Types for forum data
export type ForumSection = {
  id: number;
  name: string;
  description: string | null;
  section_type: 'general_discussion' | 'investment_tips' | 'budgeting_advice' | 'admin_announcements';
  is_restricted: boolean;
  created_at: string;
  updated_at: string | null;
  post_count: number;
  latest_post: ForumPost | null;
};

export type ForumTag = {
  id: number;
  name: string;
  created_at: string;
};

export type ForumImage = {
  id: number;
  filename: string;
  filepath: string;
  file_size: number;
  mime_type: string;
  created_at: string;
};

export type ForumUser = {
  id: number;
  username: string;
  email: string;
};

export type ForumPost = {
  id: number;
  title: string;
  content: string;
  user_id: number;
  section_id: number;
  is_pinned: boolean;
  is_official: boolean;
  created_at: string;
  updated_at: string | null;
  user: ForumUser;
  tags: ForumTag[];
  images: ForumImage[];
  comment_count: number;
  like_count: number;
  is_liked_by_user: boolean;
  comments: ForumComment[];
};

export type ForumComment = {
  id: number;
  content: string;
  user_id: number;
  post_id: number;
  parent_id: number | null;
  created_at: string;
  updated_at: string | null;
  user: ForumUser;
  like_count: number;
  is_liked_by_user: boolean;
  replies: ForumComment[];
};

export type ForumReport = {
  id: number;
  reason: 'spam' | 'offensive' | 'irrelevant' | 'duplicate' | 'other';
  details: string | null;
  user_id: number;
  post_id: number | null;
  comment_id: number | null;
  is_resolved: boolean;
  resolved_by: number | null;
  created_at: string;
  resolved_at: string | null;
  user: ForumUser;
  resolver: ForumUser | null;
};

// Interfaces for API responses
export interface ForumPostsResponse {
  items: ForumPost[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// Context type
interface ForumContextType {
  sections: ForumSection[];
  tags: ForumTag[];
  isAdmin: boolean;
  loadSections: () => Promise<void>;
  loadTags: () => Promise<ForumTag[]>;
  loadPosts: (sectionId?: number, tagId?: number, search?: string, page?: number) => Promise<ForumPostsResponse>;
  loadPost: (postId: number) => Promise<ForumPost>;
  createPost: (formData: FormData) => Promise<ForumPost>;
  updatePost: (postId: number, formData: FormData) => Promise<ForumPost>;
  deletePost: (postId: number) => Promise<void>;
  toggleLikePost: (postId: number) => Promise<{ like_count: number, is_liked: boolean }>;
  togglePinPost: (postId: number) => Promise<void>;
  createComment: (postId: number, content: string, parentId?: number) => Promise<ForumComment>;
  updateComment: (commentId: number, content: string) => Promise<ForumComment>;
  deleteComment: (commentId: number) => Promise<void>;
  toggleLikeComment: (commentId: number) => Promise<{ like_count: number, is_liked: boolean }>;
  reportContent: (reason: string, details: string, postId?: number, commentId?: number) => Promise<void>;
  loadReports: (resolved?: boolean) => Promise<ForumReport[]>;
  resolveReport: (reportId: number) => Promise<void>;
  loading: boolean;
  error: string | null;
}

const ForumContext = createContext<ForumContextType | undefined>(undefined);

export const ForumProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const { getAuthHeader, user } = useAuth();
  const [sections, setSections] = useState<ForumSection[]>([]);
  const [tags, setTags] = useState<ForumTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user is admin
  const isAdmin = user?.role === 'admin';

  const handleApiError = useCallback((error: any, defaultMessage: string = 'An error occurred') => {
    console.error("ForumContext API Error:", error.message, error.response?.data, error.stack);
    const message = error?.response?.data?.detail || error?.message || defaultMessage;
    setError(message);
  }, [setError]);

  const loadSections = useCallback(async (): Promise<void> => {
    console.log('[ForumContext] Attempting to load sections...');
    setLoading(true);
    setError(null);
    try {
      const headers = getAuthHeader();
      if (!headers) {
        const authError = new Error('User not authenticated. Please log in.');
        handleApiError(authError, 'User not authenticated.');
        throw authError;
      }
      const response = await fetch('/api/forum/sections', { headers: { ...headers, 'Content-Type': 'application/json' } });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: `Server error: ${response.status}` }));
        const apiError = new Error(errorData.detail || `Failed to load sections: ${response.statusText || response.status}`);
        handleApiError(apiError, apiError.message);
        throw apiError;
      }
      const data = await response.json();
      setSections(data);
    } catch (error: any) {
      if (!error.message.includes("User not authenticated") && !error.message.includes("Failed to load sections")) {
          handleApiError(error, 'An unexpected error occurred while loading sections.');
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader, handleApiError]);

  const loadTags = useCallback(async (): Promise<ForumTag[]> => {
    console.log('[ForumContext] Attempting to load tags...');
    setLoading(true);
    setError(null);
    try {
      const headers = getAuthHeader();
      if (!headers) { 
        const authError = new Error('User not authenticated.'); 
        handleApiError(authError, 'User not authenticated.'); 
        throw authError; 
      }
      const response = await fetch('/api/forum/tags', { headers: { ...headers, 'Content-Type': 'application/json' } });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: `Server error: ${response.status}` }));
        const apiError = new Error(errorData.detail || `Failed to load tags: ${response.statusText || response.status}`);
        handleApiError(apiError, apiError.message);
        throw apiError;
      }
      const data = await response.json();
      setTags(data);
      return data;
    } catch (error: any) {
      if (!error.message.includes("Failed to load tags") && !error.message.includes("User not authenticated")) {
          handleApiError(error, 'An unexpected error occurred while loading tags.');
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader, handleApiError]);

  const loadPosts = useCallback(async (sectionId?: number, tagId?: number, search?: string, page: number = 1): Promise<ForumPostsResponse> => {
    console.log(`[ForumContext] Attempting to load posts (page ${page})...`, { sectionId, tagId, search });
    setLoading(true);
    setError(null);
    try {
      const headers = getAuthHeader();
      if (!headers) { 
        const authError = new Error('User not authenticated.'); 
        handleApiError(authError, 'User not authenticated.'); 
        throw authError; 
      }
      let url = `/api/forum/posts?page=${page}`;
      if (sectionId) url += `&section_id=${sectionId}`;
      if (tagId) url += `&tag_id=${tagId}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      const response = await fetch(url, { headers: { ...headers, 'Content-Type': 'application/json' } });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: `Server error: ${response.status}` }));
        const apiError = new Error(errorData.detail || `Failed to load posts: ${response.statusText || response.status}`);
        handleApiError(apiError, apiError.message);
        throw apiError;
      }
      const data = await response.json();
      return data as ForumPostsResponse;
    } catch (error: any) {
       if (!error.message.includes("Failed to load posts") && !error.message.includes("User not authenticated")) {
          handleApiError(error, 'An unexpected error occurred while loading posts.');
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader, handleApiError]);

  // Load a single post with details
  const loadPost = useCallback(async (postId: number): Promise<ForumPost> => {
    console.log(`[ForumContext] Attempting to load post ${postId}...`);
    setLoading(true);
    setError(null);
    try {
      const headers = getAuthHeader();
      if (!headers) { 
        const authError = new Error('User not authenticated.'); 
        handleApiError(authError, 'User not authenticated.'); 
        throw authError; 
      }
      const response = await fetch(`/api/forum/posts/${postId}`, { headers: { ...headers, 'Content-Type': 'application/json' } });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: `Server error: ${response.status}` }));
        const apiError = new Error(errorData.detail || `Failed to load post ${postId}: ${response.statusText || response.status}`);
        handleApiError(apiError, apiError.message);
        throw apiError;
      }
      const data = await response.json();
      return data as ForumPost;
    } catch (error: any) {
      if (!error.message.includes("Failed to load post") && !error.message.includes("User not authenticated")) {
          handleApiError(error, `An unexpected error occurred while loading post ${postId}.`);
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader, handleApiError]);

  // Create a new post using FormData (for file uploads)
  const createPost = useCallback(async (formData: FormData): Promise<ForumPost> => {
    console.log('[ForumContext] Attempting to create post...');
    setLoading(true);
    setError(null);
    try {
      const authHeader = getAuthHeader(); 
      if (!authHeader?.Authorization) { 
        const authError = new Error('User not authenticated.'); 
        handleApiError(authError, 'User not authenticated.'); 
        throw authError; 
      }
      // Pass only the Authorization header, browser will set Content-Type for FormData
      const response = await fetch('/api/forum/posts', { 
        method: 'POST', 
        headers: { 'Authorization': authHeader.Authorization }, 
        body: formData 
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: `Server error: ${response.status}` }));
        const apiError = new Error(errorData.detail || `Failed to create post: ${response.statusText || response.status}`);
        handleApiError(apiError, apiError.message);
        throw apiError;
      }
      const data = await response.json();
      return data as ForumPost;
    } catch (error: any) {
      if (!error.message.includes("Failed to create post") && !error.message.includes("User not authenticated")) {
          handleApiError(error, 'An unexpected error occurred while creating the post.');
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader, handleApiError, setLoading, setError]);

  // Update an existing post
  const updatePost = useCallback(async (postId: number, formData: FormData): Promise<ForumPost> => {
    setLoading(true); setError(null);
    try {
      const authHeader = getAuthHeader();
      if (!authHeader?.Authorization) { const err = new Error('User not authenticated'); handleApiError(err); throw err; }
      // Pass only the Authorization header, browser will set Content-Type for FormData
      const response = await fetch(`/api/forum/posts/${postId}`, { 
        method: 'PUT', 
        headers: { 'Authorization': authHeader.Authorization }, 
        body: formData 
      });
      if (!response.ok) { 
        const errorData = await response.json().catch(() => ({ detail: `Server error: ${response.status}` }));
        const err = new Error(errorData.detail || `Update post failed: ${response.status}`); 
        handleApiError(err, err.message); 
        throw err; 
      }
      return await response.json() as ForumPost;
    } catch (e: any) { 
      if (!e.message.includes("Update post failed") && !e.message.includes("User not authenticated")) handleApiError(e, 'Update post error'); 
      throw e; 
    } finally { setLoading(false); }
  }, [getAuthHeader, handleApiError]);

  // Delete a post
  const deletePost = useCallback(async (postId: number): Promise<void> => {
    setLoading(true); setError(null);
    try {
      const headers = getAuthHeader();
      if (!headers) { const err = new Error('User not authenticated'); handleApiError(err); throw err; }
      const response = await fetch(`/api/forum/posts/${postId}`, { method: 'DELETE', headers });
      if (!response.ok) { 
        const errorData = await response.json().catch(() => ({ detail: `Server error: ${response.status}` }));
        const err = new Error(errorData.detail || `Delete post failed: ${response.status}`); 
        handleApiError(err, err.message); 
        throw err; 
      }
    } catch (e: any) { 
      if (!e.message.includes("Delete post failed") && !e.message.includes("User not authenticated")) handleApiError(e, 'Delete post error'); 
      throw e; 
    } finally { setLoading(false); }
  }, [getAuthHeader, handleApiError]);

  // Toggle like on a post
  const toggleLikePost = useCallback(async (postId: number): Promise<{ like_count: number, is_liked: boolean }> => {
    setLoading(true); setError(null);
    try {
      const headers = getAuthHeader();
      if (!headers) { const err = new Error('User not authenticated'); handleApiError(err); throw err; }
      const response = await fetch(`/api/forum/posts/${postId}/like`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' } });
      if (!response.ok) { 
        const errorData = await response.json().catch(() => ({ detail: `Server error: ${response.status}` }));
        const err = new Error(errorData.detail || `Toggle like failed: ${response.status}`); 
        handleApiError(err, err.message); 
        throw err; 
      }
      return await response.json();
    } catch (e: any) { 
      if (!e.message.includes("Toggle like failed") && !e.message.includes("User not authenticated")) handleApiError(e, 'Toggle like error'); 
      throw e; 
    } finally { setLoading(false); }
  }, [getAuthHeader, handleApiError]);

  // Toggle pin status on a post (admin only)
  const togglePinPost = useCallback(async (postId: number): Promise<void> => {
    setLoading(true); setError(null);
    try {
      const headers = getAuthHeader();
      if (!headers) { const err = new Error('User not authenticated'); handleApiError(err); throw err; }
      const response = await fetch(`/api/forum/posts/${postId}/pin`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' } });
      if (!response.ok) { 
        const errorData = await response.json().catch(() => ({ detail: `Server error: ${response.status}` }));
        const err = new Error(errorData.detail || `Toggle pin failed: ${response.status}`); 
        handleApiError(err, err.message); 
        throw err; 
      }
    } catch (e: any) { 
      if (!e.message.includes("Toggle pin failed") && !e.message.includes("User not authenticated")) handleApiError(e, 'Toggle pin error'); 
      throw e; 
    } finally { setLoading(false); }
  }, [getAuthHeader, handleApiError]);

  // Create a new comment
  const createComment = useCallback(async (postId: number, content: string, parentId?: number): Promise<ForumComment> => {
    setLoading(true); setError(null);
    try {
      const headers = getAuthHeader();
      if (!headers) { const err = new Error('User not authenticated'); handleApiError(err); throw err; }
      const response = await fetch('/api/forum/comments', { 
        method: 'POST', 
        headers: { ...headers, 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ post_id: postId, content, parent_id: parentId }) 
      });
      if (!response.ok) { 
        const errorData = await response.json().catch(() => ({ detail: `Server error: ${response.status}` }));
        const err = new Error(errorData.detail || `Create comment failed: ${response.status}`); 
        handleApiError(err, err.message); 
        throw err; 
      }
      return await response.json();
    } catch (e: any) { 
      if (!e.message.includes("Create comment failed") && !e.message.includes("User not authenticated")) handleApiError(e, 'Create comment error'); 
      throw e; 
    } finally { setLoading(false); }
  }, [getAuthHeader, handleApiError]);

  // Update an existing comment
  const updateComment = useCallback(async (commentId: number, content: string): Promise<ForumComment> => {
    setLoading(true); setError(null);
    try {
      const headers = getAuthHeader();
      if (!headers) { const err = new Error('User not authenticated'); handleApiError(err); throw err; }
      const response = await fetch(`/api/forum/comments/${commentId}`, { 
        method: 'PUT', 
        headers: { ...headers, 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ content }) 
      });
      if (!response.ok) { 
        const errorData = await response.json().catch(() => ({ detail: `Server error: ${response.status}` }));
        const err = new Error(errorData.detail || `Update comment failed: ${response.status}`); 
        handleApiError(err, err.message); 
        throw err; 
      }
      return await response.json();
    } catch (e: any) { 
      if (!e.message.includes("Update comment failed") && !e.message.includes("User not authenticated")) handleApiError(e, 'Update comment error'); 
      throw e; 
    } finally { setLoading(false); }
  }, [getAuthHeader, handleApiError]);

  // Delete a comment
  const deleteComment = useCallback(async (commentId: number): Promise<void> => {
    setLoading(true); setError(null);
    try {
      const headers = getAuthHeader();
      if (!headers) { const err = new Error('User not authenticated'); handleApiError(err); throw err; }
      const response = await fetch(`/api/forum/comments/${commentId}`, { method: 'DELETE', headers });
      if (!response.ok) { 
        const errorData = await response.json().catch(() => ({ detail: `Server error: ${response.status}` }));
        const err = new Error(errorData.detail || `Delete comment failed: ${response.status}`); 
        handleApiError(err, err.message); 
        throw err; 
      }
    } catch (e: any) { 
      if (!e.message.includes("Delete comment failed") && !e.message.includes("User not authenticated")) handleApiError(e, 'Delete comment error'); 
      throw e; 
    } finally { setLoading(false); }
  }, [getAuthHeader, handleApiError]);

  // Toggle like on a comment
  const toggleLikeComment = useCallback(async (commentId: number): Promise<{ like_count: number, is_liked: boolean }> => {
    setLoading(true); setError(null);
    try {
      const headers = getAuthHeader();
      if (!headers) { const err = new Error('User not authenticated'); handleApiError(err); throw err; }
      const response = await fetch(`/api/forum/comments/${commentId}/like`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' } });
      if (!response.ok) { 
        const errorData = await response.json().catch(() => ({ detail: `Server error: ${response.status}` }));
        const err = new Error(errorData.detail || `Like comment failed: ${response.status}`); 
        handleApiError(err, err.message); 
        throw err; 
      }
      return await response.json();
    } catch (e: any) { 
      if (!e.message.includes("Like comment failed") && !e.message.includes("User not authenticated")) handleApiError(e, 'Like comment error'); 
      throw e; 
    } finally { setLoading(false); }
  }, [getAuthHeader, handleApiError]);

  // Report a post or comment
  const reportContent = useCallback(async (
    reason: string, 
    details: string, 
    postId?: number, 
    commentId?: number
  ): Promise<void> => {
    setLoading(true); setError(null);
    try {
      const headers = getAuthHeader();
      if (!headers) { const err = new Error('User not authenticated'); handleApiError(err); throw err; }
      const response = await fetch('/api/forum/reports', { 
        method: 'POST', 
        headers: { ...headers, 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ reason, details, post_id: postId, comment_id: commentId }) 
      });
      if (!response.ok) { 
        const errorData = await response.json().catch(() => ({ detail: `Server error: ${response.status}` }));
        const err = new Error(errorData.detail || `Report content failed: ${response.status}`); 
        handleApiError(err, err.message); 
        throw err; 
      }
    } catch (e: any) { 
      if (!e.message.includes("Report content failed") && !e.message.includes("User not authenticated")) handleApiError(e, 'Report content error'); 
      throw e; 
    } finally { setLoading(false); }
  }, [getAuthHeader, handleApiError]);

  // Load reports (admin only)
  const loadReports = useCallback(async (resolved?: boolean): Promise<ForumReport[]> => {
    setLoading(true); setError(null);
    try {
      const headers = getAuthHeader();
      if (!headers) { const err = new Error('User not authenticated'); handleApiError(err); throw err; }
      const response = await fetch(`/api/forum/reports${resolved !== undefined ? `?resolved=${resolved}` : ''}`, { headers });
      if (!response.ok) { 
        const errorData = await response.json().catch(() => ({ detail: `Server error: ${response.status}` }));
        const err = new Error(errorData.detail || `Load reports failed: ${response.status}`); 
        handleApiError(err, err.message); 
        throw err; 
      }
      return await response.json() as ForumReport[];
    } catch (e: any) { 
      if (!e.message.includes("Load reports failed") && !e.message.includes("User not authenticated")) handleApiError(e, 'Load reports error');
      throw e; 
    } finally { setLoading(false); }
  }, [getAuthHeader, handleApiError]);

  // Resolve a report (admin only)
  const resolveReport = useCallback(async (reportId: number): Promise<void> => {
    setLoading(true); setError(null);
    try {
      const headers = getAuthHeader();
      if (!headers) { const err = new Error('User not authenticated'); handleApiError(err); throw err; }
      const response = await fetch(`/api/forum/reports/${reportId}/resolve`, { method: 'PATCH', headers });
      if (!response.ok) { 
        const errorData = await response.json().catch(() => ({ detail: `Server error: ${response.status}` }));
        const err = new Error(errorData.detail || `Resolve report failed: ${response.status}`); 
        handleApiError(err, err.message); 
        throw err; 
      }
    } catch (e: any) { 
      if (!e.message.includes("Resolve report failed") && !e.message.includes("User not authenticated")) handleApiError(e, 'Resolve report error');
      throw e; 
    } finally { setLoading(false); }
  }, [getAuthHeader, handleApiError]);

  const value = {
    sections,
    tags,
    isAdmin,
    loadSections,
    loadTags,
    loadPosts,
    loadPost,
    createPost,
    updatePost,
    deletePost,
    toggleLikePost,
    togglePinPost,
    createComment,
    updateComment,
    deleteComment,
    toggleLikeComment,
    reportContent,
    loadReports,
    resolveReport,
    loading,
    error
  };

  return (
    <ForumContext.Provider value={value}>
      {children}
    </ForumContext.Provider>
  );
};

export const useForum = () => {
  const context = useContext(ForumContext);
  
  if (context === undefined) {
    throw new Error('useForum must be used within a ForumProvider');
  }
  
  return context;
};

export default ForumContext; 