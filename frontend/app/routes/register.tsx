import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import { FaUser, FaEnvelope, FaLock, FaArrowLeft, FaUserPlus } from 'react-icons/fa';

export default function Register() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError("");
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError("Full name is required.");
      return false;
    }
    if (!formData.email.trim()) {
      setError("Email address is required.");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) { // Simplified regex for basic email structure
      setError("Please enter a valid email address.");
      return false;
    }
    if (!formData.password) {
      setError("Password is required.");
      return false;
    }
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 2000); // Shortened redirect time
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
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

      <div className={`w-full max-w-sm p-6 space-y-6`}>
        <div className="text-center">
          {/* <img src="/logo.svg" alt="YourApp Logo" className="mx-auto h-10 w-auto mb-4" /> */}
          <FaUserPlus className={`mx-auto h-10 w-auto ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
          <h2 className={`mt-5 text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Create your account
          </h2>
          <p className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Join us and take control of your finances.
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="name" className="sr-only">Full name</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaUser className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} h-5 w-5`} />
              </div>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={formData.name}
                onChange={handleChange}
                className={`appearance-none rounded-md relative block w-full px-3 py-3 pl-10 border ${isDarkMode ? 'border-gray-600 bg-gray-800 text-gray-300 placeholder-gray-500 focus:ring-indigo-500 focus:border-indigo-500' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:ring-indigo-500 focus:border-indigo-500'} focus:outline-none sm:text-sm`}
                placeholder="Full name"
              />
            </div>
          </div>
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
                value={formData.email}
                onChange={handleChange}
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
                autoComplete="new-password"
                required
                value={formData.password}
                onChange={handleChange}
                className={`appearance-none rounded-md relative block w-full px-3 py-3 pl-10 border ${isDarkMode ? 'border-gray-600 bg-gray-800 text-gray-300 placeholder-gray-500 focus:ring-indigo-500 focus:border-indigo-500' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:ring-indigo-500 focus:border-indigo-500'} focus:outline-none sm:text-sm`}
                placeholder="Password (min. 8 characters)"
              />
            </div>
          </div>
          <div>
            <label htmlFor="confirmPassword" className="sr-only">Confirm password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaLock className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} h-5 w-5`} />
              </div>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className={`appearance-none rounded-md relative block w-full px-3 py-3 pl-10 border ${isDarkMode ? 'border-gray-600 bg-gray-800 text-gray-300 placeholder-gray-500 focus:ring-indigo-500 focus:border-indigo-500' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:ring-indigo-500 focus:border-indigo-500'} focus:outline-none sm:text-sm`}
                placeholder="Confirm password"
              />
            </div>
          </div>

          {error && (
            <div className={`rounded-md p-3 text-sm text-center ${isDarkMode ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'}`}>
              {error}
            </div>
          )}

          {success && (
            <div className={`rounded-md p-3 text-sm text-center ${isDarkMode ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700'}`}>
              Registration successful! Redirecting to login...
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading || success}
              className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white ${isDarkMode ? 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500' : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'} focus:outline-none focus:ring-2 focus:ring-offset-2 ${isDarkMode ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'} transition-colors ${ // Added focus:ring-offset for dark/light
                loading || success ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating account...
                </>
              ) : success ? (
                  'Registered!'
              ) : (
                // Removed icon from button text for cleaner look
                'Sign up'
              )}
            </button>
          </div>
        </form>

        <p className={`mt-8 text-center text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          Already have an account?{" "}
          <Link to="/login" className={`font-medium ${isDarkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-500'}`}>
            Sign in
          </Link>
        </p>
      </div>
       <div className="absolute bottom-6 text-xs text-gray-500 dark:text-gray-400">
        © {new Date().getFullYear()} YourApp. All rights reserved.
      </div>
    </div>
  );
} 