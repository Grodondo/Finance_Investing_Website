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

type TimeRange = '1D' | '7D' | '30D' | '1Y';

export default function Recommendations() {
  const { user, getAuthHeader, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState<Stock[]>([]);
  const [watchlist, setWatchlist] = useState<Watchlist[]>([]);
  const [selectedStocks, setSelectedStocks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [timeRange] = useState<TimeRange>('30D');
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [isPageLoaded, setIsPageLoaded] = useState(false);

  const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#E57373', '#81C784', '#64B5F6'];

  const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 5000): Promise<Response | null> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        return null;
      }
      throw error;
    }
  };

  // First useEffect: Load watchlist and set up initial page state
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    const fetchWatchlist = async () => {
      try {
        const authHeader = getAuthHeader();
        if (!authHeader) return;

        const watchlistResponse = await fetchWithTimeout(
          "/api/watchlist",
          {
            headers: { ...authHeader, "Content-Type": "application/json" }
          }
        );

        if (!watchlistResponse || !watchlistResponse.ok) {
          setWatchlist([]);
          setLoading(false);
          setIsPageLoaded(true);
          return;
        }

        const watchlistData = await watchlistResponse.json() as WatchlistResponse[];
        
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

        const watchlistWithHistory = await Promise.all(
          normalizedWatchlist.map(async (stock: Watchlist) => {
            try {
              const response = await fetchWithTimeout(
                `/api/stocks/${stock.symbol}`,
                {
                  headers: { ...authHeader, "Content-Type": "application/json" }
                }
              );
              if (response?.ok) {
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
        setWatchlist(watchlistWithHistory);
        setSelectedStocks(watchlistWithHistory.map(stock => stock.symbol));
      } catch {
        setWatchlist([]);
      } finally {
        setLoading(false);
        setIsPageLoaded(true);
      }
    };

    fetchWatchlist();
  }, [getAuthHeader, isAuthenticated, navigate]);

  // Second useEffect: Load recommendations after page is loaded
  useEffect(() => {
    if (!isPageLoaded || !isAuthenticated) return;

    const fetchRecommendations = async () => {
      try {
        const authHeader = getAuthHeader();
        if (!authHeader) return;

        const recommendationsResponse = await fetchWithTimeout(
          "/api/stocks/recommendations",
          {
            headers: { ...authHeader, "Content-Type": "application/json" }
          }
        );

        if (!recommendationsResponse || !recommendationsResponse.ok) {
          setRecommendations([]);
          return;
        }

        const recommendationsData = await recommendationsResponse.json() as StockResponse[];
        
        const normalizedRecommendations = recommendationsData.map((stock: StockResponse) => ({
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
        }));
        setRecommendations(normalizedRecommendations);
      } catch {
        setRecommendations([]);
      }
    };

    fetchRecommendations();
  }, [isPageLoaded, getAuthHeader, isAuthenticated]);

  const handleStockSelect = (symbol: string) => {
    fetchStockData(symbol);
  };

  const fetchStockData = async (symbol: string) => {
    try {
      setIsLoadingStock(true);
      setStockError(null);
      const authHeader = getAuthHeader();
      if (!authHeader) return;
      const response = await fetch(`/api/stocks/${symbol}`, {
        headers: { ...authHeader, "Content-Type": "application/json" }
      });
      if (!response.ok) throw new Error("Failed to fetch stock data");
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
    } catch (error) {
      setStockError("Failed to fetch stock data.");
    } finally {
      setIsLoadingStock(false);
    }
  };

  const handleAddToWatchlist = async (symbol: string) => {
    try {
      const authHeader = getAuthHeader();
      if (!authHeader) return;

      const response = await fetchWithTimeout(
        "/api/watchlist",
        {
          method: "POST",
          headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ symbol })
        }
      );

      if (!response || !response.ok) return;

      // Refetch watchlist with timeout
      const watchlistResponse = await fetchWithTimeout(
        "/api/watchlist",
        {
          headers: { ...authHeader, "Content-Type": "application/json" }
        }
      );

      if (!watchlistResponse || !watchlistResponse.ok) return;

      const watchlistData = await watchlistResponse.json() as WatchlistResponse[];
      
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

      // Fetch historical data with timeout
      const watchlistWithHistory = await Promise.all(
        normalizedWatchlist.map(async (stock: Watchlist) => {
          try {
            const response = await fetchWithTimeout(
              `/api/stocks/${stock.symbol}`,
              {
                headers: { ...authHeader, "Content-Type": "application/json" }
              }
            );
            if (response?.ok) {
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
      setWatchlist(watchlistWithHistory);
      setSelectedStocks(watchlistWithHistory.map(stock => stock.symbol));
    } catch {
      // Silently handle any errors
    }
  };

  const prepareChartData = (watchlist: Watchlist[], selectedStocks: string[], range: TimeRange) => {
    if (watchlist.length === 0 || selectedStocks.length === 0) {
      return { labels: [], datasets: [] };
    }
    const firstStock = watchlist.find(stock => selectedStocks.includes(stock.symbol));
    if (!firstStock || !firstStock.historicalData) {
      return { labels: [], datasets: [] };
    }
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - 30);
    const filteredData = firstStock.historicalData.filter(item => new Date(item.date) >= cutoff);
    const labels = filteredData.map(item => new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' }));

    const datasets = selectedStocks.map((symbol, index) => {
      const stock = watchlist.find(s => s.symbol === symbol);
      if (!stock || !stock.historicalData) return null;
      const color = colors[index % colors.length];
      return {
        label: symbol,
        data: stock.historicalData
          .filter(item => new Date(item.date) >= cutoff)
          .map(item => item.price),
        borderColor: color,
        backgroundColor: `${color}20`,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2
      };
    }).filter(dataset => dataset !== null);

    return { labels, datasets };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top' as const },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (context: any) => `${context.dataset.label}: $${context.parsed.y.toFixed(2)}`
        }
      }
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        position: 'right' as const,
        grid: { color: 'rgba(156, 163, 175, 0.1)' },
        ticks: { callback: (value: any) => `$${value.toFixed(2)}` }
      }
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400"></div></div>;
  if (recommendationsError || watchlistError) return <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center"><div className="bg-white dark:bg-dark-surface p-8 rounded-lg shadow-md max-w-md w-full"><h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Error</h2><p className="text-gray-600 dark:text-gray-300 mb-4">{recommendationsError || watchlistError}</p><button onClick={() => window.location.reload()} className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700">Try Again</button></div></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-text mb-8">Stock Recommendations and Watchlist</h1>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12">
            {/* Watchlist - Now appears first */}
            <div className="bg-white dark:bg-dark-surface rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text mb-6">Your Watchlist</h2>
              {watchlist.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {watchlist.map((stock, index) => (
                    <div key={stock.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[index % colors.length] }}></div>
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
              <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text mb-6">Watchlist Price History (Last 30 Days)</h2>
              {watchlist.length > 0 && selectedStocks.length > 0 ? (
                <div className="h-[500px]">
                  <Line
                    data={prepareChartData(watchlist, selectedStocks, timeRange)}
                    options={chartOptions}
                  />
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">Select stocks from your watchlist to view price history.</p>
              )}
            </div>

            {/* Top Recommendations - Now appears last */}
            <div className="bg-white dark:bg-dark-surface rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text mb-6">Top 5 Recommended Stocks This Week</h2>
              {recommendations.length > 0 ? (
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