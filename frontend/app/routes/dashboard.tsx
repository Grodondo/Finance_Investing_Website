import { useState, useEffect, useMemo, useCallback, Suspense, lazy, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  Filler,
  TimeScale
} from "chart.js";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { 
  Bars3BottomLeftIcon, 
  ArrowTrendingUpIcon, 
  ArrowTrendingDownIcon, 
  CurrencyDollarIcon, 
  ChartBarIcon, 
  ClockIcon,
  StarIcon,
  BellIcon,
} from "@heroicons/react/24/outline";
import React from "react";
import LoadingPlaceholder from "../components/LoadingPlaceholder";

// Import chart components lazily
const Line = lazy(() => import("react-chartjs-2").then(module => ({ 
  default: React.memo(module.Line, (prevProps, nextProps) => {
    // Custom comparison function to prevent unnecessary re-renders
    return (
      prevProps.data === nextProps.data &&
      prevProps.options === nextProps.options
    );
  })
})));
const Bar = lazy(() => import("react-chartjs-2").then(module => ({ default: module.Bar })));

// Register zoom plugin
// @ts-ignore
import zoomPlugin from 'chartjs-plugin-zoom';

// Register ChartJS components first
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

// Configure zoom plugin
ChartJS.defaults.plugins.zoom = {
  pan: {
    enabled: true,
    mode: 'xy',
    threshold: 10,
    modifierKey: 'ctrl',
  },
  zoom: {
    wheel: {
      enabled: true,
      speed: 0.1,
    },
    pinch: {
      enabled: true
    },
    mode: 'xy',
    drag: {
      enabled: true,
      backgroundColor: 'rgba(0,0,0,0.1)',
      borderColor: 'rgba(0,0,0,0.3)',
      borderWidth: 1,
    }
  },
  limits: {
    y: {min: 'original', max: 'original'}
  }
};

interface Transaction {
  id: number;
  amount: number;
  description: string;
  type: "income" | "expense";
  category_id: number;
  date: string;
  user_id: number;
}

interface CategoryInsight {
  category_id: number;
  category_name: string;
  total_amount: number;
  transaction_count: number;
}

interface MonthlyInsight {
  month: string;
  income: number;
  expenses: number;
  balance: number;
}

interface FinancialInsights {
  total_income: number;
  total_expenses: number;
  net_balance: number;
  top_expense_categories: CategoryInsight[];
  monthly_trends: MonthlyInsight[];
}

interface DailyData {
  [date: string]: {
    income: number;
    expenses: number;
  };
}

interface WatchlistStock {
  id: string;
  symbol: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  sharesOwned: number;
  totalValue: number;
  historicalData: Array<{
    date: string;
    price: number;
    is_intraday: boolean;
  }>;
}

type SectionId = "portfolio-summary" | "market-overview" | "recent-transactions" | "financial-insights" | "watchlist" | "price-alerts";
type AuthHeader = { Authorization: string } | null;

interface DashboardData {
  watchlist: WatchlistStock[] | undefined;
  transactions: Transaction[] | undefined;
  insights: FinancialInsights | undefined;
}

interface DashboardItem {
  id: string;
  sectionId: SectionId;
  isFullWidth: boolean;
}

type TimeRange = '1D' | '7D' | '30D' | '1Y' | '5Y';

const useTransactions = (authHeader: AuthHeader) => {
  return useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      if (!authHeader) return [];
      const response = await fetch("/api/transactions", {
        headers: {
          ...authHeader,
          "Content-Type": "application/json"
        }
      });
      if (!response.ok) throw new Error("Failed to fetch transactions");
      return response.json() as Promise<Transaction[]>;
    },
    enabled: !!authHeader,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false
  });
};

const useFinancialInsights = (authHeader: AuthHeader) => {
  return useQuery({
    queryKey: ['insights'],
    queryFn: async () => {
      if (!authHeader) return null;
      const response = await fetch("/api/insights", {
        headers: {
          ...authHeader,
          "Content-Type": "application/json"
        }
      });
      if (!response.ok) throw new Error("Failed to fetch insights");
      return response.json() as Promise<FinancialInsights>;
    },
    enabled: !!authHeader,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false
  });
};

