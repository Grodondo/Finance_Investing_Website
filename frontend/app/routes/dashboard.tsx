import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Line, Bar } from "react-chartjs-2";
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
} from "chart.js";
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProvided, DraggableProvided } from "react-beautiful-dnd";
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

type SectionId = "portfolio-summary" | "market-overview" | "recent-transactions" | "financial-insights" | "watchlist" | "price-alerts";
type AuthHeader = { Authorization: string } | null;

interface DashboardData {
  watchlist: WatchlistStock[] | undefined;
  transactions: Transaction[] | undefined;
  insights: FinancialInsights | undefined;
}

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
    staleTime: 30000,
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
    staleTime: 30000,
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

      const watchlistWithHistory = await Promise.all(
        normalizedWatchlist.map(async (stock: WatchlistStock) => {
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

      return watchlistWithHistory;
    },
    enabled: !!authHeader,
    staleTime: 30000,
  });
};

const COLORS = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#E57373', '#81C784', '#64B5F6'];

const prepareTransactionsChartData = (transactions: Transaction[]) => {
  const dailyData = transactions.reduce<Record<string, { income: number; expenses: number }>>((acc, t) => {
    const date = new Date(t.date).toLocaleDateString();
    if (!acc[date]) acc[date] = { income: 0, expenses: 0 };
    if (t.type === "income") acc[date].income += t.amount;
    else acc[date].expenses += t.amount;
    return acc;
  }, {});

  const sortedDates = Object.keys(dailyData).sort((a, b) => 
    new Date(a).getTime() - new Date(b).getTime()
  );

  return {
    labels: sortedDates,
    datasets: [
      {
        label: "Income",
        data: sortedDates.map((date) => dailyData[date].income),
        borderColor: "rgb(34, 197, 94)",
        backgroundColor: "rgba(34, 197, 94, 0.1)",
        tension: 0.4,
        fill: true,
      },
      {
        label: "Expenses",
        data: sortedDates.map((date) => dailyData[date].expenses),
        borderColor: "rgb(239, 68, 68)",
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        tension: 0.4,
        fill: true,
      },
    ],
  };
};

const prepareWatchlistChartData = (watchlist: WatchlistStock[] | undefined, selectedStocks: string[]) => {
  if (!watchlist || watchlist.length === 0 || selectedStocks.length === 0) {
    return { labels: [], datasets: [] };
  }

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - 30);

  const datasets = selectedStocks.map((symbol, index) => {
    const stock = watchlist.find(s => s.symbol === symbol);
    if (!stock?.historicalData) return null;

    const filteredData = stock.historicalData.filter(item => new Date(item.date) >= cutoff);
    const color = COLORS[index % COLORS.length];

    return {
      label: symbol,
      data: filteredData.map(item => item.price),
      borderColor: color,
      backgroundColor: `${color}20`,
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      borderWidth: 2
    };
  }).filter(dataset => dataset !== null);

  const labels = watchlist[0]?.historicalData
    ?.filter(item => new Date(item.date) >= cutoff)
    .map(item => new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' })) || [];

  return { labels, datasets };
};

const getChartOptions = (timeRange?: string): ChartOptions<"line"> => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { 
      display: true, 
      position: "top" as const 
    },
    tooltip: { 
      mode: "index" as const, 
      intersect: false 
    },
  },
  scales: {
    y: { 
      beginAtZero: true, 
      grid: { color: "rgba(0, 0, 0, 0.1)" } 
    },
    x: { 
      grid: { display: false }, 
      ticks: { maxTicksLimit: 10 } 
    },
  },
});

const getWatchlistChartOptions = (): ChartOptions<"line"> => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { 
      display: true, 
      position: "top" as const,
      labels: {
        color: 'rgb(156, 163, 175)',
        usePointStyle: true,
        pointStyle: 'circle'
      }
    },
    tooltip: {
      mode: "index" as const,
      intersect: false,
      backgroundColor: 'rgba(17, 24, 39, 0.8)',
      titleColor: 'rgb(229, 231, 235)',
      bodyColor: 'rgb(229, 231, 235)',
      borderColor: 'rgba(75, 85, 99, 0.2)',
      borderWidth: 1,
      callbacks: {
        label: (context: any) => `${context.dataset.label}: $${context.parsed.y.toFixed(2)}`
      }
    }
  },
  scales: {
    x: { 
      grid: { 
        display: false,
        color: 'rgba(75, 85, 99, 0.1)'
      },
      ticks: {
        color: 'rgb(156, 163, 175)'
      }
    },
    y: {
      position: 'right' as const,
      grid: { 
        color: 'rgba(75, 85, 99, 0.1)'
      },
      ticks: { 
        color: 'rgb(156, 163, 175)',
        callback: (value: any) => `$${value.toFixed(2)}`
      }
    }
  }
});

