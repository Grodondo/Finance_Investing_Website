import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Line } from "react-chartjs-2";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  recommendation?: string;
  recommendation_reason?: string;
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
  recommendation: string;
  recommendationReason: string;
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

type TimeRange = '1D' | '7D' | '30D' | '1Y' | '5Y';
type AuthHeader = { Authorization: string } | null;

const useRecommendations = (authHeader: AuthHeader) => {
  return useQuery({
    queryKey: ['recommendations'],
    queryFn: async () => {
      if (!authHeader) return [];
      const response = await fetch("/api/stocks/recommendations", {
        headers: {
          ...authHeader,
          "Content-Type": "application/json"
        }
      });
      if (!response.ok) throw new Error("Failed to fetch recommendations");
      const data = await response.json() as StockResponse[];
      return data.map((stock: StockResponse) => ({
        symbol: stock.symbol,
        name: stock.name,
        currentPrice: stock.current_price || 0,
        change: stock.change || 0,
        changePercent: stock.change_percent || 0,
        volume: stock.volume || 0,
        marketCap: stock.market_cap || 0,
        historicalData: stock.historical_data?.map(point => ({
          date: point.date,
          price: point.price,
          is_intraday: point.date.includes(' ')
        })) || [],
        recommendation: stock.recommendation || 'N/A',
        recommendationReason: stock.recommendation_reason || 'No reason provided'
      })) as Stock[];
    },
    enabled: !!authHeader,
    staleTime: 30000, // Consider data fresh for 30 seconds
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
      const normalizedWatchlist = watchlistData.map((stock: WatchlistResponse) => ({
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
        normalizedWatchlist.map(async (stock: Watchlist) => {
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

      return watchlistWithHistory as Watchlist[];
    },
    enabled: !!authHeader,
    staleTime: 30000,
  });
};

const getFilteredHistoricalData = (data: Stock['historicalData'] | undefined, range: TimeRange) => {
  if (!data || !Array.isArray(data)) return [];

  const now = new Date();
  const cutoff = new Date(now);
  
  switch (range) {
    case '7D':
      cutoff.setDate(now.getDate() - 7);
      break;
    case '30D':
      cutoff.setDate(now.getDate() - 30);
      break;
    case '1Y':
      cutoff.setFullYear(now.getFullYear() - 1);
      break;
    case '5Y':
      cutoff.setFullYear(now.getFullYear() - 5);
      break;
    default:
      cutoff.setHours(now.getHours() - 24);
  }

  return data.filter(item => {
    const itemDate = new Date(item.date);
    return itemDate >= cutoff && !item.is_intraday;
  });
};

// Move colors array to component scope
const COLORS = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#E57373', '#81C784', '#64B5F6'];

const prepareChartData = (watchlist: Watchlist[] | undefined, selectedStocks: string[], range: TimeRange) => {
  if (!watchlist || watchlist.length === 0 || selectedStocks.length === 0) {
    return { labels: [], datasets: [], options: {} };
  }

  // Get all unique dates from selected stocks
  const allDates = new Set<string>();
  selectedStocks.forEach(symbol => {
    const stock = watchlist.find(s => s.symbol === symbol);
    if (stock?.historicalData) {
      getFilteredHistoricalData(stock.historicalData, range)
        .forEach(item => allDates.add(item.date));
    }
  });

  // Sort dates chronologically
  const sortedDates = Array.from(allDates).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  // Create datasets for each selected stock
  const datasets = selectedStocks.map((symbol, index) => {
    const stock = watchlist.find(s => s.symbol === symbol);
    if (!stock?.historicalData) return null;

    const color = COLORS[index % COLORS.length];
    const priceMap = new Map(
      getFilteredHistoricalData(stock.historicalData, range)
        .map(item => [item.date, item.price])
    );

    const data = sortedDates.map(date => priceMap.get(date) ?? null);

    return {
      label: symbol,
      data,
      borderColor: color,
      backgroundColor: `${color}20`,
      fill: false,
      tension: 0,
      pointRadius: 1,
      pointHoverRadius: 4,
      pointBackgroundColor: color,
      pointBorderColor: color,
      borderWidth: 1,
      spanGaps: true,
      showLine: true
    };
  }).filter(dataset => dataset !== null);

  // Create chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: { 
        display: true, 
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20
        }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (context: any) => {
            const value = context.parsed.y;
            if (value === null) return `${context.dataset.label}: No data`;
            return `${context.dataset.label}: $${value.toFixed(2)}`;
          },
          title: (context: any) => {
            const date = new Date(sortedDates[context[0].dataIndex]);
            return date.toLocaleDateString([], { 
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
          }
        }
      }
    },
    scales: {
      x: { 
        grid: { 
          display: true,
          color: 'rgba(156, 163, 175, 0.1)',
          drawBorder: false
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          autoSkip: true,
          maxTicksLimit: range === '7D' ? 7 : range === '30D' ? 15 : 20,
          font: { size: 10 },
          callback: (value: any, index: number) => {
            const date = new Date(sortedDates[index]);
            if (range === '7D') {
              return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
            } else if (range === '30D') {
              return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
            }
            return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
          }
        }
      },
      y: {
        position: 'right' as const,
        grid: { 
          color: 'rgba(156, 163, 175, 0.1)',
          drawBorder: false
        },
        ticks: { 
          callback: (value: any) => `$${value.toFixed(2)}`,
          font: { size: 10 },
          maxTicksLimit: 10
        }
      }
    }
  };

  return { labels: sortedDates, datasets, options: chartOptions };
};

export default function Recommendations() {
  const { user, getAuthHeader, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedStocks, setSelectedStocks] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('1Y');
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);

  const authHeader = useMemo(() => getAuthHeader() as AuthHeader, [getAuthHeader]);

  // Use React Query hooks
  const { 
    data: recommendations, 
    isLoading: isRecommendationsLoading,
    error: recommendationsError 
  } = useRecommendations(authHeader);

  const { 
    data: watchlist,
    isLoading: isWatchlistLoading,
    error: watchlistError 
  } = useWatchlistWithHistory(authHeader);

  // Add to watchlist mutation
  const addToWatchlistMutation = useMutation({
    mutationFn: async (symbol: string) => {
      if (!authHeader) throw new Error("Not authenticated");
      
      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: {
          ...authHeader,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ symbol })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to add to watchlist");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlistWithHistory'] });
    }
  });

  // Memoize chart data
  const chartData = useMemo(() => {
    if (!watchlist) return { labels: [], datasets: [], options: {} };
    return prepareChartData(watchlist, selectedStocks, timeRange);
  }, [watchlist, selectedStocks, timeRange]);

  // Handle stock selection
  const handleStockSelect = useCallback((symbol: string) => {
    const stock = recommendations?.find(s => s.symbol === symbol) || null;
    setSelectedStock(stock);
  }, [recommendations]);

  // Handle add to watchlist
  const handleAddToWatchlist = useCallback((symbol: string) => {
    addToWatchlistMutation.mutate(symbol);
  }, [addToWatchlistMutation]);

  // Update selected stocks when watchlist changes
  useEffect(() => {
    if (watchlist) {
      setSelectedStocks(watchlist.map(stock => stock.symbol));
    }
  }, [watchlist]);

  // Handle authentication
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  const isLoading = isRecommendationsLoading || isWatchlistLoading;
  const error = recommendationsError || watchlistError;

  if (isLoading) return (
    <div className="min-h-screen pt-16 bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen pt-16 bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
      <div className="bg-white dark:bg-dark-surface p-8 rounded-lg shadow-md max-w-md w-full">
        <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Error</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          {error instanceof Error ? error.message : "An error occurred"}
        </p>
        <button onClick={() => window.location.reload()} className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700">
          Try Again
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-text mb-8">Stock Recommendations and Watchlist</h1>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12">
            {/* Watchlist - Now appears first */}
            <div className="bg-white dark:bg-dark-surface rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text mb-6">Your Watchlist</h2>
              {watchlist && watchlist.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {watchlist.map((stock, index) => (
                    <div key={stock.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                        <input
                          type="checkbox"
                          checked={selectedStocks.includes(stock.symbol)}
                          onChange={() => setSelectedStocks(prev =>
                            prev.includes(stock.symbol) ? prev.filter(s => s !== stock.symbol) : [...prev, stock.symbol]
                          )}
                          className="cursor-pointer"
                        />
                        <div onClick={() => handleStockSelect(stock.symbol)} className="cursor-pointer flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-dark-text">{stock.symbol}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{stock.name}</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-medium text-gray-900 dark:text-dark-text">${stock.currentPrice.toFixed(2)}</p>
                        <p className={`text-xs ${stock.change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No stocks in watchlist. Add from recommendations above.</p>
              )}
            </div>

            {/* Price History Graph - Now appears second */}
            <div className="bg-white dark:bg-dark-surface rounded-lg shadow-md p-6 mb-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text">Watchlist Price History</h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setTimeRange('7D')}
                    className={`px-3 py-1 rounded-md text-sm font-medium ${
                      timeRange === '7D'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    7D
                  </button>
                  <button
                    onClick={() => setTimeRange('30D')}
                    className={`px-3 py-1 rounded-md text-sm font-medium ${
                      timeRange === '30D'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    30D
                  </button>
                  <button
                    onClick={() => setTimeRange('1Y')}
                    className={`px-3 py-1 rounded-md text-sm font-medium ${
                      timeRange === '1Y'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    1Y
                  </button>
                  <button
                    onClick={() => setTimeRange('5Y')}
                    className={`px-3 py-1 rounded-md text-sm font-medium ${
                      timeRange === '5Y'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    5Y
                  </button>
                </div>
              </div>
              {watchlist && watchlist.length > 0 && selectedStocks.length > 0 ? (
                <div className="h-[500px]">
                  <Line
                    data={chartData}
                    options={chartData.options}
                  />
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">Select stocks from your watchlist to view price history.</p>
              )}
            </div>

            {/* Top Recommendations - Now appears last */}
            <div className="bg-white dark:bg-dark-surface rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text mb-6">Top 5 Recommended Stocks This Week</h2>
              {recommendations && recommendations.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {recommendations.slice(0, 5).map((stock, index) => (
                    <div key={stock.symbol} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-lg font-medium text-indigo-600 dark:text-indigo-400">#{index + 1}</span>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-dark-text">{stock.symbol}</h3>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{stock.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{stock.recommendationReason}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-gray-900 dark:text-dark-text">${stock.currentPrice.toFixed(2)}</p>
                          <p className={`text-sm ${stock.change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAddToWatchlist(stock.symbol); }}
                        className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 transition-colors"
                      >
                        Add to Watchlist
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No recommendations available at the moment.</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}