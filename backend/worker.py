"""
Background Worker — Chạy song song, quản lý tài nguyên và độ ưu tiên.
"""

import os
import sys
import time
import datetime
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List, Set

# Ensure project root is in path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from libs.logger import logger
from core.config import settings
from libs.database.connect import SessionMaker
from db.model.pipeline import Edge, Node
from db.model.run import NodeRun, PipelineRun
from libs.job.registry import task_registry, load_all_tasks

# --- Configuration ---
POLL_INTERVAL = settings.POLL_INTERVAL
MAX_CONCURRENT_PIPELINES = settings.MAX_CONCURRENT
MAX_MEMORY_MB = settings.MAX_MEMORY_MB
TASK_TIMEOUT = settings.TASK_TIMEOUT

# --- Global State for Resource Tracking ---
_running = True
# Track which pipeline runs are currently active (running at least one node)
_active_pipeline_runs: Set[int] = set()
_current_memory_usage: int = 0
_resource_lock = threading.Lock()

def _handle_signal(sig, frame):
    global _running
    logger.info(f"Received signal {sig}, shutting down worker...")
    _running = False

# --- Helper Functions ---

def _resolve_inputs(db, node_run: NodeRun) -> dict:
    pipeline_id = node_run.pipeline_run.pipeline_id
    inbound_edges = db.query(Edge).filter(
        Edge.pipeline_id == pipeline_id, Edge.target_node_id == node_run.node_id
    ).all()
    
    inputs = {}
    for edge in inbound_edges:
        source_run = db.query(NodeRun).filter(
            NodeRun.pipeline_run_id == node_run.pipeline_run_id,
            NodeRun.node_id == edge.source_node_id
        ).first()
        
        if source_run and source_run.outputs:
            source_port = edge.source_port or "default"
            target_port = edge.target_port or "default"
            value = source_run.outputs.get(source_port)
            if value is None and len(source_run.outputs) == 1:
                value = list(source_run.outputs.values())[0]
            inputs[target_port] = value
    return inputs

def _unlock_downstream_nodes(db, node_run: NodeRun):
    pipeline_id = node_run.pipeline_run.pipeline_id
    outbound_edges = db.query(Edge).filter(
        Edge.pipeline_id == pipeline_id, Edge.source_node_id == node_run.node_id
    ).all()

    for edge in outbound_edges:
        target_run = db.query(NodeRun).filter(
            NodeRun.pipeline_run_id == node_run.pipeline_run_id,
            NodeRun.node_id == edge.target_node_id
        ).first()
        
        if target_run and target_run.status == "waiting":
            inbound_for_target = db.query(Edge).filter(
                Edge.pipeline_id == pipeline_id, Edge.target_node_id == target_run.node_id
            ).all()

            all_success = True
            for in_e in inbound_for_target:
                src_run = db.query(NodeRun).filter(
                    NodeRun.pipeline_run_id == node_run.pipeline_run_id,
                    NodeRun.node_id == in_e.source_node_id
                ).first()
                if not src_run or src_run.status != "success":
                    all_success = False
                    break
            
            if all_success:
                target_run.status = "pending"
    db.commit()

def _check_pipeline_completion(db, pipeline_run_id: int):
    run = db.get(PipelineRun, pipeline_run_id)
    if not run or run.status in ["success", "failed", "cancelled"]:
        return

    has_active = False
    any_failed = False
    for nr in run.node_runs:
        if nr.status in ["pending", "running"]:
            has_active = True
        if nr.status == "failed":
            any_failed = True

    # If nothing is actively running or pending to run, the pipeline has stopped making progress.
    # It either succeeded completely (no waiting nodes left, all success) or stalled due to failures.
    if not has_active:
        run.status = "failed" if any_failed else "success"
        run.end_time = datetime.datetime.utcnow()
        # Mark any remaining 'waiting' nodes as cancelled/failed
        for nr in run.node_runs:
            if nr.status == "waiting":
                nr.status = "cancelled"
        db.commit()
        logger.info(f"PipelineRun {pipeline_run_id} finished with status: {run.status}")

# --- Core Execution Logic ---

