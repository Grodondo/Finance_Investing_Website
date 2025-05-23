import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "./contexts/AuthContext";
import { ForumProvider } from "./contexts/ForumContext";
import ThemeProvider from "./contexts/ThemeContext";
import Navbar from "./components/Navbar";
import ThemeToggle from "./components/ThemeToggle";
import "./app.css";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export default function Root() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading) {
      if (isAuthenticated && location.pathname === "/login") {
        // If authenticated and on login page, redirect to dashboard
        navigate("/dashboard", { replace: true });
      } else if (!isAuthenticated) {
        // If not authenticated, redirect to login page if not on a public path
        const publicPaths = ["/login", "/register", "/about", "/"];
        if (!publicPaths.includes(location.pathname)) {
          navigate("/login", { replace: true });
        }
      }
    }
  }, [isAuthenticated, loading, location.pathname, navigate]);

  // Don't render anything while checking authentication
  if (loading) {
    return null;
  }

  // Show navbar only on authenticated pages, excluding home, login, and register
  const showNavbar = isAuthenticated && !["/", "/login", "/register"].includes(location.pathname);
  
  // Only show theme toggle outside of the index page
  const showThemeToggle = location.pathname !== "/";

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ForumProvider>
          <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
            {showNavbar && <Navbar />}
            <Outlet />
            {showThemeToggle && <ThemeToggle />}
          </div>
        </ForumProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}