# Personal Finance Manager - Project Documentation

## Table of Contents
- [Project Overview](#project-overview)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Functional Requirements](#functional-requirements)
- [Codebase Structure](#codebase-structure)
- [Backend Details](#backend-details)
- [Frontend Details](#frontend-details)
- [Database Schema](#database-schema)
- [Security Measures](#security-measures)
- [API Endpoints](#api-endpoints)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Maintenance](#maintenance)

## Project Overview

The Personal Finance Manager is a comprehensive financial management application designed to help users take control of their finances. It combines expense tracking, investment portfolio management, real-time stock market data, and AI-powered financial insights in a modern, user-friendly interface.

### Key Features

- **Transaction Tracking**: Categorize and monitor expenses
- **Investment Portfolio**: Track stocks and manage investments
- **Stock Market Data**: Real-time data and historical trends
- **Financial Insights**: AI-powered analytics and recommendations
- **Community Forum**: Financial discussions with other users
- **News Integration**: Relevant financial news for better decision-making
- **Responsive Design**: Seamless experience across devices

The application targets individual investors, financial enthusiasts, and anyone looking to improve their financial management skills. It provides both beginner-friendly features and advanced tools for experienced users.

## Technology Stack

### Backend
- **Framework**: FastAPI - A modern, high-performance Python web framework that supports asynchronous operations
- **Language**: Python 3.8+ - Offering strong typing capabilities and modern language features
- **Database ORM**: SQLAlchemy - For database operations with Object-Relational Mapping
- **Database Migrations**: Alembic - Maintaining database schema changes
- **Authentication**: JWT (JSON Web Tokens) - Secure, stateless authentication
- **API Integration**: Yahoo Finance API - For real-time stock data and financial news
- **Data Processing**: Pandas - For efficient data manipulation and analysis

### Frontend
- **Framework**: React - A component-based JavaScript library for building user interfaces
- **Language**: TypeScript - Adding static typing to improve code quality and maintainability
- **Routing**: React Router - For client-side navigation
- **State Management**: React Query for server state, Context API for application state
- **UI Components**: Custom components with responsive design
- **Styling**: TailwindCSS - A utility-first CSS framework
- **Data Visualization**: Chart.js - For interactive financial charts and graphs
- **HTTP Client**: Axios - For browser and server HTTP requests

### Infrastructure
- **Containerization**: Docker - For consistent development and deployment environments
- **Orchestration**: Docker Compose - Managing multi-container Docker applications
- **Database**: PostgreSQL - A powerful, open-source relational database
- **Version Control**: Git - For source code management
- **Development Environment**: Node.js for frontend, Python virtual environments for backend

## Architecture

The Personal Finance Manager follows a modern, microservices-oriented architecture with clear separation between frontend and backend components.

### High-Level Architecture

```
┌─────────────────┐     ┌───────────────────┐     ┌─────────────────┐
│                 │     │                   │     │                 │
│    Frontend     │◄───►│      Backend      │◄───►│    Database     │
│    (React)      │     │     (FastAPI)     │     │  (PostgreSQL)   │
│                 │     │                   │     │                 │
└─────────────────┘     └───────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │   External APIs  │
                        │ (Yahoo Finance)  │
                        │                 │
                        └─────────────────┘
```

### Communication Flow

1. The React frontend makes HTTP requests to the FastAPI backend
2. The backend processes requests, interacts with the database, and communicates with external APIs
3. The backend returns structured JSON responses to the frontend
4. The frontend renders data and handles user interactions

## Functional Requirements

### User Management
- User registration and authentication
- Profile management with preferences
- Role-based access control (user, admin)

### Financial Transaction Management
- Add, edit, and delete transactions
- Categorize transactions
- Filter and search transaction history
- Generate spending reports and insights

### Investment Management
- Stock portfolio tracking
- Buy/sell order management
- Watchlist creation and management
- Performance tracking with gains/losses
- Stock recommendations

### Market Data
- Real-time stock quotes
- Historical price data visualization
- Stock details and company information
- Market news and updates

### News & Insights
- Financial news aggregation
- Personalized news based on portfolio
- Market trends and analysis
- AI-powered insights

### Community Features
- Discussion forums by topic
- Post and comment functionality
- Like/upvote system
- User reputation system

## Codebase Structure

### Root Structure

```
Personal_Finance_Manager/
├── backend/                # Python FastAPI application
├── frontend/               # React TypeScript application
├── alembic/                # Database migration scripts
├── docker-compose.yml      # Docker service configuration
├── README.md               # Project overview and setup instructions
├── Technical_Documentation.md  # Technical details for developers
└── PROJECT_DOCUMENTATION.md  # This comprehensive documentation
```

### Backend Structure

```
backend/
├── app/
│   ├── models/          # Database models (SQLAlchemy)
│   ├── routes/          # API route handlers
│   ├── schemas/         # Pydantic schemas for request/response validation
│   ├── auth/            # Authentication utilities
│   ├── db/              # Database connection utilities
│   ├── services/        # Business logic and service layers
│   ├── utils/           # Helper functions and utilities
│   └── routers/         # Specialized route handlers
├── main.py              # Application entry point
├── requirements.txt     # Python dependencies
├── alembic.ini          # Alembic configuration
└── Dockerfile           # Backend container configuration
```

### Frontend Structure

```
frontend/
├── app/
│   ├── components/      # Reusable UI components
│   ├── contexts/        # React context providers
│   ├── routes/          # Page components
│   ├── i18n/            # Internationalization resources
│   ├── App.tsx          # Main application component
│   ├── root.tsx         # Root component with providers
│   └── routes.tsx       # Route definitions
├── public/              # Static assets
├── package.json         # Node.js dependencies
├── tailwind.config.js   # TailwindCSS configuration
└── Dockerfile           # Frontend container configuration
```

## Backend Details

The backend serves as a REST API that handles requests from the frontend, interacts with the database, and communicates with external services like Yahoo Finance API.

### Key Components

- **FastAPI Application**: The main entry point that registers routes and middleware
- **Pydantic Models**: Define request/response schemas with validation
- **SQLAlchemy Models**: Define database tables and relationships
- **Route Handlers**: Process HTTP requests and return responses
- **Auth Utilities**: Handle authentication and authorization
- **Database Utilities**: Manage database connections and transactions
- **Service Layer**: Contain business logic and external API interactions

### Core Modules

1. **Authentication Module** (`app/auth/`)
   - JWT token-based authentication
   - Password hashing and verification
   - User registration and login

2. **Investing Module** (`app/routes/investing.py`)
   - Stock data retrieval and caching
   - Portfolio management
   - Stock recommendations
   - Watchlist management

3. **News Module** (`app/routes/news.py`)
   - Financial news aggregation
   - News filtering and categorization
   - Watchlist-related news

4. **Forum Module** (`app/routes/forum.py`)
   - Community discussions
   - Post and comment management
   - Moderation features

5. **Transaction Module** (`app/routes/transactions.py`)
   - Expense tracking
   - Transaction categorization
   - Budget monitoring

6. **Insights Module** (`app/routes/insights.py`)
   - Financial analytics
   - Spending patterns
   - Investment performance

## Frontend Details

The frontend is a React application with TypeScript that provides an interactive user interface for managing finances, investments, and interacting with the community.

### Key Components

- **App Root**: Sets up routing and global providers
- **Context Providers**: Manage authentication state and theme
- **Route Components**: Individual pages in the application
- **UI Components**: Reusable components like charts, tables, and forms
- **API Clients**: Services for communicating with the backend API

### Core Pages

1. **Dashboard**: Overview of financial health with key metrics
2. **Investments**: Portfolio management and stock tracking
3. **Transactions**: Expense tracking and categorization
4. **Recommendations**: AI-powered stock recommendations
5. **News**: Financial news feed with filtering
6. **Forum**: Community discussions and interactions
7. **Profile**: User settings and preferences

### State Management

- **React Query**: For server state management (API data)
- **Context API**: For global application state (auth, theme)
- **Local State**: Component-specific state with useState/useReducer

## Database Schema

The PostgreSQL database uses the following schema to store application data:

### Users

| Column      | Type        | Description                       |
|-------------|-------------|-----------------------------------|
| id          | Integer     | Primary key                       |
| email       | String      | User's email address (unique)     |
| username    | String      | User's display name               |
| hashed_password | String  | Securely stored password          |
| is_active   | Boolean     | Account status                    |
| is_admin    | Boolean     | Administrator privileges          |
| created_at  | DateTime    | Account creation timestamp        |
| updated_at  | DateTime    | Last update timestamp             |

### Stocks

| Column        | Type        | Description                     |
|---------------|--------------|---------------------------------|
| id            | Integer     | Primary key                     |
| symbol        | String      | Stock ticker symbol             |
| name          | String      | Company name                    |
| current_price | Float       | Current stock price             |
| change        | Float       | Price change                    |
| change_percent| Float       | Percentage price change         |
| volume        | Integer     | Trading volume                  |
| market_cap    | Float       | Market capitalization           |
| last_updated  | DateTime    | Last data update timestamp      |

### Holdings

| Column        | Type        | Description                     |
|---------------|--------------|---------------------------------|
| id            | Integer     | Primary key                     |
| user_id       | Integer     | Foreign key to users            |
| stock_id      | Integer     | Foreign key to stocks           |
| shares        | Float       | Number of shares owned          |
| average_price | Float       | Average purchase price          |
| last_updated  | DateTime    | Last update timestamp           |

### Orders

| Column        | Type        | Description                     |
|---------------|--------------|---------------------------------|
| id            | Integer     | Primary key                     |
| user_id       | Integer     | Foreign key to users            |
| stock_id      | Integer     | Foreign key to stocks           |
| type          | Enum        | BUY or SELL                     |
| quantity      | Float       | Number of shares                |
| price         | Float       | Price per share                 |
| total_amount  | Float       | Total transaction amount        |
| status        | String      | Order status                    |
| created_at    | DateTime    | Order creation timestamp        |
| completed_at  | DateTime    | Order completion timestamp      |

### Watchlist

| Column        | Type        | Description                     |
|---------------|--------------|---------------------------------|
| id            | Integer     | Primary key                     |
| user_id       | Integer     | Foreign key to users            |
| stock_id      | Integer     | Foreign key to stocks           |
| added_at      | DateTime    | When stock was added            |

### Transactions

| Column        | Type        | Description                     |
|---------------|--------------|---------------------------------|
| id            | Integer     | Primary key                     |
| user_id       | Integer     | Foreign key to users            |
| amount        | Float       | Transaction amount              |
| category_id   | Integer     | Foreign key to categories       |
| description   | String      | Transaction description         |
| date          | Date        | Transaction date                |
| is_expense    | Boolean     | True for expense, false for income |
| created_at    | DateTime    | Record creation timestamp       |

### Categories

| Column        | Type        | Description                     |
|---------------|--------------|---------------------------------|
| id            | Integer     | Primary key                     |
| name          | String      | Category name                   |
| icon          | String      | Category icon identifier        |
| is_default    | Boolean     | Whether it's a default category |

### Forum-related Tables

The application also includes tables for forum functionality:
- Topics
- Posts
- Comments
- Likes
- User activity

## Security Measures

The application implements several security measures to protect user data and ensure secure operations:

### Authentication & Authorization
- JSON Web Token (JWT) based authentication
- Password hashing using secure algorithms
- Role-based access control
- Token expiration and refresh mechanisms

### Data Protection
- HTTPS for all communications
- Input validation using Pydantic schemas
- Parameterized SQL queries to prevent SQL injection
- XSS protection through content encoding

### API Security
- Rate limiting to prevent abuse
- CORS (Cross-Origin Resource Sharing) restrictions
- API key validation for external service calls
- Request validation and sanitization

### Infrastructure Security
- Containerized deployment for isolation
- Principle of least privilege for services
- Regular security updates and patches
- Environment variable management for secrets

## API Endpoints

The backend exposes the following key API endpoints:

### Authentication
- `POST /api/auth/register`: Create new user account
- `POST /api/auth/login`: Authenticate and receive access token
- `POST /api/auth/refresh`: Refresh access token
- `GET /api/auth/me`: Get current user profile

### Investments
- `GET /api/stocks/search`: Search for stocks
- `GET /api/stocks/{symbol}`: Get detailed stock information
- `GET /api/stocks/recommendations`: Get stock recommendations
- `GET /api/portfolio`: Get user's investment portfolio
- `POST /api/orders`: Create buy/sell orders
- `GET /api/watchlist`: Get user's watchlist
- `POST /api/watchlist`: Add stock to watchlist
- `DELETE /api/watchlist/{stock_id}`: Remove stock from watchlist

### News
- `GET /api/news/market`: Get general market news
- `GET /api/news/watchlist`: Get news related to watchlist stocks
- `GET /api/news/stock/{symbol}`: Get news for specific stock

### Forum
- `GET /api/forum/topics`: Get all discussion topics
- `GET /api/forum/topics/{id}/posts`: Get posts for a topic
- `POST /api/forum/posts`: Create a new post
- `GET /api/forum/posts/{id}/comments`: Get comments for a post
- `POST /api/forum/posts/{id}/comments`: Add comment to a post
- `POST /api/forum/posts/{id}/like`: Like a post

### Transactions
- `GET /api/transactions`: Get user's transactions
- `POST /api/transactions`: Create new transaction
- `PUT /api/transactions/{id}`: Update transaction
- `DELETE /api/transactions/{id}`: Delete transaction
- `GET /api/categories`: Get transaction categories

### Insights
- `GET /api/insights/spending`: Get spending insights
- `GET /api/insights/budget`: Get budget compliance insights
- `GET /api/insights/investments`: Get investment performance insights

## Deployment

The application is containerized using Docker and can be deployed in various environments.

### Development Environment
- Local deployment using Docker Compose
- Hot reloading for both frontend and backend
- Debug tools and development utilities

### Production Environment
- Multi-stage Docker builds for optimized images
- Nginx reverse proxy for frontend assets
- Database migrations run automatically
- Health checks and automatic restarts

### Deployment Process
1. Build Docker images for frontend and backend
2. Apply database migrations
3. Start services with Docker Compose
4. Verify health checks
5. Configure reverse proxy (if needed)

## Roadmap

Planned enhancements for future versions:

### Short-term (Next 3 Months)
- Mobile application development
- Export functionality for financial reports
- Enhanced notification system
- Dark mode improvements

### Medium-term (3-6 Months)
- AI-powered budget recommendations
- Real-time stock price updates via WebSockets
- Integration with banking APIs
- Advanced charting tools with technical indicators

### Long-term (6-12 Months)
- Multi-currency support
- Tax reporting features
- Retirement planning tools
- Social features for investment communities

## Maintenance

The application follows these maintenance practices:

### Regular Updates
- Weekly dependency updates
- Monthly security patches
- Quarterly feature releases

### Monitoring
- Application performance monitoring
- Error tracking and logging
- Database query optimization
- User feedback collection

### Backup Strategy
- Daily database backups
- Weekly full system backups
- Disaster recovery procedures

### Support Processes
- Issue tracking system
- User support workflow
- Documentation updates
- Performance optimization reviews 