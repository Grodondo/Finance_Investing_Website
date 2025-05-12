import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
}

type TimeRange = '1D' | '7D' | '30D' | '1Y';

export default function Recommendations() {
  const { user, getAuthHeader, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState<Stock[]>([]);
  const [watchlist, setWatchlist] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('7D');
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      console.log('Not authenticated, redirecting to login');
      navigate("/login");
      return;
    }

    const fetchData = async () => {
      try {
        const authHeader = getAuthHeader();
        console.log('Auth header:', authHeader); // Debug log
        
        if (!authHeader) {
          console.error('No auth header available');
          throw new Error("Not authenticated");
        }

        // Fetch recommendations
        console.log('Fetching recommendations...');
        const recommendationsResponse = await fetch("/api/stocks/recommendations", {
          headers: {
            ...authHeader,
            "Content-Type": "application/json"
          }
        });

        console.log('Recommendations response status:', recommendationsResponse.status);
        if (!recommendationsResponse.ok) {
          const errorData = await recommendationsResponse.json().catch(() => ({}));
          console.error('Recommendations error details:', errorData);
          throw new Error(errorData.detail || "Failed to fetch recommendations");
        }

        const recommendationsData = await recommendationsResponse.json();
        console.log('Recommendations data received:', recommendationsData);
        if (!Array.isArray(recommendationsData)) {
          console.error('Invalid recommendations data format:', recommendationsData);
          throw new Error("Invalid recommendations data format");
        }
        // Normalize the data to match our interface
        const normalizedRecommendations = recommendationsData.map(stock => ({
          symbol: stock.symbol,
          name: stock.name,
          currentPrice: stock.current_price || 0,
          change: stock.change || 0,
          changePercent: stock.change_percent || 0,
          volume: stock.volume || 0,
          marketCap: stock.market_cap || 0,
          historicalData: stock.historical_data?.map((point: any) => ({
            date: point.date,
            price: point.price,
            is_intraday: point.date.includes(' ')
          })) || [],
          recommendation: stock.recommendation || 'N/A',
          recommendationReason: stock.recommendation_reason || 'No reason provided'
        }));
        setRecommendations(normalizedRecommendations);

        // Fetch watchlist
        console.log('Fetching watchlist...');
        const watchlistResponse = await fetch("/api/watchlist", {
          headers: {
            ...authHeader,
            "Content-Type": "application/json"
          }
        });

        console.log('Watchlist response status:', watchlistResponse.status);
        if (!watchlistResponse.ok) {
          const errorData = await watchlistResponse.json().catch(() => ({}));
          console.error('Watchlist error details:', errorData);
          throw new Error(errorData.detail || "Failed to fetch watchlist");
        }

        const watchlistData = await watchlistResponse.json();
        console.log('Watchlist data received:', watchlistData);
        // Normalize watchlist data
        const normalizedWatchlist = watchlistData.map((stock: any) => ({
          id: stock.id,
          symbol: stock.symbol,
          name: stock.name,
          currentPrice: stock.current_price || 0,
          change: stock.change || 0,
          changePercent: stock.change_percent || 0,
          volume: stock.volume || 0,
          marketCap: stock.market_cap || 0,
          sharesOwned: stock.shares_owned || 0,
          totalValue: stock.total_value || 0
        }));
        setWatchlist(normalizedWatchlist);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError(error instanceof Error ? error.message : "An error occurred");
      } finally {
        console.log('Setting loading to false');
        setLoading(false);
      }
    };

    console.log('Starting data fetch...');
    fetchData();
  }, [getAuthHeader, isAuthenticated, navigate]);

  const fetchStockData = async (symbol: string) => {
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

      if (!response.ok) {
        throw new Error("Failed to fetch stock data");
      }

      const stockData = await response.json();
      const normalizedStockData = {
        ...stockData,
        currentPrice: stockData.current_price,
        change: stockData.change,
        changePercent: stockData.change_percent,
        volume: stockData.volume,
        marketCap: stockData.market_cap,
        historicalData: stockData.historical_data?.map((point: any) => ({
          date: point.date,
          price: point.price,
          is_intraday: point.date.includes(' ')
        })) || []
      };

      setSelectedStock(normalizedStockData);
      setStockError(null);
    } catch (error) {
      console.error("Error fetching stock data:", error);
      setStockError("Failed to fetch stock data. Please try again later.");
    } finally {
      setIsLoadingStock(false);
    }
  };

  const handleStockSelect = (symbol: string) => {
    fetchStockData(symbol);
  };

  const prepareChartData = (data: Stock['historicalData'] | undefined, range: TimeRange) => {
    if (!data || data.length === 0) {
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

    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - (range === '1D' ? 1 : range === '7D' ? 7 : range === '30D' ? 30 : 365));

    const filteredData = data.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate >= cutoff;
    });

    return {
      labels: filteredData.map(item => {
        const date = new Date(item.date);
        if (range === '1D') {
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        } else if (range === '1Y') {
          return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }),
      datasets: [{
        label: 'Price',
        data: filteredData.map(item => item.price),
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: range === '1D' ? 2 : 0,
        borderWidth: 2,
      }]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (context: any) => `$${context.parsed.y.toFixed(2)}`,
          title: (context: any) => {
            const date = new Date(context[0].label);
            if (timeRange === '1D') {
              return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            } else if (timeRange === '1Y') {
              return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
            }
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: timeRange === '1D' ? 12 : timeRange === '1Y' ? 12 : 6,
          callback: (value: any, index: number) => {
            if (timeRange === '1D') return index % 2 === 0 ? value : '';
            if (timeRange === '1Y') return index % 3 === 0 ? value : '';
            return value;
          }
        }
      },
      y: {
        position: 'right' as const,
        grid: { color: 'rgba(156, 163, 175, 0.1)' },
        ticks: { callback: (value: any) => `$${value.toFixed(2)}` }
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
          {/* Main Content */}
          <div className="col-span-12 lg:col-span-8">
            {/* Top Recommendations Section */}
            <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text mb-6">Top Stock Recommendations</h2>
              <div className="space-y-6">
                {recommendations.map((stock, index) => (
                  <div
                    key={stock.symbol}
                    className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleStockSelect(stock.symbol)}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-lg font-medium text-indigo-600 dark:text-indigo-400">#{index + 1}</span>
                          <h3 className="text-xl font-bold text-gray-900 dark:text-dark-text">{stock.symbol}</h3>
                          <span className="text-lg text-gray-600 dark:text-gray-400">{stock.name}</span>
                        </div>
                        <div className="mt-2">
                          <p className="text-sm text-gray-600 dark:text-gray-400">{stock.recommendationReason}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900 dark:text-dark-text">
                          ${(stock.currentPrice || 0).toFixed(2)}
                        </p>
                        <p className={`text-lg font-medium ${
                          (stock.change || 0) >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {(stock.change || 0) >= 0 ? '+' : ''}{(stock.change || 0).toFixed(2)} ({(stock.changePercent || 0).toFixed(2)}%)
                        </p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="h-48">
                        <Line
                          data={prepareChartData(stock.historicalData, timeRange)}
                          options={chartOptions}
                        />
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Volume</p>
                        <p className="font-medium text-gray-900 dark:text-dark-text">
                          {(stock.volume || 0).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Market Cap</p>
                        <p className="font-medium text-gray-900 dark:text-dark-text">
                          ${((stock.marketCap || 0) / 1e9).toFixed(2)}B
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Recommendation</p>
                        <p className="font-medium text-green-600 dark:text-green-400">
                          {stock.recommendation}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Stock Details */}
            {selectedStock && (
              <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6">
                {/* Stock details content (similar to investing.tsx) */}
                {/* ... Add the stock details section from investing.tsx ... */}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="col-span-12 lg:col-span-4">
            {/* Watchlist Section */}
            <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-dark-text mb-4">Your Watchlist</h2>
              {watchlist.length > 0 ? (
                <div className="space-y-4">
                  {watchlist.map((stock) => (
                    <div
                      key={stock.id}
                      className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => handleStockSelect(stock.symbol)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-dark-text">{stock.symbol}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{stock.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900 dark:text-dark-text">
                            ${(stock.currentPrice || 0).toFixed(2)}
                          </p>
                          <p className={`text-xs ${
                            (stock.change || 0) >= 0
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {(stock.change || 0) >= 0 ? '+' : ''}{(stock.change || 0).toFixed(2)} ({(stock.changePercent || 0).toFixed(2)}%)
                          </p>
                        </div>
                      </div>
                      {stock.sharesOwned > 0 && (
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <p>Owned: {(stock.sharesOwned || 0).toFixed(2)} shares (${(stock.totalValue || 0).toFixed(2)})</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  No stocks in watchlist. Add stocks from the recommendations above.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 