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

export default function Investing() {
  const { user, logout, getAuthHeader, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [watchlist, setWatchlist] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL'>('1M');
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY');
  const [orderQuantity, setOrderQuantity] = useState<number>(0);

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
        const portfolioResponse = await fetch("/api/investing/portfolio", {
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
        const watchlistResponse = await fetch("/api/investing/watchlist", {
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

        // Fetch initial stock data (e.g., AAPL)
        const stockResponse = await fetch("/api/investing/stocks/AAPL", {
          headers: {
            ...authHeader,
            "Content-Type": "application/json"
          }
        });

        if (!stockResponse.ok) {
          throw new Error("Failed to fetch stock data");
        }

        const stockData = await stockResponse.json();
        setSelectedStock(stockData);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError(error instanceof Error ? error.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [getAuthHeader, isAuthenticated, navigate]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleStockSelect = async (symbol: string) => {
    try {
      const authHeader = getAuthHeader();
      if (!authHeader) return;

      const response = await fetch(`/api/investing/stocks/${symbol}`, {
        headers: {
          ...authHeader,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error("Failed to fetch stock data");
      }

      const stockData = await response.json();
      setSelectedStock(stockData);
    } catch (error) {
      console.error("Error fetching stock data:", error);
    }
  };

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStock || orderQuantity <= 0) return;

    try {
      const authHeader = getAuthHeader();
      if (!authHeader) return;

      const response = await fetch("/api/investing/orders", {
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
        throw new Error("Failed to place order");
      }

      // Refresh portfolio data
      const portfolioResponse = await fetch("/api/investing/portfolio", {
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
    } catch (error) {
      console.error("Error placing order:", error);
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
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-dark-text">Portfolio Overview</h2>
                <div className="flex space-x-2">
                  {(['1D', '1W', '1M', '3M', '1Y', 'ALL'] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={`px-3 py-1 text-sm font-medium rounded-md ${
                        timeRange === range
                          ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>
              {portfolio && (
                <div className="space-y-4">
                  <div className="flex items-baseline space-x-4">
                    <span className="text-3xl font-bold text-gray-900 dark:text-dark-text">
                      ${portfolio.totalValue.toLocaleString()}
                    </span>
                    <span className={`text-lg font-medium ${
                      portfolio.dailyChange >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {portfolio.dailyChange >= 0 ? '+' : ''}{portfolio.dailyChange.toFixed(2)} ({portfolio.dailyChangePercent.toFixed(2)}%)
                    </span>
                  </div>
                  {/* Portfolio Chart would go here */}
                </div>
              )}
            </div>

            {/* Stock Chart */}
            {selectedStock && (
              <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 mb-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-lg font-medium text-gray-900 dark:text-dark-text">{selectedStock.name} ({selectedStock.symbol})</h2>
                    <div className="flex items-baseline space-x-4 mt-1">
                      <span className="text-2xl font-bold text-gray-900 dark:text-dark-text">
                        ${selectedStock.currentPrice.toFixed(2)}
                      </span>
                      <span className={`text-lg font-medium ${
                        selectedStock.change >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {selectedStock.change >= 0 ? '+' : ''}{selectedStock.change.toFixed(2)} ({selectedStock.changePercent.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    {(['1D', '1W', '1M', '3M', '1Y', 'ALL'] as const).map((range) => (
                      <button
                        key={range}
                        onClick={() => setTimeRange(range)}
                        className={`px-3 py-1 text-sm font-medium rounded-md ${
                          timeRange === range
                            ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-96">
                  <Line
                    data={{
                      labels: selectedStock.historicalData.map(d => d.date),
                      datasets: [{
                        label: selectedStock.symbol,
                        data: selectedStock.historicalData.map(d => d.price),
                        borderColor: selectedStock.change >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
                        backgroundColor: selectedStock.change >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        tension: 0.4,
                        fill: true,
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false,
                        },
                        tooltip: {
                          mode: "index" as const,
                          intersect: false,
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: false,
                          grid: {
                            color: (context) => {
                              const isDarkMode = document.documentElement.classList.contains('dark');
                              return isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
                            }
                          },
                          ticks: {
                            color: (context) => {
                              const isDarkMode = document.documentElement.classList.contains('dark');
                              return isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)';
                            }
                          }
                        },
                        x: {
                          grid: {
                            display: false,
                          },
                          ticks: {
                            color: (context) => {
                              const isDarkMode = document.documentElement.classList.contains('dark');
                              return isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)';
                            }
                          }
                        }
                      }
                    }}
                  />
                </div>
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
                  <button
                    type="submit"
                    className={`w-full py-2 px-4 rounded-md text-sm font-medium text-white ${
                      orderType === 'BUY'
                        ? 'bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-400'
                        : 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400'
                    }`}
                  >
                    {orderType} {selectedStock.symbol}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* Holdings */}
            <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-4">Holdings</h2>
              {portfolio?.holdings.length ? (
                <div className="space-y-4">
                  {portfolio.holdings.map((holding) => (
                    <div
                      key={holding.symbol}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => handleStockSelect(holding.symbol)}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-dark-text">{holding.symbol}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{holding.shares} shares</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-dark-text">
                          ${holding.totalValue.toFixed(2)}
                        </p>
                        <p className={`text-xs ${
                          holding.gainLoss >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {holding.gainLoss >= 0 ? '+' : ''}{holding.gainLoss.toFixed(2)} ({holding.gainLossPercent.toFixed(2)}%)
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No holdings yet.</p>
              )}
            </div>

            {/* Watchlist */}
            <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-4">Watchlist</h2>
              {watchlist.length ? (
                <div className="space-y-4">
                  {watchlist.map((stock) => (
                    <div
                      key={stock.symbol}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => handleStockSelect(stock.symbol)}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-dark-text">{stock.symbol}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{stock.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-dark-text">
                          ${stock.currentPrice.toFixed(2)}
                        </p>
                        <p className={`text-xs ${
                          stock.change >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No stocks in watchlist.</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 