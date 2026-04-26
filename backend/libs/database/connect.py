import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Dùng SQLite cho database
DB_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "app.db")
DATABASE_URL = f"sqlite:///{DB_FILE}"

# Để SQLite sử dụng các thread khác nhau trong FastAPI
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionMaker = sessionmaker(bind=engine, autoflush=False, autocommit=False)

def get_connection():
    """
    Hàm tĩnh trả về đối tượng engine nếu cần. 
    SessionMaker đã cover được các logic thao tác db qua ORM.
    """
    return engine.connect()

def get_db():
    db = SessionMaker()
    try:
        yield db
    finally:
        db.close()

