import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForum, ForumPost } from '../../../contexts/ForumContext';
import { 
  MegaphoneIcon, 
  ChevronLeftIcon,
  PlusIcon,
  MapPinIcon,
  PencilIcon,
  TrashIcon,
  ClockIcon,
  ChatBubbleOvalLeftIcon,
  HeartIcon
} from '@heroicons/react/24/outline';
import PageTitle from '../../../components/PageTitle';
import Loader from '../../../components/Loader';
import { format } from 'date-fns';

const AdminAnnouncements: React.FC = () => {
  const navigate = useNavigate();
  const { 
    sections, 
    loadSections, 
    loadPosts,
    togglePinPost,
    deletePost,
    isAdmin,
    loading,
    error
  } = useForum();
  
  const [announcements, setAnnouncements] = useState<ForumPost[]>([]);
  const [announcementSection, setAnnouncementSection] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [isPinning, setIsPinning] = useState<number | null>(null);

  useEffect(() => {
    // Redirect if not admin
    if (!isAdmin) {
      navigate('/forum');
      return;
    }
    
    const fetchAnnouncementData = async () => {
      try {
        setIsLoading(true);
        // Load sections if not already loaded
        if (sections.length === 0) {
          await loadSections();
        }
        
        // Find announcement section
        const section = sections.find(s => s.section_type === 'admin_announcements');
        if (section) {
          setAnnouncementSection(section.id);
          
          // Load announcements
          const postsData = await loadPosts(section.id);
          setAnnouncements(postsData.items);
        }
      } catch (error) {
        console.error('Error loading announcements:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnnouncementData();
  }, [isAdmin, loadSections, loadPosts, navigate, sections]);

  // Handle pin announcement
  const handlePinAnnouncement = async (postId: number) => {
    try {
      setIsPinning(postId);
      await togglePinPost(postId);
      
      // Refresh announcements after pinning
      if (announcementSection) {
        const postsData = await loadPosts(announcementSection);
        setAnnouncements(postsData.items);
      }
    } catch (error) {
      console.error('Error pinning announcement:', error);
    } finally {
      setIsPinning(null);
    }
  };

  // Handle delete announcement
  const handleDeleteAnnouncement = async (postId: number) => {
    if (window.confirm('Are you sure you want to delete this announcement? This action cannot be undone.')) {
      try {
        setIsDeleting(postId);
        await deletePost(postId);
        
        // Refresh announcements after deletion
        if (announcementSection) {
          const postsData = await loadPosts(announcementSection);
          setAnnouncements(postsData.items);
        }
      } catch (error) {
        console.error('Error deleting announcement:', error);
      } finally {
        setIsDeleting(null);
      }
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  if (isLoading || loading) {
    return <Loader />;
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg p-4 text-red-700 dark:text-red-400">
          <p>Error loading announcements: {error}</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-4 text-yellow-700 dark:text-yellow-400">
          <p>You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <button
          onClick={() => navigate('/forum')}
          className="mb-4 inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon className="h-4 w-4 mr-1" />
          Back to Forum
        </button>
        
        <PageTitle
          title="Manage Announcements"
          subtitle="Create and manage official announcements for forum users"
          icon={<MegaphoneIcon className="h-7 w-7" />}
        />
      </div>

      <div className="mb-6 flex justify-end">
        <Link
          to={`/forum/new?section=${announcementSection}&isAnnouncement=true`}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <PlusIcon className="h-5 w-5 mr-1" />
          Create Announcement
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
        {announcements.length > 0 ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition duration-150"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <Link to={`/forum/post/${announcement.id}`}>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                        {announcement.title}
                        {announcement.is_pinned && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                            <MapPinIcon className="h-3 w-3 mr-1" />
                            Pinned
                          </span>
                        )}
                        {announcement.is_official && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                            Official
                          </span>
                        )}
                      </h3>
                    </Link>
                    
                    <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <ClockIcon className="h-4 w-4 mr-1" />
                      <span>Posted on {formatDate(announcement.created_at)}</span>
                      <span className="mx-2">•</span>
                      <ChatBubbleOvalLeftIcon className="h-4 w-4 mr-1" />
                      <span>{announcement.comment_count} comments</span>
                      <span className="mx-2">•</span>
                      <HeartIcon className="h-4 w-4 mr-1" />
                      <span>{announcement.like_count} likes</span>
                    </div>
                  </div>
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={() => handlePinAnnouncement(announcement.id)}
                      disabled={isPinning === announcement.id}
                      className={`inline-flex items-center p-1.5 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-700 dark:text-gray-300 
                        ${announcement.is_pinned 
                          ? 'bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/40' 
                          : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                      title={announcement.is_pinned ? "Unpin Announcement" : "Pin Announcement"}
                    >
                      <MapPinIcon className={`h-5 w-5 ${announcement.is_pinned ? 'text-yellow-600 dark:text-yellow-400' : ''}`} />
                    </button>
                    
                    <Link
                      to={`/forum/edit/${announcement.id}`}
                      className="inline-flex items-center p-1.5 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                      title="Edit Announcement"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </Link>
                    
                    <button
                      onClick={() => handleDeleteAnnouncement(announcement.id)}
                      disabled={isDeleting === announcement.id}
                      className="inline-flex items-center p-1.5 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-red-100 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400"
                      title="Delete Announcement"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center">
            <MegaphoneIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No announcements</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get started by creating a new announcement for your users.
            </p>
            <div className="mt-6">
              <Link
                to={`/forum/new?section=${announcementSection}&isAnnouncement=true`}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <PlusIcon className="h-5 w-5 mr-1" />
                Create Announcement
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAnnouncements; 