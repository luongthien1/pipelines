from copy import deepcopy
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

# -----------------
# Node Schemas
# -----------------
class NodeBase(BaseModel):
    id: str  # Frontend React Flow ID usually string
    node_type: str
    config: Dict[str, Any] = Field(default_factory=dict)
    position_x: int = 0
    position_y: int = 0

class NodeCreate(NodeBase):
    pass

class NodeResponse(NodeBase):
    pipeline_id: int

    class Config:
        orm_mode = True
        from_attributes = True

# -----------------
# Edge Schemas
# -----------------
class EdgeBase(BaseModel):
    id: str
    source_node_id: str
    target_node_id: str
    source_port: Optional[str] = None
    target_port: Optional[str] = None

class EdgeCreate(EdgeBase):
    pass

class EdgeResponse(EdgeBase):
    pipeline_id: int

    class Config:
        orm_mode = True
        from_attributes = True

# -----------------
# Pipeline Schemas
# -----------------
class PipelineBase(BaseModel):
    name: str
    description: Optional[str] = None

class PipelineCreate(PipelineBase):
    pass

class PipelineUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class PipelineResponse(PipelineBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

class PipelineDetailResponse(PipelineResponse):
    nodes: List[NodeResponse] = []
    edges: List[EdgeResponse] = []

# -----------------
# Graph Sync Schema
# -----------------
class GraphSyncRequest(BaseModel):
    nodes: List[NodeCreate]
    edges: List[EdgeCreate]
