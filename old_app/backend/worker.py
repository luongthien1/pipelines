"""
Background Worker — chạy độc lập với FastAPI server.

Liên tục quét bảng `tasks` tìm các task có status='pending' và chạy chúng.
Cũng kiểm tra task đang 'running' có bị cancel không.

Khởi động:
    venv\\Scripts\\python.exe -m backend.worker

Hoặc dùng script:
    venv\\Scripts\\python.exe backend/worker.py
"""

import os
import sys
import time
import logging
import signal
import threading
from datetime import datetime, timezone

# Ensure project root is in path when run directly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from backend.db import SessionLocal
from backend.models.pipeline import Task, Pipeline

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("worker")

# ── Config ────────────────────────────────────────────────────────────────────
POLL_INTERVAL   = int(os.getenv("WORKER_POLL_INTERVAL",   "30"))  # seconds between scans
MAX_CONCURRENT  = int(os.getenv("WORKER_MAX_CONCURRENT",  "1"))   # max parallel tasks
# Task timeout: cancel tasks that have been running longer than this (seconds).
# Set to 0 to disable timeout.
TASK_TIMEOUT    = int(os.getenv("WORKER_TASK_TIMEOUT",    "7200")) # 2 hours default

# ── Cancel signal registry ────────────────────────────────────────────────────
# Maps task_id → threading.Event. Training callbacks check this to stop early.
_cancel_events: dict[int, threading.Event] = {}
_cancel_lock = threading.Lock()

def register_cancel_event(task_id: int) -> threading.Event:
    ev = threading.Event()
    with _cancel_lock:
        _cancel_events[task_id] = ev
    return ev

def signal_cancel(task_id: int):
    with _cancel_lock:
        ev = _cancel_events.get(task_id)
    if ev:
        ev.set()
        logger.info(f"Cancel signal sent to task {task_id}")

def unregister_cancel_event(task_id: int):
    with _cancel_lock:
        _cancel_events.pop(task_id, None)

def is_cancelled(task_id: int) -> bool:
    with _cancel_lock:
        ev = _cancel_events.get(task_id)
    return ev is not None and ev.is_set()

# ── Graceful shutdown ─────────────────────────────────────────────────────────
_running = True

def _handle_signal(sig, frame):
    global _running
    logger.info(f"Received signal {sig}, shutting down worker...")
    _running = False

signal.signal(signal.SIGINT, _handle_signal)
signal.signal(signal.SIGTERM, _handle_signal)

# ── Task dispatch ─────────────────────────────────────────────────────────────

def _dispatch(task: Task, pipeline: Pipeline):
    """Route task to the correct service based on task_type and pipeline type."""
    cancel_event = register_cancel_event(task.id)
    try:
        task_lower = task.task_type.lower()

        if "training" in task_lower or pipeline.type == "training":
            from backend.services.training_service import run_training
            logger.info(f"Dispatching training task {task.id} (pipeline {pipeline.id})")
            run_training(pipeline.id, task.id, cancel_event=cancel_event)

        elif "test" in task_lower or pipeline.type == "testing":
            from backend.services.training_service import run_testing
            logger.info(f"Dispatching testing task {task.id} (pipeline {pipeline.id})")
            run_testing(pipeline.id, task.id, cancel_event=cancel_event)

        else:
            from backend.services.task_service import execute_task
            logger.info(f"Dispatching generic task {task.id} (type={task.task_type})")
            execute_task(task.id)
    finally:
        unregister_cancel_event(task.id)


def _claim_task(db, task: Task) -> bool:
    """
    Atomically claim a task by setting status='running'.
    Returns True if successfully claimed (another worker didn't grab it first).
    """
    updated = (
        db.query(Task)
        .filter(Task.id == task.id, Task.status == "pending")
        .update(
            {"status": "running", "started_at": datetime.now(timezone.utc)},
            synchronize_session=False,
        )
    )
    db.commit()
    return updated > 0


def _check_cancelled_and_timed_out():
    """
    Check running tasks:
    1. If status was set to 'cancelled' externally → send cancel signal
    2. If running longer than TASK_TIMEOUT → auto-cancel
    """
    db = SessionLocal()
    try:
        running_tasks = db.query(Task).filter(Task.status.in_(["running", "cancelled"])).all()
        now = datetime.now(timezone.utc)

        for task in running_tasks:
            # Case 1: externally cancelled via API
            if task.status == "cancelled":
                signal_cancel(task.id)
                continue

            # Case 2: timeout
            if TASK_TIMEOUT > 0 and task.started_at:
                started = task.started_at
                if started.tzinfo is None:
                    from datetime import timezone as tz
                    started = started.replace(tzinfo=tz.utc)
                elapsed = (now - started).total_seconds()
                if elapsed > TASK_TIMEOUT:
                    logger.warning(f"Task {task.id} timed out after {elapsed:.0f}s — cancelling")
                    task.status = "cancelled"
                    task.completed_at = now
                    task.log = (task.log or "") + f"\n[{now}] TIMEOUT: Task cancelled after {elapsed:.0f}s\n"
                    # Also cancel the pipeline
                    pipeline = db.query(Pipeline).filter(Pipeline.id == task.pipeline_id).first()
                    if pipeline and pipeline.status == "running":
                        pipeline.status = "cancelled"
                        pipeline.completed_at = now
                    db.commit()
                    signal_cancel(task.id)
    except Exception as e:
        logger.error(f"Cancel/timeout check error: {e}", exc_info=True)
    finally:
        db.close()


def _scan_and_run():
    """One scan cycle: check cancellations, then find pending tasks and dispatch."""
    _check_cancelled_and_timed_out()

    db = SessionLocal()
    try:
        pending_tasks = (
            db.query(Task)
            .filter(Task.status == "pending")
            .order_by(Task.created_at.asc())
            .limit(MAX_CONCURRENT)
            .all()
        )

        for task in pending_tasks:
            pipeline = db.query(Pipeline).filter(Pipeline.id == task.pipeline_id).first()
            if not pipeline:
                logger.warning(f"Task {task.id}: pipeline {task.pipeline_id} not found, skipping.")
                continue

            # Claim the task (prevents double-execution if multiple workers run)
            if not _claim_task(db, task):
                logger.debug(f"Task {task.id} already claimed by another worker.")
                continue

            # Refresh task after claim
            db.refresh(task)

            try:
                _dispatch(task, pipeline)
            except Exception as e:
                logger.error(f"Task {task.id} dispatch error: {e}", exc_info=True)

    except Exception as e:
        logger.error(f"Scan error: {e}", exc_info=True)
    finally:
        db.close()


# ── Main loop ─────────────────────────────────────────────────────────────────

def main():
    logger.info(f"Worker started. Poll interval={POLL_INTERVAL}s, max_concurrent={MAX_CONCURRENT}, timeout={TASK_TIMEOUT}s")
    logger.info("Press Ctrl+C to stop.")

    while _running:
        _scan_and_run()
        # Sleep in small increments so SIGINT is handled quickly
        for _ in range(POLL_INTERVAL * 10):
            if not _running:
                break
            time.sleep(0.1)

    logger.info("Worker stopped.")


if __name__ == "__main__":
    main()