export default function Dashboard() {
  const { user, logout, getAuthHeader, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedStocks, setSelectedStocks] = useState<string[]>([]);
  const [sectionOrder, setSectionOrder] = useState<SectionId[]>([
    "portfolio-summary",
    "market-overview",
    "watchlist",
    "recent-transactions",
    "financial-insights",
    "price-alerts"
  ]);
  const [isCompact, setIsCompact] = useState(false);

  const authHeader = useMemo(() => getAuthHeader() as AuthHeader, [getAuthHeader]);

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

  const transactionsChartData = useMemo(() => {
    if (!transactions) return { labels: [], datasets: [] };
    return prepareTransactionsChartData(transactions);
  }, [transactions]);

  const watchlistChartData = useMemo(() => {
    if (!watchlist) return { labels: [], datasets: [] };
    return prepareWatchlistChartData(watchlist, selectedStocks);
  }, [watchlist, selectedStocks]);

  const chartOptions = useMemo(() => getChartOptions(), []);
  const watchlistChartOptions = useMemo(() => getWatchlistChartOptions(), []);

  const onDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(sectionOrder);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setSectionOrder(items as SectionId[]);
  }, [sectionOrder]);

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
    <div className="min-h-screen pt-16 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
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
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="dashboard-sections" direction={isCompact ? "vertical" : "horizontal"}>
            {(provided: DroppableProvided) => (
              <div 
                {...provided.droppableProps} 
                ref={provided.innerRef} 
                className={`grid gap-6 ${isCompact ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}
              >
                {sectionOrder.map((sectionId, index) => (
                  <Draggable key={sectionId} draggableId={sectionId} index={index}>
                    {(provided: DraggableProvided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm ${
                          sectionId === "portfolio-summary" || sectionId === "market-overview" 
                            ? "lg:col-span-2" 
                            : ""
                        }`}
                      >
                        <div
                          className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700"
                          {...provided.dragHandleProps}
                        >
                          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                            {sectionId === "portfolio-summary" 
                              ? "Portfolio Summary" 
                              : sectionId === "market-overview"
                              ? "Market Overview"
                              : sectionId === "watchlist"
                              ? "Watchlist"
                              : sectionId === "recent-transactions"
                              ? "Recent Transactions"
                              : sectionId === "financial-insights"
                              ? "Financial Insights"
                              : "Price Alerts"}
                          </h2>
                          <Bars3BottomLeftIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                        </div>
                        <div className="p-6">
                          {sectionId === "portfolio-summary" && (
                            <div className="space-y-6">
                              <div className="h-80">
                                <Line data={transactionsChartData} options={chartOptions} />
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                                  <h3 className="text-sm font-medium text-green-800 dark:text-green-200">Total Income</h3>
                                  <p className="mt-1 text-2xl font-semibold text-green-900 dark:text-green-100">
                                    ${insights?.total_income.toFixed(2) || "0.00"}
                                  </p>
                                </div>
                                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                                  <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Total Expenses</h3>
                                  <p className="mt-1 text-2xl font-semibold text-red-900 dark:text-red-100">
                                    ${insights?.total_expenses.toFixed(2) || "0.00"}
                                  </p>
                                </div>
                                <div className={`p-4 rounded-lg ${
                                  (insights?.net_balance || 0) >= 0 
                                    ? "bg-green-50 dark:bg-green-900/20" 
                                    : "bg-red-50 dark:bg-red-900/20"
                                }`}>
                                  <h3 className={`text-sm font-medium ${
                                    (insights?.net_balance || 0) >= 0 
                                      ? "text-green-800 dark:text-green-200" 
                                      : "text-red-800 dark:text-red-200"
                                  }`}>
                                    Net Balance
                                  </h3>
                                  <p className={`mt-1 text-2xl font-semibold ${
                                    (insights?.net_balance || 0) >= 0 
                                      ? "text-green-900 dark:text-green-100" 
                                      : "text-red-900 dark:text-red-100"
                                  }`}>
                                    ${insights?.net_balance.toFixed(2) || "0.00"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                          {sectionId === "market-overview" && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                                <h3 className="text-sm font-medium text-gray-900 dark:text-white">S&P 500</h3>
                                <div className="mt-2 flex items-center justify-between">
                                  <p className="text-lg font-semibold text-gray-900 dark:text-white">4,783.45</p>
                                  <span className="text-sm text-green-600">+1.2%</span>
                                </div>
                              </div>
                            </div>
                          )}
                          {sectionId === "watchlist" && (
                            <div className="space-y-6">
                              {watchlist.length > 0 ? (
                                <>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {watchlist.map((stock, index) => (
                                      <div 
                                        key={stock.id} 
                                        className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
                                      >
                                        <div className="flex items-center space-x-2 mb-2">
                                          <div 
                                            className="w-3 h-3 rounded-full" 
                                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                          />
                                          <input
                                            type="checkbox"
                                            checked={selectedStocks.includes(stock.symbol)}
                                            onChange={() => setSelectedStocks(prev =>
                                              prev.includes(stock.symbol) 
                                                ? prev.filter(s => s !== stock.symbol) 
                                                : [...prev, stock.symbol]
                                            )}
                                            className="cursor-pointer"
                                          />
                                          <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                              {stock.symbol}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                              {stock.name}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            ${stock.currentPrice.toFixed(2)}
                                          </p>
                                          <p className={`text-xs ${
                                            stock.change >= 0 
                                              ? 'text-green-600 dark:text-green-400' 
                                              : 'text-red-600 dark:text-red-400'
                                          }`}>
                                            {stock.change >= 0 ? '+' : ''}
                                            {stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="h-[400px] bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                    <Line
                                      data={watchlistChartData}
                                      options={watchlistChartOptions}
                                    />
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
                          {sectionId === "recent-transactions" && (
                            <div className="space-y-4">
                              {transactions.length === 0 ? (
                                <div className="text-center text-gray-500 py-8">No transactions found.</div>
                              ) : (
                                transactions.slice(0, 5).map((transaction) => (
                                  <div
                                    key={transaction.id}
                                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                  >
                                    <div className="flex items-center space-x-4">
                                      <div className={`p-2 rounded-full ${
                                        transaction.type === "income" 
                                          ? "bg-green-100 dark:bg-green-900/20" 
                                          : "bg-red-100 dark:bg-red-900/20"
                                      }`}>
                                        {transaction.type === "income" ? (
                                          <ArrowTrendingUpIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                                        ) : (
                                          <ArrowTrendingDownIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
                                        )}
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                          {transaction.description}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {new Date(transaction.date).toLocaleDateString()}
                                        </p>
                                      </div>
                                    </div>
                                    <p className={`text-sm font-medium ${
                                      transaction.type === "income" 
                                        ? "text-green-600 dark:text-green-400" 
                                        : "text-red-600 dark:text-red-400"
                                    }`}>
                                      {transaction.type === "income" ? "+" : "-"}${Math.abs(transaction.amount).toFixed(2)}
                                    </p>
                                  </div>
                                ))
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
                                  <div>
                                    <h3 className="text-sm font-medium text-gray-900 mb-3">Top Expense Categories</h3>
                                    <div className="space-y-3">
                                      {insights.top_expense_categories.map((category) => (
                                        <div
                                          key={category.category_id}
                                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                        >
                                          <div>
                                            <p className="text-sm font-medium text-gray-900">{category.category_name}</p>
                                            <p className="text-xs text-gray-500">{category.transaction_count} transactions</p>
                                          </div>
                                          <p className="text-sm font-medium text-red-600">${category.total_amount.toFixed(2)}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <h3 className="text-sm font-medium text-gray-900 mb-3">Monthly Trends</h3>
                                    <div className="space-y-3">
                                      {insights.monthly_trends.map((trend) => (
                                        <div key={trend.month} className="p-3 bg-gray-50 rounded-lg">
                                          <div className="flex items-center justify-between mb-2">
                                            <p className="text-sm font-medium text-gray-900">
                                              {new Date(trend.month).toLocaleDateString("en-US", { year: "numeric", month: "long" })}
                                            </p>
                                            <p className={`text-sm font-medium ${trend.balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                                              ${trend.balance.toFixed(2)}
                                            </p>
                                          </div>
                                          <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                              <p className="text-gray-500">Income</p>
                                              <p className="text-green-600">${trend.income.toFixed(2)}</p>
                                            </div>
                                            <div>
                                              <p className="text-gray-500">Expenses</p>
                                              <p className="text-red-600">${trend.expenses.toFixed(2)}</p>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-gray-500 text-sm">No insights available yet.</p>
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
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </main>
    </div>
  );
}