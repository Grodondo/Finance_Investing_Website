import { useState, useEffect, useMemo, useCallback, Suspense, lazy, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
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
  Filler,
  TimeScale
} from "chart.js";
// Import zoom plugin
// @ts-ignore
import zoomPlugin from 'chartjs-plugin-zoom';
// Import adapter for time scale
import 'chartjs-adapter-date-fns';
// Import the Line chart lazily
const Line = lazy(() => import("react-chartjs-2").then(module => ({ default: module.Line })));

// Register Chart.js components once
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale,
  zoomPlugin
);

// Configure zoom plugin globally - using proper type assertions
ChartJS.defaults.plugins.zoom = {
  pan: {
    enabled: true,
    mode: 'xy' as const,
    threshold: 10,
    modifierKey: 'ctrl' as const,
  },
  zoom: {
    wheel: {
      enabled: true,
      speed: 0.1,
    },
    pinch: {
      enabled: true
    },
    mode: 'xy' as const,
    drag: {
      enabled: true,
      backgroundColor: 'rgba(0,0,0,0.1)',
      borderColor: 'rgba(0,0,0,0.3)',
      borderWidth: 1,
    }
  },
  limits: {
    y: {min: 'original' as const, max: 'original' as const}
  }
};

// Define interfaces with proper types
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

// Colors array available at the module level for consistent use
const COLORS = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#E57373', '#81C784', '#64B5F6'];

