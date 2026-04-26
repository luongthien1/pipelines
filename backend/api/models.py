import base64
import os
import shutil
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from libs.database.connect import get_db
from db.model.model import Model, ModelVersion
from db.model.dataset import DatasetItem

try:
    from ultralytics import YOLO
except ImportError:
    YOLO = None

router = APIRouter()

# Schema for a single version
class ModelVersionBase(BaseModel):
    version_name: str
    folder_path: Optional[str] = None
    base_model: Optional[str] = "yolov8n.pt"
    size: Optional[str] = "unknown"
    stage: Optional[str] = "unknown"
    status_note: Optional[str] = "unknown"
    documentation_link: Optional[str] = "unknown"
    trained_dataset_id: Optional[int] = None
    trained_pipeline_id: Optional[int] = None
    training_results: Optional[dict] = {}

class ModelVersionResponse(ModelVersionBase):
    id: int
    model_id: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class ModelVersionDataResponse(BaseModel):
    id: int
    version_id: int
    file_name: str
    file_type: str
    file_size: int
    url: str
    preview_url: Optional[str] = None
    created_at: datetime

# Schema for the model metadata
class ModelBase(BaseModel):
    name: str
    description: Optional[str] = None
    task: Optional[str] = None
    domain: Optional[str] = "unknown"
    owner: Optional[str] = "unknown"
    collaborators: Optional[str] = "unknown"

class ModelResponse(ModelBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]
    
    model_config = ConfigDict(from_attributes=True)

# --- Model CRUD ---

@router.get("/", response_model=List[ModelResponse])
def read_models(task: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Model)
    if task:
        # Return models matching the task OR models with no task set (generic models)
        from sqlalchemy import or_
        query = query.filter(or_(Model.task == task, Model.task == None, Model.task == ""))
    return query.all()

@router.post("/", response_model=ModelResponse)
def create_model(model: ModelBase, db: Session = Depends(get_db)):
    db_model = Model(
        name=model.name,
        description=model.description,
        task=model.task,
        domain=model.domain,
        owner=model.owner,
        collaborators=model.collaborators,
    )
    db.add(db_model)
    db.commit()
    db.refresh(db_model)

    # Create initial version v1
    db_version = ModelVersion(
        model_id=db_model.id,
        version_name="v1",
        stage="experimental",
        status_note=f"Initial registration for {db_model.name}",
        folder_path=f"/models/{db_model.id}/v1"
    )
    db.add(db_version)
    db.commit()

    return db_model

@router.get("/{model_id}", response_model=ModelResponse)
def get_model(model_id: int, db: Session = Depends(get_db)):
    db_model = db.query(Model).filter(Model.id == model_id).first()
    if not db_model:
        raise HTTPException(status_code=404, detail="Model not found")
    return db_model

@router.put("/{model_id}", response_model=ModelResponse)
def update_model(model_id: int, model: ModelBase, db: Session = Depends(get_db)):
    db_model = db.query(Model).filter(Model.id == model_id).first()
    if not db_model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    setattr(db_model, 'name', model.name)
    setattr(db_model, 'description', model.description)
    setattr(db_model, 'task', model.task)
    setattr(db_model, 'domain', model.domain)
    setattr(db_model, 'owner', model.owner)
    setattr(db_model, 'collaborators', model.collaborators)
    
    db.add(db_model)
    db.commit()
    db.refresh(db_model)
    return db_model

@router.delete("/{model_id}")
def delete_model(model_id: int, db: Session = Depends(get_db)):
    db_model = db.query(Model).filter(Model.id == model_id).first()
    if not db_model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    # Optional: Delete associated versions or folders if needed
    db.delete(db_model)
    db.commit()
    return {"status": "success"}

# --- Versioning ---

@router.get("/{model_id}/versions", response_model=List[ModelVersionResponse])
def get_versions(model_id: int, db: Session = Depends(get_db)):
    return db.query(ModelVersion).filter(ModelVersion.model_id == model_id).all()


@router.post("/{model_id}/versions", response_model=ModelVersionResponse)
def create_version(model_id: int, version: ModelVersionBase, db: Session = Depends(get_db)):
    db_model = db.query(Model).filter(Model.id == model_id).first()
    if not db_model:
        raise HTTPException(status_code=404, detail="Model not found")

    # Auto-increment version name if not provided or already taken
    base_name = version.version_name or "v1"
    existing_names = {v.version_name for v in db.query(ModelVersion).filter(ModelVersion.model_id == model_id).all()}
    version_name = base_name
    if version_name in existing_names:
        # Find next available: v1 → v2 → v3 ...
        count = db.query(ModelVersion).filter(ModelVersion.model_id == model_id).count()
        version_name = f"v{count + 1}"
        while version_name in existing_names:
            count += 1
            version_name = f"v{count + 1}"

    # Create canonical folder path
    folder_path = version.folder_path or os.path.join(
        "data", "models", str(model_id), version_name
    )

    db_version = ModelVersion(
        model_id=model_id,
        version_name=version_name,
        stage=version.stage or "experimental",
        status_note=version.status_note or "",
        folder_path=folder_path,
        base_model=version.base_model or "",
        size=version.size or "unknown",
        documentation_link=version.documentation_link,
        trained_dataset_id=version.trained_dataset_id,
        trained_pipeline_id=version.trained_pipeline_id,
        training_results=version.training_results or {},
    )
    db.add(db_version)
    db.commit()
    db.refresh(db_version)
    return db_version

