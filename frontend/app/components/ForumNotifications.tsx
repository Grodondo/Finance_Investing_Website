import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  BellIcon, 
  XMarkIcon, 
  CheckCircleIcon,
  ChatBubbleLeftRightIcon,
  HeartIcon,
  TagIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  InformationCircleIcon,
  MegaphoneIcon
} from '@heroicons/react/24/outline';

// Placeholder for backend type. For a real monorepo, use a shared types package.
// import type { NotificationRead as Notification, NotificationType } from '../../../../backend/app/schemas/notification';

// Temporary local type definition mirroring backend schema
export type BackendNotificationType = 
  | 'new_post_in_section'
  | 'reply_to_post'
  | 'reply_to_comment'
  | 'mention_in_post'
  | 'mention_in_comment'
  | 'post_liked'
  | 'comment_liked'
  | 'admin_announcement'
  | 'report_update';

export interface BackendUserBase {
  id: number;
  username: string;
  email: string;
  // Add other fields like role, profile_picture_url if they are part of UserBase and used here
}

export interface Notification {
  id: number;
  type: BackendNotificationType;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string; // Kept as string, as it's serialized JSON date
  actor: BackendUserBase | null;
  // Fields like user_id, post_id, comment_id, section_id are on NotificationCreate, not always on NotificationRead directly unless expanded
}
// End of temporary local type definition

