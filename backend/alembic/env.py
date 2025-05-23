from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool
import sqlalchemy

from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
# --- Alembic Autogenerate Setup ---
import os
import sys
from dotenv import load_dotenv

# Add the app directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env')) # Assuming .env is in backend root

from app.db.database import Base # Import Base
# Import all your models here so Alembic can see them
from app.models.user import User
from app.models.transaction import Transaction
from app.models.category import Category
from app.models.budget import Budget
from app.models.investing import Holding, Order, Watchlist, Stock
from app.models.forum import ForumSection, ForumTag, ForumPost, ForumComment, ForumImage, ForumReport, post_tags, post_likes, comment_likes
from app.models.notification import Notification

target_metadata = Base.metadata
# --- End Alembic Autogenerate Setup ---

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline():
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True, # Add compare_type for better Enum support if needed
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    # Get the database URL directly from environment variable
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        # Fallback to alembic.ini if .env is not loaded or var not set, 
        # but this will likely fail if the interpolation issue persists for configparser
        db_url_from_ini = config.get_main_option("sqlalchemy.url")
        if not db_url_from_ini: # Should not happen if alembic.ini has the entry
             raise Exception("DATABASE_URL not found in environment or alembic.ini")
        # If db_url_from_ini still has %(DATABASE_URL)s, it won't resolve here.
        # This path assumes db_url_from_ini is a direct URL if .env didn't load.
        db_url = db_url_from_ini
        if "%" in db_url: # Indicates unresolved interpolation
            raise Exception(f"DATABASE_URL from alembic.ini could not be resolved: {db_url}. Ensure .env file is loaded or DATABASE_URL is set in the execution environment.")

    # Create engine configuration dictionary
    engine_config = {
        "url": db_url,
        "poolclass": pool.NullPool,
    }
    
    # Create engine directly
    connectable = sqlalchemy.create_engine(db_url, poolclass=pool.NullPool) # Use sqlalchemy directly

    with connectable.connect() as connection:
        context.configure(
            connection=connection, 
            target_metadata=target_metadata,
            compare_type=True, # Add compare_type for better Enum support
            # include_schemas=True, # If you use schemas other than public
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
