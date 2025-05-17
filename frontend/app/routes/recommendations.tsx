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
import { useTranslation } from 'react-i18next';

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
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
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
      
      if (!watchlistResponse.ok) {
        throw new Error("Failed to fetch watchlist");
      }
      
      const watchlistData = await watchlistResponse.json() as WatchlistResponse[];
      
      // Process each stock in the watchlist to include historical data
      const watchlistWithHistoryPromises = watchlistData.map(async (item) => {
        try {
          // Get stock details with historical data
          const stockResponse = await fetch(`/api/stocks/${item.symbol}`, {
            headers: {
              ...authHeader,
              "Content-Type": "application/json"
            }
          });
          
          if (!stockResponse.ok) {
            // If we can't get historical data, return item without it
            return {
              id: item.id,
              symbol: item.symbol,
              name: item.name,
              currentPrice: item.current_price,
              change: item.change,
              changePercent: item.change_percent,
              volume: item.volume,
              marketCap: item.market_cap,
              sharesOwned: item.shares_owned,
              totalValue: item.total_value,
              historicalData: []
            };
          }
          
          const stockData = await stockResponse.json();
          
          // Map historicalData to proper format for charts
          const historicalData = stockData.historical_data?.map((point: any) => ({
            date: point.date,
            price: point.price,
            is_intraday: point.date.includes(' ')
          })) || [];
          
          return {
            id: item.id,
            symbol: item.symbol,
            name: item.name,
            currentPrice: item.current_price,
            change: item.change,
            changePercent: item.change_percent,
            volume: item.volume,
            marketCap: item.market_cap,
            sharesOwned: item.shares_owned,
            totalValue: item.total_value,
            historicalData
          };
        } catch (error) {
          console.error(`Error fetching details for ${item.symbol}:`, error);
          // Return item without historical data in case of error
          return {
            id: item.id,
            symbol: item.symbol,
            name: item.name,
            currentPrice: item.current_price,
            change: item.change,
            changePercent: item.change_percent,
            volume: item.volume,
            marketCap: item.market_cap,
            sharesOwned: item.shares_owned,
            totalValue: item.total_value,
            historicalData: []
          };
        }
      });
      
      return Promise.all(watchlistWithHistoryPromises);
    },
    enabled: !!authHeader,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
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
  onAddToWatchlist,
  isInWatchlist
}: {
  stock: Stock;
  index: number;
  onAddToWatchlist: (symbol: string) => void;
  isInWatchlist: boolean;
}) => {
  const { t } = useTranslation();
  
  return (
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
      {isInWatchlist ? (
        <div className="w-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-2 text-center rounded-md font-medium">
          {t('recommendations.inWatchlist')}
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onAddToWatchlist(stock.symbol); }}
          className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 transition-colors"
        >
          {t('recommendations.addToWatchlist')}
        </button>
      )}
    </div>
  );
};

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
  <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md hover:shadow-lg transition-all duration-200 border border-gray-100 dark:border-gray-700 ${isSelected ? 'ring-2 ring-indigo-500 dark:ring-indigo-400' : ''}`}>
    <div className="flex items-center space-x-3 mb-3">
      <div 
        className="w-4 h-4 rounded-full" 
        style={{ backgroundColor: COLORS[index % COLORS.length] }}
      />
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggleSelect}
        className="w-4 h-4 text-indigo-600 dark:text-indigo-400 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 dark:focus:ring-indigo-400 cursor-pointer"
      />
      <div onClick={onSelect} className="cursor-pointer flex-1">
        <p className="text-base font-semibold text-gray-900 dark:text-dark-text">{stock.symbol}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">{stock.name}</p>
      </div>
    </div>
    <div className="flex justify-between items-center mt-2">
      <div>
        <p className="text-lg font-bold text-gray-900 dark:text-dark-text">${stock.currentPrice.toFixed(2)}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">Volume: {stock.volume.toLocaleString()}</p>
      </div>
      <p className={`text-sm font-medium ${stock.change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
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

// Add this component to show skeleton loading states
const RecommendedStockSkeleton = ({ index }: { index: number }) => (
  <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
    <div className="p-4 flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
          <div className="ml-3">
            <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded mt-1 animate-pulse"></div>
          </div>
        </div>
        <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
      </div>
      <div className="mt-3 h-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
      <div className="mt-4 flex items-center justify-between">
        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
      </div>
    </div>
  </div>
);

// Add this component to show skeleton loading for charts
const ChartSkeleton = () => (
  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
    <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4"></div>
    <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
    <div className="flex justify-center mt-4 space-x-2">
      {['1D', '7D', '30D', '1Y', '5Y'].map((range) => (
        <div key={range} className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
      ))}
    </div>
  </div>
);

// Add a new hook to get weekly top stocks from various sources
const useTopWeeklyRecommendations = (authHeader: AuthHeader) => {
  return useQuery({
    queryKey: ['topWeeklyRecommendations'],
    queryFn: async () => {
      if (!authHeader) return [];
      
      try {
        // In a production environment, you would call an actual API endpoint that:
        // 1. Aggregates data from financial research sources
        // 2. Uses market sentiment analysis
        // 3. Applies AI predictions for upcoming market trends
        // 4. Considers current economic indicators
        
        // For demo purposes, we'll simulate different top picks based on the current week number
        const today = new Date();
        const weekNumber = Math.floor((today.getTime() / (7 * 24 * 60 * 60 * 1000)));
        
        // These are hard-coded stocks that would normally come from various sources
        // In production, each week would have different recommendations based on actual analysis
        const stockSets = [
          // Week 1 recommendations (tech focus)
          [
            { symbol: "AAPL", name: "Apple Inc.", currentPrice: 175.35, change: 2.43, changePercent: 1.41, recommendation: "BUY", recommendationReason: "New product lineup expected to drive Q3 growth" },
            { symbol: "MSFT", name: "Microsoft Corporation", currentPrice: 328.79, change: 3.98, changePercent: 1.23, recommendation: "BUY", recommendationReason: "Cloud services division showing strong momentum" },
            { symbol: "GOOGL", name: "Alphabet Inc.", currentPrice: 138.42, change: -0.52, changePercent: -0.38, recommendation: "BUY", recommendationReason: "Ad revenue rebound expected after recent algorithm changes" },
            { symbol: "AMZN", name: "Amazon.com Inc.", currentPrice: 141.23, change: 1.87, changePercent: 1.34, recommendation: "BUY", recommendationReason: "E-commerce growth plus AWS expansion provides dual revenue streams" },
            { symbol: "NVDA", name: "NVIDIA Corporation", currentPrice: 435.20, change: 7.65, changePercent: 1.79, recommendation: "BUY", recommendationReason: "AI chip demand continues to outpace supply" }
          ],
          // Week 2 recommendations (finance focus)
          [
            { symbol: "JPM", name: "JPMorgan Chase & Co.", currentPrice: 152.80, change: 1.12, changePercent: 0.74, recommendation: "BUY", recommendationReason: "Strong performance amid rising interest rates" },
            { symbol: "BAC", name: "Bank of America Corp", currentPrice: 33.47, change: 0.28, changePercent: 0.84, recommendation: "HOLD", recommendationReason: "Solid fundamentals but watch consumer credit trends" },
            { symbol: "GS", name: "Goldman Sachs Group", currentPrice: 376.12, change: 4.27, changePercent: 1.15, recommendation: "BUY", recommendationReason: "Investment banking division showing strong deal flow" },
            { symbol: "V", name: "Visa Inc.", currentPrice: 242.35, change: 1.98, changePercent: 0.82, recommendation: "BUY", recommendationReason: "Payment volume increasing as travel rebounds globally" },
            { symbol: "MA", name: "Mastercard Inc.", currentPrice: 417.89, change: 3.54, changePercent: 0.85, recommendation: "BUY", recommendationReason: "Cross-border transactions accelerating with global economy" }
          ],
          // Week 3 recommendations (healthcare focus)
          [
            { symbol: "JNJ", name: "Johnson & Johnson", currentPrice: 156.76, change: -0.43, changePercent: -0.27, recommendation: "HOLD", recommendationReason: "Stable dividend performer with new product pipeline" },
            { symbol: "UNH", name: "UnitedHealth Group", currentPrice: 520.41, change: 6.89, changePercent: 1.34, recommendation: "BUY", recommendationReason: "Healthcare technology investments paying dividends" },
            { symbol: "PFE", name: "Pfizer Inc.", currentPrice: 28.79, change: -0.31, changePercent: -1.07, recommendation: "HOLD", recommendationReason: "Watch for new drug approvals in Q3" },
            { symbol: "ABT", name: "Abbott Laboratories", currentPrice: 108.12, change: 1.43, changePercent: 1.34, recommendation: "BUY", recommendationReason: "Medical device segment showing strong growth" },
            { symbol: "LLY", name: "Eli Lilly & Co.", currentPrice: 732.05, change: 14.23, changePercent: 1.98, recommendation: "BUY", recommendationReason: "Weight loss drug expected to receive expanded approvals" }
          ],
          // Week 4 recommendations (energy & industrial focus)
          [
            { symbol: "XOM", name: "Exxon Mobil Corp.", currentPrice: 113.25, change: 2.34, changePercent: 2.11, recommendation: "HOLD", recommendationReason: "Oil price volatility may present buying opportunities" },
            { symbol: "CVX", name: "Chevron Corporation", currentPrice: 152.37, change: 3.19, changePercent: 2.14, recommendation: "BUY", recommendationReason: "Strong dividend with new production starting in Q3" },
            { symbol: "NEE", name: "NextEra Energy", currentPrice: 71.48, change: 0.98, changePercent: 1.39, recommendation: "BUY", recommendationReason: "Renewable energy portfolio expanding with new acquisitions" },
            { symbol: "CAT", name: "Caterpillar Inc.", currentPrice: 336.09, change: 4.65, changePercent: 1.40, recommendation: "HOLD", recommendationReason: "Infrastructure spending benefiting equipment sales" },
            { symbol: "DE", name: "Deere & Company", currentPrice: 378.54, change: 2.87, changePercent: 0.76, recommendation: "BUY", recommendationReason: "Agricultural equipment demand remains strong globally" }
          ]
        ];
        
        // Use the week number to determine which set of recommendations to show
        const weekIndex = weekNumber % stockSets.length;
        const weeklyRecommendations = stockSets[weekIndex];
        
        // Transform the recommendations into the Stock type format
        return weeklyRecommendations.map((stock: any) => ({
          symbol: stock.symbol,
          name: stock.name,
          currentPrice: stock.currentPrice,
          change: stock.change,
          changePercent: stock.changePercent,
          volume: 0, // Would be populated from actual API
          marketCap: 0, // Would be populated from actual API
          historicalData: [], // Would be populated from actual API
          recommendation: stock.recommendation,
          recommendationReason: stock.recommendationReason
        })) as Stock[];
      } catch (error) {
        console.error('Error fetching weekly recommendations:', error);
        throw error;
      }
    },
    enabled: !!authHeader,
    staleTime: 24 * 60 * 60 * 1000, // Cache for 24 hours
    gcTime: 7 * 24 * 60 * 60 * 1000, // Keep cache for a week
    retry: 1,
    refetchOnWindowFocus: false,
  });
};

// Update the TopRecommendedStocks component to use the new data source
const TopRecommendedStocks = ({ 
  stocks, 
  onAddToWatchlist,
  isInWatchlist
}: {
  stocks: Stock[];
  onAddToWatchlist: (symbol: string) => void;
  isInWatchlist: (symbol: string) => boolean;
}) => {
  const { t } = useTranslation();
  
  // Get the start and end dates of the current week
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay()); // Set to the start of the week (Sunday)
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // Set to the end of the week (Saturday)
  
  const formattedStartDate = startOfWeek.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const formattedEndDate = endOfWeek.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  
  return (
    <div className="bg-gradient-to-r from-indigo-600 to-blue-500 dark:from-indigo-800 dark:to-blue-700 rounded-xl overflow-hidden shadow-xl mb-12">
      <div className="p-6">
        <h2 className="text-2xl font-bold text-white mb-2">
          Top 5 Recommended Stocks This Week
        </h2>
        <p className="text-indigo-100 mb-6">
          {formattedStartDate} - {formattedEndDate} • Updated {today.toLocaleDateString()}
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {stocks.map((stock, index) => (
            <div 
              key={stock.symbol} 
              className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md transform transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
            >
              <div className="flex items-center mb-3">
                <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold">
                  #{index + 1}
                </div>
                <div className="ml-3">
                  <h3 className="font-bold text-gray-900 dark:text-white">{stock.symbol}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{stock.name}</p>
                </div>
              </div>
              
              <div className="flex items-baseline justify-between mb-3">
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  ${stock.currentPrice.toFixed(2)}
                </span>
                <span className={`text-sm font-semibold ${
                  stock.change >= 0 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
                </span>
              </div>
              
              <div className="text-xs text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                {stock.recommendationReason}
              </div>
              
              {isInWatchlist(stock.symbol) ? (
                <div className="w-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-1.5 text-center rounded-md text-sm font-medium">
                  {t('recommendations.inWatchlist')}
                </div>
              ) : (
                <button
                  onClick={() => onAddToWatchlist(stock.symbol)}
                  className="w-full bg-indigo-600 text-white py-1.5 rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium"
                >
                  {t('recommendations.addToWatchlist')}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Add a skeleton loader for the top recommendations section
const TopRecommendedStocksSkeleton = () => (
  <div className="bg-gradient-to-r from-indigo-600 to-blue-500 dark:from-indigo-800 dark:to-blue-700 rounded-xl overflow-hidden shadow-xl mb-12 p-6">
    <div className="h-8 w-64 bg-indigo-400 dark:bg-indigo-600 rounded animate-pulse mb-2"></div>
    <div className="h-4 w-48 bg-indigo-400 dark:bg-indigo-600 rounded animate-pulse mb-8"></div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md">
          <div className="flex items-center mb-3">
            <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
            <div className="ml-3">
              <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded mt-1 animate-pulse"></div>
            </div>
          </div>
          <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-3"></div>
          <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
          <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-3"></div>
          <div className="h-8 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>
      ))}
    </div>
  </div>
);

export default function Recommendations() {
  const { isAuthenticated, getAuthHeader } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  
  // Get auth header for API requests
  const authHeader = useMemo(() => getAuthHeader() as AuthHeader, [getAuthHeader]);
  
  // State to track if initial page render is complete
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  
  // States for UI
  const [timeRange, setTimeRange] = useState<TimeRange>('30D');
  const [selectedStocks, setSelectedStocks] = useState<string[]>([]);
  
  // Fetch regular recommendations data
  const { 
    data: recommendedStocks = [],
    isLoading: isRecommendationsLoading,
    error: recommendationsError
  } = useRecommendations(authHeader);
  
  // Fetch weekly top recommendations (new data source)
  const {
    data: topWeeklyStocks = [],
    isLoading: isTopWeeklyLoading,
    error: topWeeklyError
  } = useTopWeeklyRecommendations(authHeader);
  
  // Fetch watchlist data
  const { 
    data: watchlist = [], 
    isLoading: isWatchlistLoading, 
    error: watchlistError
  } = useWatchlistWithHistory(authHeader);
  
  // Combination loading and error states
  const isLoading = isRecommendationsLoading || isWatchlistLoading || isTopWeeklyLoading;
  const hasError = recommendationsError || watchlistError || topWeeklyError;
  
  // Mark page as loaded after initial render
  useEffect(() => {
    // Short delay to prioritize initial render
    const timeoutId = setTimeout(() => {
      setIsPageLoaded(true);
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, []);
  
  // Prefetch stock data for watchlist to improve chart loading
  useEffect(() => {
    if (watchlist.length > 0 && isPageLoaded) {
      // Pre-fetch stock details for all watchlist items (in background)
      watchlist.forEach(stock => {
        queryClient.prefetchQuery({
          queryKey: ['stockDetail', stock.symbol],
          queryFn: async () => {
            const response = await fetch(`/api/stocks/${stock.symbol}`, {
              headers: {
                ...authHeader,
                "Content-Type": "application/json"
              }
            });
            if (!response.ok) throw new Error(`Failed to fetch ${stock.symbol}`);
            return response.json();
          },
        });
      });
    }
  }, [watchlist, queryClient, authHeader, isPageLoaded]);
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);
  
  // Handle adding a stock to the watchlist
  const addToWatchlistMutation = useMutation({
    mutationFn: async (stockSymbol: string) => {
      // First, search for the stock ID
      const searchResponse = await fetch(`/api/stocks/search?q=${stockSymbol}`, {
        headers: {
          ...authHeader,
          "Content-Type": "application/json"
        }
      });
      
      if (!searchResponse.ok) {
        throw new Error("Failed to search for stock");
      }
      
      const searchResults = await searchResponse.json();
      
      if (!searchResults || searchResults.length === 0) {
        throw new Error("Stock not found");
      }
      
      // Get stock details to get the ID
      const stockResponse = await fetch(`/api/stocks/${stockSymbol}`, {
        headers: {
          ...authHeader,
          "Content-Type": "application/json"
        }
      });
      
      if (!stockResponse.ok) {
        throw new Error("Failed to get stock details");
      }
      
      const stockData = await stockResponse.json();
      
      // Add stock to watchlist
      const addResponse = await fetch("/api/watchlist", {
        method: "POST",
        headers: {
          ...authHeader,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          stock_id: stockData.id
        })
      });
      
      if (!addResponse.ok) {
        const errorData = await addResponse.json();
        throw new Error(errorData.detail || "Failed to add to watchlist");
      }
      
      return addResponse.json();
    },
    onSuccess: () => {
      // Invalidate and refetch watchlist query
      queryClient.invalidateQueries({ queryKey: ['watchlistWithHistory'] });
    }
  });
  
  // Handle selecting a stock to display in chart
  const handleSelectStock = useCallback((symbol: string) => {
    setSelectedStocks(prev => {
      // If already in list, remove it; otherwise add it
      return prev.includes(symbol)
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol];
    });
  }, []);
  
  // Handle adding a stock to watchlist
  const handleAddToWatchlist = useCallback((symbol: string) => {
    addToWatchlistMutation.mutate(symbol);
  }, [addToWatchlistMutation]);
  
  // Add isInWatchlist helper function
  const isInWatchlist = useCallback((symbol: string) => {
    return watchlist?.some(stock => stock.symbol === symbol) ?? false;
  }, [watchlist]);
  
  return (
    <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-900">
      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top 5 Recommended Stocks This Week */}
        {hasError ? (
          <div className="mb-12 bg-red-50 dark:bg-red-900/20 p-4 rounded-md text-red-800 dark:text-red-200">
            <p>{t('recommendations.errorLoading')}</p>
          </div>
        ) : !isPageLoaded || isTopWeeklyLoading ? (
          <TopRecommendedStocksSkeleton />
        ) : topWeeklyStocks.length > 0 ? (
          <TopRecommendedStocks 
            stocks={topWeeklyStocks}
            onAddToWatchlist={handleAddToWatchlist}
            isInWatchlist={isInWatchlist}
          />
        ) : null}
        
        {/* Watchlist Section */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('recommendations.yourWatchlist')}
            </h2>
            
            {/* Time range selector for charts */}
            <TimeRangeSelector
              timeRange={timeRange}
              setTimeRange={setTimeRange}
            />
          </div>
          
          {/* Chart section */}
          <div className="mb-8">
            {hasError ? (
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md text-red-800 dark:text-red-200">
                <p>{t('recommendations.errorLoadingWatchlist')}</p>
              </div>
            ) : !isPageLoaded || isWatchlistLoading || selectedStocks.length === 0 ? (
              !isPageLoaded || isWatchlistLoading ? (
                <ChartSkeleton />
              ) : (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 text-center">
                  <p className="text-gray-600 dark:text-gray-300">
                    {t('recommendations.selectStocks')}
                  </p>
                </div>
              )
            ) : (
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  {t('recommendations.performanceComparison')}
                </h3>
                <Suspense fallback={<ChartSkeleton />}>
                  <StockChart
                    watchlist={watchlist}
                    selectedStocks={selectedStocks}
                    timeRange={timeRange}
                    instanceId="watchlist-chart"
                  />
                </Suspense>
              </div>
            )}
          </div>
          
          {/* Watchlist grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hasError ? (
              <div className="col-span-full bg-red-50 dark:bg-red-900/20 p-4 rounded-md text-red-800 dark:text-red-200">
                <p>{t('recommendations.errorLoadingWatchlist')}</p>
              </div>
            ) : !isPageLoaded || isWatchlistLoading ? (
              // Show skeleton loaders while loading
              Array.from({ length: 6 }).map((_, index) => (
                <RecommendedStockSkeleton key={index} index={index} />
              ))
            ) : watchlist.length > 0 ? (
              // Show actual watchlist
              watchlist.map((stock, index) => (
                <WatchlistStock
                  key={stock.symbol}
                  stock={stock}
                  index={index}
                  isSelected={selectedStocks.includes(stock.symbol)}
                  onToggleSelect={() => handleSelectStock(stock.symbol)}
                  onSelect={() => setSelectedStocks([stock.symbol])}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-10 bg-white dark:bg-gray-800 rounded-lg shadow">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">
                  {t('recommendations.noStocks')}
                </h3>
                <p className="mt-1 text-gray-500 dark:text-gray-400">
                  {t('recommendations.addStocks')}
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}