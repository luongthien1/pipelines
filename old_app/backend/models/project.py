from sqlalchemy import JSON, Column, DateTime, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..db import Base


class Project(Base):
    """
    Top-level project container linking datasets, models, and pipelines.
    User-facing entity for organizing AI workflows.
    """
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(String, nullable=True)
    
    # Project versioning
    version = Column(String, default="0.0.1")
    
    # Project configuration & custom attributes
    config = Column(JSON, default={})  # Custom project attributes
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships - connect all project entities
    datasets = relationship("Dataset", back_populates="project")
    models = relationship("Model", back_populates="project")
    pipelines = relationship("Pipeline", back_populates="project")
