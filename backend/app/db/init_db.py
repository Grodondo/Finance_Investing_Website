from sqlalchemy.orm import Session
from ..models.user import User, UserRole
from ..models.investing import Stock, Holding, Order, Watchlist
from ..models.forum import ForumSection, ForumSectionType
from ..auth.utils import get_password_hash
from .database import Base, engine

def init_db():
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    # Create a session
    db = Session(engine)
    
    # Check if admin user exists
    admin = db.query(User).filter(User.email == "admin@example.com").first()
    if not admin:
        admin_user = User(
            email="admin@example.com",
            username="admin",
            hashed_password=get_password_hash("admin"),  # Changed from admin123 to admin
            role=UserRole.ADMIN,
            is_active=True
        )
        db.add(admin_user)
    
    # Check if default user exists
    default_user = db.query(User).filter(User.email == "user@example.com").first()
    if not default_user:
        user = User(
            email="user@example.com",
            username="user",
            hashed_password=get_password_hash("user123"),  # Change this in production!
            role=UserRole.USER,
            is_active=True
        )
        db.add(user)
    
    # Add some sample stocks if none exist
    if db.query(Stock).count() == 0:
        sample_stocks = [
            Stock(symbol="AAPL", name="Apple Inc.", current_price=150.0),
            Stock(symbol="GOOGL", name="Alphabet Inc.", current_price=2800.0),
            Stock(symbol="MSFT", name="Microsoft Corporation", current_price=280.0),
            Stock(symbol="AMZN", name="Amazon.com Inc.", current_price=3300.0),
            Stock(symbol="TSLA", name="Tesla Inc.", current_price=900.0),
        ]
        db.add_all(sample_stocks)
    
    # Add forum sections if none exist
    if db.query(ForumSection).count() == 0:
        forum_sections = [
            ForumSection(
                name="General Discussion",
                description="Discuss general personal finance topics",
                section_type=ForumSectionType.GENERAL,
                is_restricted=False
            ),
            ForumSection(
                name="Investment Tips",
                description="Share and discuss investment strategies and tips",
                section_type=ForumSectionType.INVESTMENT,
                is_restricted=False
            ),
            ForumSection(
                name="Budgeting Advice",
                description="Get and give advice on budgeting and saving money",
                section_type=ForumSectionType.BUDGETING,
                is_restricted=False
            ),
            ForumSection(
                name="Admin Announcements",
                description="Official announcements from the administrators",
                section_type=ForumSectionType.ANNOUNCEMENTS,
                is_restricted=True
            )
        ]
        db.add_all(forum_sections)
    
    # Commit changes
    db.commit()
    db.close()

if __name__ == "__main__":
    init_db() 