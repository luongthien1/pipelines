import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

load_dotenv()

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sql_app.db")

# For SQLite, we need to allow multiple threads to access it
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# Import all models to register them with Base
from .models import (
    Dataset,
    DatasetItem,
    DatasetTask,
    DatasetVersion,
    Deployment,
    Model,
    ModelVersion,
    Pipeline,
    Project,
)


def create_db_and_tables():
    """Create all tables in the database."""
    Base.metadata.create_all(bind=engine)


# Dependency to get the database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
