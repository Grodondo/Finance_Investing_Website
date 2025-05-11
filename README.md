# AI-Powered Personal Finance Manager

A full-stack web application for managing personal finances with AI-powered insights and automated transaction categorization.

## Features

- User authentication with JWT and two-factor authentication
- Real-time bank account integration via Plaid API
- AI-powered expense categorization
- Budget planning and tracking
- Savings goals management
- Interactive dashboard with financial insights
- Responsive and modern UI

## Tech Stack

- **Backend**: Python (FastAPI)
- **Frontend**: React with TypeScript
- **Database**: PostgreSQL
- **Styling**: Tailwind CSS
- **AI**: Hugging Face Transformers
- **Bank Integration**: Plaid API
- **Charts**: Chart.js

## Prerequisites

- Python 3.8+
- Node.js 14+
- PostgreSQL
- Plaid API credentials
- Hugging Face API token

## Setup Instructions

### Backend Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. Initialize the database:
```bash
alembic upgrade head
```

5. Start the backend server:
```bash
uvicorn backend.main:app --reload
```

### Frontend Setup

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your backend API URL
```

3. Start the development server:
```bash
npm start
```

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://user:password@localhost:5432/personal_finance
SECRET_KEY=your-secret-key
PLAID_CLIENT_ID=your-plaid-client-id
PLAID_SECRET=your-plaid-secret
PLAID_ENV=sandbox
HUGGING_FACE_TOKEN=your-hugging-face-token
```

### Frontend (.env)
```
REACT_APP_API_URL=http://localhost:8000
```

## API Documentation

The API documentation is available at `http://localhost:8000/docs` when running the backend server.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 