import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Line } from "react-chartjs-2";
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
}

interface SearchResult {
  symbol: string;
  name: string;
}

// Update the TimeRange type
type TimeRange = '1D' | '7D' | '30D' | '1Y';

export default function Investing() {
  const { user, logout, getAuthHeader, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [watchlist, setWatchlist] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stockError, setStockError] = useState<string | null>(null);
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('30D');
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY');
  const [orderQuantity, setOrderQuantity] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    const fetchData = async () => {
      try {
        const authHeader = getAuthHeader();
        if (!authHeader) {
          throw new Error("Not authenticated");
        }

        // Fetch portfolio data
        const portfolioResponse = await fetch("/api/portfolio", {
          headers: {
            ...authHeader,
            "Content-Type": "application/json"
          }
        });

        if (!portfolioResponse.ok) {
          throw new Error("Failed to fetch portfolio data");
        }

        const portfolioData = await portfolioResponse.json();
        setPortfolio(portfolioData);

        // Fetch watchlist
        const watchlistResponse = await fetch("/api/watchlist", {
          headers: {
            ...authHeader,
            "Content-Type": "application/json"
          }
        });

        if (!watchlistResponse.ok) {
          throw new Error("Failed to fetch watchlist");
        }

        const watchlistData = await watchlistResponse.json();
        setWatchlist(watchlistData);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError(error instanceof Error ? error.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [getAuthHeader, isAuthenticated, navigate]);

  const fetchStockData = async (symbol: string, retryCount = 0) => {
    try {
      setIsLoadingStock(true);
      setStockError(null);

      const authHeader = getAuthHeader();
      if (!authHeader) return;

      const response = await fetch(`/api/stocks/${symbol}`, {
        headers: {
          ...authHeader,
          "Content-Type": "application/json"
        }
      });

      if (response.status === 429) {
        const data = await response.json();
        // Extract retry time from error message
        const retryMatch = data.detail?.match(/try again in (\d+) seconds/);
        const retrySeconds = retryMatch ? parseInt(retryMatch[1]) : 30;
        
        if (retryCount < 3) {  // Max 3 retries
          console.log(`Rate limited, retrying in ${retrySeconds} seconds (attempt ${retryCount + 1}/3)`);
          setTimeout(() => fetchStockData(symbol, retryCount + 1), retrySeconds * 1000);
          setStockError(`Rate limited. Retrying in ${retrySeconds} seconds...`);
        } else {
          setStockError("Unable to fetch stock data due to rate limits. Please try again later.");
        }
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch stock data");
      }

      const stockData = await response.json();
      console.log('Raw API response:', stockData);

      // Map snake_case to camelCase
      const normalizedStockData = {
        symbol: stockData.symbol,
        name: stockData.name,
        currentPrice: stockData.current_price,
        change: stockData.change,
        changePercent: stockData.change_percent,
        volume: stockData.volume,
        marketCap: stockData.market_cap,
        historicalData: stockData.historical_data?.map((point: any) => {
          const hasTimeComponent = point.date.includes(' ');
          return {
            date: point.date,
            price: point.price,
            is_intraday: hasTimeComponent
          };
        }) || [],
        fiftyTwoWeekHigh: stockData.fifty_two_week_high,
        fiftyTwoWeekLow: stockData.fifty_two_week_low
      };

      // Update the watchlist with the new stock data
      setWatchlist(prevWatchlist => 
        prevWatchlist.map(stock => 
          stock.symbol === symbol
            ? {
                ...stock,
                currentPrice: normalizedStockData.currentPrice,
                change: normalizedStockData.change,
                changePercent: normalizedStockData.changePercent,
                volume: normalizedStockData.volume,
                marketCap: normalizedStockData.marketCap
              }
            : stock
        )
      );

      setSelectedStock(normalizedStockData);
      setStockError(null);
    } catch (error) {
      console.error("Error fetching stock data:", error);
      if (error instanceof Error && !error.message.includes("Rate limited")) {
        setStockError("Failed to fetch stock data. Please try again later.");
      }
    } finally {
      setIsLoadingStock(false);
    }
  };

  // Add a function to refresh watchlist data periodically
  useEffect(() => {
    if (!isAuthenticated || !watchlist.length) return;

    const refreshWatchlistData = async () => {
      try {
        const authHeader = getAuthHeader();
        if (!authHeader) return;

        // Fetch fresh data for each stock in the watchlist
        const updatedWatchlist = await Promise.all(
          watchlist.map(async (stock) => {
            try {
              const response = await fetch(`/api/stocks/${stock.symbol}`, {
                headers: {
                  ...authHeader,
                  "Content-Type": "application/json"
                }
              });

              if (!response.ok) {
                console.error(`Failed to fetch data for ${stock.symbol}`);
                return stock; // Return existing data if fetch fails
              }

              const stockData = await response.json();
              return {
                ...stock,
                currentPrice: stockData.current_price,
                change: stockData.change,
                changePercent: stockData.change_percent,
                volume: stockData.volume,
                marketCap: stockData.market_cap
              };
            } catch (error) {
              console.error(`Error fetching data for ${stock.symbol}:`, error);
              return stock; // Return existing data if fetch fails
            }
          })
        );

        setWatchlist(updatedWatchlist);
      } catch (error) {
        console.error("Error refreshing watchlist:", error);
      }
    };

    // Refresh data every 30 seconds
    const intervalId = setInterval(refreshWatchlistData, 30000);

    // Initial refresh
    refreshWatchlistData();

    return () => clearInterval(intervalId);
  }, [isAuthenticated, watchlist.length, getAuthHeader]);

  const handleStockSelect = (symbol: string) => {
    fetchStockData(symbol);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const authHeader = getAuthHeader();
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
        // Token expired or invalid
        await logout();
        navigate("/login");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to search stocks");
      }

      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error("Error searching stocks:", error);
      if (error instanceof Error && error.message.includes("Not authenticated")) {
        navigate("/login");
      }
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddToWatchlist = async (symbol: string) => {
    try {
      const authHeader = getAuthHeader();
      if (!authHeader) return;

      // First, get the stock ID by fetching the stock data
      const stockResponse = await fetch(`/api/stocks/${symbol}`, {
        headers: {
          ...authHeader,
          "Content-Type": "application/json"
        }
      });

      if (!stockResponse.ok) {
        throw new Error("Failed to fetch stock data");
      }

      const stockData = await stockResponse.json();

      // Now add to watchlist using the stock ID
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

      // Refresh watchlist
      const watchlistResponse = await fetch("/api/watchlist", {
        headers: {
          ...authHeader,
          "Content-Type": "application/json"
        }
      });

      if (watchlistResponse.ok) {
        const watchlistData = await watchlistResponse.json();
        setWatchlist(watchlistData);
      }

      // Clear search
      setSearchQuery("");
      setSearchResults([]);
    } catch (error) {
      console.error("Error adding to watchlist:", error);
      setError(error instanceof Error ? error.message : "Failed to add stock to watchlist");
    }
  };

  const handleRemoveFromWatchlist = async (stockId: number) => {
    try {
      const authHeader = getAuthHeader();
      if (!authHeader) return;

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

      // Refresh watchlist
      const watchlistResponse = await fetch("/api/watchlist", {
        headers: {
          ...authHeader,
          "Content-Type": "application/json"
        }
      });

      if (watchlistResponse.ok) {
        const watchlistData = await watchlistResponse.json();
        setWatchlist(watchlistData);
      }
    } catch (error) {
      console.error("Error removing from watchlist:", error);
      setError(error instanceof Error ? error.message : "Failed to remove stock from watchlist");
    }
  };

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStock || orderQuantity <= 0) return;

    setIsPlacingOrder(true);
    setOrderError(null);

    try {
      const authHeader = getAuthHeader();
      if (!authHeader) return;

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          ...authHeader,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          symbol: selectedStock.symbol,
          type: orderType,
          quantity: orderQuantity,
          price: selectedStock.currentPrice
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to place order");
      }

      // Refresh portfolio data
      const portfolioResponse = await fetch("/api/portfolio", {
        headers: {
          ...authHeader,
          "Content-Type": "application/json"
        }
      });

      if (portfolioResponse.ok) {
        const portfolioData = await portfolioResponse.json();
        setPortfolio(portfolioData);
      }

      // Reset order form
      setOrderQuantity(0);
      setOrderType('BUY');
    } catch (error) {
      console.error("Error placing order:", error);
      setOrderError(error instanceof Error ? error.message : "Failed to place order");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // Update the getFilteredHistoricalData function
  const getFilteredHistoricalData = (data: Stock['historicalData'] | undefined, range: TimeRange) => {
    console.log('Raw historical data:', data);
    
    if (!data || !Array.isArray(data)) {
      console.log('No valid historical data available');
      return [];
    }

    // Sort data by date to ensure chronological order
    const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    console.log('Sorted data first point:', sortedData[0]);
    console.log('Sorted data last point:', sortedData[sortedData.length - 1]);

    const now = new Date();
    const ranges = {
      '1D': 1,
      '7D': 7,
      '30D': 30,
      '1Y': 365
    };
    const days = ranges[range];
    
    // Calculate cutoff date based on range
    const cutoff = new Date(now);
    if (range === '1D') {
      // For 1D, get data from exactly 24 hours ago
      cutoff.setHours(now.getHours() - 24);
    } else {
      // For other ranges, get data from the start of the day N days ago
      cutoff.setDate(now.getDate() - days);
      cutoff.setHours(0, 0, 0, 0);
    }
    
    console.log('Filtering data:', { 
      range, 
      days, 
      cutoff: cutoff.toISOString(),
      now: now.toISOString()
    });
    
    // First separate daily and intraday data
    const dailyData = sortedData.filter(item => item.is_intraday === false);
    const intradayData = sortedData.filter(item => item.is_intraday === true);
    
    console.log('Daily data points:', dailyData.length);
    console.log('Intraday data points:', intradayData.length);
    
    let filtered: typeof data = [];
    
    if (range === '1D') {
      // For 1D view, use only intraday data from the last 24 hours
      filtered = intradayData.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= cutoff;
      });
      console.log('1D view - Filtered intraday data points:', filtered.length);
    } else {
      // For 7D, 30D, and 1Y views, use only daily data
      filtered = dailyData.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= cutoff;
      });
      
      console.log(`${range} view - Filtered daily data points:`, filtered.length);
    }
    
    if (filtered.length > 0) {
      console.log('First filtered point:', filtered[0]);
      console.log('Last filtered point:', filtered[filtered.length - 1]);
    }
    
    return filtered;
  };

  // Update the prepareChartData function to handle 1Y view
  const prepareChartData = (data: Stock['historicalData'] | undefined, range: TimeRange) => {
    console.log('Preparing chart data for range:', range);
    
    const filteredData = getFilteredHistoricalData(data, range);
    console.log('Filtered data for chart:', filteredData);
    
    if (filteredData.length === 0) {
      console.log('No data points after filtering');
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
    
    const chartData = {
      labels: filteredData.map(item => {
        const date = new Date(item.date);
        if (range === '1D') {
          // For 1D view, show hour:minute
          return date.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false
          });
        } else if (range === '1Y') {
          // For 1Y view, show month and year
          return date.toLocaleDateString([], { 
            month: 'short', 
            year: '2-digit'
          });
        } else {
          // For other ranges, show month and day
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
          pointRadius: range === '1D' ? 2 : 0, // Show points for intraday data
          borderWidth: 2,
        }
      ]
    };
    
    return chartData;
  };

  // Update chart options to handle 1Y view
  const chartOptions = {
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
            const date = new Date(context[0].label);
            if (timeRange === '1D') {
              return date.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
              });
            } else if (timeRange === '1Y') {
              return date.toLocaleDateString([], { 
                month: 'short', 
                year: '2-digit'
              });
            }
            return date.toLocaleDateString([], { 
              month: 'short', 
              day: 'numeric' 
            });
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
          maxTicksLimit: timeRange === '1D' ? 12 : timeRange === '1Y' ? 12 : 6, // Adjust ticks based on range
          callback: (value: any, index: number, values: any[]) => {
            if (timeRange === '1D') {
              // For intraday, show every 2nd tick to avoid crowding
              return index % 2 === 0 ? value : '';
            } else if (timeRange === '1Y') {
              // For 1Y view, show every 3rd tick
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
  };

  // Add this helper function after the component's state declarations
  const isInWatchlist = (symbol: string) => {
    return watchlist.some(stock => stock.symbol === symbol);
  };

  if (loading) return (
    <div className="min-h-screen pt-16 bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen pt-16 bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
      <div className="bg-white dark:bg-dark-surface p-8 rounded-lg shadow-md max-w-md w-full">
        <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Error</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
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
              {loading ? (
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
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">{stockError}</p>
                  </div>
                )}
                {isLoadingStock && (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
                  </div>
                )}
              </div>
            )}

            {/* Trading Form */}
            {selectedStock && (
              <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-4">Trade {selectedStock.symbol}</h2>
                <form onSubmit={handleOrderSubmit} className="space-y-4">
                  <div className="flex space-x-4">
                    <button
                      type="button"
                      onClick={() => setOrderType('BUY')}
                      className={`flex-1 py-2 px-4 rounded-md text-sm font-medium ${
                        orderType === 'BUY'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      Buy
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderType('SELL')}
                      className={`flex-1 py-2 px-4 rounded-md text-sm font-medium ${
                        orderType === 'SELL'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      Sell
                    </button>
                  </div>
                  <div>
                    <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Quantity
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
                        id="quantity"
                        min="0.01"
                        step="0.01"
                        value={orderQuantity}
                        onChange={(e) => setOrderQuantity(Number(e.target.value))}
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-dark-surface dark:text-dark-text sm:text-sm"
                        placeholder="0.00"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 dark:text-gray-400 sm:text-sm">shares</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex justify-between">
                      <span>Price per share</span>
                      <span>${selectedStock?.currentPrice?.toFixed(2) ?? '0.00'}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Estimated Total</span>
                      <span>${(orderQuantity * (selectedStock?.currentPrice || 0)).toFixed(2)}</span>
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
                    className={`w-full py-2 px-4 rounded-md text-sm font-medium text-white ${
                      orderType === 'BUY'
                        ? 'bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-400'
                        : 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isPlacingOrder ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing...
                      </div>
                    ) : (
                      `${orderType} ${selectedStock.symbol}`
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
              {loading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
                </div>
              ) : watchlist?.length > 0 ? (
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
                            <p>Owned: {stock.sharesOwned.toFixed(2)} shares (${stock.totalValue.toFixed(2)})</p>
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