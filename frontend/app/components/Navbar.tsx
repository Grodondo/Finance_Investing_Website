import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useState, useEffect } from "react";
import { Bars3Icon, XMarkIcon, UserCircleIcon } from "@heroicons/react/24/outline";

// Helper to get the saved profile picture from localStorage
const getSavedProfilePicture = (): string | null => {
  try {
    return localStorage.getItem('userProfilePicture');
  } catch (error) {
    console.error('Error getting profile picture from localStorage:', error);
    return null;
  }
};

// Helper to get the saved user data from localStorage
const getSavedUserData = () => {
  try {
    const userData = localStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error getting user data from localStorage:', error);
    return null;
  }
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Get profile picture and user name from localStorage or context
  useEffect(() => {
    // Check localStorage first for profile picture
    const savedProfilePicture = getSavedProfilePicture();
    if (savedProfilePicture) {
      setProfilePicture(savedProfilePicture);
    } else if (user?.profilePicture) {
      setProfilePicture(user.profilePicture);
    }

    // Check localStorage first for user name
    const savedUserData = getSavedUserData();
    if (savedUserData?.name) {
      setUserName(savedUserData.name);
    } else if (user?.name) {
      setUserName(user.name);
    }
  }, [user]);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsProfileMenuOpen(false);
  }, [location]);

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const profileMenu = document.getElementById('profile-menu');
      const profileButton = document.getElementById('profile-button');
      
      if (
        profileMenu && 
        profileButton && 
        !profileMenu.contains(event.target as Node) && 
        !profileButton.contains(event.target as Node)
      ) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navLinkClass = (path: string) => {
    const baseClasses = "px-4 py-2 rounded-md text-sm font-medium transition-all duration-200";
    return isActive(path)
      ? `${baseClasses} bg-indigo-600 text-white shadow-sm hover:bg-indigo-700`
      : `${baseClasses} text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white`;
  };

  const mobileNavLinkClass = (path: string) => {
    const baseClasses = "block px-4 py-3 text-base font-medium transition-all duration-200";
    return isActive(path)
      ? `${baseClasses} bg-indigo-600 text-white`
      : `${baseClasses} text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white`;
  };

  return (
    <nav className={`fixed w-full z-50 transition-all duration-200 ${
      isScrolled 
        ? 'bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm shadow-md' 
        : 'bg-white dark:bg-gray-800 shadow-sm'
    } border-b border-gray-200 dark:border-gray-700`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2">
              <svg 
                className="h-8 w-8 text-indigo-600 dark:text-indigo-400" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
                />
              </svg>
              <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                Finance Manager
              </span>
            </div>
            {/* Desktop Navigation */}
            <div className="hidden sm:flex sm:space-x-4">
              <Link to="/dashboard" className={navLinkClass("/dashboard")}>
                Dashboard
              </Link>
              <Link to="/investing" className={navLinkClass("/investing")}>
                Investing
              </Link>
              <Link to="/news" className={navLinkClass("/news")}>
                News
              </Link>
              <Link to="/recommendations" className={navLinkClass("/recommendations")}>
                Recommendations
              </Link>
              <Link to="/about" className={navLinkClass("/about")}>
                About
              </Link>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center sm:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              {isMobileMenuOpen ? (
                <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Desktop user menu */}
          <div className="hidden sm:flex sm:items-center">
            {user && (
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Welcome, {userName || user.name || "User"}
                </span>
                <div className="relative">
                  <button 
                    id="profile-button"
                    className="flex items-center space-x-2 focus:outline-none"
                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  >
                    <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900 overflow-hidden">
                      {profilePicture ? (
                        <img 
                          src={profilePicture} 
                          alt={userName || user.name || "User"} 
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <UserCircleIcon className="h-full w-full text-indigo-600 dark:text-indigo-400" />
                      )}
                    </div>
                    <span className="sr-only">Open user menu</span>
                  </button>

                  {isProfileMenuOpen && (
                    <div 
                      id="profile-menu"
                      className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none"
                    >
                      <div className="py-1">
                        <Link
                          to="/profile"
                          className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          Your Profile
                        </Link>
                        <button
                          onClick={logout}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={`sm:hidden transition-all duration-200 ease-in-out ${
        isMobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
      }`}>
        <div className="px-2 pt-2 pb-3 space-y-1 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <Link to="/dashboard" className={mobileNavLinkClass("/dashboard")}>
            Dashboard
          </Link>
          <Link to="/investing" className={mobileNavLinkClass("/investing")}>
            Investing
          </Link>
          <Link to="/news" className={mobileNavLinkClass("/news")}>
            News
          </Link>
          <Link to="/recommendations" className={mobileNavLinkClass("/recommendations")}>
            Recommendations
          </Link>
          <Link to="/about" className={mobileNavLinkClass("/about")}>
            About
          </Link>
          {user && (
            <div className="pt-4 pb-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center px-4 py-2">
                <div className="flex-shrink-0 mr-3">
                  <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900 overflow-hidden">
                    {profilePicture ? (
                      <img 
                        src={profilePicture} 
                        alt={userName || user.name || "User"} 
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserCircleIcon className="h-full w-full text-indigo-600 dark:text-indigo-400" />
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {userName || user.name || "User"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {user.email}
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-1 px-2">
                <Link
                  to="/profile"
                  className="block px-4 py-2 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                >
                  Your Profile
                </Link>
                <button
                  onClick={logout}
                  className="w-full text-left px-4 py-2 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
} 