@router.get("/{model_id}/versions/{version_id}", response_model=ModelVersionResponse)
def get_version(model_id: int, version_id: int, db: Session = Depends(get_db)):
    db_version = db.query(ModelVersion).filter(ModelVersion.model_id == model_id, ModelVersion.id == version_id).first()
    if not db_version:
        raise HTTPException(status_code=404, detail="Version not found")
    return db_version

@router.put("/{model_id}/versions/{version_id}", response_model=ModelVersionResponse)
def update_version(model_id: int, version_id: int, version: ModelVersionBase, db: Session = Depends(get_db)):
    db_version = db.query(ModelVersion).filter(ModelVersion.model_id == model_id, ModelVersion.id == version_id).first()
    if not db_version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    setattr(db_version, 'version_name', version.version_name)
    setattr(db_version, 'folder_path', version.folder_path)
    setattr(db_version, 'base_model', version.base_model)
    setattr(db_version, 'size', version.size)
    setattr(db_version, 'stage', version.stage)
    setattr(db_version, 'status_note', version.status_note)
    setattr(db_version, 'documentation_link', version.documentation_link)
    setattr(db_version, 'trained_dataset_id', version.trained_dataset_id)
    setattr(db_version, 'trained_pipeline_id', version.trained_pipeline_id)
    setattr(db_version, 'training_results', version.training_results)
    
    db.add(db_version)
    db.commit()
    db.refresh(db_version)
    return db_version

@router.delete("/{model_id}/versions/{version_id}")
def delete_version(model_id: int, version_id: int, db: Session = Depends(get_db)):
    db_version = db.query(ModelVersion).filter(ModelVersion.model_id == model_id, ModelVersion.id == version_id).first()
    if not db_version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    # Delete version folder if exists
    folder_path = getattr(db_version, 'folder_path')
    if folder_path and os.path.exists(folder_path):
        shutil.rmtree(folder_path)
        
    db.delete(db_version)
    db.commit()
    return {"status": "success"}

