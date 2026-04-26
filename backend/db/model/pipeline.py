from datetime import datetime
from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from db.migrations.base import Base

class Pipeline(Base):
    __tablename__ = "pipelines"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    nodes = relationship("Node", back_populates="pipeline", cascade="all, delete-orphan")
    edges = relationship("Edge", back_populates="pipeline", cascade="all, delete-orphan")
    runs = relationship("PipelineRun", back_populates="pipeline", cascade="all, delete-orphan")


class Node(Base):
    __tablename__ = "nodes"

    id = Column(String, primary_key=True, index=True) # UUID or React Flow ID
    pipeline_id = Column(Integer, ForeignKey("pipelines.id"), nullable=False)
    node_type = Column(String, nullable=False) # e.g., 'start', 'process', 'save'
    config = Column(JSON, default={})
    position_x = Column(Integer, default=0)
    position_y = Column(Integer, default=0)

    pipeline = relationship("Pipeline", back_populates="nodes")
    runs = relationship("NodeRun", back_populates="node", cascade="all, delete-orphan")


class Edge(Base):
    __tablename__ = "edges"

    id = Column(String, primary_key=True, index=True) # UUID or React Flow Edge ID
    pipeline_id = Column(Integer, ForeignKey("pipelines.id"), nullable=False)
    source_node_id = Column(String, ForeignKey("nodes.id"), nullable=False)
    target_node_id = Column(String, ForeignKey("nodes.id"), nullable=False)
    source_port = Column(String, nullable=True)
    target_port = Column(String, nullable=True)

    pipeline = relationship("Pipeline", back_populates="edges")

    # Mối quan hệ để dễ tìm nodes liên kết
    source_node = relationship("Node", foreign_keys=[source_node_id])
    target_node = relationship("Node", foreign_keys=[target_node_id])
