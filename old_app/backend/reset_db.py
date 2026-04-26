"""
Script to reset database and apply new schema.
Run as: python -m backend.reset_db
"""

import os
from pathlib import Path

from backend.db import Base, create_db_and_tables, engine
from backend.models import (
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


def reset_database():
    """Delete old database and create new one with updated schema."""
    
    db_path = Path(__file__).resolve().parents[1] / "sql_app.db"
    
    # Step 1: Remove old database
    if db_path.exists():
        print(f"Removing old database: {db_path}")
        os.remove(db_path)
        print("Old database removed")
    else:
        print(f"Database not found: {db_path} (will create new)")
    
    # Step 2: Create new database with updated schema
    print("\nCreating new database with updated schema...")
    
    # Drop all tables first (in case of partial state)
    try:
        Base.metadata.drop_all(bind=engine)
        print("Dropped existing tables")
    except Exception as e:
        print(f"Could not drop tables (likely didn't exist): {e}")
    
    # Create all tables
    create_db_and_tables()
    print("Created new tables")
    
    # List created tables
    inspector = __import__('sqlalchemy').inspect(engine)
    tables = inspector.get_table_names()
    
    print(f"\nDatabase Reset Complete!")
    print(f"Tables created ({len(tables)}):")
    for table in sorted(tables):
        print(f"   - {table}")


if __name__ == "__main__":
    reset_database()
