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

export default function Dashboard() {
  const { user, logout, getAuthHeader, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [insights, setInsights] = useState<FinancialInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Redirect to login if not authenticated
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

        // Fetch transactions
        const transactionsResponse = await fetch("/api/transactions", {
          headers: {
            ...authHeader,
            "Content-Type": "application/json"
          }
        });

        if (transactionsResponse.status === 401) {
          // Token expired or invalid
          logout();
          navigate("/login");
          return;
        }

        if (!transactionsResponse.ok) {
          const errorData = await transactionsResponse.json().catch(() => ({}));
          throw new Error(errorData.detail || "Failed to fetch transactions");
        }

        const transactionsData = await transactionsResponse.json();
        setTransactions(transactionsData);

        // Fetch AI insights
        const insightsResponse = await fetch("/api/insights", {
          headers: {
            ...authHeader,
            "Content-Type": "application/json"
          }
        });

        if (insightsResponse.status === 401) {
          // Token expired or invalid
          logout();
          navigate("/login");
          return;
        }

        if (!insightsResponse.ok) {
          const errorData = await insightsResponse.json().catch(() => ({}));
          throw new Error(errorData.detail || "Failed to fetch insights");
        }

        const insightsData = await insightsResponse.json();
        setInsights(insightsData);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError(error instanceof Error ? error.message : "An error occurred");
        if (error instanceof Error && error.message === "Not authenticated") {
          navigate("/login");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [getAuthHeader, isAuthenticated, logout, navigate]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const chartData = {
    labels: transactions.map((t) => new Date(t.date).toLocaleDateString()),
    datasets: [
      {
        label: "Spending",
        data: transactions.map((t) => t.amount),
        borderColor: "rgb(79, 70, 229)",
        backgroundColor: "rgba(79, 70, 229, 0.1)",
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const chartOptions = {
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
        beginAtZero: true,
        grid: {
          color: "rgba(0, 0, 0, 0.1)",
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Financial Overview */}
          <div className="lg:col-span-2 bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-4">Financial Overview</h2>
            <div className="h-80">
              <Line data={chartData} options={{
                ...chartOptions,
                scales: {
                  ...chartOptions.scales,
                  y: {
                    ...chartOptions.scales.y,
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
                    ...chartOptions.scales.x,
                    ticks: {
                      color: (context) => {
                        const isDarkMode = document.documentElement.classList.contains('dark');
                        return isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)';
                      }
                    }
                  }
                }
              }} />
            </div>
          </div>

          {/* AI Insights */}
          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-4">Financial Insights</h2>
            {insights ? (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-green-800 dark:text-green-400">Total Income</h3>
                    <p className="mt-1 text-2xl font-semibold text-green-900 dark:text-green-300">${insights.total_income.toFixed(2)}</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-red-800 dark:text-red-400">Total Expenses</h3>
                    <p className="mt-1 text-2xl font-semibold text-red-900 dark:text-red-300">${insights.total_expenses.toFixed(2)}</p>
                  </div>
                  <div className={`p-4 rounded-lg ${insights.net_balance >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                    <h3 className={`text-sm font-medium ${insights.net_balance >= 0 ? 'text-green-800 dark:text-green-400' : 'text-red-800 dark:text-red-400'}`}>Net Balance</h3>
                    <p className={`mt-1 text-2xl font-semibold ${insights.net_balance >= 0 ? 'text-green-900 dark:text-green-300' : 'text-red-900 dark:text-red-300'}`}>
                      ${insights.net_balance.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Top Expense Categories */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-dark-text mb-3">Top Expense Categories</h3>
                  <div className="space-y-3">
                    {insights.top_expense_categories.map((category) => (
                      <div key={category.category_id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-surface rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-dark-text">{category.category_name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-300">{category.transaction_count} transactions</p>
                        </div>
                        <p className="text-sm font-medium text-red-600 dark:text-red-400">${category.total_amount.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Monthly Trends */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-dark-text mb-3">Monthly Trends</h3>
                  <div className="space-y-3">
                    {insights.monthly_trends.map((trend) => (
                      <div key={trend.month} className="p-3 bg-gray-50 dark:bg-dark-surface rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-dark-text">
                            {new Date(trend.month).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                          </p>
                          <p className={`text-sm font-medium ${trend.balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            ${trend.balance.toFixed(2)}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="text-gray-500 dark:text-gray-300">Income</p>
                            <p className="text-green-600 dark:text-green-400">${trend.income.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 dark:text-gray-300">Expenses</p>
                            <p className="text-red-600 dark:text-red-400">${trend.expenses.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-300 text-sm">No insights available yet.</p>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="mt-8 bg-white dark:bg-dark-surface rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-surface">
            <h2 className="text-lg font-medium text-gray-900 dark:text-dark-text">Recent Transactions</h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-dark-surface">
            {transactions.length === 0 ? (
              <div className="px-6 py-4 text-center text-gray-500 dark:text-gray-300">
                No transactions found.
              </div>
            ) : (
              transactions.map((transaction) => (
                <div key={transaction.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-dark-surface transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-dark-text">
                        {transaction.description}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-300">Category ID: {transaction.category_id}</p>
                    </div>
                    <p
                      className={`text-sm font-medium ${
                        transaction.type === "expense" ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                      }`}
                    >
                      {transaction.type === "expense" ? "-" : "+"}${Math.abs(transaction.amount).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}