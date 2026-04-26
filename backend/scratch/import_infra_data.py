import os
import sqlite3
import json
import uuid
import shutil
import cv2
import numpy as np

# Configuration
SOURCE_IMAGES = r"e:\Code\Job\self\Pipelines\Initial raw data\images"
SOURCE_MASKS = r"e:\Code\Job\self\Pipelines\Initial raw data\masks"
BACKEND_DIR = r"e:\Code\Job\self\Pipelines\backend"
DB_PATH = os.path.join(BACKEND_DIR, "app.db")
UPLOAD_DIR = os.path.join(BACKEND_DIR, "uploads", "1", "v1")

LABEL_MAP = {
    1: "building",
    2: "water",
    3: "road"
}

VERSION_ID = 1

def mask_to_polygons(mask_path, label_map):
    mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
    if mask is None:
        return []
    
    annotations = []
    
    unique_vals = np.unique(mask)
    for val in unique_vals:
        if val == 0 or val not in label_map:
            continue
            
        label_name = label_map[val]
        
        # Create binary mask for this class
        binary_mask = np.where(mask == val, 255, 0).astype(np.uint8)
        
        # Find contours
        contours, _ = cv2.findContours(binary_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for cnt in contours:
            # Simplify polygon (epsilon coefficient determines accuracy)
            epsilon = 1.0
            approx = cv2.approxPolyDP(cnt, epsilon, True)
            
            # Convert to list of [[x, y], ...]
            polygon = approx.reshape(-1, 2).tolist()
            
            # Only keep valid polygons
            if len(polygon) >= 3:
                annotations.append({
                    "label": label_name,
                    "polygon": polygon,
                    "type": "polygon" # Explicitly marking type for UI consistency
                })
                
    return annotations

def main():
    if not os.path.exists(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    image_files = [f for f in os.listdir(SOURCE_IMAGES) if f.lower().endswith('.jpg')]
    print(f"Found {len(image_files)} images to process.")
    
    imported_count = 0
    unique_labels_found = set()
    
    for i, img_name in enumerate(image_files):
        if i % 50 == 0:
            print(f"Processing image {i}/{len(image_files)}...")
            
        base_name = os.path.splitext(img_name)[0]
        mask_name = base_name + ".png"
        mask_path = os.path.join(SOURCE_MASKS, mask_name)
        
        if not os.path.exists(mask_path):
            # print(f"Warning: Mask for {img_name} not found. Skipping annotations.")
            annotations = []
        else:
            annotations = mask_to_polygons(mask_path, LABEL_MAP)
            for ann in annotations:
                unique_labels_found.add(ann["label"])
        
        # Prepare file storage
        file_id = str(uuid.uuid4())
        ext = os.path.splitext(img_name)[1].lower()
        dest_filename = f"{file_id}{ext}"
        dest_path = os.path.join(UPLOAD_DIR, dest_filename)
        
        shutil.copy2(os.path.join(SOURCE_IMAGES, img_name), dest_path)
        
        # Insert into database
        cursor.execute("""
            INSERT INTO dataset_items (version_id, file_path, original_filename, annotations, is_empty, created_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
        """, (
            VERSION_ID,
            dest_path,
            img_name,
            json.dumps(annotations),
            1 if not annotations else 0
        ))
        imported_count += 1
        
    # Update Version Metadata
    all_labels = sorted(list(unique_labels_found))
    cursor.execute("""
        UPDATE dataset_versions 
        SET data_source = ?, unique_labels = ?
        WHERE id = ?
    """, (
        UPLOAD_DIR,
        json.dumps(all_labels),
        VERSION_ID
    ))
    
    conn.commit()
    conn.close()
    
    print(f"\nImport complete!")
    print(f"Total items: {imported_count}")
    print(f"Labels detected: {all_labels}")
    print(f"Data source updated to: {UPLOAD_DIR}")

if __name__ == "__main__":
    main()
