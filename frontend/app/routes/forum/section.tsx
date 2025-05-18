import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useForum, ForumPost } from '../../contexts/ForumContext';
import { 
  ChatBubbleLeftRightIcon, 
  ChevronLeftIcon,
  DocumentTextIcon,
  ChatBubbleOvalLeftIcon,
  HeartIcon,
  TagIcon,
  ClockIcon,
  UserCircleIcon,
  MapPinIcon,
  MegaphoneIcon
} from '@heroicons/react/24/outline';
import PageTitle from '../../components/PageTitle';
import Loader from '../../components/Loader';

const ForumSection: React.FC = () => {
  const { sectionId } = useParams<{ sectionId: string }>();
  const navigate = useNavigate();
  const { 
    sections, 
    loadSections, 
    loadPosts,
    loading,
    error,
    isAdmin
  } = useForum();
  
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [currentSection, setCurrentSection] = useState<any>(null);

  useEffect(() => {
    const fetchSectionData = async () => {
      try {
        // Load sections if not already loaded
        if (sections.length === 0) {
          await loadSections();
        }
        
        // Find current section
        const section = sections.find(s => s.id === Number(sectionId));
        setCurrentSection(section);
        
        // Load posts for this section
        const postsData = await loadPosts(Number(sectionId), undefined, undefined, currentPage);
        setPosts(postsData.items);
        setTotalPosts(postsData.total);
        setTotalPages(postsData.pages);
      } catch (error) {
        console.error('Error loading section data:', error);
      }
    };

    fetchSectionData();
  }, [sectionId, loadSections, loadPosts, sections, currentPage]);

  // Handle search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    try {
      const postsData = await loadPosts(Number(sectionId), undefined, searchTerm, 1);
      setPosts(postsData.items);
      setTotalPosts(postsData.total);
      setTotalPages(postsData.pages);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error searching posts:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Clear search
  const handleClearSearch = async () => {
    setSearchTerm('');
    try {
      const postsData = await loadPosts(Number(sectionId), undefined, '', 1);
      setPosts(postsData.items);
      setTotalPosts(postsData.total);
      setTotalPages(postsData.pages);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error clearing search:', error);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading && !posts.length) {
    return <Loader />;
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg p-4 text-red-700 dark:text-red-400">
          <p>Error loading forum section: {error}</p>
        </div>
      </div>
    );
  }

  if (!currentSection) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-4 text-yellow-700 dark:text-yellow-400">
          <p>Section not found or you don't have access to this section.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20">
      <div className="mb-6">
        <button
          onClick={() => navigate('/forum')}
          className="mb-4 inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon className="h-4 w-4 mr-1" />
          Back to Forum
        </button>
        
        <PageTitle
          title={currentSection.name}
          subtitle={currentSection.description || ''}
          icon={<ChatBubbleLeftRightIcon className="h-7 w-7" />}
        />
      </div>

      <div className="mb-6 bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden p-4">
        <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
          <form onSubmit={handleSearch} className="w-full sm:w-auto">
            <div className="relative">
              <input
                type="text"
                placeholder="Search posts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-80 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </form>
          
          <Link
            to={`/forum/new?section=${sectionId}`}
            className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Create New Post
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
        {isSearching ? (
          <div className="p-6 text-center">
            <Loader size="small" text="Searching..." />
          </div>
        ) : (
          <>
            {posts.length > 0 ? (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition duration-150"
                  >
                    <Link to={`/forum/post/${post.id}`} className="block">
                      <div className="flex items-start">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                              {post.title}
                            </h3>
                            <div className="ml-2 flex items-center space-x-1">
                              {post.is_pinned && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                                  <MapPinIcon className="h-3 w-3 mr-1" />
                                  Pinned
                                </span>
                              )}
                              {post.is_official && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                                  <MegaphoneIcon className="h-3 w-3 mr-1" />
                                  Official
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <UserCircleIcon className="h-4 w-4 mr-1" />
                            <span className="mr-2">{post.user.username}</span>
                            <ClockIcon className="h-4 w-4 mr-1" />
                            <span>{formatDate(post.created_at)}</span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {post.tags.map((tag) => (
                              <span
                                key={tag.id}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"
                              >
                                <TagIcon className="h-3 w-3 mr-1" />
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="ml-4 flex flex-col items-end space-y-2">
                          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <ChatBubbleOvalLeftIcon className="h-4 w-4 mr-1" />
                            <span>{post.comment_count}</span>
                          </div>
                          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <HeartIcon className="h-4 w-4 mr-1" />
                            <span>{post.like_count}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center">
                <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No posts available</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {searchTerm
                    ? `No posts found matching "${searchTerm}"`
                    : "This section doesn't have any posts yet."
                  }
                </p>
                <div className="mt-6">
                  {searchTerm ? (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Clear Search
                    </button>
                  ) : (
                    <Link
                      to={`/forum/new?section=${sectionId}`}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Create First Post
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <nav
                className="px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700"
                aria-label="Pagination"
              >
                <div className="hidden sm:block">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Showing <span className="font-medium">{(currentPage - 1) * 20 + 1}</span> to{' '}
                    <span className="font-medium">
                      {Math.min(currentPage * 20, totalPosts)}
                    </span>{' '}
                    of <span className="font-medium">{totalPosts}</span> results
                  </p>
                </div>
                <div className="flex-1 flex justify-between sm:justify-end">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className={`relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 ${
                      currentPage === 1
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 ${
                      currentPage === totalPages
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    Next
                  </button>
                </div>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ForumSection; 