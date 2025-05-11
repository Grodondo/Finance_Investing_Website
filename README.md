# AI-Powered Personal Finance Manager

A modern, full-stack personal finance management application that helps users track expenses, manage investments, and get AI-powered financial insights.

## Features

### Core Features
- 💰 Transaction tracking and categorization
- 📊 Financial insights and analytics
- 📈 Investment portfolio management
- 🔍 Stock market data integration
- 📱 Modern, responsive UI with dark mode support
- 🔒 Secure authentication and authorization
- 🤖 AI-powered financial recommendations

### Technical Features
- 🚀 FastAPI backend with async support
- ⚛️ React frontend with TypeScript
- 📦 PostgreSQL database with SQLAlchemy ORM
- 🔄 Real-time stock data via Yahoo Finance API
- 🎨 TailwindCSS for modern UI design
- 🔐 JWT-based authentication
- 🐳 Docker containerization
- 📈 Database migrations with Alembic

## Project Structure

```
Personal_Finance_Manager/
├── backend/
│   ├── app/
│   │   ├── models/         # Database models
│   │   ├── routes/         # API endpoints
│   │   ├── schemas/        # Pydantic models
│   │   ├── auth/           # Authentication logic
│   │   └── db/            # Database configuration
│   ├── alembic/           # Database migrations
│   ├── main.py           # FastAPI application
│   └── requirements.txt   # Python dependencies
├── frontend/
│   ├── app/
│   │   ├── components/    # Reusable UI components
│   │   ├── contexts/      # React contexts
│   │   ├── routes/        # Page components
│   │   └── utils/         # Utility functions
│   ├── public/           # Static assets
│   └── package.json      # Node.js dependencies
└── docker-compose.yml    # Docker services configuration
```

## Getting Started

### Prerequisites
- Python 3.8+
- Node.js 16+
- Docker and Docker Compose
- PostgreSQL (if running locally)

### Development Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd Personal_Finance_Manager
```

2. Set up the backend:
```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate

# Install dependencies
cd backend
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env  # Create and configure your .env file

# Initialize the database
python -m app.db.init_db
```

3. Set up the frontend:
```bash
cd frontend
npm install
```

4. Start the development servers:

Using Docker (recommended):
```bash
docker-compose up
```

Or manually:
```bash
# Terminal 1 - Backend
cd backend
uvicorn main:app --reload

# Terminal 2 - Frontend
cd frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs
- PgAdmin: http://localhost:5050

### Default Credentials
- Admin: admin@example.com / admin
- User: user@example.com / user123

## API Documentation

The API documentation is available at `/docs` when running the backend server. It provides:
- Interactive API documentation
- Request/response schemas
- Authentication requirements
- Example requests

## Database Management

### Migrations
```bash
# Create a new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head
```

### Database Access
- Direct: localhost:5432
- PgAdmin: localhost:5050
  - Email: admin@admin.com
  - Password: admin

## Deployment

### Production Build

1. Build the frontend:
```bash
cd frontend
npm run build
```

2. Build and run with Docker:
```bash
docker-compose -f docker-compose.prod.yml up --build
```

### Environment Variables

Required environment variables:
```
# Backend
DATABASE_URL=postgresql://user:password@host:5432/dbname
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Frontend
VITE_API_URL=http://localhost:8000
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- FastAPI for the backend framework
- React Router for frontend routing
- TailwindCSS for styling
- Yahoo Finance API for stock data
- PostgreSQL for database
- Docker for containerization 