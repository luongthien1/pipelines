from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..db import Base
from .enums import PipelineStatus, PipelineType


class Pipeline(Base):
    """
    Training/inference pipeline execution record.
    Tracks workflow: dataset → model training/inference → metrics & logs.
    """
    __tablename__ = "pipelines"

    id = Column(Integer, primary_key=True, index=True)
    
    # Pipeline identity & control
    name = Column(String, nullable=True)
    type = Column(
        Enum(
            PipelineType,
            native_enum=False,
            values_callable=lambda enum: [member.value for member in enum],
        ),
        nullable=False,
    )  # training, inference, etc.
    status = Column(
        Enum(
            PipelineStatus,
            native_enum=False,
            values_callable=lambda enum: [member.value for member in enum],
        ),
        default=PipelineStatus.PENDING,
        index=True,
        nullable=False,
    )
    
    # Relationships to other entities
    dataset_version_id = Column(Integer, ForeignKey("dataset_versions.id"), nullable=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
    
    # Pipeline configuration & metadata
    base_model = Column(String, default="unknown")
    repo_link = Column(String, nullable=True)
    
    # Hyperparameters & config (JSON for flexibility)
    config = Column(JSON, default={})  # {"learning_rate": 0.001, "batch_size": 32, ...}
    
    # Performance metrics
    metrics = Column(JSON, default={})  # {"accuracy": 0.95, "loss": 0.05, ...}
    
    # Numeric metrics for easy querying
    learning_rate = Column(Float, nullable=True)
    batch_size = Column(Integer, nullable=True)
    num_epochs = Column(Integer, nullable=True)
    
    # Infrastructure & execution details
    infra = Column(JSON, default={})  # {"gpu_count": 2, "memory_gb": 16, "node": "gpu-01"}
    
    # Logs & output
    log = Column(Text, nullable=True)  # Full execution log
    experiment_logs = Column(String, nullable=True)  # Path to detailed logs
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    dataset_version = relationship("DatasetVersion", back_populates="pipelines")
    project = relationship("Project", back_populates="pipelines")
    model_versions = relationship("ModelVersion", back_populates="training_pipeline")
    tasks = relationship("Task", back_populates="pipeline", cascade="all, delete-orphan")

class Task(Base):
    """
    A specific step within a pipeline.
    Tasks can be chained: previous_task -> current_task.
    """
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    pipeline_id = Column(Integer, ForeignKey("pipelines.id"), nullable=False, index=True)
    previous_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    
    task_type = Column(String, nullable=False) # training, preprocessing, etc.
    status = Column(String, default="pending") # pending, running, completed, failed
    folder_path = Column(String, nullable=True) # Storage path for task artifacts
    
    config = Column(JSON, default={}) # Static configuration
    input_data = Column(JSON, default={}) # Dynamic input (from previous task or manual)
    output_data = Column(JSON, default={}) # Result of task execution
    
    log = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    pipeline = relationship("Pipeline", back_populates="tasks")
    previous_task = relationship("Task", remote_side=[id], backref="next_tasks")
