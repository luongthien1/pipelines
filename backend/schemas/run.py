from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

class NodeRunResponse(BaseModel):
    id: int
    pipeline_run_id: int
    node_id: str
    status: str
    logs: Optional[str] = None
    inputs: Dict[str, Any]
    outputs: Dict[str, Any]
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

    class Config:
        orm_mode = True
        from_attributes = True

class PipelineRunResponse(BaseModel):
    id: int
    pipeline_id: int
    pipeline_name: Optional[str] = None
    status: str
    priority: int = 0
    inputs: Dict[str, Any] = {}
    outputs: Dict[str, Any] = {}
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

    class Config:
        orm_mode = True
        from_attributes = True

class PipelineRunDetailResponse(PipelineRunResponse):
    node_runs: List[NodeRunResponse] = []

class PipelineRunCreate(BaseModel):
    priority: int = 0
    inputs: Dict[str, Any] = {}
