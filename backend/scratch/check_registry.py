import sys
import os
# Add project root to path
# __file__ is backend/scratch/check_registry.py
# parent is backend/scratch
# parent's parent is backend
# parent's parent's parent is root
root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, root_dir)
# Also add backend to path for libs etc.
sys.path.insert(0, os.path.join(root_dir, "backend"))

try:
    from libs.job.registry import task_registry, load_all_tasks
    print("Loading all tasks...")
    load_all_tasks()
    print("Registered tasks:")
    for name, cls in task_registry.all().items():
        print(f" - {name}: {cls.label} (Category: {cls.category})")
except Exception as e:
    import traceback
    print("Error loading tasks:")
    traceback.print_exc()
