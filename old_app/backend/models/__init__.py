"""
SQLAlchemy models for the AI platform.
Organized by domain:
- Project: Top-level project container
- Dataset: Dataset versions and items
- Model: AI model versions and deployments
- Pipeline: Training/inference workflow execution
"""

from .dataset import Dataset, DatasetItem, DatasetTask, DatasetVersion
from .deployment import Deployment
from .enums import (
    DatasetDomain,
    DatasetTaskStatus,
    DatasetTaskType,
    DatasetType,
    DeploymentStatus,
    ModelStage,
    PipelineStatus,
    PipelineType,
)
from .model import Model, ModelVersion
from .pipeline import Pipeline
from .project import Project

__all__ = [
    # Models
    "Project",
    "Dataset",
    "DatasetVersion",
    "DatasetItem",
    "DatasetTask",
    "Model",
    "ModelVersion",
    "Pipeline",
    "Deployment",
    # Enums
    "PipelineType",
    "PipelineStatus",
    "DatasetType",
    "DatasetDomain",
    "DatasetTaskType",
    "DatasetTaskStatus",
    "ModelStage",
    "DeploymentStatus",
]
