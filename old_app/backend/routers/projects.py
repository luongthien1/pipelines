from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models.project import Project
from pydantic import BaseModel
from typing import List

router = APIRouter()

class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    version: str = "0.0.1"

class ProjectResponse(ProjectCreate):
    id: int
    version: str
    class Config:
        orm_mode = True

@router.post("/projects", response_model=ProjectResponse)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    db_project = Project(name=project.name, description=project.description)
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

@router.get("/projects", response_model=List[ProjectResponse])
def read_projects(db: Session = Depends(get_db)):
    return db.query(Project).all()

@router.put("/projects/{project_id}", response_model=ProjectResponse)
def update_project(project_id: int, update: ProjectCreate, db: Session = Depends(get_db)):
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    db_project.name = update.name
    db_project.description = update.description
    db.commit()
    db.refresh(db_project)
    return db_project

@router.delete("/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Cascade delete datasets and their files
    from ..models.dataset import Dataset
    import shutil
    import os
    datasets = db.query(Dataset).filter(Dataset.project_id == project_id).all()
    for ds in datasets:
        upload_dir = os.path.join("uploads", str(ds.id))
        if os.path.exists(upload_dir):
            shutil.rmtree(upload_dir)
    
    # Also delete models (just DB for now, or runs folder too)
    from ..models.model import Model
    models = db.query(Model).filter(Model.project_id == project_id).all()
    for m in models:
        run_dir = os.path.join("runs", "detect", f"model_{m.id}")
        if os.path.exists(run_dir):
            shutil.rmtree(run_dir)

    db.delete(db_project)
    db.commit()
    return {"status": "success"}
