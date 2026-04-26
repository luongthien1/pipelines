from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from db.migrations.base import Base
from .enums import DatasetTaskStatus, DatasetTaskType


class Dataset(Base):
    """
    Dataset container for organizing related versions.
    """
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(String, nullable=True)
    task = Column(String(100), nullable=True)
    
    # Project link
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    versions = relationship("DatasetVersion", back_populates="dataset", cascade="all, delete-orphan")
    project = relationship("Project", back_populates="datasets")

    __table_args__ = (
        UniqueConstraint('name', 'project_id', name='unique_dataset_per_project'),
    )


class DatasetVersion(Base):
    """
    Versioned dataset snapshot with metadata and processing info.
    """
    __tablename__ = "dataset_versions"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False, index=True)
    
    # Version tracking
    version_name = Column(String, nullable=False)  # v1, v2, v3...
    data_source = Column(String, nullable=False)   # Path to folder containing data
    
    # Dataset characteristics
    data_info = Column(String, default="")  # Description of data content
    preprocessing_steps = Column(String, default="")
    data_purpose = Column(String, default="")
    train_val_test_size = Column(String, default="")  # e.g., "70,20,10"
    output_link = Column(String, nullable=True)  # Where processed data is stored
    
    # Annotations & configuration
    annotations = Column(JSON, default={})  # All annotations for this version
    processing_config = Column(JSON, default={})  # Processing pipeline config

    # Cached unique labels — updated incrementally when items are annotated.
    # Avoids full table scan on every /unique-labels request.
    unique_labels = Column(JSON, default=[])  # e.g. ["cat", "dog", "car"]
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    dataset = relationship("Dataset", back_populates="versions")
    items = relationship("DatasetItem", back_populates="version", cascade="all, delete-orphan")
    tasks = relationship("DatasetTask", back_populates="version", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint('dataset_id', 'version_name', name='unique_version_per_dataset'),
    )


class DatasetItem(Base):
    """
    Individual data sample/file within a dataset version.
    """
    __tablename__ = "dataset_items"

    id = Column(Integer, primary_key=True, index=True)
    version_id = Column(Integer, ForeignKey("dataset_versions.id"), nullable=False, index=True)
    
    file_path = Column(String, nullable=False)  # Local path to file
    original_filename = Column(String)
    
    # Optional: Item-level annotations 
    # (version-level annotations in DatasetVersion are source of truth)
    annotations = Column(JSON, default=[])
    is_empty = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    version = relationship("DatasetVersion", back_populates="items")


class DatasetTask(Base):
    """
    Task/workflow step for dataset processing (upload, labeling, enrichment, validation).
    """
    __tablename__ = "dataset_tasks"

    id = Column(Integer, primary_key=True, index=True)
    version_id = Column(Integer, ForeignKey("dataset_versions.id"), nullable=False, index=True)
    
    name = Column(String, nullable=False)  # "Upload", "Labeling Session Alpha"
    task_type = Column(
        Enum(
            DatasetTaskType,
            native_enum=False,
            values_callable=lambda enum: [member.value for member in enum],
        ),
        nullable=False,
    )  # upload, labeling, enrichment
    status = Column(
        Enum(
            DatasetTaskStatus,
            native_enum=False,
            values_callable=lambda enum: [member.value for member in enum],
        ),
        default=DatasetTaskStatus.PENDING,
        index=True,
    )
    
    order_idx = Column(Integer, default=0)  # Sequence in workflow
    
    # Task configuration (dynamic per task type)
    config = Column(JSON, default={})  # {"labels": ["cat", "dog"], "enrichment_source": "huggingface"}
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    version = relationship("DatasetVersion", back_populates="tasks")
