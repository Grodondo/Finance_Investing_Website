import { Link } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import { FaChartPie, FaExchangeAlt, FaLightbulb, FaSignOutAlt, FaCog, FaUserCircle, FaChevronDown, FaChevronUp, FaPlusCircle, FaEdit, FaTrash } from 'react-icons/fa';
import { useState } from "react";

// Mock Data
const mockUser = {
  username: "DemoUser",
  avatar: "/images/default-avatar.png", // Placeholder
};

const mockOverviewData = {
  totalBalance: 12540.75,
  incomeThisMonth: 5200.00,
  expensesThisMonth: 3150.50,
  savingsGoalProgress: 65, // Percentage
};

const mockTransactions = [
  { id: "1", date: "2024-07-15", description: "Grocery Shopping", category: "Food", amount: -75.50, type: "expense" },
  { id: "2", date: "2024-07-14", description: "Salary Deposit", category: "Income", amount: 2500.00, type: "income" },
  { id: "3", date: "2024-07-13", description: "Netflix Subscription", category: "Entertainment", amount: -15.99, type: "expense" },
  { id: "4", date: "2024-07-12", description: "Dinner with Friends", category: "Food", amount: -45.00, type: "expense" },
  { id: "5", date: "2024-07-10", description: "Freelance Project Payment", category: "Income", amount: 800.00, type: "income" },
];

const mockBudgets = [
  { id: "b1", name: "Groceries", allocated: 400, spent: 280.75, remaining: 119.25 },
  { id: "b2", name: "Entertainment", allocated: 150, spent: 95.50, remaining: 54.50 },
  { id: "b3", name: "Utilities", allocated: 200, spent: 185.00, remaining: 15.00 },
  { id: "b4", name: "Transport", allocated: 100, spent: 60.00, remaining: 40.00 },
];

const mockInsights = [
  { id: "i1", text: "You're on track with your 'Groceries' budget this month. Great job!", type: "positive" },
  { id: "i2", text: "Consider reducing your 'Entertainment' spending to meet your savings goals faster.", type: "suggestion" },
  { id: "i3", text: "You've received a high income this month. Consider allocating more to savings.", type: "info" },
];

// Helper function to format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export default function DemoPage() {
  const { isDarkMode, toggleTheme } = useTheme();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const Card = ({ title, children, className }: { title?: string, children: React.ReactNode, className?: string }) => (
    <div className={`rounded-xl shadow-lg p-6 ${isDarkMode ? 'bg-gray-800/70 text-gray-200' : 'bg-white/80 text-gray-700'} backdrop-blur-md ${className}`}>
      {title && <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{title}</h2>}
      {children}
    </div>
  );

  const ProgressBar = ({ value, maxValue, colorClass }: { value: number, maxValue: number, colorClass: string }) => {
    const percentage = (value / maxValue) * 100;
    return (
      <div className={`w-full h-4 rounded-full ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`}>
        <div
          className={`h-full rounded-full ${colorClass}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    );
  };
  

  return (
    <div className={`min-h-screen flex flex-col ${isDarkMode ? 'dark-mode-bg text-gray-200' : 'light-mode-bg-subtle text-gray-800'}`}>
      {/* Demo Header */}
      <header className={`sticky top-0 z-50 shadow-md ${isDarkMode ? 'bg-gray-800/80 border-b border-gray-700/50' : 'bg-white/90 border-b border-gray-200/60'} backdrop-blur-md`}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className={`text-2xl font-bold ${isDarkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'}`}>
                Finance Manager
              </Link>
              <span className={`ml-3 text-xs font-semibold py-1 px-2 rounded-full ${isDarkMode ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-400/30 text-yellow-700'}`}>DEMO MODE</span>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={toggleTheme} 
                aria-label="Toggle dark mode"
                className={`p-2 rounded-full ${isDarkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-200'}`}
              >
                {isDarkMode ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                  </svg>
                )}
              </button>
              <div className="relative">
                <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-700/50">
                  <img src={mockUser.avatar} alt="User" className="w-8 h-8 rounded-full border-2 border-indigo-500/70" />
                  <span className={`hidden sm:inline ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{mockUser.username}</span>
                  {showUserMenu ? <FaChevronUp className="w-3 h-3"/> : <FaChevronDown className="w-3 h-3"/>}
                </button>
                {showUserMenu && (
                  <div className={`absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 ${isDarkMode ? 'bg-gray-800 ring-1 ring-black ring-opacity-5' : 'bg-white ring-1 ring-black ring-opacity-5'}`}>
                    <Link to="#" className={`block px-4 py-2 text-sm ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}><FaUserCircle className="inline mr-2" />Profile</Link>
                    <Link to="#" className={`block px-4 py-2 text-sm ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}><FaCog className="inline mr-2" />Settings</Link>
                    <Link to="/" className={`block px-4 py-2 text-sm ${isDarkMode ? 'text-red-400 hover:bg-gray-700' : 'text-red-600 hover:bg-gray-100'}`}><FaSignOutAlt className="inline mr-2" />Exit Demo</Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Demo Content */}
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Welcome to Your Financial Dashboard, {mockUser.username}!</h1>
          <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>This is a demo of your financial overview. All data is illustrative.</p>
        </div>

        {/* Overview Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card title="Total Balance" className="bg-gradient-to-br from-indigo-500 to-blue-600 text-white dark:from-indigo-600 dark:to-blue-700">
            <p className="text-4xl font-bold">{formatCurrency(mockOverviewData.totalBalance)}</p>
            <p className="text-sm opacity-80 mt-1">Across all accounts</p>
          </Card>
          <Card>
            <h3 className="text-lg font-semibold">Income This Month</h3>
            <p className={`text-3xl font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>{formatCurrency(mockOverviewData.incomeThisMonth)}</p>
          </Card>
          <Card>
            <h3 className="text-lg font-semibold">Expenses This Month</h3>
            <p className={`text-3xl font-bold ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>{formatCurrency(mockOverviewData.expensesThisMonth)}</p>
          </Card>
          <Card>
            <h3 className="text-lg font-semibold">Savings Goal</h3>
            <ProgressBar value={mockOverviewData.savingsGoalProgress} maxValue={100} colorClass="bg-green-500" />
            <p className="text-sm mt-2 text-right">{mockOverviewData.savingsGoalProgress}% achieved</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Transactions Section */}
          <div className="lg:col-span-2">
            <Card title="Recent Transactions">
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {mockTransactions.map(t => (
                  <div key={t.id} className={`flex justify-between items-center p-3 rounded-lg ${isDarkMode ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-100/70 hover:bg-gray-200/70'}`}>
                    <div>
                      <p className="font-semibold">{t.description}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t.date} - {t.category}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                     <span className={`font-semibold ${t.type === 'income' ? (isDarkMode ? 'text-green-400' : 'text-green-600') : (isDarkMode ? 'text-red-400' : 'text-red-500')}`}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(t.amount))}
                      </span>
                      <button className="p-1 text-gray-400 hover:text-indigo-500"><FaEdit /></button>
                      <button className="p-1 text-gray-400 hover:text-red-500"><FaTrash /></button>
                    </div>
                  </div>
                ))}
              </div>
              <button className={`mt-4 w-full flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium ${isDarkMode ? 'text-white bg-indigo-600 hover:bg-indigo-700' : 'text-white bg-indigo-600 hover:bg-indigo-700'}`}>
                <FaPlusCircle className="mr-2" /> Add Transaction (Demo)
              </button>
            </Card>
          </div>

          {/* Budgets & AI Insights Column */}
          <div className="space-y-6">
            {/* Budgets Section */}
            <Card title="Budget Overview">
              <div className="space-y-4">
                {mockBudgets.map(b => (
                  <div key={b.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{b.name}</span>
                      <span>{formatCurrency(b.spent)} / {formatCurrency(b.allocated)}</span>
                    </div>
                    <ProgressBar value={b.spent} maxValue={b.allocated} colorClass={b.spent / b.allocated > 0.8 ? (isDarkMode ? 'bg-red-500' : 'bg-red-600') : (isDarkMode ? 'bg-indigo-500' : 'bg-indigo-600')} />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">{formatCurrency(b.remaining)} remaining</p>
                  </div>
                ))}
                 <button className={`mt-2 w-full flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium ${isDarkMode ? 'text-white bg-green-600 hover:bg-green-700' : 'text-white bg-green-600 hover:bg-green-700'}`}>
                    <FaPlusCircle className="mr-2" /> Manage Budgets (Demo)
                </button>
              </div>
            </Card>

            {/* AI Insights Section */}
            <Card title="AI Financial Insights">
              <div className="space-y-3">
                {mockInsights.map(i => (
                  <div key={i.id} className={`flex items-start p-3 rounded-lg ${
                    i.type === 'positive' ? (isDarkMode ? 'bg-green-600/20' : 'bg-green-100') :
                    i.type === 'suggestion' ? (isDarkMode ? 'bg-yellow-500/20' : 'bg-yellow-100') :
                    (isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100')
                  }`}>
                    <FaLightbulb className={`mr-3 mt-1 flex-shrink-0 ${
                      i.type === 'positive' ? 'text-green-500' :
                      i.type === 'suggestion' ? 'text-yellow-500' :
                      'text-blue-500'
                    }`} />
                    <p className={`text-sm ${
                       i.type === 'positive' ? (isDarkMode ? 'text-green-300' : 'text-green-700') :
                       i.type === 'suggestion' ? (isDarkMode ? 'text-yellow-300' : 'text-yellow-700') :
                       (isDarkMode ? 'text-blue-300' : 'text-blue-700')
                    }`}>{i.text}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </main>

      {/* Demo Footer */}
      <footer className={`py-8 text-center ${isDarkMode ? 'bg-gray-800/50 border-t border-gray-700/50' : 'bg-gray-100/70 border-t border-gray-200/60'}`}>
        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          © {new Date().getFullYear()} Finance Manager Demo. 
          <Link to="/" className={`ml-2 font-semibold ${isDarkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'}`}>
            Return to Main Site
          </Link>
        </p>
      </footer>
    </div>
  );
} 