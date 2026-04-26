import os
import shutil
from sqlalchemy.orm import Session
from ..models.dataset import Dataset, DatasetItem
import yaml

def prepare_yolo_dataset(db: Session, dataset_id: int):
    # Create temp directory for training
    train_dir = os.path.join("train_data", str(dataset_id))
    os.makedirs(train_dir, exist_ok=True)
    os.makedirs(os.path.join(train_dir, "images"), exist_ok=True)
    os.makedirs(os.path.join(train_dir, "labels"), exist_ok=True)
    
    items = db.query(DatasetItem).filter(DatasetItem.dataset_id == dataset_id).all()
    
    # Simple label map: class name -> class index
    all_labels = set()
    for item in items:
        for ann in item.annotations:
            all_labels.add(ann['label'])
    
    label_map = {label: i for i, label in enumerate(sorted(all_labels))}
    
    for item in items:
        if not item.annotations:
            continue
            
        # Copy image
        file_name = os.path.basename(item.file_path)
        dest_img_path = os.path.join(train_dir, "images", file_name)
        shutil.copy(item.file_path, dest_img_path)
        
        # Write labels (YOLO format: <class> <x_center> <y_center> <width> <height> normalized 0-1)
        # Note: BBox in my DB is [x, y, w, h] in absolute pixels.
        # I need to know image dimensions.
        from PIL import Image
        with Image.open(item.file_path) as img:
            img_w, img_h = img.size
            
        label_file = os.path.splitext(file_name)[0] + ".txt"
        with open(os.path.join(train_dir, "labels", label_file), "w") as f:
            for ann in item.annotations:
                class_idx = label_map[ann['label']]
                x, y, w, h = ann['bbox'] # [x, y, w, h] - top-left
                
                # Convert to center x, center y, w, h normalized
                xc = (x + w/2) / img_w
                yc = (y + h/2) / img_h
                wn = w / img_w
                hn = h / img_h
                
                f.write(f"{class_idx} {xc} {yc} {wn} {hn}\n")
                
    # Create data.yaml
    data_yaml = {
        "path": os.path.abspath(train_dir),
        "train": "images",
        "val": "images", # Using same for MVP
        "names": {v: k for k, v in label_map.items()}
    }
    yaml_path = os.path.join(train_dir, "data.yaml")
    with open(yaml_path, "w") as f:
        yaml.dump(data_yaml, f)
        
    return yaml_path
