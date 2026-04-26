from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..db import get_db
from ..models.dataset import DatasetVersion
from ..models.model import ModelVersion
from ..models.pipeline import Pipeline, Task

router = APIRouter()

class TaskBase(BaseModel):
    task_type: str
    config: dict = {}
    previous_task_id: Optional[int] = None

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    task_type: Optional[str] = None
    config: Optional[dict] = None
    previous_task_id: Optional[int] = None
    status: Optional[str] = None
    input_data: Optional[dict] = None
    output_data: Optional[dict] = None

class TaskResponse(TaskBase):
    id: int
    pipeline_id: int
    status: str
    input_data: dict
    output_data: dict
    log: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

class PipelineCreate(BaseModel):
    name: Optional[str] = None
    type: str # training, testing
    base_model: Optional[str] = None
    dataset_version_id: Optional[int] = None
    model_version_id: Optional[int] = None
    config: dict = {}
    infra: dict = {}

class PipelineUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    dataset_version_id: Optional[int] = None
    model_version_id: Optional[int] = None
    config: Optional[dict] = None
    infra: Optional[dict] = None

class PipelineResponse(BaseModel):
    id: int
    name: Optional[str] = None
    type: str
    status: str
    base_model: Optional[str] = None
    dataset_version_id: Optional[int] = None
    repo_link: Optional[str] = None
    config: dict
    metrics: dict
    created_at: datetime
    updated_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    log: Optional[str] = None
    tasks: List[TaskResponse] = []
    
    model_config = ConfigDict(from_attributes=True)

@router.post("/", response_model=PipelineResponse)
def create_pipeline(pipeline: PipelineCreate, db: Session = Depends(get_db)):
    pipeline_name = pipeline.name or f"pipeline_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    
    # Initialize config with defaults if it's a training pipeline
    initial_config = dict(pipeline.config or {})
    
    if pipeline.type == "training":
        defaults = {
            "base_model": pipeline.base_model or "YOLO11",
            "steps": ["choose dataset", "training data"]
        }
        for k, v in defaults.items():
            if k not in initial_config:
                initial_config[k] = v
    else:
        if "steps" not in initial_config:
            initial_config["steps"] = ["testing data"]
            
    # Consistently include model_version_id in config if provided
    if pipeline.model_version_id is not None:
        initial_config["model_version_id"] = pipeline.model_version_id

    db_pipeline = Pipeline(
        name=pipeline_name,
        type=pipeline.type,
        base_model=pipeline.base_model,
        dataset_version_id=pipeline.dataset_version_id,
        config=initial_config,
        infra=pipeline.infra,
        status="pending"
    )
    db.add(db_pipeline)
    db.commit()
    db.refresh(db_pipeline)
    
    # Create initial tasks based on steps
    # Each task gets only the config relevant to its type — not the full pipeline config
    TRAINING_KEYS = {
        "epochs", "imgsz", "batch",
        "optimizer", "lr0", "lrf", "momentum", "weight_decay", "warmup_epochs",
        "mosaic", "mixup", "copy_paste", "flipud", "fliplr", "degrees", "translate", "scale",
        "base_model", "base_model_architecture", "base_model_version", "model_version_id",
    }
    DATASET_KEYS  = {"dataset_version_id"}

    steps = initial_config.get("steps", [])
    prev_task = None
    for step_name in steps:
        step_lower = step_name.lower()

        if "training" in step_lower:
            task_config = {k: v for k, v in initial_config.items() if k in TRAINING_KEYS}
        elif "dataset" in step_lower:
            task_config = {k: v for k, v in initial_config.items() if k in DATASET_KEYS}
        else:
            task_config = {}

        db_task = Task(
            pipeline_id=db_pipeline.id,
            task_type=step_name,
            config=task_config,
            previous_task=prev_task,
            status="pending"
        )
        db.add(db_task)
        db.commit()
        db.refresh(db_task)
        prev_task = db_task

    return db_pipeline