def _execute_task(node_run_id: int, mem_requirement: int):
    """Worker function to execute a single task in a thread."""
    global _current_memory_usage
    db = SessionMaker()
    try:
        node_run = db.get(NodeRun, node_run_id)
        if not node_run: return

        # Resolve inputs and run
        log_lines = []
        log_lines.append(f"[{datetime.datetime.utcnow().strftime('%H:%M:%S')}] Task Started")
        
        try:
            inputs = _resolve_inputs(db, node_run)
            node_run.inputs = inputs
            log_lines.append(f"Inputs resolved: {inputs}")
            log_lines.append(f"Config loaded: {node_run.node.config}")
            
            outputs = task_registry.execute(
                task_name=node_run.node.node_type,
                config=node_run.node.config or {},
                inputs=inputs,
                pipeline_run=node_run.pipeline_run,
                db=db,
                node_run_id=node_run.id
            )
            node_run.outputs = outputs
            node_run.status = "success"
            log_lines.append(f"Execution completed. Outputs: {outputs}")
            log_lines.append(f"[{datetime.datetime.utcnow().strftime('%H:%M:%S')}] Task finished successfully.")
            node_run.logs = "\\n".join(log_lines)
        except Exception as e:
            logger.error(f"NodeRun {node_run.id} failed: {e}")
            node_run.status = "failed"
            log_lines.append(f"[{datetime.datetime.utcnow().strftime('%H:%M:%S')}] Task failed with exception:")
            log_lines.append(str(e))
            node_run.logs = "\\n".join(log_lines)

        node_run.end_time = datetime.datetime.utcnow()
        pipeline_run_id = node_run.pipeline_run_id
        db.commit()

        # Unlock next nodes
        if node_run.status == "success":
            _unlock_downstream_nodes(db, node_run)

        # Check for pipeline completion
        _check_pipeline_completion(db, pipeline_run_id)

    finally:
        # Release resources
        with _resource_lock:
            _current_memory_usage -= mem_requirement
            # Check if this pipeline has any other nodes running
            db_rem = SessionMaker()
            running_count = db_rem.query(NodeRun).filter(
                NodeRun.pipeline_run_id == pipeline_run_id,
                NodeRun.status == "running"
            ).count()
            if running_count == 0:
                _active_pipeline_runs.discard(pipeline_run_id)
            db_rem.close()
        db.close()

def _scan_and_dispatch(executor: ThreadPoolExecutor):
    """Find eligible tasks according to priority and resources, then dispatch them."""
    global _current_memory_usage
    db = SessionMaker()
    try:
        # 1. Join NodeRun with PipelineRun to get priority
        # Filter for pending tasks and nodes whose pipeline run is not cancelled/finished
        pending_tasks = db.query(NodeRun).join(PipelineRun).filter(
            NodeRun.status == "pending",
            PipelineRun.status.in_(["pending", "running"])
        ).order_by(
            PipelineRun.priority.desc(),
            PipelineRun.start_time.asc(),
            NodeRun.id.asc()
        ).all()

        if not pending_tasks:
            return

        for task in pending_tasks:
            task_cls = task_registry.get(task.node.node_type)
            # Default to 100MB if not specified
            mem_req = getattr(task_cls, "memory_mb", 100) if task_cls else 100
            
            pipeline_id = task.pipeline_run_id

            with _resource_lock:
                # Check resource constraints
                can_run_pipeline = (
                    pipeline_id in _active_pipeline_runs or 
                    len(_active_pipeline_runs) < MAX_CONCURRENT_PIPELINES
                )
                can_run_memory = (_current_memory_usage + mem_req) <= MAX_MEMORY_MB

                if can_run_pipeline and can_run_memory:
                    # Dispatch
                    logger.info(f"Dispatching task {task.id} (Prio: {task.pipeline_run.priority}, Mem: {mem_req}MB)")
                    
                    # Update state
                    task.status = "running"
                    task.start_time = datetime.datetime.utcnow()
                    if task.pipeline_run.status == "pending":
                        task.pipeline_run.status = "running"
                    
                    _active_pipeline_runs.add(pipeline_id)
                    _current_memory_usage += mem_req
                    
                    db.commit()
                    executor.submit(_execute_task, task.id, mem_req)
                else:
                    reason = []
                    if not can_run_pipeline: reason.append("max concurrent pipelines")
                    if not can_run_memory: reason.append("max memory")
                    # logger.debug(f"Task {task.id} waiting for resources: {', '.join(reason)}")
    except Exception as e:
        logger.error(f"Error in scheduler: {e}")
    finally:
        db.close()

def main():
    load_all_tasks()
    logger.info(f"Worker Parallel started. Limits: {MAX_CONCURRENT_PIPELINES} pipelines, {MAX_MEMORY_MB}MB memory.")
    
    # We use a large thread pool because the scheduler handles concurrency limits manually
    # based on business logic (MAX_CONCURRENT_PIPELINES/MAX_MEMORY_MB).
    with ThreadPoolExecutor(max_workers=50) as executor:
        while _running:
            _scan_and_dispatch(executor)
            time.sleep(1) # Faster polling for parallel worker

    logger.info("Worker stopped.")

if __name__ == "__main__":
    main()
