from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
import os
from app.db.init_db import init_db

# Load environment variables
load_dotenv()

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
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Initialize database and create default users
@app.on_event("startup")
async def startup_event():
    init_db()

# Import and include routers
from auth.routes import router as auth_router
from app.routes.transactions import router as transactions_router
from app.routes.insights import router as insights_router

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(transactions_router, prefix="/api", tags=["transactions"])
app.include_router(insights_router, prefix="/api", tags=["insights"])

@app.get("/")
async def root():
    return {"message": "Welcome to AI-Powered Personal Finance Manager API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 