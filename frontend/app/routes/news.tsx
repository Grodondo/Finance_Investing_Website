import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { 
  NewspaperIcon, 
  BookmarkIcon, 
  GlobeAltIcon,
  ClockIcon,
  BriefcaseIcon,
  ArrowTopRightOnSquareIcon,
  ChevronRightIcon,
  InformationCircleIcon,
  StarIcon
} from "@heroicons/react/24/outline";

interface NewsItem {
  title: string;
  publisher: string;
  link: string;
  published_date: string;
  summary?: string;
  thumbnail?: string;
  related_symbols: string[];
  source: string;
}

// Types for auth header
type AuthHeader = { Authorization: string } | null;

// Function to use market news
const useMarketNews = (authHeader: AuthHeader) => {
  return useQuery({
    queryKey: ['marketNews'],
    queryFn: async () => {
      if (!authHeader) return [];
      const response = await fetch("/api/news/market", {
        headers: {
          ...authHeader,
          "Content-Type": "application/json"
        }
      });
      if (!response.ok) throw new Error("Failed to fetch market news");
      return response.json() as Promise<NewsItem[]>;
    },
    enabled: !!authHeader,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
};

// Function to use watchlist news
const useWatchlistNews = (authHeader: AuthHeader) => {
  return useQuery({
    queryKey: ['watchlistNews'],
    queryFn: async () => {
      if (!authHeader) return [];
      const response = await fetch("/api/news/watchlist", {
        headers: {
          ...authHeader,
          "Content-Type": "application/json"
        }
      });
      if (!response.ok) throw new Error("Failed to fetch watchlist news");
      return response.json() as Promise<NewsItem[]>;
    },
    enabled: !!authHeader,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
};

// Simple date formatter that works consistently for server and client
function formatDateSimple(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

// Client-side only formatter for relative dates
function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  
  // Calculate time difference in milliseconds
  const diffMs = now.getTime() - date.getTime();
  
  // Convert to minutes, hours, and days
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  
  // Format the date based on how recent it is
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  } else {
    return formatDateSimple(dateString);
  }
}

// News card component for displaying a single news item
const NewsCard = ({ news, isWatchlist = false }: { news: NewsItem, isWatchlist?: boolean }) => {
  const [showSummary, setShowSummary] = useState(false);
  const [formattedDate, setFormattedDate] = useState(formatDateSimple(news.published_date));
  const [isClient, setIsClient] = useState(false);
  
  // Update to relative time format only after component has mounted (client-side only)
  useEffect(() => {
    setIsClient(true);
    setFormattedDate(formatRelativeDate(news.published_date));
  }, [news.published_date]);
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-200 dark:border-gray-700">
      <div className="p-5">
        <div className="flex items-start gap-4">
          {isClient && news.thumbnail ? (
            <div className="flex-shrink-0">
              <img 
                src={news.thumbnail} 
                alt={news.title}
                className="w-20 h-20 object-cover rounded-md"
                onError={(e) => {
                  // Hide broken images
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          ) : (
            <div className="flex-shrink-0 w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-md flex items-center justify-center">
              <NewspaperIcon className="w-10 h-10 text-gray-400 dark:text-gray-500" />
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center">
                <span>{news.publisher}</span>
                {isClient && isWatchlist && news.related_symbols.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded-full text-xs">
                    {news.related_symbols[0]}
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center ml-2">
                <ClockIcon className="w-3 h-3 mr-1" />
                {formattedDate}
              </p>
            </div>
            
            <h3 className="text-base font-semibold text-gray-900 dark:text-white line-clamp-2 mb-1">
              {news.title}
            </h3>
            
            {isClient && news.summary && (
              <div>
                <button 
                  onClick={() => setShowSummary(!showSummary)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center mb-2"
                >
                  {showSummary ? 'Hide summary' : 'Show summary'}
                  <ChevronRightIcon className={`w-3 h-3 ml-1 transition-transform duration-200 ${showSummary ? 'rotate-90' : ''}`} />
                </button>
                
                {showSummary && (
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 line-clamp-3">
                    {news.summary}
                  </p>
                )}
              </div>
            )}
            
            <div className="flex items-center justify-between mt-2">
              <div className="flex space-x-2">
                {isClient && news.related_symbols.slice(0, 3).map(symbol => (
                  <Link 
                    key={symbol} 
                    to={`/investing?symbol=${symbol}`}
                    className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    ${symbol}
                  </Link>
                ))}
              </div>
              
              <a 
                href={news.link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center"
              >
                Read more
                <ArrowTopRightOnSquareIcon className="w-3 h-3 ml-1" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Empty state component for when there are no news items
const EmptyNewsState = ({ type }: { type: 'watchlist' | 'market' }) => {
  return (
    <div className="text-center py-10">
      {type === 'watchlist' ? (
        <>
          <StarIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No watchlist news</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Add stocks to your watchlist to see related news here.
          </p>
          <div className="mt-6">
            <Link
              to="/recommendations"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Browse recommendations
            </Link>
          </div>
        </>
      ) : (
        <>
          <NewspaperIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No market news</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            There are currently no market news available.
          </p>
          <div className="mt-6">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Refresh
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default function News() {
  const { isAuthenticated, getAuthHeader } = useAuth();
  const navigate = useNavigate();
  const isMounted = useRef(false);
  
  // Get auth header for API requests
  const authHeader = useMemo(() => getAuthHeader() as AuthHeader, [getAuthHeader]);
  
  // State to track if initial page render is complete
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  
  // Fetch news data with defer loading
  const { 
    data: marketNews,
    isLoading: isMarketNewsLoading,
    error: marketNewsError,
    refetch: refetchMarketNews
  } = useMarketNews(authHeader);
  
  const { 
    data: watchlistNews,
    isLoading: isWatchlistNewsLoading,
    error: watchlistNewsError,
    refetch: refetchWatchlistNews
  } = useWatchlistNews(authHeader);
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
    isMounted.current = true;
  }, [isAuthenticated, navigate]);
  
  // Mark page as loaded after initial render
  useEffect(() => {
    // Use requestAnimationFrame to wait for the next frame after rendering
    const timeoutId = setTimeout(() => {
      setIsPageLoaded(true);
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, []);
  
  // Handle tab selection
  const [activeTab, setActiveTab] = useState<'all' | 'watchlist'>('all');
  
  // Handle refresh
  const handleRefresh = () => {
    refetchMarketNews();
    refetchWatchlistNews();
  };
  
  // Error states
  const hasError = marketNewsError || watchlistNewsError;
  const isLoading = isMarketNewsLoading || isWatchlistNewsLoading;
  
  // Only render content if we're on the client (prevents hydration errors)
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Render a skeleton loader for news items
  const NewsCardSkeleton = () => (
    <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse"></div>
        <div className="flex-1 min-w-0">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse"></div>
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse"></div>
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse w-3/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/4 mt-4"></div>
        </div>
      </div>
    </div>
  );
  
  // Render multiple skeleton loaders
  const NewsSkeletonList = ({ count = 5 }: { count?: number }) => (
    <div className="grid grid-cols-1 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <NewsCardSkeleton key={index} />
      ))}
    </div>
  );
  
  return (
    <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center mb-4 sm:mb-0">
              <NewspaperIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mr-2" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Market News</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <button 
                onClick={handleRefresh}
                disabled={isLoading}
                className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-md text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/40 flex items-center"
              >
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </button>
              
              <div className="bg-gray-100 dark:bg-gray-700 rounded-md p-1 flex">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1 rounded-md text-sm font-medium ${
                    activeTab === 'all'
                      ? 'bg-white dark:bg-gray-800 text-indigo-700 dark:text-indigo-300 shadow-sm'
                      : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  All News
                </button>
                <button
                  onClick={() => setActiveTab('watchlist')}
                  className={`px-3 py-1 rounded-md text-sm font-medium ${
                    activeTab === 'watchlist'
                      ? 'bg-white dark:bg-gray-800 text-indigo-700 dark:text-indigo-300 shadow-sm'
                      : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Watchlist News
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {hasError ? (
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg mb-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <InformationCircleIcon className="h-5 w-5 text-red-400 dark:text-red-300" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error loading news</h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                  <p>
                    {(marketNewsError as Error)?.message || (watchlistNewsError as Error)?.message || "Something went wrong. Please try again."}
                  </p>
                </div>
                <div className="mt-4">
                  <div className="-mx-2 -my-1.5 flex">
                    <button
                      onClick={handleRefresh}
                      className="bg-red-50 dark:bg-red-900/40 px-2 py-1.5 rounded-md text-sm font-medium text-red-800 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900 focus:outline-none"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Watchlist News Section - Only render if client-side */}
            {isClient && activeTab === 'all' && (
              <div className="mb-12">
                <div className="flex items-center mb-4">
                  <BookmarkIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mr-2" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Your Watchlist News</h2>
                </div>
                
                <div className="grid grid-cols-1 gap-6">
                  {!isPageLoaded || isWatchlistNewsLoading ? (
                    <NewsSkeletonList count={3} />
                  ) : watchlistNews && watchlistNews.length > 0 ? (
                    watchlistNews.slice(0, 5).map((news, index) => (
                      <NewsCard key={`${news.title}-${index}`} news={news} isWatchlist={true} />
                    ))
                  ) : (
                    <EmptyNewsState type="watchlist" />
                  )}
                  
                  {watchlistNews && watchlistNews.length > 5 && (
                    <div className="text-center mt-4">
                      <button
                        onClick={() => setActiveTab('watchlist')}
                        className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                      >
                        View all watchlist news
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Active Tab Content */}
            <div>
              <div className="flex items-center mb-4">
                {activeTab === 'all' ? (
                  <>
                    <GlobeAltIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mr-2" />
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Market News</h2>
                  </>
                ) : (
                  <>
                    <BookmarkIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mr-2" />
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Watchlist News</h2>
                  </>
                )}
              </div>
              
              <div className="grid grid-cols-1 gap-6">
                {activeTab === 'all' ? (
                  !isPageLoaded || isMarketNewsLoading ? (
                    <NewsSkeletonList count={5} />
                  ) : marketNews && marketNews.length > 0 ? (
                    marketNews.map((news, index) => (
                      <NewsCard key={`${news.title}-${index}`} news={news} />
                    ))
                  ) : (
                    <EmptyNewsState type="market" />
                  )
                ) : (
                  !isPageLoaded || isWatchlistNewsLoading ? (
                    <NewsSkeletonList count={5} />
                  ) : watchlistNews && watchlistNews.length > 0 ? (
                    watchlistNews.map((news, index) => (
                      <NewsCard key={`${news.title}-${index}`} news={news} isWatchlist={true} />
                    ))
                  ) : (
                    <EmptyNewsState type="watchlist" />
                  )
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
} 