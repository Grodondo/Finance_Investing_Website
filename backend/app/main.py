from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import auth, transactions, insights, investing
from .database import engine, Base

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(transactions.router, prefix="/api/transactions", tags=["transactions"])
app.include_router(insights.router, prefix="/api/insights", tags=["insights"])
app.include_router(investing.router, prefix="/api/investing", tags=["investing"])

@app.get("/")
async def root():
    return {"message": "Personal Finance Manager API"} 