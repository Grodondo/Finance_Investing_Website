from sqlalchemy.orm import Session
from models.user import User, UserRole
from auth.utils import get_password_hash
from database import Base, engine

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
    
    # Commit changes
    db.commit()
    db.close()

if __name__ == "__main__":
    init_db() 