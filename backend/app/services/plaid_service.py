import plaid
from plaid.api import plaid_api
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.accounts_balance_get_request import AccountsBalanceGetRequest
from plaid.model.transactions_get_request import TransactionsGetRequest
from plaid.model.transactions_get_request_options import TransactionsGetRequestOptions
import os
from dotenv import load_dotenv

load_dotenv()

# Plaid configuration
PLAID_CLIENT_ID = os.getenv("PLAID_CLIENT_ID")
PLAID_SECRET = os.getenv("PLAID_SECRET")
PLAID_ENV = os.getenv("PLAID_ENV", "sandbox")

configuration = plaid.Configuration(
    host=plaid.Environment.Sandbox if PLAID_ENV == "sandbox" else plaid.Environment.Development,
    api_key={
        'clientId': PLAID_CLIENT_ID,
        'secret': PLAID_SECRET,
    }
)

api_client = plaid.ApiClient(configuration)
client = plaid_api.PlaidApi(api_client)

class PlaidService:
    @staticmethod
    async def create_link_token(user_id: str):
        """Create a link token for Plaid Link initialization."""
        request = LinkTokenCreateRequest(
            user=LinkTokenCreateRequestUser(
                client_user_id=user_id
            ),
            client_name="Personal Finance Manager",
            products=["auth", "transactions"],
            country_codes=["US"],
            language="en"
        )
        response = client.link_token_create(request)
        return response.link_token

    @staticmethod
    async def exchange_public_token(public_token: str):
        """Exchange a public token for an access token."""
        request = ItemPublicTokenExchangeRequest(
            public_token=public_token
        )
        response = client.item_public_token_exchange(request)
        return response.access_token

    @staticmethod
    async def get_account_balance(access_token: str):
        """Get account balances for the given access token."""
        request = AccountsBalanceGetRequest(
            access_token=access_token
        )
        response = client.accounts_balance_get(request)
        return response.accounts

    @staticmethod
    async def get_transactions(access_token: str, start_date: str, end_date: str):
        """Get transactions for the given access token and date range."""
        request = TransactionsGetRequest(
            access_token=access_token,
            start_date=start_date,
            end_date=end_date,
            options=TransactionsGetRequestOptions()
        )
        response = client.transactions_get(request)
        return response.transactions 