import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// Google OAuth
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, options: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [show2FA, setShow2FA] = useState(false);
  const [showRecoveryCode, setShowRecoveryCode] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const { login, verify2FA, useRecoveryCode, googleLogin } = useAuth();
  const navigate = useNavigate();

  // Initialize Google Sign-In
  useEffect(() => {
    // Load the Google Sign-In API script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
          callback: handleGoogleCallback,
          auto_select: false,
        });

        // Render the button if the container exists
        const buttonContainer = document.getElementById('google-signin-button');
        if (buttonContainer) {
          window.google.accounts.id.renderButton(buttonContainer, {
            theme: 'outline',
            size: 'large',
            width: 280,
            text: 'signin_with',
            shape: 'rectangular',
          });
        }
      }
    };

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleGoogleCallback = async (response: any) => {
    try {
      // The credential is in response.credential
      await googleLogin(response.credential);
      navigate("/dashboard");
    } catch (err) {
      setError("Google sign-in failed. Please try again.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const response = await login(email, password);
      
      // If 2FA is required, show the verification input
      if (response.requires2FA) {
        setShow2FA(true);
        return;
      }
      
      navigate("/dashboard");
    } catch (err) {
      setError("Invalid email or password");
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      await verify2FA(verificationCode);
      navigate("/dashboard");
    } catch (err) {
      setError("Invalid verification code");
    }
  };

  const handleRecoveryCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      await useRecoveryCode(recoveryCode);
      navigate("/dashboard");
    } catch (err) {
      setError("Invalid recovery code");
    }
  };

  const toggleRecoveryCodeMode = () => {
    setShowRecoveryCode(!showRecoveryCode);
    setError("");
  };

  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg">
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <div className="absolute top-4 left-4">
          <Link
            to="/"
            className="inline-flex items-center rounded-md bg-white dark:bg-dark-surface px-3 py-2 text-sm font-semibold text-gray-900 dark:text-dark-text shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <svg className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z" clipRule="evenodd" />
            </svg>
            Back to Home
          </Link>
        </div>

        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900 dark:text-dark-text">
            {show2FA 
              ? (showRecoveryCode ? "Enter Recovery Code" : "Two-Factor Authentication") 
              : "Sign in to your account"}
          </h2>
        </div>

        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
          {!show2FA ? (
            <>
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium leading-6 text-gray-900 dark:text-dark-text">
                    Email address
                  </label>
                  <div className="mt-2">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full rounded-md border-0 px-4 py-2.5 text-gray-900 dark:text-dark-text shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:focus:ring-indigo-500 sm:text-sm sm:leading-6 bg-white dark:bg-dark-surface"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="block text-sm font-medium leading-6 text-gray-900 dark:text-dark-text">
                      Password
                    </label>
                    <div className="text-sm">
                      <Link to="/forgot-password" className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300">
                        Forgot password?
                      </Link>
                    </div>
                  </div>
                  <div className="mt-2">
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full rounded-md border-0 px-4 py-2.5 text-gray-900 dark:text-dark-text shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:focus:ring-indigo-500 sm:text-sm sm:leading-6 bg-white dark:bg-dark-surface"
                    />
                  </div>
                </div>

                {error && (
                  <div className="text-red-600 dark:text-red-400 text-sm text-center">{error}</div>
                )}

                <div>
                  <button
                    type="submit"
                    className="flex w-full justify-center rounded-md bg-indigo-600 dark:bg-indigo-500 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 dark:hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-500"
                  >
                    Sign in
                  </button>
                </div>
              </form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-white dark:bg-dark-bg px-2 text-gray-500 dark:text-gray-400">Or continue with</span>
                  </div>
                </div>

                <div className="mt-6 flex justify-center">
                  <div id="google-signin-button" className="w-full flex justify-center"></div>
                </div>
              </div>
            </>
          ) : showRecoveryCode ? (
            <form className="space-y-6" onSubmit={handleRecoveryCodeSubmit}>
              <div>
                <label htmlFor="recovery-code" className="block text-sm font-medium leading-6 text-gray-900 dark:text-dark-text">
                  Recovery Code
                </label>
                <div className="mt-2">
                  <input
                    id="recovery-code"
                    name="recovery-code"
                    type="text"
                    required
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                    placeholder="XXXX-XXXX"
                    className="block w-full rounded-md border-0 px-4 py-2.5 text-gray-900 dark:text-dark-text shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:focus:ring-indigo-500 sm:text-sm sm:leading-6 bg-white dark:bg-dark-surface"
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Enter one of your recovery codes
                </p>
              </div>

              {error && (
                <div className="text-red-600 dark:text-red-400 text-sm text-center">{error}</div>
              )}

              <div>
                <button
                  type="submit"
                  className="flex w-full justify-center rounded-md bg-indigo-600 dark:bg-indigo-500 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 dark:hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-500"
                >
                  Verify
                </button>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={toggleRecoveryCodeMode}
                  className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
                >
                  Use verification code instead
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handle2FASubmit}>
              <div>
                <label htmlFor="verification-code" className="block text-sm font-medium leading-6 text-gray-900 dark:text-dark-text">
                  Verification Code
                </label>
                <div className="mt-2">
                  <input
                    id="verification-code"
                    name="verification-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                    className="block w-full rounded-md border-0 px-4 py-2.5 text-gray-900 dark:text-dark-text shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:focus:ring-indigo-500 sm:text-sm sm:leading-6 bg-white dark:bg-dark-surface"
                    placeholder="Enter 6-digit code"
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>

              {error && (
                <div className="text-red-600 dark:text-red-400 text-sm text-center">{error}</div>
              )}

              <div>
                <button
                  type="submit"
                  className="flex w-full justify-center rounded-md bg-indigo-600 dark:bg-indigo-500 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 dark:hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-500"
                >
                  Verify
                </button>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={toggleRecoveryCodeMode}
                  className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
                >
                  Use recovery code instead
                </button>
              </div>
            </form>
          )}

          {!show2FA && (
            <p className="mt-10 text-center text-sm text-gray-500 dark:text-gray-400">
              Not a member?{" "}
              <Link to="/register" className="font-semibold leading-6 text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300">
                Start a 14 day free trial
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
} 