import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000/api"
# Replace with a valid token from your application
TOKEN = ""  # You'll need to get this from logging in

def get_auth_header():
    return {"Authorization": f"Bearer {TOKEN}"} if TOKEN else {}

def test_market_news():
    """Test the market news endpoint"""
    print("\n--- Testing Market News API ---")
    response = requests.get(f"{BASE_URL}/news/market", headers=get_auth_header())
    
    if response.status_code == 200:
        news = response.json()
        print(f"Success! Received {len(news)} market news items")
        if news:
            print("\nSample news item:")
            sample = news[0]
            print(f"Title: {sample.get('title')}")
            print(f"Publisher: {sample.get('publisher')}")
            print(f"Date: {sample.get('published_date')}")
            print(f"Related symbols: {sample.get('related_symbols')}")
    else:
        print(f"Error: {response.status_code}")
        print(response.text)

def test_watchlist_news():
    """Test the watchlist news endpoint"""
    print("\n--- Testing Watchlist News API ---")
    response = requests.get(f"{BASE_URL}/news/watchlist", headers=get_auth_header())
    
    if response.status_code == 200:
        news = response.json()
        print(f"Success! Received {len(news)} watchlist news items")
        if news:
            print("\nSample news item:")
            sample = news[0]
            print(f"Title: {sample.get('title')}")
            print(f"Publisher: {sample.get('publisher')}")
            print(f"Date: {sample.get('published_date')}")
            print(f"Related symbols: {sample.get('related_symbols')}")
    else:
        print(f"Error: {response.status_code}")
        print(response.text)

def login(email, password):
    """Login to get an access token"""
    print("\n--- Logging in to get token ---")
    response = requests.post(
        f"{BASE_URL}/auth/login", 
        json={"username": email, "password": password}
    )
    
    if response.status_code == 200:
        data = response.json()
        token = data.get("access_token")
        print(f"Login successful! Token received.")
        return token
    else:
        print(f"Login failed: {response.status_code}")
        print(response.text)
        return None

if __name__ == "__main__":
    # To get a token, uncomment and fill in your credentials
    # global TOKEN
    # TOKEN = login("your_email@example.com", "your_password")
    
    # Test the endpoints
    test_market_news()
    test_watchlist_news() 