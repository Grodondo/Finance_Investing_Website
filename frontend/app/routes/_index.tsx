import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Index() {
  const { isAuthenticated, logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="relative isolate overflow-hidden bg-white dark:bg-dark-bg">
      <div className="mx-auto max-w-7xl px-6 pb-24 pt-10 sm:pb-32 lg:flex lg:px-8 lg:py-40">
        <nav className="absolute top-0 left-0 right-0 bg-white dark:bg-dark-bg shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-dark-text">Finance Manager</h1>
              </div>
              {isAuthenticated && (
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Welcome, {user?.name}</span>
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>

        <div className="mx-auto max-w-2xl lg:mx-0 lg:max-w-xl lg:flex-shrink-0 lg:pt-8 mt-16">
          <h1 className="mt-10 text-4xl font-bold tracking-tight text-gray-900 dark:text-dark-text sm:text-6xl">
            AI-Powered Personal Finance Manager
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
            Take control of your finances with our intelligent platform. Get personalized insights,
            automated categorization, and smart budgeting recommendations powered by AI.
          </p>
          <div className="mt-10 flex items-center gap-x-6">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="rounded-md bg-indigo-600 dark:bg-indigo-500 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 dark:hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-500"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-md bg-indigo-600 dark:bg-indigo-500 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 dark:hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-500"
                >
                  Get started
                </Link>
                <Link 
                  to="/about" 
                  className="text-sm font-semibold leading-6 text-gray-900 dark:text-gray-200 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Learn more <span aria-hidden="true">→</span>
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="mx-auto mt-16 flex max-w-2xl sm:mt-24 lg:ml-10 lg:mr-0 lg:mt-0 lg:max-w-none lg:flex-none xl:ml-32">
          <div className="max-w-3xl flex-none sm:max-w-5xl lg:max-w-none">
            <img
              src="/dashboard-preview.png"
              alt="App screenshot"
              width={2432}
              height={1442}
              className="w-[76rem] rounded-md bg-white/5 dark:bg-dark-surface shadow-2xl ring-1 ring-white/10 dark:ring-gray-700"
            />
          </div>
        </div>
      </div>
    </div>
  );
} 