@router.get("/versions/{version_id}/data", response_model=List[ModelVersionDataResponse])
def get_model_version_data(version_id: int, db: Session = Depends(get_db)):
    """
    Lists all files (artifacts, samples) associated with a model version.
    Reads from version.folder_path (set by training pipeline) or falls back
    to the legacy data/models/{version_id} path.
    """
    version = db.query(ModelVersion).filter(ModelVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    # Prefer folder_path from DB; fall back to legacy path
    version_dir = version.folder_path if (version.folder_path and os.path.exists(version.folder_path)) \
                  else f"data/models/{version_id}"

    if not os.path.exists(version_dir):
        return []

    results = []
    idx = 0
    # Walk recursively so weights/ subdir files are also listed
    for root, dirs, files in os.walk(version_dir):
        # Skip hidden dirs
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        for file_name in sorted(files):
            file_path = os.path.join(root, file_name)
            # Relative path from version_dir for display
            rel_path = os.path.relpath(file_path, version_dir).replace("\\", "/")
            file_size = os.path.getsize(file_path)
            ext = file_name.rsplit('.', 1)[-1] if '.' in file_name else ""
            idx += 1
            results.append(ModelVersionDataResponse(
                id=idx,
                version_id=version_id,
                file_name=rel_path,
                file_type=ext,
                file_size=file_size,
                url=f"/api/models/versions/{version_id}/files/{rel_path}",
                preview_url=f"/api/models/versions/{version_id}/files/{rel_path}" if ext in ("png", "jpg", "jpeg") else None,
                created_at=datetime.fromtimestamp(os.path.getmtime(file_path), tz=timezone.utc)
            ))
    return results

@router.get("/versions/{version_id}/files/{file_name:path}")
def get_model_version_file(version_id: int, file_name: str, db: Session = Depends(get_db)):
    """
    Download/serve a file from a model version. Supports subdirectory paths (e.g. weights/best.onnx).
    """
    version = db.query(ModelVersion).filter(ModelVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    version_dir = version.folder_path if (version.folder_path and os.path.exists(version.folder_path)) \
                  else f"data/models/{version_id}"

    file_path = os.path.normpath(os.path.join(version_dir, file_name))

    # Security: prevent path traversal
    if not file_path.startswith(os.path.abspath(version_dir)):
        raise HTTPException(status_code=400, detail="Invalid file path")

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

@router.delete("/versions/{version_id}")
def delete_version_standalone(version_id: int, db: Session = Depends(get_db)):
    """
    Delete a version by its ID directly.
    """
    db_version = db.query(ModelVersion).filter(ModelVersion.id == version_id).first()
    if not db_version:
        raise HTTPException(status_code=404, detail="Version not found")

    # Delete the version folder (use folder_path from DB)
    folder = db_version.folder_path or f"data/models/{version_id}"
    if os.path.exists(folder):
        shutil.rmtree(folder)

    db.delete(db_version)
    db.commit()
    return {"status": "success"}

@router.post("/{model_id}/versions/{version_id}/upload")
async def upload_model_file(
    model_id: int,
    version_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Uploads a model file (weights) for a specific version.
    Stores in data/models/{model_id}/{version_name}/ and updates folder_path.
    """
    db_version = db.query(ModelVersion).filter(ModelVersion.id == version_id).first()
    if not db_version:
        raise HTTPException(status_code=404, detail="Version not found")

    # Use existing folder_path if valid, otherwise create canonical path
    if db_version.folder_path and os.path.isdir(db_version.folder_path):
        version_dir = db_version.folder_path
    else:
        version_dir = os.path.join("data", "models", str(model_id), db_version.version_name)

    os.makedirs(version_dir, exist_ok=True)
    file_path = os.path.join(version_dir, file.filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
    db_version.folder_path = os.path.abspath(version_dir)
    db_version.size = f"{file_size_mb:.1f} MB"

    db.add(db_version)
    db.commit()
    db.refresh(db_version)
    return db_version

def _run_yolo_inference(weights_path: str, img, conf: float = 0.3):
    """
    Core YOLO inference logic shared between standard inference and auto-labeling.
    """
    if YOLO is None:
        raise Exception("ultralytics is not installed on the server.")

    try:
        import cv2
        model = YOLO(weights_path)
        results = model.predict(img, verbose=False, conf=conf)
        res_plotted = results[0].plot()
        _, buffer = cv2.imencode('.jpg', res_plotted)
        encoded_string = base64.b64encode(buffer.tobytes()).decode("utf-8")

        # Collect detection metadata
        boxes = results[0].boxes
        detections = []
        if boxes is not None and len(boxes) > 0:
            names = model.names
            for box in boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                # bbox in natural coordinates [x, y, w, h] from center-based
                # Actually YOLO boxes are [x1, y1, x2, y2] usually, let's convert to [x, y, w, h]
                b = box.xywh[0].tolist() # [x_center, y_center, w, h]
                detections.append({
                    "label": names.get(cls_id, str(cls_id)),
                    "confidence": round(conf, 3),
                    "bbox": [b[0] - b[2]/2, b[1] - b[3]/2, b[2], b[3]]
                })

        return {
            "image_base64": encoded_string,
            "detections": detections,
            "metadata": {"count": len(detections)}
        }
    except Exception as e:
        raise e

def _resolve_weights_path(db_version) -> str:
    """
    Resolve the best available weights file for a model version.
    Priority: best.onnx in folder_path/weights/ → best.pt → base_model fallback
    """
    folder = db_version.folder_path

    if folder and os.path.isdir(folder):
        # Check weights/ subdir first (training output structure)
        for fname in ("best.onnx", "best.pt", "model.onnx", "last.pt"):
            candidate = os.path.join(folder, "weights", fname)
            if os.path.exists(candidate):
                return candidate
        # Then check folder root
        for fname in ("best.onnx", "best.pt", "model.onnx"):
            candidate = os.path.join(folder, fname)
            if os.path.exists(candidate):
                return candidate
    elif folder and os.path.isfile(folder):
        return folder

    # Fall back to base_model (pretrained weights)
    return db_version.base_model or "yolov8n.pt"


@router.post("/{model_id}/versions/{version_id}/inference")
async def model_inference(model_id: int, version_id: int, file: UploadFile = File(...), conf: float = 0.3, db: Session = Depends(get_db)):
    db_version = db.query(ModelVersion).filter(ModelVersion.model_id == model_id, ModelVersion.id == version_id).first()
    if not db_version:
        raise HTTPException(status_code=404, detail="Version not found")

    weights_path = _resolve_weights_path(db_version)

    try:
        import cv2
        import numpy as np
        content = await file.read()
        np_img = np.frombuffer(content, np.uint8)
        img = cv2.imdecode(np_img, cv2.IMREAD_COLOR)

        result = _run_yolo_inference(weights_path, img, conf=conf)
        result["weights_used"] = weights_path
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/versions/{version_id}/auto-label/{item_id}")
async def auto_label_item(version_id: int, item_id: int, conf: float = 0.3, db: Session = Depends(get_db)):
    """
    Runs inference on a specific dataset item using a model version.
    """
    db_version = db.query(ModelVersion).filter(ModelVersion.id == version_id).first()
    if not db_version:
        raise HTTPException(status_code=404, detail="Model version not found")

    db_item = db.query(DatasetItem).filter(DatasetItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Dataset item not found")

    weights_path = _resolve_weights_path(db_version)

    try:
        import cv2
        img = cv2.imread(db_item.file_path)
        if img is None:
            raise HTTPException(status_code=400, detail="Could not load item image")

        result = _run_yolo_inference(weights_path, img, conf=conf)
        return result["detections"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
