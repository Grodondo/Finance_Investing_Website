import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useEffect, useRef } from "react";
// @ts-ignore - Import framer-motion without type definitions
import { motion } from "framer-motion";

export default function Index() {
  const { isAuthenticated, logout, user } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-gray-900 to-black text-white">
      {/* Dynamic background with animated gradients */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-[10%] opacity-20">
          <svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="a" gradientTransform="rotate(150 0.5 0.5)">
                <stop offset="0%" stopColor="#4f46e5" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
              <linearGradient id="b" gradientTransform="rotate(240 0.5 0.5)">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
              <linearGradient id="c" gradientTransform="rotate(300 0.5 0.5)">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#4f46e5" />
              </linearGradient>
              <clipPath id="globe">
                <circle cx="500" cy="500" r="450" />
              </clipPath>
            </defs>
            <g clipPath="url(#globe)">
              <motion.circle
                cx="500"
                cy="500"
                r="300"
                fill="url(#a)"
                animate={{
                  r: [300, 320, 300],
                  opacity: [0.7, 0.9, 0.7],
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <motion.circle
                cx="500"
                cy="500"
                r="400"
                fill="url(#b)"
                animate={{
                  r: [400, 380, 400],
                  opacity: [0.5, 0.7, 0.5],
                }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <motion.circle
                cx="500"
                cy="500"
                r="500"
                fill="url(#c)"
                animate={{
                  r: [500, 480, 500],
                  opacity: [0.3, 0.5, 0.3],
                }}
                transition={{
                  duration: 10,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              
              {/* Network grid/lines */}
              {Array(8).fill(0).map((_, i) => (
                <motion.line
                  key={`grid-line-${i}`}
                  x1="0"
                  y1={100 + i * 100}
                  x2="1000"
                  y2={100 + i * 100}
                  stroke="#ffffff"
                  strokeWidth="0.5"
                  strokeDasharray="5,20"
                  strokeOpacity="0.15"
                  animate={{
                    strokeOpacity: [0.05, 0.15, 0.05],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.2,
                  }}
                />
              ))}
              {Array(8).fill(0).map((_, i) => (
                <motion.line
                  key={`grid-vert-${i}`}
                  x1={100 + i * 100}
                  y1="0"
                  x2={100 + i * 100}
                  y2="1000"
                  stroke="#ffffff"
                  strokeWidth="0.5"
                  strokeDasharray="5,20"
                  strokeOpacity="0.15"
                  animate={{
                    strokeOpacity: [0.05, 0.15, 0.05],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.2,
                  }}
                />
              ))}
              
              {/* Connection points */}
              {Array(15).fill(0).map((_, i) => {
                const x = 150 + Math.random() * 700;
                const y = 150 + Math.random() * 700;
                return (
                  <motion.circle
                    key={`node-${i}`}
                    cx={x}
                    cy={y}
                    r="3"
                    fill="#ffffff"
                    animate={{
                      opacity: [0.4, 1, 0.4],
                      scale: [1, 1.5, 1],
                    }}
                    transition={{
                      duration: 3 + Math.random() * 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                );
              })}
            </g>
          </svg>
        </div>
      </div>
      
      {/* Overlay with noise texture for depth */}
      <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] pointer-events-none z-0"></div>
      
      {/* Header/Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-black/30 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <motion.span 
                  className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  Finance Manager
                </motion.span>
              </Link>
            </div>
            
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <>
                  <span className="text-sm text-gray-300">Welcome, {user?.username}</span>
                  <button
                    onClick={handleLogout}
                    className="relative group px-4 py-2 rounded-md overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-blue-500 opacity-80 group-hover:opacity-100 transition-opacity"></div>
                    <span className="relative z-10 text-white font-medium">Sign out</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-full text-gray-300 hover:bg-gray-800"
                >
                  {isDarkMode ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-24 pb-16 relative z-10">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 lg:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Hero Section */}
            <div ref={heroRef} className="flex flex-col justify-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  AI-Powered Personal Finance Manager
                </h1>
                
                <motion.p 
                  className="mt-6 text-lg leading-8 text-gray-300 max-w-xl"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  Take control of your finances with our intelligent platform. Get personalized insights,
                  automated categorization, and smart budgeting recommendations powered by AI.
                </motion.p>
                
                <motion.div 
                  className="mt-10 flex items-center gap-x-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  {isAuthenticated ? (
                    <Link to="/dashboard">
                      <motion.button 
                        className="relative px-6 py-3 overflow-hidden rounded-md bg-gradient-to-r from-indigo-500 to-blue-500"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <motion.span 
                          className="absolute inset-0 opacity-0 bg-gradient-to-r from-indigo-400 to-blue-300 blur-xl rounded-md"
                          whileHover={{ opacity: 0.6 }}
                          transition={{ duration: 0.2 }}
                        />
                        <span className="relative z-10 font-semibold text-white">Go to Dashboard</span>
                      </motion.button>
                    </Link>
                  ) : (
                    <>
                      <Link to="/login">
                        <motion.button 
                          className="relative px-6 py-3 overflow-hidden rounded-md bg-gradient-to-r from-indigo-500 to-blue-500"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <motion.span 
                            className="absolute inset-0 opacity-0 bg-gradient-to-r from-indigo-400 to-blue-300 blur-xl rounded-md"
                            whileHover={{ opacity: 0.6 }}
                            transition={{ duration: 0.2 }}
                          />
                          <span className="relative z-10 font-semibold text-white">Get started</span>
                        </motion.button>
                      </Link>
                      <Link 
                        to="/about" 
                        className="text-sm font-semibold leading-6 text-gray-200 hover:text-white relative group"
                      >
                        Learn more 
                        <span className="inline-block transition-transform duration-300 group-hover:translate-x-1 ml-1">→</span>
                        <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-indigo-500 to-blue-500 group-hover:w-full transition-all duration-300"></span>
                      </Link>
                    </>
                  )}
                </motion.div>
              </motion.div>
            </div>
            
            {/* Image Section with floating effect */}
            <motion.div 
              className="relative flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.5 }}
            >
              <div className="relative max-w-xl w-full">
                {/* Glow effect behind image */}
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-2xl blur-xl opacity-40"></div>
                
                {/* Particle effects */}
                <div className="absolute w-full h-full">
                  {Array(10).fill(0).map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-1 h-1 rounded-full bg-blue-400"
                      style={{
                        top: `${Math.random() * 100}%`,
                        left: `${Math.random() * 100}%`,
                      }}
                      animate={{
                        opacity: [0.1, 0.8, 0.1],
                        scale: [0.5, 1.5, 0.5],
                      }}
                      transition={{
                        duration: 3 + Math.random() * 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    ></motion.div>
                  ))}
                </div>
                
                {/* Image with mask */}
                <div className="relative z-10 rounded-2xl overflow-hidden border border-gray-700 shadow-2xl">
                  <motion.img
                    src="/images/dashboard.jpg"
                    alt="App dashboard"
                    className="w-full h-auto object-cover"
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.6 }}
                  />
                  
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-indigo-600/20 to-transparent pointer-events-none"></div>
                </div>
                
                {/* Floating elements for visual flair */}
                <motion.div 
                  className="absolute -top-4 -right-4 w-12 h-12 bg-indigo-600 rounded-full blur-xl opacity-40"
                  animate={{ 
                    opacity: [0.4, 0.7, 0.4],
                    scale: [1, 1.2, 1]
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                ></motion.div>
                <motion.div 
                  className="absolute -bottom-6 -left-6 w-20 h-20 bg-blue-500 rounded-full blur-xl opacity-40"
                  animate={{ 
                    opacity: [0.4, 0.7, 0.4],
                    scale: [1, 1.2, 1]
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 1
                  }}
                ></motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
} 