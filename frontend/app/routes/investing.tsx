import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Line } from "react-chartjs-2";
import { useQuery, useQueryClient, useMutation, UseQueryOptions } from "@tanstack/react-query";
import debounce from "lodash/debounce";
import type { DebouncedFunc } from "lodash";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface Stock {
  symbol: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  historicalData: {
    date: string;
    price: number;
    is_intraday: boolean;
  }[];
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

interface Portfolio {
  totalValue: number;
  dailyChange: number;
  dailyChangePercent: number;
  holdings: {
    symbol: string;
    shares: number;
    averagePrice: number;
    currentPrice: number;
    totalValue: number;
    gainLoss: number;
    gainLossPercent: number;
  }[];
}

interface WatchlistResponse {
  id: number;
  symbol: string;
  name: string;
  current_price: number;
  change: number;
  change_percent: number;
  volume: number;
  market_cap: number;
  shares_owned: number;
  total_value: number;
}

interface StockResponse {
  symbol: string;
  name: string;
  current_price: number;
  change: number;
  change_percent: number;
  volume: number;
  market_cap: number;
  historical_data?: {
    date: string;
    price: number;
  }[];
}

interface Watchlist {
  id: number;
  symbol: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  sharesOwned: number;
  totalValue: number;
  historicalData: {
    date: string;
    price: number;
    is_intraday: boolean;
  }[];
}

interface SearchResult {
  symbol: string;
  name: string;
}

// Update the TimeRange type
type TimeRange = '1D' | '7D' | '30D' | '1Y';

// Add type for auth header
type AuthHeader = { Authorization: string } | null;

// Update the custom hooks with proper types
const useStockData = (symbol: string | null, authHeader: AuthHeader) => {
  return useQuery({
    queryKey: ['stock', symbol],
    queryFn: async () => {
      if (!symbol || !authHeader) return null;
      const response = await fetch(`/api/stocks/${symbol}`, {
        headers: {
          ...authHeader,
          "Content-Type": "application/json"
        }
      });
      if (!response.ok) throw new Error("Failed to fetch stock data");
      const data = await response.json();
      return {
        symbol: data.symbol,
        name: data.name,
        currentPrice: data.current_price,
        change: data.change,
        changePercent: data.change_percent,
        volume: data.volume,
        marketCap: data.market_cap,
        historicalData: data.historical_data?.map((point: any) => ({
          date: point.date,
          price: point.price,
          is_intraday: point.date.includes(' ')
        })) || [],
        fiftyTwoWeekHigh: data.fifty_two_week_high,
        fiftyTwoWeekLow: data.fifty_two_week_low
      } as Stock;
    },
    enabled: !!symbol && !!authHeader,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
};

const useWatchlistWithHistory = (authHeader: AuthHeader) => {
  return useQuery({
    queryKey: ['watchlistWithHistory'],
    queryFn: async () => {
      if (!authHeader) return [];
      
      // Fetch watchlist
      const watchlistResponse = await fetch("/api/watchlist", {
        headers: {
          ...authHeader,
          "Content-Type": "application/json"
        }
      });
      
      if (!watchlistResponse.ok) throw new Error("Failed to fetch watchlist");
      const watchlistData = await watchlistResponse.json() as WatchlistResponse[];
      
      // Normalize watchlist data
      const normalizedWatchlist = watchlistData.map((stock: WatchlistResponse): Watchlist => ({
        id: stock.id,
        symbol: stock.symbol,
        name: stock.name,
        currentPrice: stock.current_price || 0,
        change: stock.change || 0,
        changePercent: stock.change_percent || 0,
        volume: stock.volume || 0,
        marketCap: stock.market_cap || 0,
        sharesOwned: stock.shares_owned || 0,
        totalValue: stock.total_value || 0,
        historicalData: []
      }));

      // Fetch historical data for each stock in parallel
      const watchlistWithHistory = await Promise.all(
        normalizedWatchlist.map(async (stock: Watchlist): Promise<Watchlist> => {
          try {
            const response = await fetch(`/api/stocks/${stock.symbol}`, {
              headers: {
                ...authHeader,
                "Content-Type": "application/json"
              }
            });
            if (response.ok) {
              const stockData = await response.json() as StockResponse;
              return {
                ...stock,
                currentPrice: stockData.current_price || stock.currentPrice,
                change: stockData.change || stock.change,
                changePercent: stockData.change_percent || stock.changePercent,
                volume: stockData.volume || stock.volume,
                marketCap: stockData.market_cap || stock.marketCap,
                historicalData: stockData.historical_data?.map(point => ({
                  date: point.date,
                  price: point.price,
                  is_intraday: point.date.includes(' ')
                })) || []
              };
            }
            return stock;
          } catch {
            return stock;
          }
        })
      );
      
      return watchlistWithHistory;
    },
    enabled: !!authHeader,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
};

const usePortfolio = (authHeader: AuthHeader) => {
  return useQuery({
    queryKey: ['portfolio'],
    queryFn: async () => {
      if (!authHeader) return null;
      const response = await fetch("/api/portfolio", {
        headers: {
          ...authHeader,
          "Content-Type": "application/json"
        }
      });
      if (!response.ok) throw new Error("Failed to fetch portfolio data");
      return response.json() as Promise<Portfolio>;
    },
    enabled: !!authHeader,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
};

// Move chart data preparation functions outside component
const getFilteredHistoricalData = (data: Stock['historicalData'] | undefined, range: TimeRange) => {
  if (!data || !Array.isArray(data)) {
    return [];
  }

  const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const now = new Date();
  const ranges = {
    '1D': 1,
    '7D': 7,
    '30D': 30,
    '1Y': 365
  };
  const days = ranges[range];
  
  const cutoff = new Date(now);
  if (range === '1D') {
    cutoff.setHours(now.getHours() - 24);
  } else {
    cutoff.setDate(now.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);
  }
  
  const dailyData = sortedData.filter(item => item.is_intraday === false);
  const intradayData = sortedData.filter(item => item.is_intraday === true);
  
  let filtered: typeof data = [];
  
  if (range === '1D') {
    filtered = intradayData.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate >= cutoff;
    });
  } else {
    filtered = dailyData.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate >= cutoff;
    });
  }
  
  return filtered;
};

const prepareChartData = (data: Stock['historicalData'] | undefined, range: TimeRange) => {
  const filteredData = getFilteredHistoricalData(data, range);
  
  if (filteredData.length === 0) {
    return {
      labels: [],
      datasets: [{
        label: 'Price',
        data: [],
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2,
      }]
    };
  }
  
  // Store the raw dates to use for tooltips
  const rawDates = filteredData.map(item => new Date(item.date));
  
  return {
    labels: filteredData.map((item, index) => {
      const date = rawDates[index];
      if (range === '1D') {
        return date.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false
        });
      } else if (range === '1Y') {
        return date.toLocaleDateString([], { 
          month: 'short', 
          year: '2-digit'
        });
      } else {
        return date.toLocaleDateString([], { 
          month: 'short', 
          day: 'numeric' 
        });
      }
    }),
    datasets: [
      {
        label: 'Price',
        data: filteredData.map(item => item.price),
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: range === '1D' ? 2 : 0,
        borderWidth: 2,
      }
    ],
    // Store the raw dates as metadata for tooltips
    rawDates: rawDates
  };
};

// Add skeleton loaders for different components
const StockChartSkeleton = () => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
    <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
    <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
    <div className="flex justify-center mt-4 space-x-2">
      {['1D', '7D', '30D', '1Y'].map((range) => (
        <div key={range} className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
      ))}
    </div>
  </div>
);

