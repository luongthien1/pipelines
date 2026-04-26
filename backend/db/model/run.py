from datetime import datetime
from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from db.migrations.base import Base

class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id = Column(Integer, primary_key=True, index=True)
    pipeline_id = Column(Integer, ForeignKey("pipelines.id"), nullable=False)
    status = Column(String, default="pending") # pending, running, success, failed, cancelled
    priority = Column(Integer, default=0) # Higher means more important
    inputs = Column(JSON, default={}) # Global inputs for the pipeline run
    outputs = Column(JSON, default={}) # Global outputs/results of the pipeline run
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)

    pipeline = relationship("Pipeline", back_populates="runs")
    node_runs = relationship("NodeRun", back_populates="pipeline_run", cascade="all, delete-orphan")

class NodeRun(Base):
    __tablename__ = "node_runs"

    id = Column(Integer, primary_key=True, index=True)
    pipeline_run_id = Column(Integer, ForeignKey("pipeline_runs.id"), nullable=False)
    node_id = Column(String, ForeignKey("nodes.id"), nullable=False)
    status = Column(String, default="pending") # waiting, pending, running, success, failed
    logs = Column(String, nullable=True)
    inputs = Column(JSON, default={})
    outputs = Column(JSON, default={})
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)

    pipeline_run = relationship("PipelineRun", back_populates="node_runs")
    node = relationship("Node", back_populates="runs")