const useWatchlistWithHistory = (authHeader: AuthHeader) => {
  return useQuery({
    queryKey: ['watchlistWithHistory'],
    queryFn: async () => {
      if (!authHeader) return [];
      
      const watchlistResponse = await fetch("/api/watchlist", {
        headers: {
          ...authHeader,
          "Content-Type": "application/json"
        }
      });
      
      if (!watchlistResponse.ok) throw new Error("Failed to fetch watchlist");
      const watchlistData = await watchlistResponse.json();
      
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
        totalValue: stock.total_value || 0,
        historicalData: []
      }));

      // Fetch historical data in parallel with a concurrency limit
      const concurrencyLimit = 3;
      const chunks = [];
      for (let i = 0; i < normalizedWatchlist.length; i += concurrencyLimit) {
        chunks.push(normalizedWatchlist.slice(i, i + concurrencyLimit));
      }

      const watchlistWithHistory: WatchlistStock[] = [];
      for (const chunk of chunks) {
        const chunkResults = await Promise.all(
          chunk.map(async (stock: WatchlistStock): Promise<WatchlistStock> => {
            try {
              const response = await fetch(`/api/stocks/${stock.symbol}`, {
                headers: {
                  ...authHeader,
                  "Content-Type": "application/json"
                }
              });
              if (response.ok) {
                const stockData = await response.json();
                return {
                  ...stock,
                  currentPrice: stockData.current_price || stock.currentPrice,
                  change: stockData.change || stock.change,
                  changePercent: stockData.change_percent || stock.changePercent,
                  volume: stockData.volume || stock.volume,
                  marketCap: stockData.market_cap || stock.marketCap,
                  historicalData: stockData.historical_data?.map((point: any) => ({
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
        watchlistWithHistory.push(...chunkResults);
      }

      return watchlistWithHistory;
    },
    enabled: !!authHeader,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false
  });
};

const COLORS = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#E57373', '#81C784', '#64B5F6'];

const prepareTransactionsChartData = (transactions: Transaction[]) => {
  // Use Map for better performance with large datasets
  const dailyData = new Map<string, { income: number; expenses: number }>();
  
  transactions.forEach(t => {
    const date = new Date(t.date).toLocaleDateString();
    const current = dailyData.get(date) || { income: 0, expenses: 0 };
    if (t.type === "income") {
      current.income += t.amount;
    } else {
      current.expenses += t.amount;
    }
    dailyData.set(date, current);
  });

  const sortedDates = Array.from(dailyData.keys()).sort((a, b) => 
    new Date(a).getTime() - new Date(b).getTime()
  );

  return {
    labels: sortedDates,
    datasets: [
      {
        label: "Income",
        data: sortedDates.map(date => dailyData.get(date)!.income),
        borderColor: "rgb(34, 197, 94)",
        backgroundColor: "rgba(34, 197, 94, 0.1)",
        tension: 0.4,
        fill: true,
      },
      {
        label: "Expenses",
        data: sortedDates.map(date => dailyData.get(date)!.expenses),
        borderColor: "rgb(239, 68, 68)",
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        tension: 0.4,
        fill: true,
      },
    ],
  };
};

const getFilteredHistoricalData = (data: WatchlistStock['historicalData'] | undefined, range: TimeRange) => {
  if (!data || !Array.isArray(data) || data.length === 0) return [];

  const now = new Date();
  const cutoff = new Date(now);
  
  // Use Map for better performance with large datasets
  const filteredData = new Map<string, WatchlistStock['historicalData'][0]>();
  
  switch (range) {
    case '1D': {
      const hasIntradayData = data.some(item => item.is_intraday);
      const sortedData = [...data].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const mostRecentDate = sortedData[0]?.date?.split(' ')[0] || '';
      
      if (hasIntradayData) {
        data.forEach(item => {
          if (item.is_intraday && item.date.includes(mostRecentDate)) {
            filteredData.set(item.date, item);
          }
        });
      } else {
        const mostRecent = data.find(item => item.date.includes(mostRecentDate));
        if (mostRecent) {
          filteredData.set(mostRecent.date, mostRecent);
        }
      }
      break;
    }
    case '7D': {
      cutoff.setDate(now.getDate() - 7);
      data.forEach(item => {
        const itemDate = new Date(item.date);
        if (itemDate >= cutoff && !item.is_intraday) {
          filteredData.set(item.date, item);
        }
      });
      break;
    }
    case '30D': {
      cutoff.setDate(now.getDate() - 30);
      data.forEach(item => {
        const itemDate = new Date(item.date);
        if (itemDate >= cutoff && !item.is_intraday) {
          filteredData.set(item.date, item);
        }
      });
      break;
    }
    case '1Y': {
      cutoff.setFullYear(now.getFullYear() - 1);
      data.forEach(item => {
        const itemDate = new Date(item.date);
        if (itemDate >= cutoff && !item.is_intraday) {
          filteredData.set(item.date, item);
        }
      });
      break;
    }
    case '5Y': {
      cutoff.setFullYear(now.getFullYear() - 5);
      data.forEach(item => {
        const itemDate = new Date(item.date);
        if (itemDate >= cutoff && !item.is_intraday) {
          filteredData.set(item.date, item);
        }
      });
      
      // Sample data if too many points
      if (filteredData.size > 260) {
        const sampledData = new Map<string, WatchlistStock['historicalData'][0]>();
        let count = 0;
        for (const [date, item] of filteredData) {
          if (count % 5 === 0) {
            sampledData.set(date, item);
          }
          count++;
        }
        return Array.from(sampledData.values());
      }
      break;
    }
  }

  return Array.from(filteredData.values());
};

const prepareWatchlistChartData = (watchlist: WatchlistStock[] | undefined, selectedStocks: string[], range: TimeRange) => {
  if (!watchlist || watchlist.length === 0 || selectedStocks.length === 0) {
    return { labels: [], datasets: [] };
  }

  // Use Set for unique dates
  const allDates = new Set<string>();
  const stockData = new Map<string, Map<string, number>>();

  // Pre-process data for better performance
  selectedStocks.forEach(symbol => {
    const stock = watchlist.find(s => s.symbol === symbol);
    if (stock?.historicalData) {
      const filteredData = getFilteredHistoricalData(stock.historicalData, range);
      const priceMap = new Map<string, number>();
      
      filteredData.forEach(item => {
        allDates.add(item.date);
        priceMap.set(item.date, item.price);
      });
      
      stockData.set(symbol, priceMap);
    }
  });

  // Sort dates chronologically
  const sortedDates = Array.from(allDates).sort((a, b) => 
    new Date(a).getTime() - new Date(b).getTime()
  );

  // Create datasets
  const datasets = selectedStocks.map((symbol, index) => {
    const priceMap = stockData.get(symbol);
    if (!priceMap) return null;

    const color = COLORS[index % COLORS.length];
    const data = sortedDates.map(date => priceMap.get(date) ?? null);

    return {
      label: symbol,
      data,
      borderColor: color,
      backgroundColor: `${color}20`,
      fill: true,
      tension: 0.4,
      pointRadius: range === '1D' ? 0 : 2,
      pointHoverRadius: 4,
      borderWidth: 2,
      spanGaps: true
    };
  }).filter(dataset => dataset !== null);

  return { 
    labels: sortedDates,
    datasets
  };
};

// Update chart options
const getChartOptions = (chartRef: any): ChartOptions<"line"> => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 0 // Disable animations for better performance
  },
  plugins: {
    legend: { 
      display: true, 
      position: "top" as const,
      labels: {
        boxWidth: 12,
        usePointStyle: true,
        pointStyle: 'circle'
      }
    },
    tooltip: { 
      mode: "index" as const, 
      intersect: false,
      animation: {
        duration: 0
      }
    },
    zoom: {
      pan: {
        enabled: true,
        mode: 'xy' as const,
        threshold: 10,
        modifierKey: 'ctrl',
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
        y: {min: 'original', max: 'original'}
      }
    }
  },
  elements: {
    point: {
      radius: 0,
      hitRadius: 8,
      hoverRadius: 5,
    },
    line: {
      borderWidth: 2,
      tension: 0.4
    }
  },
  scales: {
    y: { 
      beginAtZero: true, 
      grid: { 
        color: "rgba(0, 0, 0, 0.1)"
      },
      ticks: {
        maxTicksLimit: 8,
        callback: (value: any) => `$${value.toFixed(2)}`
      }
    },
    x: { 
      grid: { 
        display: false
      }, 
      ticks: { 
        maxTicksLimit: 10,
        autoSkip: true,
        maxRotation: 0
      } 
    },
  },
  interaction: {
    mode: 'nearest',
    axis: 'x',
    intersect: false
  }
});

const getWatchlistChartOptions = (range: TimeRange, chartRef: any): ChartOptions<"line"> => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 0 // Disable animations for better performance
  },
  plugins: {
    legend: { 
      display: true, 
      position: "top" as const,
      labels: {
        color: 'rgb(156, 163, 175)',
        usePointStyle: true,
        pointStyle: 'circle',
        boxWidth: 12
      }
    },
    tooltip: {
      mode: "index" as const,
      intersect: false,
      animation: {
        duration: 0
      },
      backgroundColor: 'rgba(17, 24, 39, 0.8)',
      titleColor: 'rgb(229, 231, 235)',
      bodyColor: 'rgb(229, 231, 235)',
      borderColor: 'rgba(75, 85, 99, 0.2)',
      borderWidth: 1,
      callbacks: {
        label: (context: any) => `${context.dataset.label}: $${context.parsed.y.toFixed(2)}`,
        title: (context: any) => {
          if (!context?.[0]?.dataIndex === undefined) return '';
          
          const date = new Date(context[0].chart.data.labels[context[0].dataIndex]);
          return date.toLocaleDateString([], { 
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: range === '1D' ? 'numeric' : undefined,
            minute: range === '1D' ? 'numeric' : undefined
          });
        }
      }
    },
    zoom: {
      pan: {
        enabled: true,
        mode: 'xy' as const,
      },
      zoom: {
        wheel: {
          enabled: true,
        },
        pinch: {
          enabled: true
        },
        mode: 'xy' as const,
      }
    }
  },
  elements: {
    point: {
      radius: range === '1D' ? 0 : 2,
      hitRadius: 8,
      hoverRadius: 4,
    },
    line: {
      borderWidth: 2,
      tension: 0.4
    }
  },
  scales: {
    x: { 
      grid: { 
        display: false,
        color: 'rgba(75, 85, 99, 0.1)'
      },
      ticks: {
        color: 'rgb(156, 163, 175)',
        maxTicksLimit: range === '1D' ? 12 : range === '7D' ? 7 : range === '30D' ? 15 : 20,
        autoSkip: true,
        maxRotation: 0,
        callback: function(this: any, value, index) {
          if (!this.chart?.data?.labels?.[index]) return '';
          
          const date = new Date(this.chart.data.labels[index] as string);
          if (range === '1D') {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } else if (range === '7D') {
            return date.toLocaleDateString([], { weekday: 'short', day: 'numeric' });
          } else if (range === '30D') {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
          } else if (range === '5Y') {
            return date.toLocaleDateString([], { year: 'numeric', month: 'short' });
          }
          return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
        }
      }
    },
    y: {
      position: 'right' as const,
      grid: { 
        color: 'rgba(75, 85, 99, 0.1)'
      },
      ticks: { 
        color: 'rgb(156, 163, 175)',
        maxTicksLimit: 8,
        callback: (value: any) => `$${value.toFixed(2)}`
      }
    }
  },
  interaction: {
    mode: 'nearest',
    axis: 'x',
    intersect: false
  }
});