const StockInfoSkeleton = () => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
    <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
    <div className="grid grid-cols-2 gap-4">
      <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
      <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
      <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
      <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
      <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
      <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
    </div>
  </div>
);

const WatchlistSkeleton = () => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
    <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
    {Array.from({ length: 5 }).map((_, index) => (
      <div key={index} className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          <div className="ml-3">
            <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mt-1"></div>
          </div>
        </div>
        <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    ))}
  </div>
);

const PortfolioSkeleton = () => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
    <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
    <div className="grid grid-cols-3 gap-4 mb-4">
      <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
      <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
      <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
    </div>
    <div className="h-1 w-full bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
    {Array.from({ length: 3 }).map((_, index) => (
      <div key={index} className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
        <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    ))}
  </div>
);

export default function Investing() {
  const { user, logout, getAuthHeader, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedStockSymbol, setSelectedStockSymbol] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30D');
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY');
  const [orderQuantity, setOrderQuantity] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [componentError, setComponentError] = useState<string | null>(null);
  const [pageLoaded, setPageLoaded] = useState(false);

  const authHeader = useMemo(() => getAuthHeader() as AuthHeader, [getAuthHeader]);

  // Use React Query hooks with proper types
  const { data: portfolio, isLoading: isPortfolioLoading, error: portfolioError } = usePortfolio(authHeader);
  const { data: watchlist, isLoading: isWatchlistLoading, error: watchlistError } = useWatchlistWithHistory(authHeader);
  const { 
    data: selectedStock, 
    isLoading: isStockLoading, 
    error: stockError 
  } = useStockData(selectedStockSymbol, authHeader);

  // Memoize chart options
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (context: any) => `$${context.parsed.y.toFixed(2)}`,
          title: (context: any) => {
            // Use the rawDates provided in the chart data instead of parsing the label
            const chart = context[0].chart;
            const dataIndex = context[0].dataIndex;
            const rawDates = chart.data.rawDates || [];
            
            // If we have a valid date from rawDates, use it
            if (rawDates[dataIndex]) {
              const date = rawDates[dataIndex];
              if (timeRange === '1D') {
                return date.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true 
                });
              } else if (timeRange === '1Y') {
                return date.toLocaleDateString([], { 
                  month: 'long', 
                  day: 'numeric',
                  year: 'numeric'
                });
              }
              return date.toLocaleDateString([], { 
                month: 'long', 
                day: 'numeric',
                year: 'numeric'
              });
            }
            
            // Fallback to label if rawDates is not available
            return context[0].label;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: timeRange === '1D' ? 12 : timeRange === '1Y' ? 12 : 6,
          callback: (value: any, index: number, values: any[]) => {
            if (timeRange === '1D') {
              return index % 2 === 0 ? value : '';
            } else if (timeRange === '1Y') {
              return index % 3 === 0 ? value : '';
            }
            return value;
          }
        }
      },
      y: {
        position: 'right' as const,
        grid: {
          color: 'rgba(156, 163, 175, 0.1)'
        },
        ticks: {
          callback: (value: any) => `$${value.toFixed(2)}`
        }
      }
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false
    }
  }), [timeRange]);

  // Memoize the debounced search function with proper type
  const debouncedSearch = useMemo(
    () => debounce(async (query: string) => {
      if (query.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        if (!authHeader) {
          navigate("/login");
          return;
        }

        const response = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`, {
          headers: {
            ...authHeader,
            "Content-Type": "application/json"
          }
        });

        if (response.status === 401) {
          await logout();
          navigate("/login");
          return;
        }

        if (!response.ok) throw new Error("Failed to search stocks");
        const data = await response.json();
        setSearchResults(data);
      } catch (error) {
        console.error("Error searching stocks:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300) as DebouncedFunc<(query: string) => Promise<void>>,
    [authHeader, navigate, logout]
  );

  // Memoize chart data preparation
  const chartData = useMemo(() => {
    if (!selectedStock?.historicalData) return null;
    return prepareChartData(selectedStock.historicalData, timeRange);
  }, [selectedStock?.historicalData, timeRange]);

  // Memoize filtered historical data
  const filteredHistoricalData = useMemo(() => {
    if (!selectedStock?.historicalData) return [];
    return getFilteredHistoricalData(selectedStock.historicalData, timeRange);
  }, [selectedStock?.historicalData, timeRange]);

  // Add to watchlist mutation
  const addToWatchlistMutation = useMutation({
    mutationFn: async (symbol: string) => {
      if (!authHeader) throw new Error("Not authenticated");
      
      const stockResponse = await fetch(`/api/stocks/${symbol}`, {
        headers: {
          ...authHeader,
          "Content-Type": "application/json"
        }
      });

      if (!stockResponse.ok) throw new Error("Failed to fetch stock data");
      const stockData = await stockResponse.json();

      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: {
          ...authHeader,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ stock_id: stockData.id })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to add to watchlist");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      setSearchQuery("");
      setSearchResults([]);
    },
    onError: (error) => {
      setComponentError(error instanceof Error ? error.message : "Failed to add stock to watchlist");
    }
  });

  // Remove from watchlist mutation
  const removeFromWatchlistMutation = useMutation({
    mutationFn: async (stockId: number) => {
      if (!authHeader) throw new Error("Not authenticated");
      
      const response = await fetch(`/api/watchlist/${stockId}`, {
        method: "DELETE",
        headers: {
          ...authHeader,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to remove from watchlist");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    }
  });

  // Add order mutation
  const orderMutation = useMutation({
    mutationFn: async (orderData: { symbol: string; type: 'BUY' | 'SELL'; quantity: number; price: number }) => {
      if (!authHeader) throw new Error("Not authenticated");
      
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          ...authHeader,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(orderData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to place order");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      setOrderQuantity(0);
      setOrderType('BUY');
    },
    onError: (error: Error) => {
      setOrderError(error.message);
    }
  });

  // Handle search input change
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    debouncedSearch(query);
  }, [debouncedSearch]);

  // Handle stock selection
  const handleStockSelect = useCallback((symbol: string) => {
    setSelectedStockSymbol(symbol);
  }, []);

  // Handle add to watchlist
  const handleAddToWatchlist = useCallback((symbol: string) => {
    addToWatchlistMutation.mutate(symbol);
  }, [addToWatchlistMutation]);

  // Handle remove from watchlist
  const handleRemoveFromWatchlist = useCallback((stockId: number) => {
    removeFromWatchlistMutation.mutate(stockId);
  }, [removeFromWatchlistMutation]);

  // Add handleOrderSubmit function
  const handleOrderSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStock || orderQuantity <= 0) return;

    setIsPlacingOrder(true);
    setOrderError(null);

    try {
      await orderMutation.mutateAsync({
        symbol: selectedStock.symbol,
        type: orderType,
        quantity: orderQuantity,
        price: selectedStock.currentPrice
      });
    } catch (error) {
      // Error is handled by mutation
    } finally {
      setIsPlacingOrder(false);
    }
  }, [selectedStock, orderType, orderQuantity, orderMutation]);

  // Update loading and error states
  const isLoading = isPortfolioLoading || isWatchlistLoading;
  const queryError = portfolioError || watchlistError || stockError;

  // Add isInWatchlist helper function
  const isInWatchlist = useCallback((symbol: string) => {
    return watchlist?.some(stock => stock.symbol === symbol) ?? false;
  }, [watchlist]);

  // Handle errors
  useEffect(() => {
    if (queryError instanceof Error) {
      setComponentError(queryError.message);
    } else if (typeof queryError === 'string') {
      setComponentError(queryError);
    } else if (queryError) {
      setComponentError('An error occurred while fetching data');
    } else {
      setComponentError(null);
    }
  }, [queryError]);

  // Mark page as loaded after initial render
  useEffect(() => {
    // Short delay to prioritize initial render
    const timeoutId = setTimeout(() => {
      setPageLoaded(true);
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  if (isLoading) return (
    <div className="min-h-screen pt-16 bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
    </div>
  );

  if (componentError) return (
    <div className="min-h-screen pt-16 bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
      <div className="bg-white dark:bg-dark-surface p-8 rounded-lg shadow-md max-w-md w-full">
        <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Error</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">{componentError}</p>
        <button onClick={() => window.location.reload()} className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700">Try Again</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        <div className="grid grid-cols-12 gap-6">
          {/* Portfolio Overview */}
          <div className="col-span-12 lg:col-span-8">
            <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-6">Portfolio Overview</h2>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
                </div>
              ) : portfolio ? (
                <div className="space-y-4">
                  <div className="flex items-baseline space-x-4">
                    <span className="text-3xl font-bold text-gray-900 dark:text-dark-text">
                      ${portfolio.totalValue?.toLocaleString() ?? '0.00'}
                    </span>
                    <span className={`text-lg font-medium ${
                      (portfolio.dailyChange ?? 0) >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {(portfolio.dailyChange ?? 0) >= 0 ? '+' : ''}{(portfolio.dailyChange ?? 0).toFixed(2)} ({(portfolio.dailyChangePercent ?? 0).toFixed(2)}%)
                    </span>
                  </div>
                  <div className="mt-6">
                    <h3 className="text-md font-medium text-gray-900 dark:text-dark-text mb-4">Your Holdings</h3>
                    {portfolio.holdings?.length > 0 ? (
                      <div className="space-y-4">
                        {portfolio.holdings.map((holding) => (
                          <div
                            key={holding.symbol}
                            className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                            onClick={() => handleStockSelect(holding.symbol)}
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-dark-text">{holding.symbol}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{holding.shares} shares @ ${holding.averagePrice?.toFixed(2) ?? '0.00'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-900 dark:text-dark-text">
                                ${holding.totalValue?.toFixed(2) ?? '0.00'}
                              </p>
                              <p className={`text-xs ${
                                (holding.gainLoss ?? 0) >= 0
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}>
                                {(holding.gainLoss ?? 0) >= 0 ? '+' : ''}{(holding.gainLoss ?? 0).toFixed(2)} ({(holding.gainLossPercent ?? 0).toFixed(2)}%)
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-sm">No holdings yet.</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">Unable to load portfolio data. Please try again later.</p>
              )}
            </div>

            {/* Stock Search */}
            <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-4">Search Stocks</h2>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search by symbol or company name..."
                  className="w-full px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface text-gray-900 dark:text-dark-text focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent"
                />
                {isSearching && (
                  <div className="absolute right-3 top-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
                  </div>
                )}
                {searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-dark-surface rounded-md shadow-lg border border-gray-200 dark:border-gray-700">
                    {searchResults.map((result) => (
                      <div
                        key={result.symbol}
                        className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        onClick={() => {
                          handleStockSelect(result.symbol);
                          setSearchQuery("");
                          setSearchResults([]);
                        }}
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-dark-text">{result.symbol}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{result.name}</p>
                        </div>
                        {isInWatchlist(result.symbol) ? (
                          <span className="px-3 py-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                            In Watchlist
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToWatchlist(result.symbol);
                            }}
                            className="px-3 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                          >
                            Add to Watchlist
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Stock Details */}
            {selectedStock && (
              <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6">
                {/* Header Section */}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text">{selectedStock.symbol}</h2>
                      <span className="text-lg text-gray-600 dark:text-gray-400">{selectedStock.name}</span>
                    </div>
                    <div className="flex items-baseline space-x-4 mt-2">
                      <span className="text-3xl font-bold text-gray-900 dark:text-dark-text">
                        ${selectedStock.currentPrice?.toFixed(2) ?? '0.00'}
                      </span>
                      <span className={`text-xl font-medium ${
                        (selectedStock.change ?? 0) >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {(selectedStock.change ?? 0) >= 0 ? '+' : ''}{(selectedStock.change ?? 0).toFixed(2)} ({(selectedStock.changePercent ?? 0).toFixed(2)}%)
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} EDT
                      </span>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    {isInWatchlist(selectedStock.symbol) ? (
                      <span className="px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-md">
                        In Watchlist
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAddToWatchlist(selectedStock.symbol)}
                        className="px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md"
                      >
                        Add to Watchlist
                      </button>
                    )}
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Market Cap</p>
                    <p className="text-lg font-medium text-gray-900 dark:text-dark-text">
                      ${(selectedStock.marketCap / 1e9).toFixed(2)}B
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Volume</p>
                    <p className="text-lg font-medium text-gray-900 dark:text-dark-text">
                      {selectedStock.volume?.toLocaleString() ?? '0'}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <p className="text-sm text-gray-500 dark:text-gray-400">52 Week Range</p>
                    <p className="text-lg font-medium text-gray-900 dark:text-dark-text">
                      ${selectedStock.fiftyTwoWeekLow?.toFixed(2) ?? 'N/A'} - ${selectedStock.fiftyTwoWeekHigh?.toFixed(2) ?? 'N/A'}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Day Range</p>
                    <p className="text-lg font-medium text-gray-900 dark:text-dark-text">
                      {selectedStock.historicalData && selectedStock.historicalData.length > 0 ? (
                        <>
                          ${Math.min(...selectedStock.historicalData.map(d => d.price)).toFixed(2)} - 
                          ${Math.max(...selectedStock.historicalData.map(d => d.price)).toFixed(2)}
                        </>
                      ) : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Chart Section */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center space-x-4">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text">Price History</h3>
                      <div className="flex space-x-2">
                        {(['1D', '7D', '30D', '1Y'] as TimeRange[]).map((range) => (
                          <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                              timeRange === range
                                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                          >
                            {range}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {timeRange === '1D' ? 'Intraday' : timeRange === '1Y' ? '1 Year' : 'Daily'} data
                    </div>
                  </div>
                  <div className="h-96 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    {selectedStock?.historicalData && selectedStock.historicalData.length > 0 ? (
                      <Line
                        data={prepareChartData(selectedStock.historicalData, timeRange)}
                        options={{
                          ...chartOptions,
                          plugins: {
                            ...chartOptions.plugins,
                            tooltip: {
                              ...chartOptions.plugins.tooltip,
                              backgroundColor: 'rgba(255, 255, 255, 0.9)',
                              titleColor: '#000',
                              bodyColor: '#000',
                              borderColor: '#e5e7eb',
                              borderWidth: 1,
                              padding: 12,
                              displayColors: false,
                              callbacks: {
                                ...chartOptions.plugins.tooltip.callbacks,
                                label: (context: any) => {
                                  const value = context.parsed.y;
                                  const change = value - selectedStock.historicalData[0].price;
                                  const changePercent = (change / selectedStock.historicalData[0].price) * 100;
                                  return [
                                    `$${value.toFixed(2)}`,
                                    `${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePercent.toFixed(2)}%)`
                                  ];
                                }
                              }
                            }
                          }
                        }}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                        {selectedStock?.historicalData ? 'No historical data available' : 'Loading historical data...'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Stats Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-4">Statistics</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Previous Close</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-dark-text">
                          ${selectedStock.historicalData?.[0]?.price.toFixed(2) ?? 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Open</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-dark-text">
                          ${selectedStock.historicalData?.[0]?.price.toFixed(2) ?? 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Day's Range</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-dark-text">
                          {selectedStock.historicalData && selectedStock.historicalData.length > 0 ? (
                            <>
                              ${Math.min(...selectedStock.historicalData.map(d => d.price)).toFixed(2)} - 
                              ${Math.max(...selectedStock.historicalData.map(d => d.price)).toFixed(2)}
                            </>
                          ) : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">52 Week Range</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-dark-text">
                          ${selectedStock.fiftyTwoWeekLow?.toFixed(2) ?? 'N/A'} - ${selectedStock.fiftyTwoWeekHigh?.toFixed(2) ?? 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-4">Trading Information</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Volume</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-dark-text">
                          {selectedStock.volume?.toLocaleString() ?? 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Market Cap</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-dark-text">
                          ${(selectedStock.marketCap / 1e9).toFixed(2)}B
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Avg. Volume (30d)</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-dark-text">
                          {selectedStock.volume?.toLocaleString() ?? 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Beta (5Y Monthly)</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-dark-text">N/A</span>
                      </div>
                    </div>
                  </div>
                </div>

                {stockError && (
                  <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">{stockError.message}</p>
                  </div>
                )}
                {isStockLoading && (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
                  </div>
                )}
              </div>
            )}

            {/* Trading Form */}
            {selectedStock && (
              <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 mt-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-text mb-6">Trade {selectedStock.symbol}</h2>
                <form onSubmit={handleOrderSubmit} className="space-y-6">
                  <div className="flex space-x-4">
                    <button
                      type="button"
                      onClick={() => setOrderType('BUY')}
                      className={`flex-1 py-3 px-4 rounded-md text-base font-medium transition-colors ${
                        orderType === 'BUY'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-2 border-green-500 dark:border-green-600'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      Buy
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderType('SELL')}
                      className={`flex-1 py-3 px-4 rounded-md text-base font-medium transition-colors ${
                        orderType === 'SELL'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-2 border-red-500 dark:border-red-600'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      Sell
                    </button>
                  </div>
                  
                  {/* Enhanced Quantity Input */}
                  <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700">
                    <label htmlFor="quantity" className="block text-base font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Quantity of shares
                    </label>
                    
                    {/* Quick quantity buttons */}
                    <div className="flex space-x-2 mb-3">
                      {[1, 5, 10, 25, 100].map(qty => (
                        <button
                          key={qty}
                          type="button"
                          onClick={() => setOrderQuantity(qty)}
                          className={`py-1 px-3 rounded-md text-xs font-medium border ${
                            orderQuantity === qty 
                              ? orderType === 'BUY'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-500 dark:border-green-600'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-500 dark:border-red-600'
                              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                          }`}
                        >
                          {qty}
                        </button>
                      ))}
                    </div>
                    
                    <div className="relative rounded-md shadow-sm">
                      <input
                        type="number"
                        id="quantity"
                        min="0.01"
                        step="0.01"
                        value={orderQuantity}
                        onChange={(e) => setOrderQuantity(Number(e.target.value))}
                        className={`block w-full py-3 px-4 text-xl font-medium rounded-md border ${
                          orderType === 'BUY'
                            ? 'border-green-500 dark:border-green-600 focus:border-green-500 focus:ring-green-500'
                            : 'border-red-500 dark:border-red-600 focus:border-red-500 focus:ring-red-500'
                        } shadow-sm focus:ring-2 dark:bg-dark-surface dark:text-dark-text`}
                        placeholder="0.00"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 dark:text-gray-400 text-base font-medium">shares</span>
                      </div>
                    </div>
                    
                    {/* Order value preview */}
                    <div className="mt-3 p-3 bg-white dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Current price</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">${selectedStock?.currentPrice?.toFixed(2) ?? '0.00'}</span>
                      </div>
                      <div className="flex justify-between items-center mt-2 text-base font-semibold">
                        <span className={orderType === 'BUY' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
                          Total {orderType === 'BUY' ? 'cost' : 'value'}
                        </span>
                        <span className={`text-lg ${orderType === 'BUY' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                          ${(orderQuantity * (selectedStock?.currentPrice || 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {orderError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
                      <p className="text-sm text-red-600 dark:text-red-400">{orderError}</p>
                    </div>
                  )}
                  
                  <button
                    type="submit"
                    disabled={isPlacingOrder || orderQuantity <= 0}
                    className={`w-full py-3 px-4 rounded-md text-base font-medium text-white ${
                      orderType === 'BUY'
                        ? 'bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-400'
                        : 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400'
                    } disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                  >
                    {isPlacingOrder ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Processing...
                      </div>
                    ) : (
                      `${orderType} ${orderQuantity > 0 ? orderQuantity : ''} ${orderQuantity === 1 ? 'share' : 'shares'} of ${selectedStock.symbol}`
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* Watchlist */}
            <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-4">Watchlist</h2>
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
                </div>
              ) : watchlist && watchlist.length > 0 ? (
                <div className="space-y-4">
                  {watchlist.map((stock) => (
                    <div
                      key={stock.id}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => handleStockSelect(stock.symbol)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-dark-text">{stock.symbol}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{stock.name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900 dark:text-dark-text">
                              ${stock.currentPrice?.toFixed(2) ?? '0.00'}
                            </p>
                            <p className={`text-xs ${
                              (stock.change ?? 0) >= 0
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {(stock.change ?? 0) >= 0 ? '+' : ''}{(stock.change ?? 0).toFixed(2)} ({(stock.changePercent ?? 0).toFixed(2)}%)
                            </p>
                          </div>
                        </div>
                        {stock.sharesOwned > 0 && (
                          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            <p>Owned: {stock.sharesOwned.toFixed(2)} shares (${(stock.sharesOwned * stock.currentPrice).toFixed(2)})</p>
                          </div>
                        )}
                        <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <p>Volume: {stock.volume?.toLocaleString() ?? '0'}</p>
                          <p>Market Cap: ${(stock.marketCap / 1e9).toFixed(2)}B</p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFromWatchlist(stock.id);
                        }}
                        className="ml-4 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No stocks in watchlist. Use the search above to add stocks.</p>
              )}
            </div>

            {/* Note about stock data */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-400 mb-2">Note</h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Stock data is fetched on-demand when you click on a stock. Due to API rate limits, 
                there may be a short delay between requests. Please be patient while the data loads.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 