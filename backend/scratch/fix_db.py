import os
import sys
import sqlite3

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

db_path = 'app.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# 1. Update NULL values to '{}' for inputs and outputs in pipeline_runs
cursor.execute('UPDATE pipeline_runs SET inputs = "{}" WHERE inputs IS NULL')
cursor.execute('UPDATE pipeline_runs SET outputs = "{}" WHERE outputs IS NULL')
conn.commit()

print("Fixed NULLs in pipeline_runs")

# 2. Check failed node_runs
cursor.execute("SELECT id, node_id, status, logs FROM node_runs WHERE status = 'failed' ORDER BY id DESC LIMIT 5")
rows = cursor.fetchall()

if rows:
    for r in rows:
        print(f"--- Failed NodeRun {r[0]} (node: {r[1]}) ---")
        print(r[3])
else:
    print("No failed node_runs found.")

conn.close()
