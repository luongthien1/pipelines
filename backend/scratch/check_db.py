import sqlite3
import json

db_path = r'e:\Code\Job\self\Pipelines\backend\app.db'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# Get DatasetVersion 1
cursor.execute("SELECT * FROM dataset_versions WHERE id = 1")
version = cursor.fetchone()

if version:
    print(f"Version ID: {version['id']}")
    print(f"Dataset ID: {version['dataset_id']}")
    print(f"Unique Labels: {version['unique_labels']}")
    
    # Get Dataset Info
    cursor.execute("SELECT * FROM datasets WHERE id = ?", (version['dataset_id'],))
    dataset = cursor.fetchone()
    if dataset:
        print(f"Dataset Name: {dataset['name']}")
        print(f"Dataset Task: {dataset['task']}")
else:
    print("Dataset Version 1 not found")

conn.close()
