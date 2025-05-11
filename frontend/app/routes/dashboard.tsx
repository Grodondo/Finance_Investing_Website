import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
  id: string;
  amount: number;
  category: string;
  date: string;
  description: string;
}

interface AIInsight {
  id: string;
  title: string;
  description: string;
  impact: "positive" | "negative" | "neutral";
}

export default function Dashboard() {
  const { user, logout, getAuthHeader } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const authHeader = getAuthHeader();
        if (!authHeader) {
          throw new Error("Not authenticated");
        }

        // Fetch transactions
        const transactionsResponse = await fetch("/api/transactions", {
          headers: authHeader
        });
        if (!transactionsResponse.ok) {
          throw new Error("Failed to fetch transactions");
        }
        const transactionsData = await transactionsResponse.json();
        setTransactions(transactionsData);

        // Fetch AI insights
        const insightsResponse = await fetch("/api/insights", {
          headers: authHeader
        });
        if (!insightsResponse.ok) {
          throw new Error("Failed to fetch insights");
        }
        const insightsData = await insightsResponse.json();
        setInsights(insightsData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [getAuthHeader]);

  const chartData = {
    labels: transactions.map((t) => new Date(t.date).toLocaleDateString()),
    datasets: [
      {
        label: "Spending",
        data: transactions.map((t) => t.amount),
        borderColor: "rgb(75, 192, 192)",
        tension: 0.1,
      },
    ],
  };

  if (loading) {
    return <div className="text-center py-10">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.name}</h1>
          <button
            onClick={logout}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Sign out
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Financial Overview */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Financial Overview</h2>
            <div className="h-64">
              <Line data={chartData} />
            </div>
          </div>

          {/* AI Insights */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">AI Insights</h2>
            <div className="space-y-4">
              {insights.map((insight) => (
                <div
                  key={insight.id}
                  className={`p-4 rounded-lg ${
                    insight.impact === "positive"
                      ? "bg-green-50"
                      : insight.impact === "negative"
                      ? "bg-red-50"
                      : "bg-gray-50"
                  }`}
                >
                  <h3 className="font-medium text-gray-900">{insight.title}</h3>
                  <p className="mt-1 text-sm text-gray-600">{insight.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="mt-8 bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Recent Transactions</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {transaction.description}
                    </p>
                    <p className="text-sm text-gray-500">{transaction.category}</p>
                  </div>
                  <p
                    className={`text-sm font-medium ${
                      transaction.amount < 0 ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {transaction.amount < 0 ? "-" : "+"}${Math.abs(transaction.amount)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 