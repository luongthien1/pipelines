import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from ..db import SessionLocal
from ..models.pipeline import Task, Pipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def execute_task(task_id: int):
    db = SessionLocal()
    try:
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            logger.error(f"Task {task_id} not found.")
            return

        task.status = "running"
        task.started_at = datetime.now(timezone.utc)
        task.log = f"[{datetime.now(timezone.utc)}] Starting task {task.task_type}...\n"
        db.commit()

        # Input Chaining Logic
        if task.previous_task_id:
            prev_task = db.query(Task).filter(Task.id == task.previous_task_id).first()
            if prev_task:
                # Combine previous output with current config
                task.input_data = {**(prev_task.output_data or {}), **(task.config or {})}
                task.log += f"[{datetime.now(timezone.utc)}] Input combined from previous task {prev_task.id}.\n"
            else:
                task.input_data = task.config or {}
                task.log += f"[{datetime.now(timezone.utc)}] Previous task not found. Using config as input.\n"
        else:
            task.input_data = task.config or {}
            task.log += f"[{datetime.now(timezone.utc)}] No previous task. Using config as input.\n"

        db.commit()

        # Task-specific Execution
        try:
            result = perform_task_logic(db, task)
            task.output_data = result
            task.status = "completed"
            task.completed_at = datetime.now(timezone.utc)
            task.log += f"[{datetime.now(timezone.utc)}] Task completed successfully.\n"
        except Exception as e:
            task.status = "failed"
            task.completed_at = datetime.now(timezone.utc)
            task.log += f"[{datetime.now(timezone.utc)}] Error during execution: {str(e)}\n"
            logger.error(f"Task {task_id} failed: {e}")

        db.commit()
    except Exception as e:
        # Catch unexpected errors outside the inner try block (e.g. DB errors during setup)
        logger.error(f"Unexpected error in execute_task({task_id}): {e}")
        try:
            # Attempt to mark task as failed if we can still reach it
            task = db.query(Task).filter(Task.id == task_id).first()
            if task and task.status == "running":
                task.status = "failed"
                task.completed_at = datetime.now(timezone.utc)
                task.log = (task.log or "") + f"[{datetime.now(timezone.utc)}] Fatal error: {str(e)}\n"
                db.commit()
        except Exception:
            pass
    finally:
        # Always close the session, regardless of what happened above
        db.close()

def perform_task_logic(db: Session, task: Task) -> dict:
    """
    Placeholder for actual task logic. 
    In a real system, this would call specialized services based on task_type.
    """
    task_type = task.task_type
    input_data = task.input_data or {}
    
    if task_type == "training":
        # Simulate training logic
        return {"model_id": input_data.get("model_id"), "accuracy": 0.9, "status": "trained"}
    elif task_type == "preprocessing":
        # Simulate preprocessing
        return {"processed_dataset_id": input_data.get("dataset_id"), "status": "processed"}
    else:
        # Default mock output
        return {"message": f"Executed {task_type}", "input_received": input_data}
