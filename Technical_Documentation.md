# Personal Finance Manager - Technical Documentation

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Frontend Implementation](#frontend-implementation)
5. [Backend Implementation](#backend-implementation)
6. [Database Design](#database-design)
7. [API Architecture](#api-architecture)
8. [Security Measures](#security-measures)
9. [Performance Optimization](#performance-optimization)
10. [Testing Strategy](#testing-strategy)
11. [Deployment Architecture](#deployment-architecture)
12. [Scalability Considerations](#scalability-considerations)
13. [Maintenance and Support](#maintenance-and-support)
14. [Appendix: Third-party Libraries](#appendix-third-party-libraries)

## Executive Summary

The Personal Finance Manager is a comprehensive web application designed to help users track, manage, and optimize their personal finances. The application provides a feature-rich dashboard for monitoring financial data, investment tracking, financial recommendations, and secure profile management.

This document provides an in-depth technical overview of the application, detailing the technologies used, architectural decisions, implementation specifics, and security measures in place.

## System Architecture

The Personal Finance Manager implements a modern client-server architecture with a clear separation between frontend and backend components:

### High-Level Architecture Diagram

```
┌─────────────────┐                 ┌─────────────────┐
│                 │     HTTPS       │                 │
│  Client Browser │ ──────────────> │   Load Balancer │
│                 │ <────────────── │                 │
└─────────────────┘                 └─────────────────┘
                                            │
                                            │
                                            ▼
                ┌─────────────────────────────────────────────┐
                │                                             │
                │               Web Servers                   │
                │               (Node.js)                     │
                │                                             │
                └─────────────────────────────────────────────┘
                                    │
                                    │
                                    ▼
    ┌────────────────────────────────────────────────────────────────┐
    │                                                                │
    │                        API Services                            │
    │                                                                │
    └────────────────────────────────────────────────────────────────┘
           │                   │                  │
           │                   │                  │
           ▼                   ▼                  ▼
┌─────────────────┐   ┌──────────────────┐   ┌─────────────────┐
│                 │   │                  │   │                 │
│  User Service   │   │  Finance Service │   │ Investment Svc  │
│                 │   │                  │   │                 │
└─────────────────┘   └──────────────────┘   └─────────────────┘
           │                   │                  │
           │                   │                  │
           ▼                   ▼                  ▼
┌─────────────────┐   ┌──────────────────┐   ┌─────────────────┐
│                 │   │                  │   │                 │
│  User Database  │   │  Finance Database│   │ Market Data DB  │
│                 │   │                  │   │                 │
└─────────────────┘   └──────────────────┘   └─────────────────┘
```

The architecture follows a microservices approach with the following components:

1. **Client Application**: Single-Page Application (SPA) built with React and TypeScript
2. **API Gateway**: Routes client requests to appropriate backend services
3. **Microservices**: Specialized services for user management, financial operations, and investment data
4. **Databases**: Separate databases for different domains of the application
5. **External Services**: Integration with financial data providers and authentication services

## Technology Stack

### Frontend
- **Framework**: React 18
- **Language**: TypeScript 4.9
- **State Management**: React Context API, React Query 4
- **Routing**: React Router 6
- **UI Components**: Custom components with Tailwind CSS
- **Styling**: Tailwind CSS 3
- **Charting Library**: Chart.js with React-ChartJS-2
- **Form Handling**: Custom hooks with validation
- **HTTP Client**: Fetch API with custom wrapper
- **Build Tool**: Vite

### Backend
- **Runtime Environment**: Node.js 18
- **Framework**: Express.js
- **Language**: TypeScript 4.9
- **API Documentation**: Swagger/OpenAPI 3.0
- **Authentication**: JWT with refresh tokens
- **Password Hashing**: bcrypt with salt rounds
- **Data Validation**: Zod
- **Logging**: Winston with structured JSON logging

### Database
- **Primary Database**: PostgreSQL 14
- **Caching Layer**: Redis 6
- **ORM**: Prisma
- **Migrations**: Prisma Migrate
- **Backup Strategy**: Point-in-time recovery with daily snapshots

### Infrastructure
- **Hosting**: AWS (Amazon Web Services)
- **Container Orchestration**: Kubernetes
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus with Grafana dashboards
- **Error Tracking**: Sentry
- **CDN**: CloudFront
- **DNS Management**: Route 53

## Frontend Implementation

### Component Architecture

The frontend application follows a component-based architecture using React functional components with hooks. The component hierarchy is structured as follows:

```
App
├── AuthProvider
│   ├── Routes
│   │   ├── Root
│   │   │   ├── Navbar
│   │   │   ├── <Page Content>
│   │   │   └── Footer
```

### Key Components

1. **Dashboard**: The main interface displaying financial overview, recent transactions, and budget summaries
   - Implements a drag-and-drop system for widget customization
   - Uses Chart.js for data visualization
   - Implements responsive design for all device sizes

2. **Investing Page**: Provides stock tracking, portfolio management, and investment analytics
   - Real-time stock data visualization
   - Portfolio performance tracking
   - Trading interface with order execution
   - Watchlist management

3. **Profile Management**: Secure user profile and settings management
   - Personal information management
   - Profile picture upload and management
   - Payment method management (credit cards)
   - Two-factor authentication setup

4. **Authentication**: Secure login, registration, and session management
   - JWT-based authentication
   - Refresh token rotation
   - Session timeout handling
   - Password reset functionality

### State Management

The application uses a combination of React Context and React Query for state management:

1. **AuthContext**: Manages authentication state, user information, and session management
2. **React Query**: Handles server state including data fetching, caching, and synchronization
3. **Local State**: Component-specific state managed with `useState` and `useReducer` hooks

### Routing

React Router 6 is used for client-side routing with the following route structure:

```
/                   - Landing page
/login              - User login
/register           - User registration
/dashboard          - Main dashboard
/investing          - Investment tracking and management
/recommendations    - Financial recommendations
/profile            - User profile management
/about              - About the application
```

### Data Fetching Strategy

The application uses React Query for data fetching with the following features:

1. **Caching**: Automatic caching of query results
2. **Background Fetching**: Silent background updates for fresh data
3. **Pagination Support**: Efficient loading of large datasets
4. **Mutation Management**: Optimistic updates and rollbacks
5. **Retry Logic**: Automatic retry on network failures
6. **Prefetching**: Preloading data for anticipated user actions

## Backend Implementation

### API Design

The backend API follows RESTful design principles with resource-oriented endpoints. The main API groups include:

1. **Authentication API**: User registration, login, token refresh, and logout
2. **User API**: User profile management and settings
3. **Financial API**: Transactions, budgets, and financial summaries
4. **Investment API**: Stock data, portfolio management, and watchlists

### Authentication Flow

The application implements a secure JWT-based authentication system:

1. **Login Process**:
   - User submits credentials
   - Server validates credentials and issues JWT access token and refresh token
   - Access token stored in memory, refresh token in httpOnly cookie

2. **Token Refresh**:
   - Silent refresh before token expiration
   - Refresh token rotation for security
   - Invalidation of compromised tokens

3. **Logout Process**:
   - Client-side token removal
   - Server-side token invalidation

### Middleware

The Express application uses several middleware layers:

1. **CORS**: Cross-Origin Resource Sharing configuration
2. **Helmet**: HTTP security headers
3. **Rate Limiting**: Protection against brute force and DoS attacks
4. **Body Parsing**: JSON request body parsing
5. **Authentication**: JWT verification
6. **Logging**: Request/response logging
7. **Error Handling**: Centralized error handling and formatting

## Database Design

### Schema Design

The database is designed with a normalized schema to ensure data integrity while maintaining performance:

#### User Management Tables
- `users`: Core user information
- `profiles`: Extended user profile data
- `sessions`: Active user sessions
- `auth_tokens`: Refresh tokens and validation

#### Financial Data Tables
- `accounts`: Financial accounts (checking, savings, credit)
- `transactions`: Financial transactions
- `categories`: Transaction categories
- `budgets`: Budget definitions and targets
- `budget_items`: Individual budget category allocations

#### Investment Tables
- `portfolios`: User investment portfolios
- `holdings`: Stock holdings within portfolios
- `watchlists`: User watchlists
- `watchlist_items`: Stocks in watchlists
- `stock_data`: Cached stock information
- `historical_prices`: Historical price data for stocks

### Data Access Layer

The application uses Prisma ORM for database access with the following features:

1. **Type Safety**: Full TypeScript integration
2. **Migration Management**: Version-controlled schema evolution
3. **Query Building**: Type-safe query construction
4. **Transactions**: ACID-compliant transactions
5. **Relations**: Automatic handling of relationships

### Database Security

The database implements multiple security measures:

1. **Connection Encryption**: TLS/SSL for all database connections
2. **Access Control**: Principle of least privilege for database users
3. **Query Parameterization**: Prevention of SQL injection
4. **Data Encryption**: Sensitive data encrypted at rest
5. **Audit Logging**: Database-level audit logging for security events

## API Architecture

### API Endpoints

The API is organized around resources with standard RESTful operations:

#### Authentication Endpoints
- `POST /api/auth/register`: Create new user account
- `POST /api/auth/login`: Authenticate and receive tokens
- `POST /api/auth/refresh`: Refresh access token
- `POST /api/auth/logout`: Invalidate tokens
- `GET /api/auth/me`: Get current user information

#### User Endpoints
- `GET /api/user/profile`: Get user profile
- `PUT /api/user/profile`: Update user profile
- `POST /api/user/profile-picture`: Upload profile picture
- `GET /api/user/credit-cards`: Get saved payment methods
- `POST /api/user/credit-cards`: Add new payment method
- `DELETE /api/user/credit-cards/:id`: Remove payment method
- `POST /api/user/2fa/setup`: Initialize 2FA setup
- `POST /api/user/2fa/verify`: Verify 2FA code
- `POST /api/user/2fa/disable`: Disable 2FA

#### Dashboard Endpoints
- `GET /api/dashboard`: Get dashboard configuration
- `PUT /api/dashboard`: Update dashboard layout
- `GET /api/dashboard/widgets`: Get available widgets
- `GET /api/dashboard/summary`: Get financial summary data

#### Investing Endpoints
- `GET /api/stocks/search`: Search for stocks
- `GET /api/stocks/:symbol`: Get detailed stock information
- `GET /api/portfolio`: Get user portfolio summary
- `GET /api/watchlist`: Get user watchlist
- `POST /api/watchlist`: Add stock to watchlist
- `DELETE /api/watchlist/:id`: Remove stock from watchlist
- `POST /api/orders`: Place buy/sell order

### API Versioning

The API implements versioning to ensure backward compatibility:

1. **URL Versioning**: Major versions in URL path (e.g., `/api/v1/users`)
2. **Header Versioning**: Fine-grained versioning in request headers
3. **Documentation**: Each version fully documented with migration guides

### Rate Limiting

To protect API resources, rate limiting is implemented with the following characteristics:

1. **Request Quotas**: Limits on requests per time window
2. **Graduated Limits**: Different limits for authenticated vs. unauthenticated requests
3. **Headers**: Rate limit information in response headers
4. **Backoff Strategy**: Exponential backoff for client retries

## Security Measures

### Authentication Security

1. **Password Requirements**:
   - Minimum length of 12 characters
   - Complexity requirements (uppercase, lowercase, numbers, symbols)
   - Password strength meter for user feedback
   - Check against common/breached password databases

2. **Multi-factor Authentication**:
   - TOTP-based two-factor authentication
   - QR code setup for authentication apps
   - Backup codes for recovery
   - Remember trusted devices option

3. **Session Management**:
   - Short-lived access tokens (15 minutes)
   - Refresh token rotation
   - Session inactivity timeout
   - Concurrent session management

### Data Protection

1. **Data at Rest**:
   - AES-256 encryption for sensitive data
   - Database-level encryption
   - Secure key management through AWS KMS

2. **Data in Transit**:
   - TLS 1.3 for all communications
   - HSTS implementation
   - Perfect forward secrecy
   - Strong cipher suites

3. **Payment Information**:
   - Credit card data tokenization
   - PCI DSS compliance measures
   - Only last 4 digits stored for display purposes
   - No CVV storage

### Vulnerability Prevention

1. **Input Validation**:
   - Server-side validation of all inputs
   - Input sanitization
   - Output encoding
   - Content Security Policy (CSP)

2. **Attack Prevention**:
   - XSS protection through React's built-in escaping and CSP
   - CSRF protection with token-based approach
   - SQL injection prevention through ORM parameterization
   - Clickjacking protection with X-Frame-Options

### Compliance

The application is designed to comply with the following regulations and standards:

1. **GDPR**: European data protection regulation
2. **CCPA**: California Consumer Privacy Act
3. **SOC 2**: Service Organization Control 2
4. **OWASP Top 10**: Protection against common web vulnerabilities

## Performance Optimization

### Frontend Optimizations

1. **Code Splitting**: Dynamic imports for route-based code splitting
2. **Bundle Size Optimization**: Tree shaking and dead code elimination
3. **Image Optimization**: WebP format, responsive loading, and lazy loading
4. **Critical CSS**: Inline critical styles for fast initial render
5. **Caching Strategy**: Appropriate cache headers and service worker implementation

### Backend Optimizations

1. **Database Indexing**: Strategic indexes for query performance
2. **Query Optimization**: Efficient query patterns and monitoring
3. **Connection Pooling**: Database connection management
4. **Caching Layer**: Redis for frequently accessed data
5. **Compressed Responses**: gzip/Brotli compression for API responses

### Network Optimizations

1. **CDN Integration**: Static assets delivered via CDN
2. **HTTP/2**: Multiplexed connections
3. **Resource Hints**: Preload, prefetch, and preconnect directives
4. **API Response Optimization**: Minimal payloads with field selection

## Testing Strategy

### Frontend Testing

1. **Unit Testing**: Jest and Testing Library for component testing
2. **Integration Testing**: Component interaction testing
3. **E2E Testing**: Cypress for full user flow testing
4. **Visual Regression**: Screenshot comparison for UI verification
5. **Accessibility Testing**: Automated a11y checks

### Backend Testing

1. **Unit Testing**: Individual function and utility testing
2. **Integration Testing**: API endpoint testing with database integration
3. **Load Testing**: Performance under load with k6
4. **Security Testing**: Automated vulnerability scanning
5. **Contract Testing**: API contract validation

### Test Automation

1. **CI Pipeline**: Automated tests on pull requests
2. **Test Coverage**: Minimum coverage requirements
3. **Reporting**: Detailed test reports and trend analysis
4. **Mocking**: Test doubles for external services

## Deployment Architecture

### Infrastructure as Code

The entire infrastructure is defined as code using:

1. **Terraform**: Infrastructure provisioning
2. **Kubernetes Manifests**: Container orchestration
3. **Helm Charts**: Application deployment
4. **GitHub Actions**: CI/CD workflows

### Environments

The application has multiple deployment environments:

1. **Development**: For active development
2. **Staging**: Pre-production testing
3. **Production**: Live customer-facing environment
4. **DR**: Disaster recovery environment

### Deployment Process

1. **CI/CD Pipeline**: Automated build, test, and deploy
2. **Blue-Green Deployment**: Zero-downtime deployments
3. **Canary Releases**: Gradual rollout with monitoring
4. **Rollback Capability**: Immediate rollback on issues

## Scalability Considerations

### Horizontal Scaling

1. **Stateless Design**: Application servers designed for horizontal scaling
2. **Load Balancing**: Distributed traffic across multiple instances
3. **Database Scaling**: Read replicas and sharding strategies
4. **Caching Strategy**: Distributed caching with Redis Cluster

### Vertical Scaling

1. **Resource Optimization**: Efficient resource utilization
2. **Performance Profiling**: Identification of bottlenecks
3. **Instance Sizing**: Appropriate sizing for workloads

### Micro-Frontend Architecture (Future)

As the application grows, we plan to implement a micro-frontend architecture:

1. **Module Federation**: Independent deployable frontend modules
2. **Team Autonomy**: Separate teams maintaining different sections
3. **Shared Components**: Common component library

## Maintenance and Support

### Monitoring

1. **Application Monitoring**: Performance metrics and error tracking
2. **Infrastructure Monitoring**: Resource utilization and health
3. **User Activity Monitoring**: Usage patterns and behavior
4. **Alerting**: Proactive notification of issues

### Logging

1. **Centralized Logging**: ELK stack for log aggregation
2. **Structured Logging**: JSON format for machine-readable logs
3. **Log Levels**: Appropriate verbosity for different environments
4. **Audit Logging**: Security-relevant events

### Backup and Recovery

1. **Database Backups**: Automated daily backups
2. **Point-in-Time Recovery**: Transaction log backups
3. **Disaster Recovery Plan**: Documented procedures for recovery
4. **Regular Testing**: Scheduled recovery exercises

## Appendix: Third-party Libraries

### Frontend Libraries
- **react**: Core UI library
- **react-router-dom**: Client-side routing
- **@tanstack/react-query**: Data fetching and caching
- **chart.js & react-chartjs-2**: Data visualization
- **tailwindcss**: Utility-first CSS framework
- **@heroicons/react**: Icon library
- **zod**: Schema validation
- **lodash**: Utility functions

### Backend Libraries
- **express**: Web framework
- **jsonwebtoken**: JWT implementation
- **bcrypt**: Password hashing
- **prisma**: Database ORM
- **zod**: Schema validation
- **winston**: Logging
- **helmet**: Security headers
- **cors**: Cross-Origin Resource Sharing
- **express-rate-limit**: API rate limiting

---

This document is maintained by the Personal Finance Manager development team and is updated with each major release.

Last Updated: June 2023
Version: 1.0 