// Dashboard section component
const DashboardSection = ({ sectionId, transactions, insights, watchlist, selectedStocks, setSelectedStocks, watchlistChartOptions, transactionsChartOptions, transactionsChartData, watchlistChartData, timeRange, setTimeRange, isChartsVisible, watchlistChartRef, setWatchlistChartRef, transactionsChartRef, setTransactionsChartRef, resetWatchlistZoom, resetTransactionsZoom }: any) => {
  const handleResetZoom = useCallback(() => {
    if (sectionId === "portfolio-summary") {
      resetTransactionsZoom();
    } else if (sectionId === "watchlist") {
      resetWatchlistZoom();
    }
  }, [sectionId, resetTransactionsZoom, resetWatchlistZoom]);

  return (
    <div className="p-6">
      {sectionId === "portfolio-summary" && (
        <div className="space-y-6">
          {!isChartsVisible ? (
            <div className="h-[400px] bg-white dark:bg-gray-800 rounded-lg p-4">
              <LoadingPlaceholder type="chart" height="100%" />
            </div>
          ) : (
            <Suspense fallback={
              <div className="h-[400px] bg-white dark:bg-gray-800 rounded-lg p-4">
                <LoadingPlaceholder type="chart" height="100%" />
              </div>
            }>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                <div className="flex justify-between mb-2">
                  <div></div>
                  <button
                    onClick={handleResetZoom}
                    className="px-3 py-1 rounded-md text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Reset Zoom
                  </button>
                </div>
                <div className="h-[400px]">
                  <Line 
                    key={`transactions-chart-${transactions?.length || 0}-${isChartsVisible}`}
                    data={transactionsChartData} 
                    options={{
                      ...transactionsChartOptions,
                      maintainAspectRatio: false,
                      responsive: true
                    }}
                    ref={transactionsChartRef}
                  />
                </div>
              </div>
            </Suspense>
          )}
        </div>
      )}
      {sectionId === "market-overview" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">S&P 500</h3>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">4,783.45</span>
              <span className="text-sm font-medium text-green-600 dark:text-green-400">+1.25%</span>
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Dow Jones</h3>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">37,305.16</span>
              <span className="text-sm font-medium text-green-600 dark:text-green-400">+0.86%</span>
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">NASDAQ</h3>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">14,963.23</span>
              <span className="text-sm font-medium text-red-600 dark:text-red-400">-0.32%</span>
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}
      {sectionId === "watchlist" && (
        <div className="space-y-6">
          {watchlist && watchlist.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {watchlist.map((stock: WatchlistStock) => (
                  <div
                    key={stock.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                    onClick={() => setSelectedStocks((prev: string[]) => 
                      prev.includes(stock.symbol)
                        ? prev.filter((s: string) => s !== stock.symbol)
                        : [...prev, stock.symbol]
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{stock.symbol}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{stock.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
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
                  </div>
                ))}
              </div>
              <div className="h-[400px] bg-white dark:bg-gray-800 rounded-lg p-4">
                {!isChartsVisible ? (
                  <LoadingPlaceholder type="chart" height="100%" />
                ) : (
                  <Suspense fallback={
                    <div className="h-[400px] bg-white dark:bg-gray-800 rounded-lg p-4">
                      <LoadingPlaceholder type="chart" height="100%" />
                    </div>
                  }>
                    <Line
                      key={`watchlist-chart-${timeRange}-${selectedStocks.join('-')}-${isChartsVisible}`}
                      data={watchlistChartData}
                      options={watchlistChartOptions}
                      ref={watchlistChartRef}
                    />
                  </Suspense>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <StarIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                No stocks in your watchlist. Add stocks from the recommendations page.
              </p>
            </div>
          )}
        </div>
      )}
      {sectionId === "financial-insights" && (
        <div>
          {insights ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-green-800">Total Income</h3>
                  <p className="mt-1 text-2xl font-semibold text-green-900">
                    ${insights.total_income.toFixed(2)}
                  </p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-red-800">Total Expenses</h3>
                  <p className="mt-1 text-2xl font-semibold text-red-900">
                    ${insights.total_expenses.toFixed(2)}
                  </p>
                </div>
                <div className={`p-4 rounded-lg ${insights.net_balance >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                  <h3 className={`text-sm font-medium ${insights.net_balance >= 0 ? "text-green-800" : "text-red-800"}`}>
                    Net Balance
                  </h3>
                  <p className={`mt-1 text-2xl font-semibold ${insights.net_balance >= 0 ? "text-green-900" : "text-red-900"}`}>
                    ${insights.net_balance.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <LoadingPlaceholder type="card" />
          )}
        </div>
      )}
      {sectionId === "price-alerts" && (
        <div className="space-y-4">
          <div className="text-center text-gray-500 py-8">
            Set up price alerts to monitor your favorite stocks
          </div>
        </div>
      )}
    </div>
  );
};

export default function Dashboard() {
  const { user, logout, getAuthHeader, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // All state declarations
  const [selectedStocks, setSelectedStocks] = useState<string[]>([]);
  const [isCompact, setIsCompact] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('30D');
  const [isChartDataLoaded, setIsChartDataLoaded] = useState(false);
  const [isChartsVisible, setIsChartsVisible] = useState(false);
  const [watchlistChartRef, setWatchlistChartRef] = useState<any>(null);
  const [transactionsChartRef, setTransactionsChartRef] = useState<any>(null);
  const [dashboardItems, setDashboardItems] = useState<DashboardItem[]>([
    { id: "item-portfolio-summary", sectionId: "portfolio-summary", isFullWidth: true },
    { id: "item-market-overview", sectionId: "market-overview", isFullWidth: true },
    { id: "item-watchlist", sectionId: "watchlist", isFullWidth: false },
    { id: "item-recent-transactions", sectionId: "recent-transactions", isFullWidth: false },
    { id: "item-financial-insights", sectionId: "financial-insights", isFullWidth: false },
    { id: "item-price-alerts", sectionId: "price-alerts", isFullWidth: false }
  ]);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const chartInstancesRef = useRef<{ [key: string]: any }>({});

  // Auth header
  const authHeader = useMemo(() => getAuthHeader() as AuthHeader, [getAuthHeader]);

  // Prefetch data when component mounts
  useEffect(() => {
    if (authHeader) {
      // Prefetch transactions
      queryClient.prefetchQuery({
        queryKey: ['transactions'],
        queryFn: async () => {
          const response = await fetch("/api/transactions", {
            headers: {
              ...authHeader,
              "Content-Type": "application/json"
            }
          });
          if (!response.ok) throw new Error("Failed to fetch transactions");
          return response.json();
        },
        staleTime: 30000,
        gcTime: 5 * 60 * 1000,
      });

      // Prefetch insights
      queryClient.prefetchQuery({
        queryKey: ['insights'],
        queryFn: async () => {
          const response = await fetch("/api/insights", {
            headers: {
              ...authHeader,
              "Content-Type": "application/json"
            }
          });
          if (!response.ok) throw new Error("Failed to fetch insights");
          return response.json();
        },
        staleTime: 30000,
        gcTime: 5 * 60 * 1000,
      });

      // Prefetch watchlist
      queryClient.prefetchQuery({
        queryKey: ['watchlistWithHistory'],
        queryFn: async () => {
          const watchlistResponse = await fetch("/api/watchlist", {
            headers: {
              ...authHeader,
              "Content-Type": "application/json"
            }
          });
          if (!watchlistResponse.ok) throw new Error("Failed to fetch watchlist");
          const watchlistData = await watchlistResponse.json();
          
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
            totalValue: stock.total_value || 0,
            historicalData: []
          }));

          // Fetch historical data in parallel with a concurrency limit
          const concurrencyLimit = 3;
          const chunks = [];
          for (let i = 0; i < normalizedWatchlist.length; i += concurrencyLimit) {
            chunks.push(normalizedWatchlist.slice(i, i + concurrencyLimit));
          }

          const watchlistWithHistory = [];
          for (const chunk of chunks) {
            const chunkResults = await Promise.all(
              chunk.map(async (stock: WatchlistStock): Promise<WatchlistStock> => {
                try {
                  const response = await fetch(`/api/stocks/${stock.symbol}`, {
                    headers: {
                      ...authHeader,
                      "Content-Type": "application/json"
                    }
                  });
                  if (response.ok) {
                    const stockData = await response.json();
                    return {
                      ...stock,
                      currentPrice: stockData.current_price || stock.currentPrice,
                      change: stockData.change || stock.change,
                      changePercent: stockData.change_percent || stock.changePercent,
                      volume: stockData.volume || stock.volume,
                      marketCap: stockData.market_cap || stock.marketCap,
                      historicalData: stockData.historical_data?.map((point: any) => ({
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
            watchlistWithHistory.push(...chunkResults);
          }

          return watchlistWithHistory;
        },
        staleTime: 30000,
        gcTime: 5 * 60 * 1000,
      });
    }
  }, [authHeader, queryClient]);

  // Data fetching
  const { 
    data: transactions, 
    isLoading: isTransactionsLoading,
    error: transactionsError 
  } = useTransactions(authHeader);

  const { 
    data: insights, 
    isLoading: isInsightsLoading,
    error: insightsError 
  } = useFinancialInsights(authHeader);

  const { 
    data: watchlist,
    isLoading: isWatchlistLoading,
    error: watchlistError 
  } = useWatchlistWithHistory(authHeader);

  // Chart management functions
  const destroyChart = useCallback((chartId: string) => {
    if (chartInstancesRef.current[chartId]) {
      try {
        chartInstancesRef.current[chartId].destroy();
        delete chartInstancesRef.current[chartId];
      } catch (error) {
        console.warn(`Error destroying chart ${chartId}:`, error);
      }
    }
  }, []);

  const registerChart = useCallback((chartId: string, instance: any) => {
    destroyChart(chartId);
    chartInstancesRef.current[chartId] = instance;
  }, [destroyChart]);

  const resetWatchlistZoom = useCallback(() => {
    if (chartInstancesRef.current['watchlist']?.resetZoom) {
      chartInstancesRef.current['watchlist'].resetZoom();
    }
  }, []);

  const resetTransactionsZoom = useCallback(() => {
    if (chartInstancesRef.current['transactions']?.resetZoom) {
      chartInstancesRef.current['transactions'].resetZoom();
    }
  }, []);

  const handleTransactionsChartRef = useCallback((ref: any) => {
    if (ref) {
      try {
        if (chartInstancesRef.current['transactions']) {
          chartInstancesRef.current['transactions'].destroy();
        }
        chartInstancesRef.current['transactions'] = ref.chartInstance || ref;
      } catch (error) {
        console.warn('Error setting transactions chart ref:', error);
      }
    }
    setTransactionsChartRef(ref);
  }, []);

  const handleWatchlistChartRef = useCallback((ref: any) => {
    if (ref) {
      try {
        if (chartInstancesRef.current['watchlist']) {
          chartInstancesRef.current['watchlist'].destroy();
        }
        chartInstancesRef.current['watchlist'] = ref.chartInstance || ref;
      } catch (error) {
        console.warn('Error setting watchlist chart ref:', error);
      }
    }
    setWatchlistChartRef(ref);
  }, []);

  // Chart data preparation with better memoization
  const transactionsChartData = useMemo(() => {
    if (!transactions || !isChartDataLoaded) return { labels: [], datasets: [] };
    return prepareTransactionsChartData(transactions);
  }, [transactions, isChartDataLoaded]);

  const watchlistChartData = useMemo(() => {
    if (!watchlist || !isChartDataLoaded || selectedStocks.length === 0) return { labels: [], datasets: [] };
    return prepareWatchlistChartData(watchlist, selectedStocks, timeRange);
  }, [watchlist, selectedStocks, timeRange, isChartDataLoaded]);

  // Memoize chart options to prevent unnecessary re-renders
  const transactionsChartOptions = useMemo(() => 
    getChartOptions(transactionsChartRef), 
    [transactionsChartRef]
  );

  const watchlistChartOptions = useMemo(() => 
    getWatchlistChartOptions(timeRange, watchlistChartRef), 
    [timeRange, watchlistChartRef]
  );

  // Optimize chart cleanup
  useEffect(() => {
    return () => {
      Object.values(chartInstancesRef.current).forEach(chart => {
        try {
          chart.destroy();
        } catch (error) {
          console.warn('Error destroying chart:', error);
        }
      });
      chartInstancesRef.current = {};
    };
  }, []);

  // Optimize data loading effect
  useEffect(() => {
    if (!isTransactionsLoading && !transactionsError && 
        !isInsightsLoading && !insightsError && 
        !isWatchlistLoading && !watchlistError) {
      setIsChartDataLoaded(true);
      
      // Use requestAnimationFrame for smoother chart rendering
      requestAnimationFrame(() => {
        setIsChartsVisible(true);
      });
    }
  }, [isTransactionsLoading, transactionsError, isInsightsLoading, insightsError, isWatchlistLoading, watchlistError]);

  // HTML5 Drag and Drop functions
  const handleDragStart = (index: number) => {
    setDraggedItem(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    
    if (draggedItem === null) return;
    if (draggedItem === index) return;

    const newItems = [...dashboardItems];
    const draggedItemContent = newItems[draggedItem];
    
    // Remove the dragged item
    newItems.splice(draggedItem, 1);
    // Add it at the new position
    newItems.splice(index, 0, draggedItemContent);
    
    setDashboardItems(newItems);
    setDraggedItem(index);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  useEffect(() => {
    const handleResize = () => {
      setIsCompact(window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (watchlist && watchlist.length > 0) {
      setSelectedStocks(watchlist.map(stock => stock.symbol));
    }
  }, [watchlist]);

  const isLoading = isTransactionsLoading || isInsightsLoading || isWatchlistLoading;
  const error = transactionsError || insightsError || watchlistError;

  if (isLoading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8">
            <LoadingPlaceholder type="chart" height="400px" className="mb-6" />
            <LoadingPlaceholder type="card" className="mb-6" />
          </div>
          <div className="col-span-12 lg:col-span-4">
            <LoadingPlaceholder type="list" className="mb-6" />
            <LoadingPlaceholder type="card" />
          </div>
        </div>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen pt-16 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
        <p className="text-gray-600 mb-4">
          {error instanceof Error ? error.message : "An error occurred"}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700"
        >
          Try Again
        </button>
      </div>
    </div>
  );

  const getGridColumnClass = (item: DashboardItem) => {
    if (isCompact) return "";
    return item.isFullWidth ? "col-span-2" : "";
  };

  const getSectionTitle = (sectionId: SectionId) => {
    return {
      "portfolio-summary": "Portfolio Summary",
      "market-overview": "Market Overview",
      "watchlist": "Watchlist",
      "recent-transactions": "Recent Transactions",
      "financial-insights": "Financial Insights",
      "price-alerts": "Price Alerts"
    }[sectionId];
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="pt-16 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center space-x-4 mb-4 lg:mb-0">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
              <div className="hidden lg:flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                <ClockIcon className="h-4 w-4" />
                <span>Last updated: {new Date().toLocaleTimeString()}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Portfolio Value</span>
                  <CurrencyDollarIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  ${insights?.net_balance.toFixed(2) || "0.00"}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Daily Change</span>
                  <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />
                </div>
                <p className="text-lg font-semibold text-green-600">+2.5%</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Monthly Return</span>
                  <ChartBarIcon className="h-4 w-4 text-gray-400" />
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">+5.2%</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Open Positions</span>
                  <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />
                </div>
                <p className="text-lg font-semibold text-red-600">-1.2%</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className={`grid gap-6 ${isCompact ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {dashboardItems.map((item, index) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm ${getGridColumnClass(item)} ${
                draggedItem === index ? 'border-2 border-indigo-500 opacity-70' : ''
              }`}
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 cursor-move">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                  {getSectionTitle(item.sectionId)}
                </h2>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Drag to reorder</span>
                  <Bars3BottomLeftIcon className="h-5 w-5 text-gray-400 dark:text-gray-500 cursor-move" />
                </div>
              </div>
              <DashboardSection 
                sectionId={item.sectionId}
                transactions={transactions}
                insights={insights}
                watchlist={watchlist}
                selectedStocks={selectedStocks}
                setSelectedStocks={setSelectedStocks}
                watchlistChartOptions={watchlistChartOptions}
                transactionsChartOptions={transactionsChartOptions}
                transactionsChartData={transactionsChartData}
                watchlistChartData={watchlistChartData}
                timeRange={timeRange}
                setTimeRange={setTimeRange}
                isChartsVisible={isChartsVisible}
                watchlistChartRef={handleWatchlistChartRef}
                setWatchlistChartRef={setWatchlistChartRef}
                transactionsChartRef={handleTransactionsChartRef}
                setTransactionsChartRef={setTransactionsChartRef}
                resetWatchlistZoom={resetWatchlistZoom}
                resetTransactionsZoom={resetTransactionsZoom}
              />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}