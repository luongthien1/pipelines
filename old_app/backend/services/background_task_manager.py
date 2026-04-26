import threading
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Callable
import logging

logger = logging.getLogger(__name__)

class BackgroundTaskManager:
    """
    Manages in-memory state of background tasks.
    In a production environment, this should use Redis or a database.
    """
    def __init__(self):
        self.tasks: Dict[str, Dict[str, Any]] = {}

    def register_task(self, name: str, task_type: str) -> str:
        task_id = str(uuid.uuid4())
        self.tasks[task_id] = {
            "id": task_id,
            "name": name,
            "type": task_type,
            "status": "pending",
            "progress": 0,
            "result": None,
            "error": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "started_at": None,
            "completed_at": None,
            "logs": []
        }
        return task_id

    def start_task(self, task_id: str):
        if task_id in self.tasks:
            self.tasks[task_id]["status"] = "running"
            self.tasks[task_id]["started_at"] = datetime.now(timezone.utc).isoformat()
            self.add_log(task_id, f"Task {task_id} started.")

    def complete_task(self, task_id: str, result: Any = None):
        if task_id in self.tasks:
            self.tasks[task_id]["status"] = "completed"
            self.tasks[task_id]["progress"] = 100
            self.tasks[task_id]["result"] = result
            self.tasks[task_id]["completed_at"] = datetime.now(timezone.utc).isoformat()
            self.add_log(task_id, "Task completed successfully.")

    def fail_task(self, task_id: str, error: str):
        if task_id in self.tasks:
            self.tasks[task_id]["status"] = "failed"
            self.tasks[task_id]["error"] = error
            self.tasks[task_id]["completed_at"] = datetime.now(timezone.utc).isoformat()
            self.add_log(task_id, f"Task failed: {error}")

    def update_progress(self, task_id: str, progress: int):
        if task_id in self.tasks:
            self.tasks[task_id]["progress"] = progress

    def add_log(self, task_id: str, message: str):
        if task_id in self.tasks:
            timestamp = datetime.now(timezone.utc).isoformat()
            self.tasks[task_id]["logs"].append(f"[{timestamp}] {message}")
            logger.info(f"Task {task_id}: {message}")

    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        return self.tasks.get(task_id)

    def list_tasks(self) -> Dict[str, Dict[str, Any]]:
        return self.tasks

# Singleton instance
task_manager = BackgroundTaskManager()
