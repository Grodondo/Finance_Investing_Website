import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  id: string;
  email: string;
  username: string;
  profilePicture?: string;
  is2FAEnabled?: boolean;
  role?: 'user' | 'admin' | 'moderator';
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  getAuthHeader: () => { Authorization: string } | undefined;
  updateUserProfile: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedToken = localStorage.getItem('token');

        if (storedToken) {
          setToken(storedToken);
          const response = await fetch("/api/auth/me", {
            headers: {
              Authorization: `Bearer ${storedToken}`
            }
          });
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
          } else {
            console.warn('[AuthContext] checkAuth: /api/auth/me response NOT OK. Status:', response.status, 'Clearing local session.');
            localStorage.removeItem('token');
            setToken(null);
            setUser(null);
          }
        } else {
          setUser(null);
          setToken(null);
        }
      } catch (error) {
        console.error("[AuthContext] checkAuth: Error during fetch to /api/auth/me or JSON parsing:", error);
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Failed to parse error JSON" }));
        console.warn('[AuthContext] login: /api/auth/login response NOT OK. Error data:', errorData);
        throw new Error(errorData.detail || "Login failed");
      }

      const data = await response.json();
      const { access_token, user: userData } = data;
      
      if (!access_token) {
        console.warn('[AuthContext] login: No access_token in response data.');
        throw new Error("No access token received");
      }
      
      localStorage.setItem('token', access_token);
      setToken(access_token);
      setUser(userData);
    } catch (error) {
      console.error("[AuthContext] login: Error caught in login function:", error);
      return Promise.reject(error);
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      }
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const getAuthHeader = () => {
    const storedToken = localStorage.getItem('token');
    
    if (!storedToken && !token) {
      console.warn('No authentication token available');
      return undefined;
    }
    
    const tokenToUse = storedToken || token || '';
    const authHeader = { Authorization: `Bearer ${tokenToUse}` };
    return authHeader;
  };

  const updateUserProfile = (userData: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
        loading,
        getAuthHeader,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
} 