@router.get("/", response_model=List[PipelineResponse])
def get_pipelines(type: Optional[str] = None, db: Session = Depends(get_db)):
    try:
        query = db.query(Pipeline)
        if type:
            query = query.filter(Pipeline.type == type)
        return query.order_by(Pipeline.created_at.desc()).all()
    except Exception as e:
        # If column 'name' is missing, it means the DB schema is old.
        # For this PoC, we'll try to add it dynamically if it's a sqlite database.
        if "no such column: pipelines.name" in str(e):
            try:
                db.execute(text("ALTER TABLE pipelines ADD COLUMN name VARCHAR"))
                db.commit()
                # Retry the query
                query = db.query(Pipeline)
                if type:
                    query = query.filter(Pipeline.type == type)
                return query.order_by(Pipeline.created_at.desc()).all()
            except Exception as inner_e:
                print(f"Failed to auto-migrate: {inner_e}")
        raise e

@router.get("/{pipeline_id}", response_model=PipelineResponse)
def get_pipeline(pipeline_id: int, db: Session = Depends(get_db)):
    db_pipeline = db.query(Pipeline).filter(Pipeline.id == pipeline_id).first()
    if not db_pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return db_pipeline

@router.put("/{pipeline_id}", response_model=PipelineResponse)
def update_pipeline(pipeline_id: int, pipeline: PipelineUpdate, db: Session = Depends(get_db)):
    db_pipeline = db.query(Pipeline).filter(Pipeline.id == pipeline_id).first()
    if not db_pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    old_type = db_pipeline.type

    if pipeline.name is not None:
        db_pipeline.name = pipeline.name
    if pipeline.type is not None:
        db_pipeline.type = pipeline.type
    if pipeline.dataset_version_id is not None:
        db_pipeline.dataset_version_id = pipeline.dataset_version_id
    if pipeline.infra is not None:
        db_pipeline.infra = pipeline.infra

    # Handle config merging
    new_config = dict(db_pipeline.config or {})
    
    if pipeline.config is not None:
        new_config.update(pipeline.config)

    if pipeline.type is not None and pipeline.type != old_type:
        has_steps_override = isinstance(pipeline.config, dict) and "steps" in pipeline.config
        if not has_steps_override:
            new_config["steps"] = ["choose dataset", "training data"] if pipeline.type == "training" else ["testing data"]

    if pipeline.model_version_id is not None:
        new_config["model_version_id"] = pipeline.model_version_id

    db_pipeline.config = new_config

    db.add(db_pipeline)
    db.commit()
    db.refresh(db_pipeline)

    # Sync Task records with the updated steps list.
    # Create Task records for any new steps that don't have one yet.
    if "steps" in new_config:
        existing_tasks = db.query(Task).filter(Task.pipeline_id == pipeline_id).all()
        existing_types = {t.task_type.lower() for t in existing_tasks}

        # Find the last task to chain new ones after it
        last_task = None
        for t in existing_tasks:
            if t.previous_task_id is None:
                last_task = t
        # Walk the chain to find the actual last task
        if last_task:
            visited = set()
            while True:
                next_t = next((t for t in existing_tasks if t.previous_task_id == last_task.id), None)
                if next_t is None or next_t.id in visited:
                    break
                visited.add(next_t.id)
                last_task = next_t

        for step_name in new_config["steps"]:
            if step_name.lower() not in existing_types:
                db_task = Task(
                    pipeline_id=pipeline_id,
                    task_type=step_name,
                    config={},
                    previous_task=last_task,
                    status="pending",
                    input_data={},
                    output_data={},
                )
                db.add(db_task)
                db.commit()
                db.refresh(db_task)
                last_task = db_task
                existing_types.add(step_name.lower())

    db.refresh(db_pipeline)
    return db_pipeline

@router.post("/{pipeline_id}/run", response_model=PipelineResponse)
def run_pipeline(pipeline_id: int, db: Session = Depends(get_db), task_id: Optional[int] = None):
    db_pipeline = db.query(Pipeline).filter(Pipeline.id == pipeline_id).first()
    if not db_pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    if db_pipeline.status == "running":
        raise HTTPException(status_code=400, detail="Pipeline is already running")

    # Find the target task
    if task_id:
        db_task = db.query(Task).filter(Task.id == task_id, Task.pipeline_id == pipeline_id).first()
    elif db_pipeline.type == "training":
        # Prefer the explicit training task
        db_task = db.query(Task).filter(
            Task.pipeline_id == pipeline_id,
            Task.task_type.ilike("%training%")
        ).first() or db.query(Task).filter(
            Task.pipeline_id == pipeline_id,
            Task.previous_task_id == None
        ).first()
    else:
        db_task = db.query(Task).filter(
            Task.pipeline_id == pipeline_id,
            Task.previous_task_id == None
        ).first()

    if not db_task:
        raise HTTPException(status_code=400, detail="No suitable task found to run")

    # Mark task as pending — the worker process will pick it up
    db_task.status = "pending"
    db_task.started_at = None
    db_pipeline.status = "pending"
    db_pipeline.started_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(db_pipeline)
    return db_pipeline

