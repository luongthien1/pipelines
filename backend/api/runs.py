from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from db.model.pipeline import Pipeline, Node, Edge
from db.model.run import PipelineRun, NodeRun
from schemas.run import PipelineRunResponse, PipelineRunDetailResponse, PipelineRunCreate
from libs.database.connect import SessionMaker

router = APIRouter()

def get_db():
    db = SessionMaker()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=List[PipelineRunResponse])
def get_all_runs(db: Session = Depends(get_db)):
    """Lấy danh sách tất cả các lượt chạy, kèm tên pipeline."""
    runs = db.query(PipelineRun).order_by(PipelineRun.start_time.desc()).all()
    # Map pipeline name for each run
    for run in runs:
        run.pipeline_name = run.pipeline.name
    return runs


@router.post("/{pipeline_id}/start", response_model=PipelineRunResponse)
def start_pipeline_run(pipeline_id: int, data: PipelineRunCreate = PipelineRunCreate(), db: Session = Depends(get_db)):
    """
    Khởi tạo một lần chạy cho pipeline.
    """
    pipeline = db.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    # 1. Tạo bản ghi Run
    run = PipelineRun(
        pipeline_id=pipeline_id, 
        status="pending", 
        priority=data.priority,
        inputs=data.inputs,
        start_time=datetime.utcnow()
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    run.pipeline_name = pipeline.name

    # 2. Khởi tạo NodeRuns cho từng node
    # Những node không có inbound edge sẽ có status là "pending" (sẵn sàng chạy)
    # Những node khác sẽ là "waiting"
    all_edges = pipeline.edges
    target_node_ids = {edge.target_node_id for edge in all_edges}

    for node in pipeline.nodes:
        # Nếu node không phải là một target -> nghĩa là nó ở đầu workflow
        initial_status = "pending" if node.id not in target_node_ids else "waiting"
        
        n_run = NodeRun(
            pipeline_run_id=run.id,
            node_id=node.id,
            status=initial_status,
            inputs={},
            outputs={}
        )
        db.add(n_run)

    db.commit()
    db.refresh(run)

    return run

@router.post("/{run_id}/cancel")
def cancel_pipeline_run(run_id: int, db: Session = Depends(get_db)):
    run = db.get(PipelineRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    if run.status in ["success", "failed", "cancelled"]:
        return {"message": f"Run already finished with status: {run.status}"}

    run.status = "cancelled"
    
    # Update node_runs to cancelled as well if they are waiting or pending
    for nr in run.node_runs:
        if nr.status in ["waiting", "pending", "running"]:
            nr.status = "cancelled"
            nr.end_time = datetime.utcnow()
    
    db.commit()
    return {"message": "Pipeline run cancelled"}

@router.get("/{run_id}", response_model=PipelineRunDetailResponse)
def get_pipeline_run_status(run_id: int, db: Session = Depends(get_db)):
    run = db.get(PipelineRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    run.pipeline_name = run.pipeline.name
    return run
