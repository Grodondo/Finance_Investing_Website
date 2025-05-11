# AI-Powered Personal Finance Manager

A secure, full-stack web application for managing personal finances with AI-powered insights and automated transaction categorization.

## Security Features

- JWT-based authentication with secure token storage
- Password hashing using bcrypt
- CSRF protection
- Rate limiting on authentication endpoints
- Input validation and sanitization
- Secure HTTP headers
- XSS protection
- SQL injection prevention
- Environment variable management
- Regular security audits
- Error handling with no sensitive data exposure

## Features

- User authentication with JWT and two-factor authentication
- Real-time bank account integration via Plaid API
- AI-powered expense categorization
- Budget planning and tracking
- Savings goals management
- Interactive dashboard with financial insights
- Responsive and modern UI
- Comprehensive error handling and user feedback

## Tech Stack

- **Backend**: Python (FastAPI)
- **Frontend**: React with TypeScript
- **Database**: PostgreSQL
- **Styling**: Tailwind CSS
- **AI**: Hugging Face Transformers
- **Bank Integration**: Plaid API
- **Charts**: Chart.js
- **Security**: JWT, bcrypt, CORS, Helmet

## Prerequisites

- Python 3.8+
- Node.js 14+
- PostgreSQL
- Plaid API credentials
- Hugging Face API token

## Security Setup

1. Generate a strong secret key:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

2. Set up secure environment variables:
```bash
# Backend (.env)
DATABASE_URL=postgresql://user:password@localhost:5432/personal_finance
SECRET_KEY=<generated-secret-key>
PLAID_CLIENT_ID=your-plaid-client-id
PLAID_SECRET=your-plaid-secret
PLAID_ENV=sandbox
HUGGING_FACE_TOKEN=your-hugging-face-token
CORS_ORIGINS=http://localhost:3000
RATE_LIMIT_PER_MINUTE=60
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=30

# Frontend (.env)
REACT_APP_API_URL=http://localhost:8000
REACT_APP_ENV=development
```

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
# Edit .env with your secure credentials
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

## Security Best Practices

1. **Environment Variables**
   - Never commit `.env` files
   - Use strong, unique secrets
   - Rotate secrets regularly
   - Use different secrets for development and production

2. **Authentication**
   - Implement rate limiting on login attempts
   - Use secure password requirements
   - Implement account lockout after failed attempts
   - Use secure session management

3. **API Security**
   - Validate all input data
   - Implement proper CORS policies
   - Use HTTPS in production
   - Implement request rate limiting
   - Sanitize error messages

4. **Database Security**
   - Use parameterized queries
   - Implement proper access controls
   - Regular backups
   - Encrypt sensitive data

5. **Frontend Security**
   - Implement Content Security Policy
   - Use secure HTTP headers
   - Sanitize user input
   - Implement proper error handling
   - Use secure cookie settings

## Error Handling

The application implements comprehensive error handling:

- Frontend error boundaries for graceful error recovery
- User-friendly error messages
- Detailed error logging for debugging
- No sensitive data exposure in error messages
- Proper HTTP status codes
- Consistent error response format

## API Documentation

The API documentation is available at `http://localhost:8000/docs` when running the backend server.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Security Reporting

If you discover a security vulnerability, please report it to security@example.com. Do not disclose security-related issues publicly.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 