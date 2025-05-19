import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useForum } from '../../contexts/ForumContext';
import { 
  ChatBubbleLeftRightIcon, 
  ChevronRightIcon, 
  UserGroupIcon,
  DocumentTextIcon,
  BriefcaseIcon,
  BanknotesIcon,
  MegaphoneIcon
} from '@heroicons/react/24/outline';
import PageTitle from '../../components/PageTitle';
import Loader from '../../components/Loader';
import { useTranslation } from 'react-i18next';

const Forum: React.FC = () => {
  const { sections, loadSections, loading, error, isAdmin } = useForum();
  const { t } = useTranslation();

  useEffect(() => {
    const fetchSections = async () => {
      try {
        await loadSections();
      } catch (error) {
        console.error('Error loading forum sections:', error);
      }
    };

    fetchSections();
  }, [loadSections]);

  // Function to get the appropriate icon for each section type
  const getSectionIcon = (sectionType: string) => {
    switch (sectionType) {
      case 'general_discussion':
        return <UserGroupIcon className="h-8 w-8 text-indigo-500" />;
      case 'investment_tips':
        return <BriefcaseIcon className="h-8 w-8 text-green-500" />;
      case 'budgeting_advice':
        return <BanknotesIcon className="h-8 w-8 text-blue-500" />;
      case 'admin_announcements':
        return <MegaphoneIcon className="h-8 w-8 text-red-500" />;
      default:
        return <ChatBubbleLeftRightIcon className="h-8 w-8 text-gray-500" />;
    }
  };

  // Format date for last post
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return <Loader />;
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg p-4 text-red-700 dark:text-red-400">
          <p>Error loading forum sections: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20">
      <div className="flex justify-between items-center mb-6">
        <PageTitle 
          title={t('forum.title', 'Community Forum')} 
          subtitle={t('forum.subtitle', 'Discuss and share ideas with the community')}
          icon={<ChatBubbleLeftRightIcon className="h-7 w-7" />} 
        />
        
        <div className="flex space-x-3">
          {isAdmin && (
            <Link
              to="/forum/admin/reports"
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Manage Reports
            </Link>
          )}
          
          <Link
            to="/forum/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            New Post
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {sections.map((section) => (
            <div key={section.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition duration-150">
              <div className="flex items-start space-x-5">
                <div className="flex-shrink-0 mt-1">
                  {getSectionIcon(section.section_type)}
                </div>
                
                <div className="min-w-0 flex-1">
                  <div className="block">
                    <div className="flex items-center justify-between">
                      <Link to={`/forum/section/${section.id}`} className="hover:underline">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                          {section.name}
                          {section.is_restricted && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                              Restricted
                            </span>
                          )}
                        </h3>
                      </Link>
                      <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {section.description}
                    </p>
                  </div>
                  
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <DocumentTextIcon className="h-4 w-4 mr-1" />
                      <span>{section.post_count} posts</span>
                    </div>
                    
                    {section.latest_post && (
                      <div className="text-sm">
                        <p className="text-gray-500 dark:text-gray-400">
                          Latest: 
                          <Link 
                            to={`/forum/post/${section.latest_post.id}`}
                            className="ml-1 font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
                          >
                            {section.latest_post.title}
                          </Link>
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          by {section.latest_post.user.username} 
                          on {formatDate(section.latest_post.created_at)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {sections.length === 0 && (
            <div className="p-6 text-center">
              <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No forum sections available</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                There are currently no sections in the forum.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Forum; 