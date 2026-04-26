import os
import shutil
import uuid
from datetime import datetime, timezone
from typing import List, Optional

import io
from PIL import Image
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from libs.database.connect import get_db
from db.model.dataset import Dataset, DatasetItem, DatasetTask, DatasetVersion
from db.model.model import Model, ModelVersion
from services.dataset_service import dataset_service

router = APIRouter()

# File/Data response schema for Data Explorer
class VersionDataResponse(BaseModel):
    id: int
    file_name: str
    file_type: str
    file_size: int
    url: str
    preview_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    annotations: Optional[List[dict]] = None
    is_empty: Optional[bool] = False

    model_config = ConfigDict(from_attributes=True)

# Pagination wrapper for Data Explorer
class PaginatedVersionDataResponse(BaseModel):
    items: List[VersionDataResponse]
    total: int
    page: int
    size: int
    pages: int

# Schema for a single version
class VersionBase(BaseModel):
    version_name: str
    data_info: Optional[str] = ""
    data_source: Optional[str] = None
    preprocessing_steps: Optional[str] = ""
    data_purpose: Optional[str] = ""
    train_val_test_size: Optional[str] = ""
    output_link: Optional[str] = None
    annotations: Optional[dict] = {}
    processing_config: Optional[dict] = {}

class VersionUpdate(BaseModel):
    version_name: Optional[str] = None
    data_info: Optional[str] = None
    preprocessing_steps: Optional[str] = None
    data_purpose: Optional[str] = None
    train_val_test_size: Optional[str] = None
    output_link: Optional[str] = None
    annotations: Optional[dict] = None
    processing_config: Optional[dict] = None

class VersionResponse(VersionBase):
    id: int
    dataset_id: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

# Task Schemas
class TaskBase(BaseModel):
    name: str
    task_type: str # upload, labeling, enrichment, training
    status: Optional[str] = "pending"
    config: Optional[dict] = {}
    order_idx: Optional[int] = 0

class TaskResponse(TaskBase):
    id: int
    version_id: int
    created_at: datetime
    updated_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)

# Schema for the dataset metadata
class DatasetBase(BaseModel):
    name: str
    description: Optional[str] = None
    task: Optional[str] = None

class DatasetResponse(DatasetBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]
    
    model_config = ConfigDict(from_attributes=True)

class ItemUpdate(BaseModel):
    annotations: Optional[List[dict]] = None
    is_empty: Optional[bool] = None

class ItemResponse(BaseModel):
    id: int
    version_id: int
    file_name: str
    file_type: str
    file_size: int
    url: str
    preview_url: Optional[str] = None
    annotations: Optional[List[dict]] = None
    is_empty: Optional[bool] = False

    model_config = ConfigDict(from_attributes=True)

class BatchDeleteRequest(BaseModel):
    item_ids: List[int]

# --- Dataset CRUD ---

@router.get("/", response_model=List[DatasetResponse])
def read_datasets(db: Session = Depends(get_db)):
    return db.query(Dataset).all()

@router.post("/", response_model=DatasetResponse)
def create_dataset(dataset: DatasetBase, db: Session = Depends(get_db)):
    return dataset_service.create_dataset(
        db, 
        name=dataset.name, 
        description=dataset.description, 
        task=dataset.task
    )

@router.get("/{dataset_id}", response_model=DatasetResponse)
def get_dataset(dataset_id: int, db: Session = Depends(get_db)):
    db_dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not db_dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return db_dataset

@router.put("/{dataset_id}", response_model=DatasetResponse)
def update_dataset(dataset_id: int, dataset: DatasetBase, db: Session = Depends(get_db)):
    db_dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not db_dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    db_dataset.name = dataset.name
    db_dataset.description = dataset.description
    db_dataset.task = dataset.task
    db_dataset.updated_at = datetime.now(timezone.utc)
    
    db.add(db_dataset)
    db.commit()
    db.refresh(db_dataset)
    return db_dataset

@router.delete("/{dataset_id}")
def delete_dataset(dataset_id: int, db: Session = Depends(get_db)):
    dataset_service.delete_dataset(db, dataset_id)
    return {"status": "success"}

# --- Versioning ---