const ForumNotifications: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getAuthHeader, user } = useAuth();
  const notificationRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  const fetchNotifications = useCallback(async (showLoading: boolean = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    const authHeader = getAuthHeader();
    if (!authHeader) {
      setError("User not authenticated.");
      if (showLoading) setLoading(false);
      setNotifications([]); // Clear notifications if not authenticated
      setUnreadCount(0);
      return;
    }

    try {
      const response = await fetch('/api/notifications/', { // Assuming API is prefixed by vite.config.ts or similar
        headers: { ...authHeader, 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Failed to fetch notifications"}));
        throw new Error(errorData.detail || `Error fetching notifications: ${response.status}`);
      }
      const data = await response.json(); // Expects NotificationsResponse: { notifications: Notification[], unread_count: number }
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } catch (err: any) {
      console.error("Failed to fetch notifications:", err);
      setError(err.message || "Could not load notifications.");
      setNotifications([]); // Clear notifications on error
      setUnreadCount(0);
    }
    if (showLoading) setLoading(false);
  }, [getAuthHeader]);

  useEffect(() => {
    if (user) { 
      fetchNotifications();
      // Optional: Set up polling for notifications
      // const intervalId = setInterval(() => fetchNotifications(false), 30000); // Poll every 30s, without full loading spinner
      // return () => clearInterval(intervalId);
    } else {
      // Clear notifications if user logs out
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false); // Stop loading if there was no user
    }
  }, [user, fetchNotifications]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationRef.current && 
        buttonRef.current &&
        !notificationRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const toggleNotifications = () => {
    setIsOpen(prevIsOpen => {
      const newIsOpen = !prevIsOpen;
      if (newIsOpen) { // Fetch fresh notifications when opening
          fetchNotifications(notifications.length === 0); // Show full loader only if no notifications are currently displayed
      }
      return newIsOpen;
    });
  };
  
  const handleMarkAsRead = async (id: number) => {
    const authHeader = getAuthHeader();
    if (!authHeader) return;

    const originalNotifications = notifications.map(n => ({...n}));
    const originalUnreadCount = unreadCount;

    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id ? { ...notification, is_read: true } : notification
      )
    );
    // Only decrement unreadCount if the notification was actually unread
    const notifToUpdate = originalNotifications.find(n => n.id === id);
    if (notifToUpdate && !notifToUpdate.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
    }
    
    try {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        setNotifications(originalNotifications);
        setUnreadCount(originalUnreadCount);
        console.error("Failed to mark notification as read on server");
        setError("Failed to update notification. Please try again.");
      }
      // Successfully marked as read on server, UI is already updated.
      // Optionally, re-fetch all notifications to ensure sync, or just rely on optimistic update.
      // fetchNotifications(false); // Re-fetch without full loader
    } catch (err) {
      setNotifications(originalNotifications);
      setUnreadCount(originalUnreadCount);
      console.error("Error marking notification as read:", err);
      setError("An error occurred. Please try again.");
    }
  };
  
  const handleMarkAllAsRead = async () => {
    const authHeader = getAuthHeader();
    if (!authHeader || unreadCount === 0) return;

    const originalNotifications = notifications.map(n => ({...n}));
    const originalUnreadCount = unreadCount;

    setNotifications(prev => 
      prev.map(notification => ({ ...notification, is_read: true }))
    );
    setUnreadCount(0);

    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        setNotifications(originalNotifications);
        setUnreadCount(originalUnreadCount);
        console.error("Failed to mark all notifications as read on server");
        setError("Failed to update notifications. Please try again.");
      }
       // Optionally re-fetch all to confirm: fetchNotifications(false);
    } catch (err) {
      setNotifications(originalNotifications);
      setUnreadCount(originalUnreadCount);
      console.error("Error marking all notifications as read:", err);
      setError("An error occurred. Please try again.");
    }
  };
  
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMilliseconds = now.getTime() - date.getTime();
    
    const diffInSeconds = Math.floor(diffInMilliseconds / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInSeconds < 5) return 'just now';
    if (diffInMinutes < 1) return `${diffInSeconds}s ago`;
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  // Updated to use BackendNotificationType
  const getNotificationIcon = (type: BackendNotificationType) => {
    switch (type) {
      case 'reply_to_post':
      case 'reply_to_comment':
        return <ChatBubbleLeftRightIcon className="h-5 w-5 text-blue-500" />;
      case 'mention_in_post':
      case 'mention_in_comment':
        return <TagIcon className="h-5 w-5 text-purple-500" />;
      case 'post_liked':
      case 'comment_liked':
        return <HeartIcon className="h-5 w-5 text-pink-500" />; // Changed color for like
      case 'new_post_in_section':
        return <InformationCircleIcon className="h-5 w-5 text-green-500" />; // Changed icon
      case 'admin_announcement':
        return <MegaphoneIcon className="h-5 w-5 text-yellow-500" />; // Changed color
      case 'report_update':
        return <FlagIcon className="h-5 w-5 text-red-500" />;
      default:
        // This case should ideally not be reached if types are exhaustive
        const exhaustiveCheck: never = type; 
        console.warn("Unknown notification type:", exhaustiveCheck);
        return <BellIcon className="h-5 w-5 text-gray-500" />;
    }
  };
  
  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={toggleNotifications}
        className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 focus:outline-none transition-colors duration-150"
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <BellIcon className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 dark:bg-red-600 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>
      
      {isOpen && (
        <div 
          ref={notificationRef}
          className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden z-50 border border-gray-200 dark:border-gray-700"
          role="menu" aria-orientation="vertical" aria-labelledby="notifications-button"
        >
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</h3>
            {notifications.length > 0 && unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline focus:outline-none"
              >
                Mark all as read
              </button>
            )}
          </div>
          
          <div className="max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-700">
            {loading && notifications.length === 0 && ( // Show loader only if no old notifications are visible
              <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                <BellIcon className="h-8 w-8 mx-auto text-gray-400 animate-pulse" />
                <p className="mt-2">Loading notifications...</p>
              </div>
            )}
            {error && ( // Display error more prominently
              <div className="p-4 m-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-center text-sm text-red-700 dark:text-red-300">
                {error}
                <button onClick={() => fetchNotifications()} className="ml-2 text-indigo-600 dark:text-indigo-400 hover:underline">Try again</button>
              </div>
            )}
            {!loading && !error && notifications.length === 0 && (
              <div className="p-8 text-center">
                <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500" />
                <p className="mt-3 text-sm font-medium text-gray-900 dark:text-white">All caught up!</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">You have no new notifications.</p>
              </div>
            )}
            {!error && notifications.map((notification) => (
              <Link 
                to={notification.link || '#'} 
                key={notification.id}
                role="menuitem"
                className={`block p-4 border-b border-gray-200 dark:border-gray-700 transition-colors duration-150 ${notification.is_read ? 'bg-white dark:bg-gray-800 opacity-70' : 'bg-indigo-50 dark:bg-indigo-900/30 font-semibold'} hover:bg-gray-100 dark:hover:bg-gray-700`}
                onClick={() => !notification.is_read && handleMarkAsRead(notification.id)}
              >
                <div className="flex items-start">
                  <div className={`flex-shrink-0 mr-3 mt-0.5 p-1.5 rounded-full ${notification.is_read ? 'bg-gray-100 dark:bg-gray-700' : 'bg-indigo-100 dark:bg-indigo-700'}`}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${notification.is_read ? 'text-gray-600 dark:text-gray-400' : 'text-gray-800 dark:text-white'}`}>
                      {notification.message}
                    </p>
                    <p className={`mt-1 text-xs ${notification.is_read ? 'text-gray-400 dark:text-gray-500' : 'text-indigo-700 dark:text-indigo-400'} flex items-center`}>
                      {notification.actor && (
                        <>
                          <span className="font-medium mr-1">{notification.actor.username}</span> ·
                        </>
                      )}
                      <span className="ml-1">{formatRelativeTime(notification.created_at)}</span>
                    </p>
                  </div>
                  {!notification.is_read && (
                    <div className="ml-2 flex-shrink-0 mt-1">
                      <span className="inline-block h-2.5 w-2.5 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-pulse"></span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ForumNotifications; 