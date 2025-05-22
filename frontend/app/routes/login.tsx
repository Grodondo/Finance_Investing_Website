import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { FaEnvelope, FaLock, FaSignInAlt, FaArrowLeft } from 'react-icons/fa';

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError("Invalid email or password. Please try again.");
    }
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center ${isDarkMode ? 'bg-gray-900' : 'bg-white'} p-4 relative`}>
      <div className="absolute top-6 left-6">
        <Link
          to="/"
          className={`flex items-center text-sm font-medium ${isDarkMode ? 'text-gray-300 hover:text-indigo-400' : 'text-gray-700 hover:text-indigo-600'} transition-colors`}
        >
          <FaArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Link>
      </div>

      <div className="w-full max-w-sm p-6 space-y-6">
        <div className="text-center">
          <FaSignInAlt className={`mx-auto h-10 w-auto ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
          <h2 className={`mt-5 text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Sign in to YourApp
          </h2>
          <p className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Welcome back! Please enter your details.
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email-address" className="sr-only">Email address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaEnvelope className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} h-5 w-5`} />
              </div>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`appearance-none rounded-md relative block w-full px-3 py-3 pl-10 border ${isDarkMode ? 'border-gray-600 bg-gray-800 text-gray-300 placeholder-gray-500 focus:ring-indigo-500 focus:border-indigo-500' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:ring-indigo-500 focus:border-indigo-500'} focus:outline-none sm:text-sm`}
                placeholder="Email address"
              />
            </div>
          </div>
          <div>
            <label htmlFor="password" className="sr-only">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaLock className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} h-5 w-5`} />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`appearance-none rounded-md relative block w-full px-3 py-3 pl-10 border ${isDarkMode ? 'border-gray-600 bg-gray-800 text-gray-300 placeholder-gray-500 focus:ring-indigo-500 focus:border-indigo-500' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:ring-indigo-500 focus:border-indigo-500'} focus:outline-none sm:text-sm`}
                placeholder="Password"
              />
            </div>
          </div>

          <div className="flex items-center justify-end">
            <div className="text-sm">
              <Link to="/forgot-password" className={`font-medium ${isDarkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-500'}`}>
                Forgot your password?
              </Link>
            </div>
          </div>

          {error && (
            <div className={`rounded-md p-3 text-sm text-center ${isDarkMode ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'}`}>
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white ${isDarkMode ? 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500' : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'} focus:outline-none focus:ring-2 focus:ring-offset-2 ${isDarkMode ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'} transition-colors`}
            >
              Sign in
            </button>
          </div>
        </form>

        <p className={`mt-8 text-center text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          Don't have an account yet?{" "}
          <Link to="/register" className={`font-medium ${isDarkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-500'}`}>
            Sign up
          </Link>
        </p>
      </div>
      <div className="absolute bottom-6 text-xs text-gray-500 dark:text-gray-400">
        © {new Date().getFullYear()} YourApp. All rights reserved.
      </div>
    </div>
  );
} 