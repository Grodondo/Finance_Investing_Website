from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
import os
import logging
from app.db.init_db import init_db
from app.db.database import engine, Base

# Configure logging
logging.basicConfig(
    level=logging.WARNING,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()  # This will print to console
    ]
)

# Prevent duplicate logs by configuring uvicorn loggers
logging.getLogger("uvicorn").handlers = []
logging.getLogger("uvicorn.access").handlers = []
logging.getLogger("uvicorn.error").handlers = []
logging.getLogger("uvicorn").propagate = True

# Load environment variables
load_dotenv()

# Create database tables
# Base.metadata.create_all(bind=engine) # Commented out

app = FastAPI(
    title="AI-Powered Personal Finance Manager",
    description="Backend API for Personal Finance Manager with AI capabilities",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OAuth2 scheme for token authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

# Initialize database and create default users
@app.on_event("startup")
async def startup_event():
    logging.info("Starting up application...")
    init_db()
    logging.info("Database initialized")

# Import and include routers
from app.routes.auth import router as auth_router
from app.routes.transactions import router as transactions_router
from app.routes.insights import router as insights_router
from app.routes.investing import router as investing_router
from app.routes.news import router as news_router
from app.routes.forum import router as forum_router
from app.routes.stock_ai import router as stock_ai_router
from app.routes.notification import router as notification_router

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(transactions_router, prefix="/api", tags=["transactions"])
app.include_router(insights_router, prefix="/api", tags=["insights"])
app.include_router(investing_router, prefix="/api", tags=["investing"])
app.include_router(news_router, prefix="/api/news", tags=["news"])
app.include_router(forum_router, prefix="/api", tags=["forum"])
app.include_router(stock_ai_router, prefix="/api", tags=["stock-ai"])
app.include_router(notification_router, prefix="/api", tags=["notifications"])

@app.get("/")
async def root():
    return {"message": "Welcome to AI-Powered Personal Finance Manager API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 