// Data fetching hooks
const useRecommendations = (authHeader: AuthHeader) => {
  return useQuery({
    queryKey: ['recommendations'],
    queryFn: async () => {
      if (!authHeader) return [];
      
      try {
        const response = await fetch("/api/stocks/recommendations", {
          headers: {
            ...authHeader,
            "Content-Type": "application/json"
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch recommendations: ${response.status}`);
        }
        
        const data = await response.json() as StockResponse[];
        
        // Ensure we got valid data
        if (!Array.isArray(data)) {
          throw new Error('Invalid recommendations data format');
        }
        
        // Transform the data
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
          recommendation: stock.recommendation || 'BUY',
          recommendationReason: stock.recommendation_reason || 'Strong market performance'
        })) as Stock[];
      } catch (error) {
        console.error('Error fetching recommendations:', error);
        throw error;
      }
    },
    enabled: !!authHeader,
    staleTime: 30000, // Consider data fresh for 30 seconds
    retry: 2, // React Query's built-in retry mechanism
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
                currentPrice: stockData.current_price || stock.currentPrice,
                change: stockData.change || stock.change,
                changePercent: stockData.change_percent || stock.changePercent,
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

// Improved getFilteredHistoricalData function to fix time granularity issues
const getFilteredHistoricalData = (data: Stock['historicalData'] | undefined, range: TimeRange) => {
  if (!data || !Array.isArray(data) || data.length === 0) return [];

  const now = new Date();
  const cutoff = new Date(now);
  
  switch (range) {
    case '1D': {
      // For 1D, we need data from the last 24 hours
      cutoff.setHours(cutoff.getHours() - 24);
      
      // Get all intraday data points from the last 24 hours
      const filteredData = data
        .filter(item => {
          const itemDate = new Date(item.date);
          return itemDate >= cutoff && item.is_intraday; // Ensure we use intraday data for 1D view
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // If we have too few intraday points, try to include any data points from the last 24 hours
      if (filteredData.length < 10) {
        return data
          .filter(item => {
            const itemDate = new Date(item.date);
            return itemDate >= cutoff;
          })
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }
      
      // If we have a reasonable number of points, return them all for minute-by-minute view
      if (filteredData.length <= 390) { // 6.5 trading hours * 60 minutes
        return filteredData;
      }
      
      // If we have too many points, sample them to prevent overcrowding
      const sampleRate = Math.ceil(filteredData.length / 390);
      return filteredData.filter((_, index) => index % sampleRate === 0);
    }
    case '7D': {
      // For 7D, we need data from the last 7 days
      cutoff.setDate(cutoff.getDate() - 7);
      
      // Get all data points from the last 7 days
      const filteredData = data
        .filter(item => {
          const itemDate = new Date(item.date);
          return itemDate >= cutoff;
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Group data by hour to ensure hourly granularity
      const hourlyData = new Map();
      filteredData.forEach(item => {
        const date = new Date(item.date);
        const hourKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}`;
        
        // If we already have a data point for this hour, use the most recent one
        if (!hourlyData.has(hourKey) || 
            new Date(item.date).getTime() > new Date(hourlyData.get(hourKey).date).getTime()) {
          hourlyData.set(hourKey, item);
        }
      });
      
      // Convert hourly data back to array and sort by date
      const hourlyArray = Array.from(hourlyData.values())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      // For 7D view (168 hours), we should have ~168 data points
      return hourlyArray;
    }
    case '30D': {
      // For 30D view, use daily data
      cutoff.setDate(cutoff.getDate() - 30);
      
      // Get daily data for the last 30 days
      const dailyData = data
        .filter(item => {
          const itemDate = new Date(item.date);
          return itemDate >= cutoff;
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
      // If we have intraday data mixed in, use one data point per day
      if (dailyData.some(item => item.is_intraday)) {
        const uniqueDays = new Map<string, any>();
        dailyData.forEach(item => {
          const date = new Date(item.date);
          const dayKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
          
          // Prefer non-intraday data for each day
          if (!uniqueDays.has(dayKey) || item.is_intraday === false) {
            uniqueDays.set(dayKey, item);
          }
        });
        return Array.from(uniqueDays.values())
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }
      
      return dailyData;
    }
    case '1Y': {
      // For 1Y view, use daily data
      cutoff.setFullYear(cutoff.getFullYear() - 1);
      
      // Get data from the last year
      const filteredData = data
        .filter(item => {
          const itemDate = new Date(item.date);
          return itemDate >= cutoff;
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      // Group by day to get one data point per day
      const uniqueDays = new Map<string, any>();
      filteredData.forEach(item => {
        const date = new Date(item.date);
        const dayKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
        
        // Prefer non-intraday data for each day
        if (!uniqueDays.has(dayKey) || item.is_intraday === false) {
          uniqueDays.set(dayKey, item);
        }
      });
      
      return Array.from(uniqueDays.values())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    case '5Y': {
      // Exactly 5 years back for 5Y view
      cutoff.setFullYear(now.getFullYear() - 5);
      
      // Get data from the last 5 years
      const filteredData = data
        .filter(item => {
          const itemDate = new Date(item.date);
          return itemDate >= cutoff;
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      // Group by day to get one data point per day
      const uniqueDays = new Map<string, any>();
      filteredData.forEach(item => {
        const date = new Date(item.date);
        const dayKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
        
        // Prefer non-intraday data for each day
        if (!uniqueDays.has(dayKey) || item.is_intraday === false) {
          uniqueDays.set(dayKey, item);
        }
      });
      
      const dailyData = Array.from(uniqueDays.values())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      // If we have too many points, sample them to reduce load
      if (dailyData.length > 260) { // ~260 trading days in a year
        const sampleRate = Math.max(1, Math.floor(dailyData.length / 260));
        return dailyData.filter((_, index) => index % sampleRate === 0);
      }
      
      return dailyData;
    }
    default:
      return data;
  }
};

// Recommended Stock component
const RecommendedStock = ({ 
  stock, 
  index, 
  onAddToWatchlist 
}: {
  stock: Stock;
  index: number;
  onAddToWatchlist: (symbol: string) => void;
}) => (
  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
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
      onClick={(e) => { e.stopPropagation(); onAddToWatchlist(stock.symbol); }}
      className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 transition-colors"
    >
      Add to Watchlist
    </button>
  </div>
);

// Watchlist Stock component
const WatchlistStock = ({ 
  stock, 
  index, 
  isSelected, 
  onToggleSelect, 
  onSelect 
}: {
  stock: Watchlist;
  index: number;
  isSelected: boolean;
  onToggleSelect: () => void;
  onSelect: () => void;
}) => (
  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-center space-x-2 mb-2">
      <div 
        className="w-3 h-3 rounded-full" 
        style={{ backgroundColor: COLORS[index % COLORS.length] }}
      />
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggleSelect}
        className="cursor-pointer"
      />
      <div onClick={onSelect} className="cursor-pointer flex-1">
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
);

// Time Range Selector component
const TimeRangeSelector = ({ 
  timeRange, 
  setTimeRange 
}: {
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
}) => (
  <div className="flex space-x-2 items-center">
    {(['1D', '7D', '30D', '1Y', '5Y'] as TimeRange[]).map((range) => (
      <button
        key={range}
        onClick={() => setTimeRange(range)}
        className={`px-3 py-1 rounded-md text-sm font-medium ${
          timeRange === range
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
      >
        {range}
      </button>
    ))}
  </div>
);

// Simplified chart component that uses standard scales instead of time scales
const StockChart = ({ 
  watchlist, 
  selectedStocks, 
  timeRange, 
  instanceId 
}: {
  watchlist: Watchlist[];
  selectedStocks: string[];
  timeRange: TimeRange;
  instanceId: string;
}) => {
  const chartRef = useRef<any>(null);
  const [chartKey, setChartKey] = useState(`chart-${instanceId}-${Date.now()}`);
  const [theme, setTheme] = useState<'light' | 'dark'>(
    window?.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light'
  );
  
  // Listen for theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? 'dark' : 'light');
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Force chart recreation when dependencies change
  useEffect(() => {
    setChartKey(`chart-${instanceId}-${timeRange}-${selectedStocks.join('-')}-${Date.now()}`);
    
    return () => {
      if (chartRef.current) {
        try {
          chartRef.current.destroy();
          chartRef.current = null;
        } catch (error) {
          console.warn('Error destroying chart:', error);
        }
      }
    };
  }, [timeRange, selectedStocks.join(','), instanceId]);
  
  // Format date labels based on timeRange
  const formatDateLabel = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    if (timeRange === '1D') {
      // For 1D, show hours and minutes (e.g., 10:30)
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (timeRange === '7D') {
      // For 7D, show day and hour (e.g., Mon 14:00)
      return `${date.toLocaleDateString([], { weekday: 'short' })} ${date.getHours()}:00`;
    } else if (timeRange === '30D') {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } else if (timeRange === '5Y') {
      return date.toLocaleDateString([], { year: 'numeric', month: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
  }, [timeRange]);
  
  // Prepare chart data - memoized
  const chartData = useMemo(() => {
    if (!watchlist || watchlist.length === 0 || selectedStocks.length === 0) {
      return { labels: [], datasets: [] };
    }

    // Get all unique dates from selected stocks
    const allDates = new Set<string>();
    selectedStocks.forEach(symbol => {
      const stock = watchlist.find(s => s.symbol === symbol);
      if (stock?.historicalData) {
        getFilteredHistoricalData(stock.historicalData, timeRange)
          .forEach(item => allDates.add(item.date));
      }
    });

    // Sort dates chronologically
    const sortedDates = Array.from(allDates).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    // Format the dates for display
    const formattedDateLabels = sortedDates.map(formatDateLabel);

    // Create datasets for each selected stock
    const datasets = selectedStocks.map((symbol) => {
      const stock = watchlist.find(s => s.symbol === symbol);
      if (!stock?.historicalData) return null;

      // Find the index in the original watchlist to keep color consistent
      const originalIndex = watchlist.findIndex(s => s.symbol === symbol);
      const color = COLORS[originalIndex % COLORS.length];
      
      const filteredData = getFilteredHistoricalData(stock.historicalData, timeRange);
      const priceMap = new Map(
        filteredData.map(item => [item.date, item.price])
      );

      // Only provide values for dates that exist in this stock's data
      const data = sortedDates.map(date => priceMap.has(date) ? priceMap.get(date) : null);

      return {
        label: symbol,
        data,
        borderColor: color,
        backgroundColor: `${color}20`,
        fill: timeRange === '1D' ? false : true,
        tension: 0.1,
        pointRadius: 0, // Hide points by default
        pointHoverRadius: 5, // Show points on hover
        pointBackgroundColor: color,
        pointBorderColor: 'white',
        pointBorderWidth: 1.5,
        borderWidth: 2,
        spanGaps: false,
        showLine: true
      };
    }).filter(dataset => dataset !== null);

    return { 
      labels: formattedDateLabels,
      originalDates: sortedDates, // Keep original dates for tooltips
      datasets 
    };
  }, [watchlist, selectedStocks, timeRange, formatDateLabel]);

  // Prepare chart options - memoized
  const chartOptions = useMemo(() => {
    const isDark = theme === 'dark';
    const originalDates = chartData.originalDates || [];
    
    // Theme-based colors
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
    const textColor = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)';
    const tooltipBgColor = isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.95)';
    const tooltipBorderColor = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)';
    
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 750,
        easing: 'easeOutQuart' as const,
      },
      interaction: {
        mode: 'index' as const,
        intersect: false,
      },
      elements: {
        line: {
          tension: 0.1,
          borderWidth: 2,
          fill: true,
          spanGaps: false,
        },
        point: {
          radius: timeRange === '1D' ? 2 : 0, // Show points for 1D view
          hitRadius: 8,
          hoverRadius: 5,
        }
      },
      plugins: {
        legend: { 
          display: true, 
          position: 'top' as const,
          align: 'start' as const,
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 15,
            color: textColor,
            font: {
              size: 11
            }
          }
        },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
          backgroundColor: tooltipBgColor,
          titleColor: textColor,
          bodyColor: textColor,
          borderColor: tooltipBorderColor,
          borderWidth: 1,
          padding: 10,
          cornerRadius: 4,
          boxPadding: 5,
          usePointStyle: true,
          multiKeyBackground: 'transparent',
          callbacks: {
            title: (context: any) => {
              if (!context || !context.length || context[0].dataIndex === undefined) {
                return '';
              }
              
              const index = context[0].dataIndex;
              if (!originalDates || index >= originalDates.length) {
                return '';
              }
              
              const date = new Date(originalDates[index]);
              
              // Format date based on timeRange
              if (timeRange === '1D') {
                return date.toLocaleString([], { 
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: 'numeric',
                });
              } else if (timeRange === '7D') {
                return date.toLocaleString([], { 
                  weekday: 'short',
                  month: 'short', 
                  day: 'numeric',
                  hour: 'numeric',
                });
              } else {
                return date.toLocaleDateString([], { 
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                });
              }
            },
            label: (context: any) => {
              const value = context.parsed.y;
              if (value === null) return `${context.dataset.label}: No data`;
              return `${context.dataset.label}: $${value.toFixed(2)}`;
            }
          }
        },
        zoom: {
          pan: {
            enabled: true,
            mode: 'xy' as const,
            threshold: 10,
            modifierKey: 'ctrl' as const,
          },
          zoom: {
            wheel: {
              enabled: true,
              speed: 0.1,
            },
            pinch: {
              enabled: true
            },
            mode: 'xy' as const,
            drag: {
              enabled: true,
              backgroundColor: 'rgba(0,0,0,0.1)',
              borderColor: 'rgba(0,0,0,0.3)',
              borderWidth: 1,
            }
          },
          limits: {
            y: {min: 'original' as const, max: 'original' as const}
          }
        }
      },
      scales: {
        x: { 
          grid: { 
            display: true,
            color: gridColor,
            drawBorder: false,
            tickWidth: 0
          },
          ticks: {
            autoSkip: true,
            maxTicksLimit: timeRange === '1D' ? 6 : timeRange === '7D' ? 14 : timeRange === '30D' ? 10 : 12,
            font: { size: 10 },
            color: textColor,
            padding: 5,
            callback: function(this: any, value: any, index: number): string {
              if (!this.chart?.data?.labels?.[index]) return '';
              const date = new Date(this.chart.data.labels[index] as string);
              
              if (timeRange === '1D') {
                // For 1D, show time in HH:MM format
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              } else if (timeRange === '7D') {
                // For 7D, show weekday + hour
                const hour = date.getHours();
                const weekday = date.toLocaleDateString([], { weekday: 'short' });
                return hour % 3 === 0 ? `${weekday} ${hour}:00` : `${hour}:00`;
              } else if (timeRange === '30D') {
                return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
              } else if (timeRange === '5Y') {
                return date.toLocaleDateString([], { year: 'numeric', month: 'short' });
              }
              return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
            }
          }
        },
        y: {
          position: 'right' as const,
          grid: { 
            color: gridColor,
            drawBorder: false
          },
          border: {
            display: false
          },
          ticks: { 
            callback: (value: any) => `$${value.toFixed(2)}`,
            font: { size: 10 },
            color: textColor,
            padding: 8,
            maxTicksLimit: 8
          }
        }
      }
    };
  }, [theme, timeRange, chartData.originalDates]);

  // Reset zoom function
  const resetZoom = useCallback(() => {
    if (chartRef.current?.resetZoom) {
      chartRef.current.resetZoom();
    }
  }, []);

  // Chart reference handler
  const handleChartRef = useCallback((ref: any) => {
    if (ref) {
      try {
        if (chartRef.current) {
          chartRef.current.destroy();
        }
        chartRef.current = ref;
      } catch (error) {
        console.warn('Error setting chart ref:', error);
      }
    }
  }, []);

  // No data case
  if (chartData.datasets.length === 0) {
    return (
      <div className="h-[500px] flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">
          Select stocks from your watchlist to view price history.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[500px]">
      <div className="flex justify-between items-center mb-4">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {timeRange === '1D' ? 'Minute-by-minute data, last 24 hours' : 
           timeRange === '7D' ? 'Hourly data, last 7 days' : 
           timeRange === '30D' ? 'Daily data, last 30 days' : 
           timeRange === '1Y' ? 'Daily data, last year' : 'Weekly data, last 5 years'}
        </div>
        <button
          onClick={resetZoom}
          className="px-3 py-1 rounded-md text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          Reset Zoom
        </button>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 h-[calc(100%-40px)] shadow-sm">
        <Suspense fallback={
          <div className="h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
          </div>
        }>
          <Line
            key={chartKey}
            data={chartData}
            options={chartOptions}
            ref={handleChartRef}
            redraw={true}
          />
        </Suspense>
      </div>
    </div>
  );
};

export default function Recommendations() {
  const { getAuthHeader, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedStocks, setSelectedStocks] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('1Y');
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(true);
  const [showChart, setShowChart] = useState(false);
  const chartInstanceId = useRef(`chart-instance-${Date.now()}`).current;
  const chartRef = useRef<any>(null);

  // Auth header - memoized to prevent unnecessary recalculation
  const authHeader = useMemo(() => getAuthHeader() as AuthHeader, [getAuthHeader]);

  // Use React Query hooks with proper configuration
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

  // Show loading state for recommendations initially, then reveal after a delay
  useEffect(() => {
    if (!isRecommendationsLoading && recommendations) {
      const timer = setTimeout(() => {
        setIsLoadingRecommendations(false);
      }, 500); // Short delay for smoother UI
      return () => clearTimeout(timer);
    }
  }, [isRecommendationsLoading, recommendations]);

  // Delay chart display until after page loads
  useEffect(() => {
    if (!isWatchlistLoading && watchlist) {
      // Delay chart rendering to prioritize UI responsiveness
      const timer = setTimeout(() => {
        setShowChart(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isWatchlistLoading, watchlist]);

  // Add to watchlist mutation with proper error handling
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
      
      return symbol; // Return the symbol to fix the void type issue
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlistWithHistory'] });
    }
  });

  // Initialize selected stocks when watchlist changes
  useEffect(() => {
    if (watchlist && watchlist.length > 0) {
      setSelectedStocks(watchlist.map(stock => stock.symbol));
    }
  }, [watchlist]);

  // Authentication check
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  // Memoized callbacks for actions
  const handleStockSelect = useCallback((symbol: string) => {
    const stock = recommendations?.find(s => s.symbol === symbol) || null;
    setSelectedStock(stock);
  }, [recommendations]);

  const handleAddToWatchlist = useCallback((symbol: string) => {
    addToWatchlistMutation.mutate(symbol);
  }, [addToWatchlistMutation]);

  const handleToggleStockSelection = useCallback((symbol: string) => {
    setSelectedStocks(prev =>
      prev.includes(symbol) 
        ? prev.filter(s => s !== symbol) 
        : [...prev, symbol]
    );
  }, []);

  // Main loading handler - only show loader for initial page render
  if (isWatchlistLoading && isRecommendationsLoading) return (
    <div className="min-h-screen pt-16 bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
    </div>
  );

  // Handle errors
  const error = recommendationsError || watchlistError;
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
        
        {/* Top Recommendations */}
        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text mb-6">Top 5 Recommended Stocks This Week</h2>
          {isLoadingRecommendations ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
            </div>
          ) : recommendations && recommendations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendations.slice(0, 5).map((stock, index) => (
                <RecommendedStock 
                  key={stock.symbol}
                  stock={stock}
                  index={index}
                  onAddToWatchlist={handleAddToWatchlist}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-40">
              <p className="text-gray-500 dark:text-gray-400 mb-4">No recommendations available at the moment.</p>
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: ['recommendations'] })}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
              >
                Refresh Recommendations
              </button>
            </div>
          )}
        </div>

        {/* Watchlist */}
        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text mb-6">Your Watchlist</h2>
          {isWatchlistLoading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
            </div>
          ) : watchlist && watchlist.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {watchlist.map((stock, index) => (
                <WatchlistStock 
                  key={stock.id}
                  stock={stock}
                  index={index}
                  isSelected={selectedStocks.includes(stock.symbol)}
                  onToggleSelect={() => handleToggleStockSelection(stock.symbol)}
                  onSelect={() => handleStockSelect(stock.symbol)}
                />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">No stocks in watchlist. Add from recommendations above.</p>
          )}
        </div>

        {/* Price History Graph */}
        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text">Watchlist Price History</h2>
            <TimeRangeSelector timeRange={timeRange} setTimeRange={setTimeRange} />
          </div>
          
          {!showChart ? (
            <div className="h-[500px] flex items-center justify-center">
              <div className="animate-pulse flex flex-col items-center">
                <div className="rounded-lg bg-gray-200 dark:bg-gray-700 h-64 w-full mb-4"></div>
                <div className="text-gray-500 dark:text-gray-400">Loading chart data...</div>
              </div>
            </div>
          ) : watchlist && watchlist.length > 0 && selectedStocks.length > 0 ? (
            <Suspense fallback={
              <div className="h-[500px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
              </div>
            }>
              <StockChart 
                watchlist={watchlist}
                selectedStocks={selectedStocks}
                timeRange={timeRange}
                instanceId={chartInstanceId}
                key={`stock-chart-${timeRange}-${selectedStocks.join('-')}`}
              />
            </Suspense>
          ) : (
            <div className="h-[500px] flex items-center justify-center">
              <p className="text-gray-500 dark:text-gray-400">
                {watchlist && watchlist.length === 0 
                  ? "Add stocks to your watchlist to view price history." 
                  : "Select stocks from your watchlist to view price history."}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}