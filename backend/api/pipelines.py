from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from db.model.pipeline import Pipeline, Node, Edge
from schemas.pipeline import (
    PipelineResponse, PipelineDetailResponse, PipelineCreate, PipelineUpdate, GraphSyncRequest
)
from libs.database.connect import SessionMaker

router = APIRouter()

def get_db():
    db = SessionMaker()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=List[PipelineResponse])
def get_pipelines(db: Session = Depends(get_db)):
    pipelines = db.scalars(select(Pipeline)).all()
    return pipelines


@router.get("/{pipeline_id}", response_model=PipelineDetailResponse)
def get_pipeline(pipeline_id: int, db: Session = Depends(get_db)):
    pipeline = db.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return pipeline


@router.post("/", response_model=PipelineResponse)
def create_pipeline(data: PipelineCreate, db: Session = Depends(get_db)):
    pipeline = Pipeline(**data.model_dump())
    db.add(pipeline)
    db.commit()
    db.refresh(pipeline)
    return pipeline


@router.put("/{pipeline_id}", response_model=PipelineResponse)
def update_pipeline(pipeline_id: int, data: PipelineUpdate, db: Session = Depends(get_db)):
    pipeline = db.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(pipeline, key, value)
    
    db.commit()
    db.refresh(pipeline)
    return pipeline


@router.delete("/{pipeline_id}")
def delete_pipeline(pipeline_id: int, db: Session = Depends(get_db)):
    pipeline = db.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    db.delete(pipeline)
    db.commit()
    return {"message": "Deleted successfully"}


@router.post("/{pipeline_id}/graph", response_model=PipelineDetailResponse)
def sync_pipeline_graph(pipeline_id: int, data: GraphSyncRequest, db: Session = Depends(get_db)):
    """
    Sync toàn bộ sơ đồ Node và Edge từ frontend.
    Xóa hết các node/edge cũ và thêm mới lại (để đơn giản).
    """
    pipeline = db.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    # 1. Xóa các node và edge cũ (SQLAlchemy cascade sẽ tự xử lý DB relationships nếu setup đúng, 
    # nhưng để an toàn delete cụ thể Edge trước rồi Node. Hoặc delete trực tiếp trên session)
    db.query(Edge).filter(Edge.pipeline_id == pipeline_id).delete()
    db.query(Node).filter(Node.pipeline_id == pipeline_id).delete()

    # 2. Add Node mới
    for n in data.nodes:
        db.add(Node(
            id=n.id,
            pipeline_id=pipeline_id,
            node_type=n.node_type,
            config=n.config,
            position_x=n.position_x,
            position_y=n.position_y
        ))
    
    # 3. Add Edge mới
    for e in data.edges:
        db.add(Edge(
            id=e.id,
            pipeline_id=pipeline_id,
            source_node_id=e.source_node_id,
            target_node_id=e.target_node_id,
            source_port=e.source_port,
            target_port=e.target_port
        ))
    
    db.commit()
    db.refresh(pipeline)
    return pipeline
