import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useEffect, useRef, useState } from "react";

const PARTICLE_COUNT = 50; 

interface ParticleConfig {
  id: number;
  xPercent: number;
  initialYVh: number; // Initial Y position in VH units
  size: number;
  speedFactor: number; // Multiplier for scroll-based movement
  color: string;
  initialOpacity: number;
}

export default function Index() {
  const { isAuthenticated, logout, user } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [particleConfigs, setParticleConfigs] = useState<ParticleConfig[]>([]);
  const particlesContainerRef = useRef<HTMLDivElement>(null);

  // Hide the ThemeToggle from root.tsx when on index page
  useEffect(() => {
    const rootThemeToggle = document.querySelector('body > div > button.theme-toggle-button:last-child') as HTMLElement | null;
    if (rootThemeToggle) {
      rootThemeToggle.style.display = 'none';
    }
    
    return () => {
      if (rootThemeToggle) {
        rootThemeToggle.style.display = 'block';
      }
    };
  }, []);

  // Initialize particles
  useEffect(() => {
    const generateParticles = () => {
      const newParticles: ParticleConfig[] = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const particleConfig = {
          id: i,
          xPercent: Math.random() * 100,
          initialYVh: Math.random() * 120, // Start particles within a 0-120VH range initially
          size: 10 + Math.random() * 15, // EXTREMELY large: 10px to 25px 
          speedFactor: 0.05 + Math.random() * 0.3, // Slower for better visibility
          color: isDarkMode
            ? `rgba(${200 + Math.random() * 55}, ${200 + Math.random() * 55}, ${255}, 0.9)` // Bright blue/purple in dark mode
            : `rgba(${30 + Math.random() * 50}, ${100 + Math.random() * 155}, ${220}, 0.9)`, // Bright blue in light mode
          initialOpacity: 0.9, // Very high opacity
        };
        newParticles.push(particleConfig);
      }
      setParticleConfigs(newParticles);
    };
    
    generateParticles();
    
    // Refresh particles every 30 seconds to keep animation fresh
    const intervalId = setInterval(() => {
      generateParticles();
    }, 30000);

    return () => clearInterval(intervalId);
  }, [isDarkMode]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Handle smooth scrolling to sections
  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Add animation effects on mount
  useEffect(() => {
    const animateElements = () => {
      // Animate heading
      const heading = heroRef.current?.querySelector('h1');
      if (heading) {
        heading.classList.add('animate-fade-in');
      }
      
      // Animate paragraph with delay
      const paragraph = heroRef.current?.querySelector('p');
      if (paragraph) {
        setTimeout(() => {
          paragraph.classList.add('animate-slide-up');
        }, 300);
      }
      
      // Animate buttons with delay
      const buttons = heroRef.current?.querySelectorAll('.cta-button');
      buttons?.forEach((button, index) => {
        setTimeout(() => {
          (button as HTMLElement).classList.add('animate-fade-in');
        }, 600 + (index * 200));
      });
    };
    
    animateElements();
  }, []);

  // Handle scroll effects
  useEffect(() => {
    const handleScroll = () => {
      const position = window.scrollY;
      setScrollPosition(position);
      
      // Animate section elements as they come into view
      const sections = document.querySelectorAll('.scroll-section');
      sections.forEach(section => {
        const rect = section.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight - 100;
        
        if (isVisible) {
          section.classList.add('section-visible');
        }
      });
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []); // scrollPosition is not needed as a dependency here as it's read directly

  const getWindowHeight = () => {
    if (typeof window !== 'undefined') {
      return window.innerHeight;
    }
    return 1000; // Default fallback for SSR or non-browser environments
  };

  return (
    <div className={`mercor-layout ${!isDarkMode ? 'light-mode' : ''}`}>
      {/* Background color based on theme */}
      <div className={`fixed inset-0 z-[-10] ${
          isDarkMode 
            ? 'bg-gradient-to-b from-gray-900 to-gray-950' 
            : 'bg-gradient-to-b from-blue-50 to-sky-100' // Brighter light mode gradient
        }`}></div>
      
      {/* Noise overlay - MOVED WAY BEHIND */}
      <div className="fixed inset-0 z-[-20] bg-[url('/noise.svg')] opacity-[0.03] pointer-events-none"></div>
      
      {/* Dynamic Particles Background - MOVED TO FRONT (positive z-index) */}
      <div 
        ref={particlesContainerRef}
        className="fixed inset-0 z-[10] overflow-visible pointer-events-none"
        style={{ willChange: 'transform' }} // Performance optimization
      >
        {particleConfigs.map(p => {
          const windowHeight = getWindowHeight();
          let currentYPercent = (p.initialYVh - (scrollPosition / windowHeight * 100 * p.speedFactor)) % 120;
          if (currentYPercent < 0) currentYPercent += 120; // Keep it positive within 0-120 VH
          
          return (
            <div 
              key={p.id} 
              className="absolute rounded-full transform -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${p.xPercent}%`,
                top: `${currentYPercent}vh`, // Using vh for consistent positioning
                width: `${p.size}px`,
                height: `${p.size}px`,
                backgroundColor: p.color,
                opacity: p.initialOpacity,
                boxShadow: `0 0 ${p.size}px ${p.color}`, // Added bigger glow effect
                filter: 'blur(1px)', // Slight blur for glow effect
                willChange: 'transform, opacity', // Performance optimization
              }}
            ></div>
          );
        })}
      </div>
      
      {/* Floating theme toggle */}
      <button 
        onClick={toggleTheme} 
        className="theme-toggle-button"
        aria-label="Toggle dark mode"
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
      
      {/* Header/Navigation with light/dark mode styles */}
      <header className={`mercor-header ${!isDarkMode ? 'light-mode-header' : ''} bg-opacity-90 backdrop-blur-md border-b ${
        isDarkMode ? 'bg-gray-900/80 border-gray-800/50' : 'bg-white/90 border-gray-200/30'
      }`}>
        <div className="header-content">
          <Link to="/" className="logo-link">
            <span className={`logo-text ${!isDarkMode ? 'text-blue-700' : ''}`}>Finance Manager</span>
          </Link>
          
          <div className="header-controls">
            {isAuthenticated ? (
              <>
                <span className={`welcome-text ${!isDarkMode ? 'text-gray-700' : 'text-gray-300'}`}>
                  Welcome, {user?.username}
                </span>
                <button
                  onClick={handleLogout}
                  className={`sign-out-button ${!isDarkMode ? 'light-mode-button-primary' : ''}`}
                >
                  <span>Sign out</span>
                </button>
              </>
            ) : (
              <div className="nav-links">
                <button 
                  onClick={() => scrollToSection('features')} 
                  className={`nav-link ${!isDarkMode ? 'text-gray-700 hover:text-blue-600' : 'text-gray-300 hover:text-white'}`}
                >
                  Features
                </button>
                <button 
                  onClick={() => scrollToSection('pricing')} 
                  className={`nav-link ${!isDarkMode ? 'text-gray-700 hover:text-blue-600' : 'text-gray-300 hover:text-white'}`}
                >
                  Pricing
                </button>
                <Link 
                  to="/about" 
                  className={`nav-link ${!isDarkMode ? 'text-gray-700 hover:text-blue-600' : 'text-gray-300 hover:text-white'}`}
                >
                  About
                </Link>
                <Link 
                  to="/login" 
                  className={`login-button ${!isDarkMode ? 'border-blue-500 text-blue-600 hover:bg-blue-50' : 'border-gray-700 text-white hover:border-indigo-500'}`}
                >
                  Login
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content with theme-sensitive styling */}
      <main className="mercor-main">
        {/* Hero Section */}
        <section className="hero-container">
          <div className="main-content">
            <div className="content-grid">
              {/* Hero Content */}
              <div ref={heroRef} className="hero-section">
                <h1 className={isDarkMode ? 'text-white hero-title' : 'light-mode-gradient-text-strong hero-title'}>
                  AI-Powered Personal Finance Manager
                </h1>
                
                <p className={isDarkMode ? 'text-gray-300 hero-description' : 'text-gray-600 hero-description'}>
                  Take control of your finances with our intelligent platform. Get personalized insights,
                  automated categorization, and smart budgeting recommendations powered by AI.
                </p>
                
                <div className="cta-buttons">
                  {isAuthenticated ? (
                    <Link to="/dashboard" className={`cta-button primary ${!isDarkMode ? 'light-mode-button-primary' : ''}`}>
                      <span className="button-text">Go to Dashboard</span>
                      <div className="button-glow"></div>
                    </Link>
                  ) : (
                    <>
                      <Link to="/register" className={`cta-button primary ${!isDarkMode ? 'light-mode-button-primary' : ''}`}>
                        <span className="button-text">Get started</span>
                        <div className="button-glow"></div>
                      </Link>
                      <Link 
                        to="/demo" 
                        className={`cta-button secondary ${!isDarkMode ? 'light-mode-button-secondary' : ''}`}
                      >
                        <span className="button-text">See Demo</span>
                        <span className="arrow">→</span>
                      </Link>
                    </>
                  )}
                </div>
              </div>
              
              {/* Image Section with floating effect */}
              <div className="image-section">
                <div className={`image-container ${!isDarkMode ? 'light-mode-image-container' : ''}`}>
                  {/* Glow effect behind image */}
                  <div className={`image-glow ${!isDarkMode ? 'light-mode-image-glow' : ''}`}></div>
                  
                  {/* Dashboard image */}
                  <div className={`dashboard-image border ${!isDarkMode ? 'border-gray-200' : 'border-gray-700'}`}>
                    <img
                      src="/images/index_ss.jpg"
                      alt="App dashboard"
                      className="dashboard-screenshot"
                    />
                    
                    {/* Gradient overlay */}
                    <div className={`image-overlay ${!isDarkMode ? 'light-mode-image-overlay' : ''}`}></div>
                  </div>
                  
                  {/* Decorative elements */}
                  <div className={`decoration top-right ${!isDarkMode ? 'bg-blue-500' : 'bg-indigo-600'}`}></div>
                  <div className={`decoration bottom-left ${!isDarkMode ? 'bg-sky-400' : 'bg-blue-500'}`}></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className={`scroll-section features-section ${!isDarkMode ? 'bg-white' : 'bg-gray-900/50'}`} id="features">
          <div className="section-content">
            <div className="section-header">
              <h2 className={isDarkMode ? 'text-white section-title' : 'light-mode-gradient-text section-title'}>
                Powerful Features
              </h2>
              <p className={`section-subtitle ${!isDarkMode ? 'text-gray-600' : 'text-gray-300'}`}>
                Our intelligent tools help you manage your finances with ease
              </p>
            </div>
            
            <div className="features-grid">
              {[ 
                { title: "AI-Powered Insights", description: "Our machine learning algorithms analyze your spending patterns to provide personalized financial recommendations.", icon: "AI" },
                { title: "Automated Categorization", description: "Transactions are automatically categorized, saving you time and providing accurate spending breakdowns.", icon: "🔄" },
                { title: "Smart Budgeting", description: "Create intelligent budgets that adapt to your spending habits and help you reach your financial goals.", icon: "💰" },
                { title: "Financial Forecasting", description: "Predict your future financial situation based on current habits and plan for upcoming expenses.", icon: "📈" }
              ].map(feature => (
                <div key={feature.title} className={`feature-card ${!isDarkMode ? 'light-mode-card bg-slate-50 hover:bg-white' : ''}`}>
                  <div className={`feature-icon ${!isDarkMode ? 'bg-gradient-to-br from-blue-500 to-sky-600' : 'bg-gradient-to-br from-indigo-500 to-blue-600'}`}>
                    <span className="text-white font-bold">{feature.icon}</span>
                  </div>
                  <h3 className={`feature-title ${!isDarkMode ? 'text-gray-800' : 'text-white'}`}>{feature.title}</h3>
                  <p className={`feature-description ${!isDarkMode ? 'text-gray-600' : 'text-gray-300'}`}>{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        
        {/* Testimonials Section */}
        <section className={`scroll-section testimonials-section ${!isDarkMode ? 'bg-gray-50' : ''}`} id="testimonials">
          <div className="section-content">
            <div className="section-header">
              <h2 className={isDarkMode ? 'text-white section-title' : 'light-mode-gradient-text section-title'}>
                What Our Users Say
              </h2>
              <p className={`section-subtitle ${!isDarkMode ? 'text-gray-600' : 'text-gray-300'}`}>
                Join thousands of satisfied users who transformed their financial lives
              </p>
            </div>
            
            <div className="testimonials-grid">
              {[ 
                { name: "Alex Johnson", role: "Small Business Owner", text: "This platform completely changed how I manage my finances. The AI insights helped me save $500 in the first month alone!" },
                { name: "Sarah Williams", role: "Software Engineer", text: "The budgeting features are exceptional. I finally feel in control of my spending and can see a clear path to my financial goals." },
                { name: "Michael Chen", role: "Marketing Director", text: "I've tried many finance apps before, but none of them had the intelligent insights this one provides. Absolutely worth every penny." }
              ].map(testimonial => (
                <div key={testimonial.name} className={`testimonial-card ${!isDarkMode ? 'light-mode-card bg-slate-50 hover:bg-white' : ''}`}>
                  <div className="testimonial-content">
                    <p className={`testimonial-text ${!isDarkMode ? 'text-gray-700' : 'text-white'}`}>"{testimonial.text}"</p>
                  </div>
                  <div className="testimonial-author">
                    <div className={`author-avatar ${!isDarkMode ? 'bg-gradient-to-br from-blue-500 to-sky-600' : 'bg-gradient-to-br from-indigo-500 to-blue-600'}`}></div>
                    <div className="author-info">
                      <p className={`author-name ${!isDarkMode ? 'text-gray-800' : 'text-white'}`}>{testimonial.name}</p>
                      <p className={`author-role ${!isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{testimonial.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        
        {/* Pricing Section */}
        <section className={`scroll-section pricing-section ${!isDarkMode ? 'bg-white' : 'bg-gray-900/50'}`} id="pricing">
          <div className="section-content">
            <div className="section-header">
              <h2 className={isDarkMode ? 'text-white section-title' : 'light-mode-gradient-text section-title'}>
                Simple, Transparent Pricing
              </h2>
              <p className={`section-subtitle ${!isDarkMode ? 'text-gray-600' : 'text-gray-300'}`}>
                Choose the plan that fits your needs
              </p>
            </div>
            
            <div className="pricing-grid">
              {/* Basic plan */}
              <div className={`pricing-card ${!isDarkMode ? 'light-mode-card bg-slate-50 hover:bg-white' : ''}`}>
                <div className={`pricing-header ${!isDarkMode ? 'border-gray-200' : 'border-gray-800'}`}>
                  <h3 className={`pricing-tier ${!isDarkMode ? 'text-gray-800' : 'text-white'}`}>Basic</h3>
                  <p className={`${!isDarkMode ? 'text-gray-500' : 'text-gray-300'}`}>
                    <span className={`price ${!isDarkMode ? 'text-gray-800' : 'text-white'}`}>$0</span>/month
                  </p>
                </div>
                <ul className="pricing-features">
                  {["Manual transaction tracking", "Basic budgeting tools", "Monthly financial reports", "Mobile app access"].map(item => (
                    <li key={item} className={`${!isDarkMode ? 'text-gray-600' : 'text-gray-300'}`}>{item}</li>
                  ))}
                </ul>
                <div className="pricing-cta">
                  <Link to="/signup" className={`pricing-button ${!isDarkMode ? 'light-mode-button-secondary' : ''}`}>Get Started</Link>
                </div>
              </div>
              
              {/* Pro plan */}
              <div className={`pricing-card featured ${!isDarkMode ? 'light-mode-card-featured' : ''}`}>
                <div className={`pricing-badge ${!isDarkMode ? 'bg-blue-600 text-white' : 'bg-indigo-500 text-white'}`}>Most Popular</div>
                <div className={`pricing-header ${!isDarkMode ? 'border-gray-200' : 'border-gray-800'}`}>
                  <h3 className={`pricing-tier ${!isDarkMode ? 'text-gray-800' : 'text-white'}`}>Pro</h3>
                  <p className={`${!isDarkMode ? 'text-gray-500' : 'text-gray-300'}`}>
                    <span className={`price ${!isDarkMode ? 'text-gray-800' : 'text-white'}`}>$9.99</span>/month
                  </p>
                </div>
                <ul className="pricing-features">
                  {[ "Automatic transaction import", "AI-powered categorization", "Custom budgeting tools", "Spending insights & analytics", "Goal tracking & forecasting"].map(item => (
                    <li key={item} className={`${!isDarkMode ? 'text-gray-600' : 'text-gray-300'}`}>{item}</li>
                  ))}
                </ul>
                <div className="pricing-cta">
                  <Link to="/signup?plan=pro" className={`pricing-button featured ${!isDarkMode ? 'light-mode-button-primary' : ''}`}>Choose Plan</Link>
                </div>
              </div>
              
              {/* Enterprise plan */}
              <div className={`pricing-card ${!isDarkMode ? 'light-mode-card bg-slate-50 hover:bg-white' : ''}`}>
                <div className={`pricing-header ${!isDarkMode ? 'border-gray-200' : 'border-gray-800'}`}>
                  <h3 className={`pricing-tier ${!isDarkMode ? 'text-gray-800' : 'text-white'}`}>Enterprise</h3>
                  <p className={`${!isDarkMode ? 'text-gray-500' : 'text-gray-300'}`}>
                    <span className={`price ${!isDarkMode ? 'text-gray-800' : 'text-white'}`}>$24.99</span>/month
                  </p>
                </div>
                <ul className="pricing-features">
                  {[ "Everything in Pro plan", "Multiple account management", "Team access controls", "Advanced financial forecasting", "Dedicated support", "Custom integrations"].map(item => (
                    <li key={item} className={`${!isDarkMode ? 'text-gray-600' : 'text-gray-300'}`}>{item}</li>
                  ))}
                </ul>
                <div className="pricing-cta">
                  <Link to="/signup?plan=enterprise" className={`pricing-button ${!isDarkMode ? 'light-mode-button-secondary' : ''}`}>Choose Plan</Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className={`scroll-section cta-section ${!isDarkMode ? 'bg-gray-50' : ''}`} id="get-started">
          <div className="section-content">
            <div className="cta-container">
              <h2 className={isDarkMode ? 'text-white cta-title' : 'light-mode-gradient-text-strong cta-title'}>
                Ready to transform your financial life?
              </h2>
              <p className={`cta-description ${!isDarkMode ? 'text-gray-600' : 'text-gray-300'}`}>
                Join thousands of users who are already taking control of their finances
                with our AI-powered platform.
              </p>
              <div className="cta-actions">
                <Link to="/signup" className={`cta-button primary large ${!isDarkMode ? 'light-mode-button-primary' : ''}`}>
                  <span className="button-text">Start for free</span>
                  <div className="button-glow"></div>
                </Link>
                <Link to="/contact" className={`cta-button secondary large ${!isDarkMode ? 'light-mode-button-secondary-cta' : ''}`}>
                  <span className="button-text">Contact sales</span>
                  <span className="arrow">→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer with light/dark styling */}
      <footer className={`site-footer ${!isDarkMode ? 'bg-slate-100 border-slate-200' : 'bg-gray-950 border-gray-800'}`}>
        <div className="footer-content">
          <div className={`footer-grid ${!isDarkMode ? 'border-slate-300' : 'border-gray-800'}`}>
            <div className="footer-column">
              <h3 className={isDarkMode ? 'text-indigo-400 footer-title' : 'light-mode-gradient-text-footer footer-title'}>
                Finance Manager
              </h3>
              <p className={`${!isDarkMode ? 'text-slate-600' : 'text-gray-400'} footer-description`}>
                AI-powered financial management platform helping you make smarter decisions with your money.
              </p>
            </div>
            
            <div className="footer-column">
              <h4 className={`${!isDarkMode ? 'text-slate-800' : 'text-white'} footer-heading`}>Product</h4>
              <ul className="footer-links">
                <li><button onClick={() => scrollToSection('features')} className={`${!isDarkMode ? 'text-slate-600 hover:text-blue-600' : 'text-gray-400 hover:text-white'} footer-link`}>Features</button></li>
                <li><button onClick={() => scrollToSection('pricing')} className={`${!isDarkMode ? 'text-slate-600 hover:text-blue-600' : 'text-gray-400 hover:text-white'} footer-link`}>Pricing</button></li>
                <li><Link to="/security" className={`${!isDarkMode ? 'text-slate-600 hover:text-blue-600' : 'text-gray-400 hover:text-white'} footer-link`}>Security</Link></li>
                <li><Link to="/roadmap" className={`${!isDarkMode ? 'text-slate-600 hover:text-blue-600' : 'text-gray-400 hover:text-white'} footer-link`}>Roadmap</Link></li>
              </ul>
            </div>
            
            <div className="footer-column">
              <h4 className={`${!isDarkMode ? 'text-slate-800' : 'text-white'} footer-heading`}>Resources</h4>
              <ul className="footer-links">
                <li><Link to="/blog" className={`${!isDarkMode ? 'text-slate-600 hover:text-blue-600' : 'text-gray-400 hover:text-white'} footer-link`}>Blog</Link></li>
                <li><Link to="/help" className={`${!isDarkMode ? 'text-slate-600 hover:text-blue-600' : 'text-gray-400 hover:text-white'} footer-link`}>Help Center</Link></li>
                <li><Link to="/guides" className={`${!isDarkMode ? 'text-slate-600 hover:text-blue-600' : 'text-gray-400 hover:text-white'} footer-link`}>Guides</Link></li>
                <li><Link to="/api" className={`${!isDarkMode ? 'text-slate-600 hover:text-blue-600' : 'text-gray-400 hover:text-white'} footer-link`}>API</Link></li>
              </ul>
            </div>
            
            <div className="footer-column">
              <h4 className={`${!isDarkMode ? 'text-slate-800' : 'text-white'} footer-heading`}>Company</h4>
              <ul className="footer-links">
                <li><Link to="/about" className={`${!isDarkMode ? 'text-slate-600 hover:text-blue-600' : 'text-gray-400 hover:text-white'} footer-link`}>About Us</Link></li>
                <li><Link to="/careers" className={`${!isDarkMode ? 'text-slate-600 hover:text-blue-600' : 'text-gray-400 hover:text-white'} footer-link`}>Careers</Link></li>
                <li><Link to="/contact" className={`${!isDarkMode ? 'text-slate-600 hover:text-blue-600' : 'text-gray-400 hover:text-white'} footer-link`}>Contact</Link></li>
                <li><Link to="/legal" className={`${!isDarkMode ? 'text-slate-600 hover:text-blue-600' : 'text-gray-400 hover:text-white'} footer-link`}>Legal</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="footer-bottom">
            <p className={`${!isDarkMode ? 'text-slate-500' : 'text-gray-500'} copyright`}>
              © {new Date().getFullYear()} Finance Manager. All rights reserved.
            </p>
            <div className="social-links">
              {[ {label: "Twitter", href: "#"}, {label: "LinkedIn", href: "#"}, {label: "GitHub", href: "#"} ].map(link => (
                <a key={link.label} href={link.href} className={`${!isDarkMode ? 'text-slate-500 hover:text-blue-600' : 'text-gray-400 hover:text-white'} social-link`} aria-label={link.label}>
                  {/* SVGs for social icons would go here, simplified for brevity */}
                  <svg className="social-icon" viewBox="0 0 24 24" fill="currentColor">
                    { link.label === "Twitter" && <path d="M22.46,6c-0.77,0.35-1.6,0.58-2.46,0.69c0.88-0.53,1.56-1.37,1.88-2.38c-0.83,0.5-1.75,0.85-2.72,1.05C18.37,4.5,17.26,4,16,4c-2.35,0-4.27,1.92-4.27,4.29c0,0.34,0.04,0.67,0.11,0.98C8.28,9.09,5.11,7.38,3,4.79c-0.37,0.63-0.58,1.37-0.58,2.15c0,1.49,0.75,2.81,1.91,3.56c-0.71,0-1.37-0.2-1.95-0.5v0.03c0,2.08,1.48,3.82,3.44,4.21c-0.36,0.1-0.74,0.15-1.13,0.15c-0.27,0-0.54-0.03-0.8-0.08c0.54,1.69,2.11,2.95,4,2.98c-1.46,1.16-3.31,1.84-5.33,1.84c-0.34,0-0.68-0.02-1.02-0.06C3.44,20.29,5.7,21,8.12,21C16,21,20.33,14.46,20.33,8.79c0-0.19,0-0.37-0.01-0.56C21.17,7.65,21.88,6.87,22.46,6z" />}
                    { link.label === "LinkedIn" && <path d="M19,3H5C3.9,3,3,3.9,3,5v14c0,1.1,0.9,2,2,2h14c1.1,0,2-0.9,2-2V5C21,3.9,20.1,3,19,3z M9,17H6.5v-7H9V17z M7.7,9.1c-0.8,0-1.4-0.7-1.4-1.4s0.6-1.4,1.4-1.4c0.8,0,1.4,0.6,1.4,1.4S8.5,9.1,7.7,9.1z M18,17h-2.4v-3.5c0-1.4-0.5-1.9-1.2-1.9c-0.7,0-1.2,0.5-1.2,1.7V17h-2.4v-7h2.3v1c0.3-0.6,1-1.2,2.2-1.2c1.2,0,2.8,0.7,2.8,3.2V17z" />}
                    { link.label === "GitHub" && <path d="M12,2A10,10,0,0,0,8.84,21.5c.5.08.66-.23.66-.5V19.31C6.73,19.91,6.14,18,6.14,18A2.69,2.69,0,0,0,5,16.5c-.91-.62.07-.6.07-.6a2.1,2.1,0,0,1,1.53,1,2.15,2.15,0,0,0,2.91.83,2.16,2.16,0,0,1,.63-1.34C8,16.17,5.62,15.31,5.62,11.5a3.87,3.87,0,0,1,1-2.71,3.58,3.58,0,0,1,.1-2.64s.84-.27,2.75,1a9.63,9.63,0,0,1,5,0c1.91-1.29,2.75-1,2.75-1a3.58,3.58,0,0,1,.1,2.64,3.87,3.87,0,0,1,1,2.71c0,3.82-2.34,4.66-4.57,4.91a2.39,2.39,0,0,1,.69,1.85V21c0,.27.16.59.67.5A10,10,0,0,0,12,2Z" />}
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
} 