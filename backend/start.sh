#!/bin/sh

# Run database migrations
echo "Running database migrations..."
alembic upgrade head

# Start Uvicorn server
echo "Starting Uvicorn server..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload 