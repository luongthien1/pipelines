from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models.deployment import Deployment
from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime

router = APIRouter()

class DeploymentCreate(BaseModel):
    model_version_id: int
    inference_pipeline_description: Optional[str] = None
    logger_link: Optional[str] = None
    note: Optional[str] = None

class DeploymentResponse(DeploymentCreate):
    id: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

@router.post("/", response_model=DeploymentResponse)
def create_deployment(deployment: DeploymentCreate, db: Session = Depends(get_db)):
    db_deployment = Deployment(
        model_version_id=deployment.model_version_id,
        inference_pipeline_description=deployment.inference_pipeline_description,
        logger_link=deployment.logger_link,
        note=deployment.note
    )
    db.add(db_deployment)
    db.commit()
    db.refresh(db_deployment)
    return db_deployment

@router.get("/", response_model=List[DeploymentResponse])
def get_deployments(db: Session = Depends(get_db)):
    return db.query(Deployment).all()

@router.get("/{deployment_id}", response_model=DeploymentResponse)
def get_deployment(deployment_id: int, db: Session = Depends(get_db)):
    db_deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not db_deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return db_deployment

@router.delete("/{deployment_id}")
def delete_deployment(deployment_id: int, db: Session = Depends(get_db)):
    db_deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not db_deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    db.delete(db_deployment)
    db.commit()
    return {"status": "success"}
