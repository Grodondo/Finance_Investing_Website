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
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
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
  symbol: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
}

interface SearchResult {
  symbol: string;
  name: string;
}

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
  const [timeRange, setTimeRange] = useState<'1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL'>('1M');
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
      setSelectedStock(stockData);
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
      if (!authHeader) return;

      const response = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`, {
        headers: {
          ...authHeader,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error("Failed to search stocks");
      }

      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error("Error searching stocks:", error);
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
                <div className="flex justify-between items-center mb-6">
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
                  </div>
                  <button
                    onClick={() => handleRemoveFromWatchlist(selectedStock.symbol)}
                    className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                  >
                    Remove from Watchlist
                  </button>
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
                    <input
                      type="number"
                      id="quantity"
                      min="1"
                      value={orderQuantity}
                      onChange={(e) => setOrderQuantity(Number(e.target.value))}
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-dark-surface dark:text-dark-text sm:text-sm"
                    />
                  </div>
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>Estimated Cost</span>
                    <span>${(orderQuantity * (selectedStock?.currentPrice || 0)).toFixed(2)}</span>
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
                      key={stock.symbol}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => handleStockSelect(stock.symbol)}
                    >
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