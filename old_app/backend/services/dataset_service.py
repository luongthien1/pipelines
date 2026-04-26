import os
import shutil
import uuid
import yaml
from PIL import Image
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, UploadFile

from ..models.dataset import Dataset, DatasetItem, DatasetTask, DatasetVersion
from ..models.model import Model, ModelVersion

class DatasetService:
    @staticmethod
    def create_dataset(db: Session, name: str, description: Optional[str], task: Optional[str]):
        db_dataset = Dataset(
            name=name,
            description=description,
            task=task,
        )
        db.add(db_dataset)
        db.commit()
        db.refresh(db_dataset)

        # Create initial version v1
        DatasetService.create_version(
            db, 
            db_dataset.id, 
            version_name="v1", 
            data_source="Initial raw data", 
            data_info=f"Initial version for {name}"
        )
        
        return db_dataset

    @staticmethod
    def create_version(
        db: Session, 
        dataset_id: int, 
        version_name: str, 
        data_source: Optional[str] = None,
        data_info: str = "",
        preprocessing_steps: str = "",
        data_purpose: str = "",
        train_val_test_size: str = "",
        output_link: Optional[str] = None,
        annotations: dict = None,
        processing_config: dict = None
    ):
        # Check dataset exists
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
            
        uploads_dir = os.getenv("UPLOADS_DIR", "uploads")
        final_data_source = data_source or os.path.join(uploads_dir, str(dataset_id), version_name)
        
        db_version = DatasetVersion(
            dataset_id=dataset_id,
            version_name=version_name,
            data_source=final_data_source,
            data_info=data_info,
            preprocessing_steps=preprocessing_steps,
            data_purpose=data_purpose,
            train_val_test_size=train_val_test_size,
            output_link=output_link,
            annotations=annotations or {},
            processing_config=processing_config or {}
        )
        db.add(db_version)
        db.commit()
        db.refresh(db_version)
        
        # Ensure folder path exists
        os.makedirs(db_version.data_source, exist_ok=True)
        
        # Auto-add Upload Task
        upload_task = DatasetTask(
            version_id=db_version.id,
            name="Data Ingestion",
            task_type="upload",
            status="completed" if data_source else "pending"
        )
        db.add(upload_task)
        db.commit()
        
        return db_version

    # Allowed image extensions and max file size (50 MB)
    ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tiff", ".tif"}
    MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB

    @staticmethod
    async def upload_file(db: Session, version_id: int, file: UploadFile):
        db_version = db.query(DatasetVersion).filter(DatasetVersion.id == version_id).first()
        if not db_version:
            raise HTTPException(status_code=404, detail="Version not found")

        # --- Validate file extension ---
        if not file.filename:
            raise HTTPException(status_code=400, detail="File has no name")
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in DatasetService.ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"File type '{ext}' is not allowed. Allowed types: {', '.join(DatasetService.ALLOWED_EXTENSIONS)}"
            )

        # --- Read content and validate size ---
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        if len(content) > DatasetService.MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File size exceeds the {DatasetService.MAX_FILE_SIZE_BYTES // (1024*1024)} MB limit"
            )

        upload_dir = db_version.data_source
        try:
            os.makedirs(upload_dir, exist_ok=True)
        except OSError as e:
            raise HTTPException(status_code=500, detail=f"Could not create upload directory: {e}")

        file_id = str(uuid.uuid4())
        file_name = f"{file_id}{ext}"
        file_path = os.path.join(upload_dir, file_name)

        # Normalize path to prevent path traversal
        file_path = os.path.abspath(file_path)
        if not file_path.startswith(os.path.abspath(upload_dir)):
            raise HTTPException(status_code=400, detail="Invalid file path")

        try:
            with open(file_path, "wb") as buffer:
                buffer.write(content)
        except OSError as e:
            raise HTTPException(status_code=500, detail=f"Could not write file to disk: {e}")

        db_item = DatasetItem(
            version_id=version_id,
            file_path=file_path,
            original_filename=file.filename,
            annotations=[]
        )
        db.add(db_item)
        db.commit()
        db.refresh(db_item)
        return db_item

    @staticmethod
    def delete_dataset(db: Session, dataset_id: int):
        db_dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not db_dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        # Versions will be deleted by cascade, but we need to delete folders
        for version in db_dataset.versions:
            if version.data_source and os.path.exists(version.data_source):
                shutil.rmtree(version.data_source, ignore_errors=True)

        db.delete(db_dataset)
        db.commit()
        return True

    @staticmethod
    def prepare_yolo_dataset(db: Session, version_id: int, run_dir: str, class_map: dict = None):
        """
        Prepares a YOLO-compatible dataset folder within the training run directory.
        Filters items: Only includes labeled items OR items marked as is_empty.

        class_map: optional dict {source_label: target_label | None}
          - None value  → drop annotations with that label
          - string value → rename label to target
          - missing key  → keep label unchanged
        """
        version = db.query(DatasetVersion).filter(DatasetVersion.id == version_id).first()
        if not version:
            raise HTTPException(status_code=404, detail="Version not found")

        # 1. Fetch filtered items
        items = db.query(DatasetItem).filter(
            DatasetItem.version_id == version_id
        ).all()
        
        # Filter: Labeled OR is_empty
        filtered_items = []
        for it in items:
            has_labels = bool(it.annotations and len(it.annotations) > 0)
            if has_labels or it.is_empty:
                filtered_items.append(it)
        
        if not filtered_items:
            raise ValueError("No valid training data found. Items must be labeled or marked as empty.")

        # 2. Apply class_map and extract unique labels
        def map_label(label: str) -> str | None:
            """Returns mapped label, or None if the annotation should be dropped."""
            if class_map is None:
                return label
            if label in class_map:
                return class_map[label]  # None means drop
            return label  # not in map → keep as-is

        unique_labels = set()
        for it in filtered_items:
            if it.annotations:
                for ann in it.annotations:
                    raw = ann.get('label')
                    if raw:
                        mapped = map_label(raw)
                        if mapped is not None:
                            unique_labels.add(mapped)
        
        sorted_labels = sorted(list(unique_labels))
        label_to_id = {label: idx for idx, label in enumerate(sorted_labels)}
        
        # 3. Create folder structure
        images_dir = os.path.join(run_dir, "dataset", "images", "train")
        labels_dir = os.path.join(run_dir, "dataset", "labels", "train")
        os.makedirs(images_dir, exist_ok=True)
        os.makedirs(labels_dir, exist_ok=True)
        
        # 4. Process items
        for it in filtered_items:
            # Copy Image
            file_name = os.path.basename(it.file_path)
            dest_image_path = os.path.join(images_dir, f"{it.id}_{file_name}")
            shutil.copy2(it.file_path, dest_image_path)
            
            # Generate YOLO Label File
            label_file_name = os.path.splitext(f"{it.id}_{file_name}")[0] + ".txt"
            dest_label_path = os.path.join(labels_dir, label_file_name)
            
            with open(dest_label_path, "w") as f:
                if it.annotations:
                    try:
                        with Image.open(it.file_path) as img:
                            img_w, img_h = img.size
                    except Exception:
                        img_w, img_h = 640, 640
                        
                    for ann in it.annotations:
                        raw_label = ann.get('label')
                        bbox = ann.get('bbox')
                        if not raw_label or not bbox or len(bbox) != 4:
                            continue
                        label = map_label(raw_label)
                        if label is None or label not in label_to_id:
                            continue  # dropped or unmapped
                        class_id = label_to_id[label]
                        x, y, w, h = bbox
                        x_center = (x + w / 2) / img_w
                        y_center = (y + h / 2) / img_h
                        norm_w = w / img_w
                        norm_h = h / img_h
                        f.write(f"{class_id} {x_center} {y_center} {norm_w} {norm_h}\n")

        # 5. Create dataset.yaml
        dataset_yaml_path = os.path.join(run_dir, "dataset.yaml")
        yaml_content = {
            "path": os.path.abspath(os.path.join(run_dir, "dataset")),
            "train": "images/train",
            "val": "images/train",
            "test": None,
            "names": {idx: label for label, idx in label_to_id.items()}
        }
        
        with open(dataset_yaml_path, "w") as f:
            yaml.dump(yaml_content, f, sort_keys=False)
            
        return dataset_yaml_path

dataset_service = DatasetService()
