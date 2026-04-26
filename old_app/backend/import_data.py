import json
import os
import sys
from datetime import datetime

import pandas as pd
from sqlalchemy.orm import Session

from backend.db import Base, SessionLocal, engine
from backend.models.dataset import Dataset, DatasetVersion
from backend.models.deployment import Deployment
from backend.models.model import Model, ModelVersion
from backend.models.pipeline import Pipeline

# This script should be run from the project root using:
# .\venv\Scripts\python -m backend.import_data


# Initialize DB
print("Resetting database for fresh schema...")
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

db = SessionLocal()

def clean_val(val):
    if pd.isna(val) or str(val).strip() == "" or str(val).strip() == "None" or str(val).strip() == "...":
        return "unknown"
    return str(val).strip()

def import_datasets():
    print("Importing Datasets...")
    csv_path = "DS_AI Module Management - Datasets.csv"
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found.")
        return
    df = pd.read_csv(csv_path)
    for _, row in df.iterrows():
        name = clean_val(row.get("Name/ID"))
        if name == "unknown": continue
        
        # Check if dataset exists
        dataset = db.query(Dataset).filter(Dataset.name == name).first()
        if not dataset:
            dataset = Dataset(
                name=name,
                description=clean_val(row.get('Data Purpose')),
                type="unknown", # Will try to infer or let user set
                domain="unknown"
            )
            db.add(dataset)
            db.commit()
            db.refresh(dataset)
        
        version_name = clean_val(row.get("Version"))
        if version_name == "unknown": version_name = "v1.0.0"
        
        dv = DatasetVersion(
            dataset_id=dataset.id,
            version_name=version_name,
            data_source=clean_val(row.get("Data Source")),
            data_info=clean_val(row.get("Data Info")),
            preprocessing_steps=clean_val(row.get("Data Preprocessing Steps")),
            data_purpose=clean_val(row.get("Data Purpose")),
            train_val_test_size=clean_val(row.get("Train/Val/Test Size")),
            output_link=clean_val(row.get("Output Data/Code Link")),
            annotations={"note": clean_val(row.get("Note"))}
        )
        db.add(dv)
    db.commit()

def import_models():
    print("Importing Models...")
    csv_path = "DS_AI Module Management - Current modules_models.csv"
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found.")
        return
    df = pd.read_csv(csv_path)
    for _, row in df.iterrows():
        name = clean_val(row.get("Module / Model Name"))
        if name == "unknown": continue
        
        model = db.query(Model).filter(Model.name == name).first()
        if not model:
            model = Model(
                name=name,
                domain=clean_val(row.get("Domain")),
                description=clean_val(row.get('Description')),
                owner=clean_val(row.get("Owner/PIC")),
                collaborators=clean_val(row.get("Collaborators"))
            )
            db.add(model)
            db.commit()
            db.refresh(model)
            
        version_name = clean_val(row.get("Version"))
        if version_name == "unknown": version_name = "v1.0.0"
        
        mv = ModelVersion(
            model_id=model.id,
            version_name=version_name,
            folder_path=clean_val(row.get("Model Repo")),
            base_model="unknown",
            size=clean_val(row.get("Size")),
            stage=clean_val(row.get("Development Stage")),
            status_note=clean_val(row.get("Status Note")),
            documentation_link=clean_val(row.get("Documentation"))
        )
        db.add(mv)
    db.commit()

def import_pipelines():
    print("Importing Pipelines...")
    csv_path = "DS_AI Module Management - Training progress.csv"
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found.")
        return
    df = pd.read_csv(csv_path)
    for _, row in df.iterrows():
        name = clean_val(row.get("Training Progress Name/ID"))
        if name == "unknown": continue
        
        # Link to dataset version
        data_used = clean_val(row.get("Data Used"))
        dv = db.query(DatasetVersion).filter(DatasetVersion.version_name == data_used).first()
        
        p = Pipeline(
            type="training",
            status="finished",
            base_model=clean_val(row.get("Base Model / Framework")),
            parameters=clean_val(row.get("Parameters")),
            repo_link=clean_val(row.get("Training Code Repo")),
            metrics=clean_val(row.get("Evaluation Metrics")),
            experiment_logs=clean_val(row.get("Experiment Logs")),
            dataset_version_id=dv.id if dv else None,
            log=f"Note: {clean_val(row.get('Note'))}"
        )
        db.add(p)
    db.commit()

def import_deployments():
    print("Importing Deployments...")
    csv_path = "DS_AI Module Management - Deployment.csv"
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found.")
        return
    df = pd.read_csv(csv_path)
    for _, row in df.iterrows():
        name = clean_val(row.get("Deployment ID/Name"))
        if name == "unknown": continue
        
        d = Deployment(
            inference_pipeline_description=clean_val(row.get("Inference Pipeline")),
            monitoring_link=clean_val(row.get("Monitoring & Logging")),
            operational_cost=clean_val(row.get("Cost")),
            note=clean_val(row.get("Note")),
            status="active"
        )
        db.add(d)
    db.commit()

if __name__ == "__main__":
    import_datasets()
    import_models()
    import_pipelines()
    import_deployments()
    print("Deep Migration Complete!")
