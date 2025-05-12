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

// Add time range type
type TimeRange = '1D' | '7D' | '30D';

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
        historicalData: stockData.historical_data?.map((point: any) => ({
          date: point.date,
          price: point.price
        })) || [],
        fiftyTwoWeekHigh: stockData.fifty_two_week_high,
        fiftyTwoWeekLow: stockData.fifty_two_week_low
      };

      console.log('Normalized stock data:', normalizedStockData);
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

      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: {
          ...authHeader,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ symbol })
      });

      if (!response.ok) {
        throw new Error("Failed to add to watchlist");
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
      setError("Failed to add stock to watchlist");
    }
  };

  const handleRemoveFromWatchlist = async (symbol: string) => {
    try {
      const authHeader = getAuthHeader();
      if (!authHeader) return;

      const response = await fetch(`/api/watchlist/${symbol}`, {
        method: "DELETE",
        headers: {
          ...authHeader,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error("Failed to remove from watchlist");
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
      setError("Failed to remove stock from watchlist");
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

  // Add function to filter historical data based on time range
  const getFilteredHistoricalData = (data: Stock['historicalData'] | undefined, range: TimeRange) => {
    console.log('Raw historical data:', data); // Debug log
    
    if (!data || !Array.isArray(data)) {
      console.log('No valid historical data available'); // Debug log
      return [];
    }

    const now = new Date();
    const ranges = {
      '1D': 1,
      '7D': 7,
      '30D': 30
    };
    const days = ranges[range];
    const cutoff = new Date(now.setDate(now.getDate() - days));
    
    console.log('Filtering data:', { range, days, cutoff }); // Debug log
    
    const filtered = data.filter(item => new Date(item.date) >= cutoff);
    console.log('Filtered data points:', filtered.length); // Debug log
    
    return filtered;
  };

  // Add function to prepare chart data
  const prepareChartData = (data: Stock['historicalData'] | undefined, range: TimeRange) => {
    console.log('Preparing chart data for range:', range); // Debug log
    
    const filteredData = getFilteredHistoricalData(data, range);
    console.log('Filtered data for chart:', filteredData); // Debug log
    
    if (filteredData.length === 0) {
      console.log('No data points after filtering'); // Debug log
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
        return range === '1D' 
          ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }),
      datasets: [
        {
          label: 'Price',
          data: filteredData.map(item => item.price),
          borderColor: 'rgb(99, 102, 241)',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2,
        }
      ]
    };
    
    console.log('Final chart data:', chartData); // Debug log
    return chartData;
  };

  // Add chart options
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
          label: (context: any) => `$${context.parsed.y.toFixed(2)}`
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
          maxTicksLimit: 6
        }
      },
      y: {
        position: 'right' as const,
        grid: {
          color: 'rgba(156, 163, 175, 0.1)' // gray-400 with opacity
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
        <div className="bg-white dark:bg-dark-surface p-8 rounded-lg shadow-md max-w-md w-full">
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Error</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-indigo-600 dark:bg-indigo-500 text-white py-2 px-4 rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToWatchlist(result.symbol);
                          }}
                          className="px-3 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                        >
                          Add to Watchlist
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Stock Details */}
            {selectedStock && (
              <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-lg font-medium text-gray-900 dark:text-dark-text">{selectedStock.name} ({selectedStock.symbol})</h2>
                    <div className="flex items-baseline space-x-4 mt-1">
                      <span className="text-2xl font-bold text-gray-900 dark:text-dark-text">
                        ${selectedStock.currentPrice?.toFixed(2) ?? '0.00'}
                      </span>
                      <span className={`text-lg font-medium ${
                        (selectedStock.change ?? 0) >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {(selectedStock.change ?? 0) >= 0 ? '+' : ''}{(selectedStock.change ?? 0).toFixed(2)} ({(selectedStock.changePercent ?? 0).toFixed(2)}%)
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <div>
                        <p>Volume: {selectedStock.volume?.toLocaleString() ?? '0'}</p>
                        <p>Market Cap: ${(selectedStock.marketCap / 1e9).toFixed(2)}B</p>
                      </div>
                      <div>
                        <p>52W High: ${selectedStock.fiftyTwoWeekHigh?.toFixed(2) ?? 'N/A'}</p>
                        <p>52W Low: ${selectedStock.fiftyTwoWeekLow?.toFixed(2) ?? 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleAddToWatchlist(selectedStock.symbol)}
                      className="px-3 py-1 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                    >
                      Add to Watchlist
                    </button>
                  </div>
                </div>

                {/* Chart Component */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-dark-text">Price History</h3>
                    <div className="flex space-x-2">
                      {(['1D', '7D', '30D'] as TimeRange[]).map((range) => (
                        <button
                          key={range}
                          onClick={() => {
                            console.log('Changing time range to:', range);
                            setTimeRange(range);
                          }}
                          className={`px-3 py-1 text-xs font-medium rounded-md ${
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
                  <div className="h-64">
                    {selectedStock?.historicalData && selectedStock.historicalData.length > 0 ? (
                      <Line
                        data={prepareChartData(selectedStock.historicalData, timeRange)}
                        options={chartOptions}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                        {selectedStock?.historicalData ? 'No historical data available' : 'Loading historical data...'}
                      </div>
                    )}
                  </div>
                </div>

                {stockError && (
                  <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
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
                          handleRemoveFromWatchlist(stock.symbol);
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