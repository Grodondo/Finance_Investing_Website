import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useForum } from '../contexts/ForumContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  BellIcon, 
  XMarkIcon, 
  CheckIcon,
  ChatBubbleLeftRightIcon,
  HeartIcon,
  TagIcon,
  ExclamationTriangleIcon,
  FlagIcon
} from '@heroicons/react/24/outline';

export type NotificationType = 
  | 'reply' 
  | 'mention' 
  | 'like' 
  | 'tag'
  | 'warning'
  | 'report_resolved';

export interface Notification {
  id: number;
  type: NotificationType;
  message: string;
  link: string;
  read: boolean;
  createdAt: string;
  sender?: {
    id: number;
    username: string;
  };
}

const ForumNotifications: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();
  const notificationRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Close notification panel when clicking outside
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
  
  // Simulate loading notifications - in a real app, this would come from API
  useEffect(() => {
    // Mock notifications data for demo purposes
    const mockNotifications: Notification[] = [
      {
        id: 1,
        type: 'reply',
        message: 'John replied to your post "Investing in Index Funds"',
        link: '/forum/post/1',
        read: false,
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        sender: {
          id: 2,
          username: 'john_doe'
        }
      },
      {
        id: 2,
        type: 'like',
        message: 'Sarah liked your comment on "Budget Planning Tips"',
        link: '/forum/post/2',
        read: false,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        sender: {
          id: 3,
          username: 'sarah_smith'
        }
      },
      {
        id: 3,
        type: 'mention',
        message: 'Alex mentioned you in "Retirement Planning Strategies"',
        link: '/forum/post/3',
        read: true,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        sender: {
          id: 4,
          username: 'alex_investor'
        }
      },
      {
        id: 4,
        type: 'tag',
        message: 'New post in #investing tag: "Market Trends 2023"',
        link: '/forum/post/4',
        read: true,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
    
    // Add admin notifications if user is admin
    if (user?.role === 'admin') {
      mockNotifications.push(
        {
          id: 5,
          type: 'report_resolved',
          message: 'A user reported a post for inappropriate content',
          link: '/forum/admin/reports',
          read: false,
          createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          sender: {
            id: 5,
            username: 'concerned_user'
          }
        },
        {
          id: 6,
          type: 'warning',
          message: 'Maintenance scheduled for forum: Jan 15, 2023',
          link: '/forum/admin/announcements',
          read: true,
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
        }
      );
    }
    
    setNotifications(mockNotifications);
    setUnreadCount(mockNotifications.filter(n => !n.read).length);
  }, [user]);
  
  // Toggle notification panel
  const toggleNotifications = () => {
    setIsOpen(!isOpen);
  };
  
  // Mark notification as read
  const markAsRead = (id: number) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };
  
  // Mark all as read
  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
    setUnreadCount(0);
  };
  
  // Format time relative to now (e.g. "2 hours ago")
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMilliseconds = now.getTime() - date.getTime();
    
    const diffInMinutes = Math.floor(diffInMilliseconds / (1000 * 60));
    const diffInHours = Math.floor(diffInMilliseconds / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMilliseconds / (1000 * 60 * 60 * 24));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes} min${diffInMinutes === 1 ? '' : 's'} ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
    } else {
      return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
    }
  };
  
  // Get icon for notification type
  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'reply':
        return <ChatBubbleLeftRightIcon className="h-5 w-5 text-blue-500" />;
      case 'mention':
        return <TagIcon className="h-5 w-5 text-purple-500" />;
      case 'like':
        return <HeartIcon className="h-5 w-5 text-red-500" />;
      case 'tag':
        return <TagIcon className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      case 'report_resolved':
        return <FlagIcon className="h-5 w-5 text-red-500" />;
      default:
        return <BellIcon className="h-5 w-5 text-gray-500" />;
    }
  };
  
  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        onClick={toggleNotifications}
        className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 focus:outline-none"
        aria-label="Notifications"
        ref={buttonRef}
      >
        <BellIcon className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>
      
      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-md shadow-lg overflow-hidden z-20 border border-gray-200 dark:border-gray-700" ref={notificationRef}>
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
              >
                Mark all as read
              </button>
            )}
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <Link 
                  to={notification.link} 
                  key={notification.id}
                  className={`block ${notification.read ? 'bg-white dark:bg-gray-800' : 'bg-blue-50 dark:bg-blue-900/20'} hover:bg-gray-50 dark:hover:bg-gray-700/50 p-4 border-b border-gray-200 dark:border-gray-700`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mr-3">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white">
                        {notification.message}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {formatRelativeTime(notification.createdAt)}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="ml-2">
                        <span className="inline-block h-2 w-2 bg-blue-600 dark:bg-blue-400 rounded-full"></span>
                      </div>
                    )}
                  </div>
                </Link>
              ))
            ) : (
              <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                No notifications
              </div>
            )}
          </div>
          
          <div className="p-2 border-t border-gray-200 dark:border-gray-700">
            <Link 
              to="/forum" 
              className="block w-full text-center text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 py-2"
            >
              View all forum activities
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default ForumNotifications; 