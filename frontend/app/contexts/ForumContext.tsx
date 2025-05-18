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
  loadTags: () => Promise<void>;
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

  const handleApiError = (error: any) => {
    console.error('Forum API error:', error);
    setError(error.message || 'An error occurred with the forum API');
    setLoading(false);
    throw error;
  };

  // Load all forum sections
  const loadSections = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Starting to load forum sections...');
      const headers = getAuthHeader();
      console.log('Auth headers obtained:', headers ? 'Headers present' : 'No headers');
      
      if (!headers) {
        console.error('Authentication headers missing when loading forum sections');
        throw new Error('Not authenticated');
      }
      
      console.log('Fetching forum sections...');
      const response = await fetch('/api/forum/sections', {
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Forum sections API response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error details');
        console.error(`Forum sections API error: ${response.status}`, errorText);
        throw new Error(`Failed to load forum sections: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Forum sections loaded successfully:', data.length);
      setSections(data);
      setLoading(false);
      return data;
    } catch (error) {
      console.error('Error in loadSections:', error);
      return handleApiError(error);
    }
  }, [getAuthHeader]);

  // Load all forum tags
  const loadTags = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const headers = getAuthHeader();
      if (!headers) throw new Error('Not authenticated');
      
      const response = await fetch('/api/forum/tags', {
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load forum tags: ${response.status}`);
      }
      
      const data = await response.json();
      setTags(data);
      setLoading(false);
      return data;
    } catch (error) {
      return handleApiError(error);
    }
  }, [getAuthHeader]);

  // Load posts with optional filtering
  const loadPosts = useCallback(async (
    sectionId?: number, 
    tagId?: number, 
    search?: string, 
    page: number = 1
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      const headers = getAuthHeader();
      if (!headers) throw new Error('Not authenticated');
      
      let url = `/api/forum/posts?page=${page}`;
      if (sectionId) url += `&section_id=${sectionId}`;
      if (tagId) url += `&tag_id=${tagId}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      
      const response = await fetch(url, {
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load forum posts: ${response.status}`);
      }
      
      const data = await response.json();
      setLoading(false);
      return data as ForumPostsResponse;
    } catch (error) {
      return handleApiError(error);
    }
  }, [getAuthHeader]);

  // Load a single post with details
  const loadPost = useCallback(async (postId: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const headers = getAuthHeader();
      if (!headers) throw new Error('Not authenticated');
      
      const response = await fetch(`/api/forum/posts/${postId}`, {
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load forum post: ${response.status}`);
      }
      
      const data = await response.json();
      setLoading(false);
      return data as ForumPost;
    } catch (error) {
      return handleApiError(error);
    }
  }, [getAuthHeader]);

  // Create a new post using FormData (for file uploads)
  const createPost = useCallback(async (formData: FormData) => {
    setLoading(true);
    setError(null);
    
    try {
      const headers = getAuthHeader();
      if (!headers) throw new Error('Not authenticated');
      
      const response = await fetch('/api/forum/posts', {
        method: 'POST',
        headers: {
          ...headers,
          // Note: Don't set Content-Type for FormData
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create forum post: ${response.status}`);
      }
      
      const data = await response.json();
      setLoading(false);
      return data as ForumPost;
    } catch (error) {
      return handleApiError(error);
    }
  }, [getAuthHeader]);

  // Update an existing post
  const updatePost = useCallback(async (postId: number, formData: FormData) => {
    setLoading(true);
    setError(null);
    
    try {
      const headers = getAuthHeader();
      if (!headers) throw new Error('Not authenticated');
      
      const response = await fetch(`/api/forum/posts/${postId}`, {
        method: 'PUT',
        headers: {
          ...headers,
          // Note: Don't set Content-Type for FormData
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update forum post: ${response.status}`);
      }
      
      const data = await response.json();
      setLoading(false);
      return data as ForumPost;
    } catch (error) {
      return handleApiError(error);
    }
  }, [getAuthHeader]);

  // Delete a post
  const deletePost = useCallback(async (postId: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const headers = getAuthHeader();
      if (!headers) throw new Error('Not authenticated');
      
      const response = await fetch(`/api/forum/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete forum post: ${response.status}`);
      }
      
      setLoading(false);
    } catch (error) {
      return handleApiError(error);
    }
  }, [getAuthHeader]);

  // Toggle like on a post
  const toggleLikePost = useCallback(async (postId: number) => {
    try {
      const headers = getAuthHeader();
      if (!headers) throw new Error('Not authenticated');
      
      const response = await fetch(`/api/forum/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to toggle post like: ${response.status}`);
      }
      
      const data = await response.json();
      return { like_count: data.like_count, is_liked: data.is_liked };
    } catch (error) {
      return handleApiError(error);
    }
  }, [getAuthHeader]);

  // Toggle pin status on a post (admin only)
  const togglePinPost = useCallback(async (postId: number) => {
    try {
      const headers = getAuthHeader();
      if (!headers) throw new Error('Not authenticated');
      
      const response = await fetch(`/api/forum/posts/${postId}/pin`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to toggle post pin status: ${response.status}`);
      }
      
      await response.json();
    } catch (error) {
      return handleApiError(error);
    }
  }, [getAuthHeader]);

  // Create a new comment
  const createComment = useCallback(async (postId: number, content: string, parentId?: number) => {
    try {
      const headers = getAuthHeader();
      if (!headers) throw new Error('Not authenticated');
      
      const response = await fetch('/api/forum/comments', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          post_id: postId,
          content,
          parent_id: parentId || null
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create comment: ${response.status}`);
      }
      
      const data = await response.json();
      return data as ForumComment;
    } catch (error) {
      return handleApiError(error);
    }
  }, [getAuthHeader]);

  // Update an existing comment
  const updateComment = useCallback(async (commentId: number, content: string) => {
    try {
      const headers = getAuthHeader();
      if (!headers) throw new Error('Not authenticated');
      
      const response = await fetch(`/api/forum/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update comment: ${response.status}`);
      }
      
      const data = await response.json();
      return data as ForumComment;
    } catch (error) {
      return handleApiError(error);
    }
  }, [getAuthHeader]);

  // Delete a comment
  const deleteComment = useCallback(async (commentId: number) => {
    try {
      const headers = getAuthHeader();
      if (!headers) throw new Error('Not authenticated');
      
      const response = await fetch(`/api/forum/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete comment: ${response.status}`);
      }
    } catch (error) {
      return handleApiError(error);
    }
  }, [getAuthHeader]);

  // Toggle like on a comment
  const toggleLikeComment = useCallback(async (commentId: number) => {
    try {
      const headers = getAuthHeader();
      if (!headers) throw new Error('Not authenticated');
      
      const response = await fetch(`/api/forum/comments/${commentId}/like`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to toggle comment like: ${response.status}`);
      }
      
      const data = await response.json();
      return { like_count: data.like_count, is_liked: data.is_liked };
    } catch (error) {
      return handleApiError(error);
    }
  }, [getAuthHeader]);

  // Report a post or comment
  const reportContent = useCallback(async (
    reason: string, 
    details: string, 
    postId?: number, 
    commentId?: number
  ) => {
    try {
      const headers = getAuthHeader();
      if (!headers) throw new Error('Not authenticated');
      
      if (!postId && !commentId) {
        throw new Error('Either postId or commentId must be provided');
      }
      
      const response = await fetch('/api/forum/reports', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason,
          details,
          post_id: postId || null,
          comment_id: commentId || null
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to report content: ${response.status}`);
      }
    } catch (error) {
      return handleApiError(error);
    }
  }, [getAuthHeader]);

  // Load reports (admin only)
  const loadReports = useCallback(async (resolved?: boolean) => {
    try {
      const headers = getAuthHeader();
      if (!headers) throw new Error('Not authenticated');
      
      let url = '/api/forum/reports';
      if (resolved !== undefined) url += `?resolved=${resolved}`;
      
      const response = await fetch(url, {
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load reports: ${response.status}`);
      }
      
      const data = await response.json();
      return data as ForumReport[];
    } catch (error) {
      return handleApiError(error);
    }
  }, [getAuthHeader]);

  // Resolve a report (admin only)
  const resolveReport = useCallback(async (reportId: number) => {
    try {
      const headers = getAuthHeader();
      if (!headers) throw new Error('Not authenticated');
      
      const response = await fetch(`/api/forum/reports/${reportId}`, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_resolved: true })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to resolve report: ${response.status}`);
      }
    } catch (error) {
      return handleApiError(error);
    }
  }, [getAuthHeader]);

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