@router.post("/{pipeline_id}/cancel", response_model=PipelineResponse)
def cancel_pipeline(pipeline_id: int, db: Session = Depends(get_db)):
    """Cancel a running or pending pipeline and all its active tasks."""
    db_pipeline = db.query(Pipeline).filter(Pipeline.id == pipeline_id).first()
    if not db_pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    if db_pipeline.status not in ("running", "pending"):
        raise HTTPException(status_code=400, detail=f"Pipeline is not running (status={db_pipeline.status})")

    db_pipeline.status = "cancelled"
    db_pipeline.completed_at = datetime.now(timezone.utc)

    # Cancel all pending/running tasks of this pipeline
    db.query(Task).filter(
        Task.pipeline_id == pipeline_id,
        Task.status.in_(["pending", "running"])
    ).update(
        {"status": "cancelled", "completed_at": datetime.now(timezone.utc)},
        synchronize_session=False,
    )

    db.commit()
    db.refresh(db_pipeline)
    return db_pipeline


@router.post("/{pipeline_id}/tasks/{task_id}/cancel", response_model=TaskResponse)
def cancel_task(pipeline_id: int, task_id: int, db: Session = Depends(get_db)):
    """Cancel a specific running or pending task."""
    db_task = db.query(Task).filter(Task.id == task_id, Task.pipeline_id == pipeline_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")

    if db_task.status not in ("running", "pending"):
        raise HTTPException(status_code=400, detail=f"Task is not running (status={db_task.status})")

    db_task.status = "cancelled"
    db_task.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(db_task)
    return db_task


@router.delete("/{pipeline_id}")
def delete_pipeline(pipeline_id: int, db: Session = Depends(get_db)):
    db_pipeline = db.query(Pipeline).filter(Pipeline.id == pipeline_id).first()
    if not db_pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    db.delete(db_pipeline)
    db.commit()
    return {"status": "success"}

# --- Task Operations ---

@router.post("/{pipeline_id}/tasks", response_model=TaskResponse)
def create_task(pipeline_id: int, task: TaskCreate, db: Session = Depends(get_db)):
    db_pipeline = db.query(Pipeline).filter(Pipeline.id == pipeline_id).first()
    if not db_pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    db_task = Task(
        pipeline_id=pipeline_id,
        task_type=task.task_type,
        config=task.config,
        previous_task_id=task.previous_task_id,
        status="pending",
        input_data={},
        output_data={}
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@router.get("/{pipeline_id}/tasks", response_model=List[TaskResponse])
def get_tasks(pipeline_id: int, db: Session = Depends(get_db)):
    return db.query(Task).filter(Task.pipeline_id == pipeline_id).all()

@router.put("/{pipeline_id}/tasks/{task_id}", response_model=TaskResponse)
def update_task(pipeline_id: int, task_id: int, task_update: TaskUpdate, db: Session = Depends(get_db)):
    db_task = db.query(Task).filter(Task.id == task_id, Task.pipeline_id == pipeline_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    for key, value in task_update.model_dump(exclude_unset=True).items():
        setattr(db_task, key, value)
    
    db.commit()
    db.refresh(db_task)
    return db_task

@router.post("/{pipeline_id}/tasks/{task_id}/run", response_model=TaskResponse)
def run_task(pipeline_id: int, task_id: int, db: Session = Depends(get_db)):
    db_task = db.query(Task).filter(Task.id == task_id, Task.pipeline_id == pipeline_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")

    if db_task.status == "running":
        raise HTTPException(status_code=400, detail="Task is already running")

    # Mark as pending — the worker process will pick it up
    db_task.status = "pending"
    db_task.started_at = None
    db.commit()
    db.refresh(db_task)
    return db_task
