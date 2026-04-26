from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from db.migrations.base import Base


class Model(Base):
    """
    AI Model metadata container.
    Serves as a project for collecting multiple versions/experiments.
    """
    __tablename__ = "models"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(String, nullable=True)
    task = Column(String(100), nullable=True)
    
    # Model classification
    domain = Column(String, default="unknown", index=True)  # computer_vision, nlp, etc.
    owner = Column(String, default="unknown")
    collaborators = Column(String, default="unknown")  # CSV or JSON list
    
    # Tracking
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    versions = relationship("ModelVersion", back_populates="model", cascade="all, delete-orphan")
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    project = relationship("Project", back_populates="models")

    __table_args__ = (
        UniqueConstraint('name', 'project_id', name='unique_model_per_project'),
    )


class ModelVersion(Base):
    """
    Versioned AI model with training lineage and deployment info.
    """
    __tablename__ = "model_versions"

    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer, ForeignKey("models.id"), nullable=False, index=True)
    
    # Version naming & stage
    version_name = Column(String, nullable=False)  # v1, v2, v3...
    stage = Column(String, default="experimental")  # experimental, staging, production
    status_note = Column(String, default="")
    
    # Model weights & architecture
    folder_path = Column(String, nullable=False)  # Path to model weights/artifacts
    base_model = Column(String)  # e.g., "yolov8n", "bert-base"
    architecture_config = Column(JSON, default={})  # Architecture hyperparams
    
    # Metadata
    size = Column(String, default="unknown")  # Model size in MB/GB
    documentation_link = Column(String, nullable=True)
    
    # Training provenance
    trained_dataset_id = Column(Integer, ForeignKey("dataset_versions.id"), nullable=True, index=True)
    trained_pipeline_id = Column(Integer, ForeignKey("pipelines.id"), nullable=True, index=True)
    
    # Performance metrics from training
    training_results = Column(JSON, default={})  # {"accuracy": 0.95, "loss": 0.05...}
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    model = relationship("Model", back_populates="versions")
    trained_dataset = relationship("DatasetVersion")

    __table_args__ = (
        UniqueConstraint('model_id', 'version_name', name='unique_version_per_model'),
    )
