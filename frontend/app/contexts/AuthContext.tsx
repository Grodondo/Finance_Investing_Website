import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  id: string;
  email: string;
  username: string;
  role: string;
  is2FAEnabled?: boolean;
  profile_picture?: string;
  name?: string;  // Added for backward compatibility
}

interface LoginResponse {
  requires2FA: boolean;
  access_token?: string;
  user?: User;
  user_id?: string;
}

interface TwoFASetupResponse {
  secret: string;
  qr_code: string;
  recovery_codes: string[];
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<LoginResponse>;
  verify2FA: (code: string) => Promise<void>;
  useRecoveryCode: (code: string) => Promise<void>;
  googleLogin: (token: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  getAuthHeader: () => { Authorization: string } | undefined;
  updateUserProfile: (userData: Partial<User>) => void;
  setup2FA: () => Promise<TwoFASetupResponse>;
  enable2FA: (code: string) => Promise<void>;
  disable2FA: (code: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingLogin, setPendingLogin] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    // Check for existing session
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
            // Token is invalid or expired
            localStorage.removeItem('token');
            setToken(null);
            setUser(null);
          }
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string): Promise<LoginResponse> => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Login failed");
      }

      const data = await response.json();
      
      // If 2FA is required, store the credentials and return
      if (data.requires2FA) {
        setPendingLogin({ email, password });
        return { requires2FA: true, user_id: data.user_id };
      }

      const { access_token, user: userData } = data;
      
      if (!access_token) {
        throw new Error("No access token received");
      }
      
      // Store token in localStorage
      localStorage.setItem('token', access_token);
      setToken(access_token);
      setUser(userData);
      
      return { requires2FA: false, access_token, user: userData };
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const verify2FA = async (code: string) => {
    if (!pendingLogin) {
      throw new Error("No pending login found");
    }

    try {
      const response = await fetch("/api/auth/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: pendingLogin.email,
          password: pendingLogin.password,
          code
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "2FA verification failed");
      }

      const data = await response.json();
      const { access_token, user: userData } = data;
      
      if (!access_token) {
        throw new Error("No access token received");
      }
      
      // Store token in localStorage
      localStorage.setItem('token', access_token);
      setToken(access_token);
      setUser(userData);
      setPendingLogin(null);
    } catch (error) {
      console.error("2FA verification error:", error);
      throw error;
    }
  };

  const useRecoveryCode = async (recoveryCode: string) => {
    if (!pendingLogin) {
      throw new Error("No pending login found");
    }

    try {
      const response = await fetch("/api/auth/recovery-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: pendingLogin.email,
          password: pendingLogin.password,
          recovery_code: recoveryCode
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Recovery code verification failed");
      }

      const data = await response.json();
      const { access_token, user: userData } = data;
      
      if (!access_token) {
        throw new Error("No access token received");
      }
      
      // Store token in localStorage
      localStorage.setItem('token', access_token);
      setToken(access_token);
      setUser(userData);
      setPendingLogin(null);
    } catch (error) {
      console.error("Recovery code verification error:", error);
      throw error;
    }
  };

  const googleLogin = async (googleToken: string) => {
    try {
      const response = await fetch("/api/auth/google-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: googleToken }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Google login failed");
      }

      const data = await response.json();
      const { access_token, user: userData } = data;
      
      if (!access_token) {
        throw new Error("No access token received");
      }
      
      // Store token in localStorage
      localStorage.setItem('token', access_token);
      setToken(access_token);
      setUser(userData);
    } catch (error) {
      console.error("Google login error:", error);
      throw error;
    }
  };

  const setup2FA = async (): Promise<TwoFASetupResponse> => {
    if (!token) {
      throw new Error("Not authenticated");
    }

    try {
      const response = await fetch("/api/auth/setup-2fa", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to set up 2FA");
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("2FA setup error:", error);
      throw error;
    }
  };

  const enable2FA = async (code: string) => {
    if (!token) {
      throw new Error("Not authenticated");
    }

    try {
      const response = await fetch("/api/auth/enable-2fa", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ code })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to enable 2FA");
      }

      // Update user state to reflect 2FA is enabled
      if (user) {
        setUser({ ...user, is2FAEnabled: true });
      }
    } catch (error) {
      console.error("Enable 2FA error:", error);
      throw error;
    }
  };

  const disable2FA = async (code: string) => {
    if (!token) {
      throw new Error("Not authenticated");
    }

    try {
      const response = await fetch("/api/auth/disable-2fa", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ code })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to disable 2FA");
      }

      // Update user state to reflect 2FA is disabled
      if (user) {
        setUser({ ...user, is2FAEnabled: false });
      }
    } catch (error) {
      console.error("Disable 2FA error:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // No need to call logout endpoint since we're using JWT
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
      setPendingLogin(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const getAuthHeader = () => {
    if (!token) return undefined;
    return { Authorization: `Bearer ${token}` };
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
        verify2FA,
        useRecoveryCode,
        googleLogin,
        logout,
        loading,
        getAuthHeader,
        updateUserProfile,
        setup2FA,
        enable2FA,
        disable2FA,
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