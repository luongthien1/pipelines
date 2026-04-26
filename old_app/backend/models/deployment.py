from sqlalchemy import JSON, Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..db import Base
from .enums import DeploymentStatus


class Deployment(Base):
    """
    Model deployment record tracking where/when a model version was deployed.
    """
    __tablename__ = "deployments"

    id = Column(Integer, primary_key=True, index=True)
    model_version_id = Column(Integer, ForeignKey("model_versions.id"), nullable=True, index=True)
    
    # Deployment details
    inference_pipeline_description = Column(String, default="")
    monitoring_link = Column(String, nullable=True)
    operational_cost = Column(String, default="")
    
    # Status tracking
    status = Column(
        Enum(
            DeploymentStatus,
            native_enum=False,
            values_callable=lambda enum: [member.value for member in enum],
        ),
        default=DeploymentStatus.INACTIVE,
        index=True,
    )
    note = Column(Text, nullable=True)
    
    # Deployment configuration & metrics
    config = Column(JSON, default={})  # {"endpoint": "...", "batch_size": 32}
    metrics = Column(JSON, default={})  # {"qps": 100, "latency_ms": 50}
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deployed_at = Column(DateTime(timezone=True), nullable=True)
    disabled_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    model_version = relationship("ModelVersion", back_populates="deployments")
