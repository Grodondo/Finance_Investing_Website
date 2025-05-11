import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth, AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Navbar from "./components/Navbar";
import ThemeToggle from "./components/ThemeToggle";
import "./app.css";

function RootContent() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Only redirect if authentication check is complete and user is not authenticated
    // AND trying to access a protected route
    if (!loading && !isAuthenticated) {
      const publicPaths = ["/login", "/register", "/about", "/"];
      if (!publicPaths.includes(location.pathname)) {
        navigate("/login", { replace: true });
      }
    }
  }, [isAuthenticated, loading, location.pathname, navigate]);

  // Don't render anything while checking authentication
  if (loading) {
    return null;
  }

  // Show navbar only on authenticated pages, excluding home, login, and register
  const showNavbar = isAuthenticated && !["/", "/login", "/register"].includes(location.pathname);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      {showNavbar && <Navbar />}
      <Outlet />
      <ThemeToggle />
    </div>
  );
}

export default function Root() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Personal Finance Manager</title>
      </head>
      <body className="bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text">
        <ThemeProvider>
          <AuthProvider>
            <RootContent />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}