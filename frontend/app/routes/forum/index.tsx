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
  MegaphoneIcon,
  ScaleIcon,
  ChartBarIcon,
  InformationCircleIcon,
  PlusCircleIcon
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
        // Error is already handled and set in ForumContext by handleApiError
        // Logging here is optional, as the context will trigger a re-render with the error message
        console.error('Error caught in Forum component useEffect:', error);
      }
    };

    fetchSections();
  }, [loadSections]);

  // Function to get the appropriate icon for each section type
  const getSectionIcon = (sectionType: string) => {
    switch (sectionType) {
      case 'general_discussion':
        return <InformationCircleIcon className="h-10 w-10 text-sky-500" />;
      case 'investment_tips':
        return <ChartBarIcon className="h-10 w-10 text-emerald-500" />;
      case 'budgeting_advice':
        return <ScaleIcon className="h-10 w-10 text-amber-500" />;
      case 'admin_announcements':
        return <MegaphoneIcon className="h-10 w-10 text-red-500" />;
      default:
        return <ChatBubbleLeftRightIcon className="h-10 w-10 text-gray-500" />;
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
            <PlusCircleIcon className="h-5 w-5 mr-2" />
            New Post
          </Link>
        </div>
      </div>

      <div className="space-y-6">
        {sections.map((section) => (
          <Link 
            to={`/forum/section/${section.id}`} 
            key={section.id} 
            className="block bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6 hover:shadow-xl dark:hover:shadow-indigo-700/30 hover:scale-[1.01] transition-all duration-300 group"
          >
            <div className="flex items-start space-x-5">
              <div className="flex-shrink-0 mt-1 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                {getSectionIcon(section.section_type)}
              </div>
              
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {section.name}
                    {section.is_restricted && (
                      <span className="ml-3 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700">
                        Restricted
                      </span>
                    )}
                  </h3>
                  <ChevronRightIcon className="h-6 w-6 text-gray-400 dark:text-gray-500 group-hover:translate-x-1 transition-transform duration-200" />
                </div>
                
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {section.description}
                </p>
                
                <div className="mt-5 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex items-center">
                    <DocumentTextIcon className="h-5 w-5 mr-1.5 text-gray-400 dark:text-gray-500" />
                    <span>{section.post_count} {section.post_count === 1 ? 'post' : 'posts'}</span>
                  </div>
                  
                  {section.latest_post && (
                    <div className="hidden sm:block text-xs text-right">
                      <p className="font-medium text-gray-700 dark:text-gray-300 truncate">
                        <Link 
                          to={`/forum/post/${section.latest_post.id}`}
                          className="hover:underline text-indigo-600 dark:text-indigo-400"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {section.latest_post.title}
                        </Link>
                      </p>
                      <p className="text-gray-500 dark:text-gray-400">
                        by {section.latest_post.user.username} 
                        {' · '} 
                        {formatDate(section.latest_post.created_at)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
        
        {sections.length === 0 && !loading && (
          <div className="text-center py-12">
            <InformationCircleIcon className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500" />
            <h3 className="mt-4 text-xl font-semibold text-gray-800 dark:text-white">No Forum Sections Yet</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              It looks like there are no discussion sections available right now.
            </p>
            {isAdmin && (
              <div className="mt-6">
                <Link
                  to="/forum/admin/sections/new"
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
                >
                  <PlusCircleIcon className="h-5 w-5 mr-2" />
                  Create New Section
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Forum; 