@router.get("/{dataset_id}/versions", response_model=List[VersionResponse])
def get_versions(dataset_id: int, db: Session = Depends(get_db)):
    return db.query(DatasetVersion).filter(DatasetVersion.dataset_id == dataset_id).all()

@router.get("/versions/{version_id}/data", response_model=PaginatedVersionDataResponse)
def get_version_data(
    version_id: int,
    page: int = 1,
    size: int = 20,
    include_annotations: bool = False,
    db: Session = Depends(get_db),
):
    """
    Returns file/artifact list for a dataset version.
    Compatible with the frontend's Data Explorer.
    """
    from sqlalchemy.orm import load_only

    version = db.query(DatasetVersion).filter(DatasetVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    # Count without loading full rows
    total = db.query(DatasetItem).filter(DatasetItem.version_id == version_id).count()
    offset = (page - 1) * size

    # Only load the columns we actually need — avoids N+1 and unnecessary data transfer
    cols = [
        DatasetItem.id,
        DatasetItem.file_path,
        DatasetItem.original_filename,
        DatasetItem.is_empty,
    ]
    if include_annotations:
        cols.append(DatasetItem.annotations)

    items = (
        db.query(DatasetItem)
        .filter(DatasetItem.version_id == version_id)
        .options(load_only(*cols))
        .offset(offset)
        .limit(size)
        .all()
    )

    results: List[VersionDataResponse] = []
    for it in items:
        file_name = os.path.basename(it.file_path)
        ext = os.path.splitext(file_name)[1].lstrip(".").lower()
        try:
            file_size = os.path.getsize(it.file_path)
        except OSError:
            file_size = 0

        url = f"/api/datasets/items/{it.id}/file"
        thumbnail_url = f"/api/datasets/items/{it.id}/thumbnail"

        results.append(VersionDataResponse(
            id=it.id,
            file_name=it.original_filename or file_name,
            file_type=ext or "file",
            file_size=file_size,
            url=url,
            preview_url=url,
            thumbnail_url=thumbnail_url,
            annotations=it.annotations if include_annotations else None,
            is_empty=it.is_empty,
        ))

    pages = (total + size - 1) // size
    return PaginatedVersionDataResponse(
        items=results,
        total=total,
        page=page,
        size=size,
        pages=pages
    )

@router.get("/versions/{version_id}/unique-labels", response_model=List[str])
def get_version_unique_labels(version_id: int, db: Session = Depends(get_db)):
    """
    Returns the cached unique labels for a dataset version.
    The cache is maintained incrementally in DatasetVersion.unique_labels
    and updated whenever an item's annotations are saved.
    Falls back to a full scan only if the cache is empty/null.
    """
    version = db.query(DatasetVersion).filter(DatasetVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    # Fast path: return cached labels (O(1))
    if version.unique_labels:
        return sorted(version.unique_labels)

    # Slow path: full scan — only runs once per version (first request after migration)
    from sqlalchemy.orm import load_only
    rows = (
        db.query(DatasetItem)
        .filter(DatasetItem.version_id == version_id)
        .options(load_only(DatasetItem.annotations))
        .all()
    )
    unique_labels: set = set()
    for item in rows:
        if item.annotations:
            for ann in item.annotations:
                label = ann.get('label')
                if label:
                    unique_labels.add(label)

    # Persist the result so next request is fast
    version.unique_labels = sorted(unique_labels)
    db.commit()

    return version.unique_labels

@router.get("/items/{item_id}/file")
def get_data_item_file(item_id: int, db: Session = Depends(get_db)):
    """
    Serves the actual file for a dataset item.
    """
    item = db.query(DatasetItem).filter(DatasetItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Data item not found")
    
    if not os.path.exists(item.file_path):
        # Log error or handle missing file
        raise HTTPException(status_code=404, detail=f"File not found on disk: {item.file_path}")
        
    return FileResponse(item.file_path)

@router.put("/items/{item_id}", response_model=ItemResponse)
def update_dataset_item(item_id: int, item_update: ItemUpdate, db: Session = Depends(get_db)):
    """
    Updates annotations or is_empty flag for a dataset item.
    Also incrementally updates the version's unique_labels cache.
    """
    db_item = db.query(DatasetItem).filter(DatasetItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")

    if item_update.annotations is not None:
        db_item.annotations = item_update.annotations

        # Incrementally update the version's unique_labels cache
        new_labels = {
            ann.get('label')
            for ann in item_update.annotations
            if isinstance(ann, dict) and ann.get('label')
        }
        if new_labels:
            version = db.query(DatasetVersion).filter(DatasetVersion.id == db_item.version_id).first()
            if version:
                existing = set(version.unique_labels or [])
                merged = sorted(existing | new_labels)
                if merged != sorted(existing):
                    version.unique_labels = merged

    if item_update.is_empty is not None:
        db_item.is_empty = item_update.is_empty

    db.commit()
    db.refresh(db_item)

    file_name = os.path.basename(db_item.file_path)
    ext = os.path.splitext(file_name)[1].lstrip(".").lower()
    url = f"/api/datasets/items/{db_item.id}/file"

    return ItemResponse(
        id=db_item.id,
        version_id=db_item.version_id,
        file_name=db_item.original_filename or file_name,
        file_type=ext or "file",
        file_size=0,
        url=url,
        preview_url=url,
        annotations=db_item.annotations,
        is_empty=db_item.is_empty
    )

@router.get("/items/{item_id}/thumbnail")
def get_data_item_thumbnail(item_id: int, db: Session = Depends(get_db)):
    """
    Serves a low-resolution thumbnail for a dataset item.
    """
    item = db.query(DatasetItem).filter(DatasetItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Data item not found")
    
    if not os.path.exists(item.file_path):
        raise HTTPException(status_code=404, detail=f"File not found on disk: {item.file_path}")
        
    try:
        img = Image.open(item.file_path)
        # Convert to RGB if necessary
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        
        # Resize maintaining aspect ratio
        img.thumbnail((320, 320))
        
        # Save to buffer
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        buf.seek(0)
        
        return StreamingResponse(buf, media_type="image/jpeg")
    except Exception as e:
        # If it's not an image or other error, fall back to small FileResponse if it's small or just error
        raise HTTPException(status_code=500, detail=f"Error generating thumbnail: {str(e)}")

@router.get("/items/{item_id}", response_model=ItemResponse)
def get_data_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(DatasetItem).filter(DatasetItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Data item not found")

    file_name = os.path.basename(item.file_path)
    ext = os.path.splitext(file_name)[1].lstrip(".").lower()
    try:
        file_size = os.path.getsize(item.file_path)
    except OSError:
        file_size = 0

    url = f"/api/datasets/items/{item.id}/file"

    return ItemResponse(
        id=item.id,
        version_id=item.version_id,
        file_name=item.original_filename or file_name,
        file_type=ext or "file",
        file_size=file_size,
        url=url,
        preview_url=url,
        annotations=item.annotations,
    )

@router.get("/versions/{version_id}/tasks", response_model=List[TaskResponse])
def get_version_tasks(version_id: int, db: Session = Depends(get_db)):
    tasks = db.query(DatasetTask).filter(DatasetTask.version_id == version_id).order_by(DatasetTask.order_idx, DatasetTask.id).all()
    
    # Safety Check: If no tasks, auto-inject initial upload task (for backward compatibility)
    if not tasks:
        db_version = db.query(DatasetVersion).filter(DatasetVersion.id == version_id).first()
        if db_version:
            upload_task = DatasetTask(
                version_id=version_id,
                name="Data Ingestion",
                task_type="upload",
                status="completed" if db_version.data_source else "pending",
                order_idx=0
            )
            db.add(upload_task)
            db.commit()
            db.refresh(upload_task)
            return [upload_task]
            
    return tasks

# Cross-link: Get all pipelines that used this dataset version
@router.get("/versions/{version_id}/pipelines")
def get_version_pipelines(version_id: int, db: Session = Depends(get_db)):
    from db.model.pipeline import Pipeline
    pipelines = db.query(Pipeline).filter(Pipeline.dataset_version_id == version_id).order_by(Pipeline.created_at.desc()).all()
    return [
        {
            "id": p.id,
            "type": p.type,
            "status": p.status,
            "config": p.config,
            "created_at": p.created_at.isoformat() if p.created_at else None
        }
        for p in pipelines
    ]

# Cross-link: Get all ModelVersions that trained on this dataset version
@router.get("/versions/{version_id}/model-versions")
def get_model_versions_for_dataset_version(version_id: int, db: Session = Depends(get_db)):
    mv_list = db.query(ModelVersion).filter(ModelVersion.trained_dataset_id == version_id).all()
    result = []
    for mv in mv_list:
        model = db.query(Model).filter(Model.id == mv.model_id).first()
        result.append({
            "id": mv.id,
            "model_id": mv.model_id,
            "model_name": model.name if model else f"Model {mv.model_id}",
            "version_name": mv.version_name,
            "stage": mv.stage,
            "created_at": mv.created_at.isoformat() if mv.created_at else None
        })
    return result

@router.post("/{dataset_id}/versions", response_model=VersionResponse)
def create_version(dataset_id: int, version: VersionBase, db: Session = Depends(get_db)):
    return dataset_service.create_version(
        db,
        dataset_id=dataset_id,
        version_name=version.version_name,
        data_source=version.data_source,
        data_info=version.data_info,
        preprocessing_steps=version.preprocessing_steps,
        data_purpose=version.data_purpose,
        train_val_test_size=version.train_val_test_size,
        output_link=version.output_link,
        annotations=version.annotations,
        processing_config=version.processing_config
    )

@router.get("/versions/{version_id}", response_model=VersionResponse)
def get_version(version_id: int, db: Session = Depends(get_db)):
    db_version = db.query(DatasetVersion).filter(DatasetVersion.id == version_id).first()
    if not db_version:
        raise HTTPException(status_code=404, detail="Version not found")
    return db_version

@router.delete("/versions/{version_id}")
def delete_version(version_id: int, db: Session = Depends(get_db)):
    db_version = db.query(DatasetVersion).filter(DatasetVersion.id == version_id).first()
    if not db_version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    # Delete version folder if exists
    if db_version.data_source and os.path.exists(db_version.data_source):
        shutil.rmtree(db_version.data_source, ignore_errors=True)
        
    db.delete(db_version)
    db.commit()
    return {"status": "success"}

# --- Item Management (within a Version) ---

@router.post("/versions/{version_id}/upload")
async def upload_image_to_version(version_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    return await dataset_service.upload_file(db, version_id, file)

@router.get("/versions/{version_id}/items")
def get_version_items(version_id: int, db: Session = Depends(get_db)):
    return db.query(DatasetItem).filter(DatasetItem.version_id == version_id).all()

@router.put("/items/{item_id}")
def update_item(item_id: int, item_update: ItemUpdate, db: Session = Depends(get_db)):
    db_item = db.query(DatasetItem).filter(DatasetItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    db_item.annotations = item_update.annotations
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/items/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db)):
    db_item = db.query(DatasetItem).filter(DatasetItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if os.path.exists(db_item.file_path):
        os.remove(db_item.file_path)
        
    db.delete(db_item)
    db.commit()
    return {"status": "success"}

@router.post("/items/batch-delete")
def batch_delete_items(request: BatchDeleteRequest, db: Session = Depends(get_db)):
    items = db.query(DatasetItem).filter(DatasetItem.id.in_(request.item_ids)).all()
    if not items:
        return {"status": "success", "deleted_count": 0}
    
    deleted_count = 0
    for item in items:
        if os.path.exists(item.file_path):
            try:
                os.remove(item.file_path)
            except Exception as e:
                # Log but continue
                print(f"Error removing file {item.file_path}: {e}")
        db.delete(item)
        deleted_count += 1
        
    db.commit()
    return {"status": "success", "deleted_count": deleted_count}

# --- Task Management ---

@router.post("/versions/{version_id}/tasks", response_model=TaskResponse)
def create_task(version_id: int, task: TaskBase, db: Session = Depends(get_db)):
    db_task = DatasetTask(
        version_id=version_id,
        name=task.name,
        task_type=task.task_type,
        status=task.status or "pending",
        config=task.config or {},
        order_idx=task.order_idx or 0
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@router.patch("/tasks/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, task_update: TaskBase, db: Session = Depends(get_db)):
    db_task = db.query(DatasetTask).filter(DatasetTask.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_data = task_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_task, key, value)
    
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@router.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    db_task = db.query(DatasetTask).filter(DatasetTask.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(db_task)
    db.commit()
    return {"status": "success"}
