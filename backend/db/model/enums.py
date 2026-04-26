"""
Enums for model validation and type safety.
"""

from enum import Enum as PyEnum


class PipelineType(str, PyEnum):
    """Pipeline execution types."""
    TRAINING = "training"
    INFERENCE = "inference"
    TESTING = "testing"
    VALIDATION = "validation"


class PipelineStatus(str, PyEnum):
    """Pipeline execution status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class DatasetType(str, PyEnum):
    """Dataset content types."""
    UNKNOWN = "unknown"
    IMAGE = "image"
    TEXT = "text"
    AUDIO = "audio"
    VIDEO = "video"
    GEOSPATIAL = "geospatial"
    TABULAR = "tabular"
    TIME_SERIES = "time_series"
    MULTIMODAL = "multimodal"


class DatasetDomain(str, PyEnum):
    """Dataset domain/application area."""
    UNKNOWN = "unknown"
    COMPUTER_VISION = "computer_vision"
    NLP = "nlp"
    AUDIO = "audio"
    VIDEO = "video"
    GEOSPATIAL = "geospatial"
    TABULAR = "tabular"
    TIME_SERIES = "time_series"
    MULTIMODAL = "multimodal"


class DatasetTaskType(str, PyEnum):
    """Dataset task types."""
    UPLOAD = "upload"
    LABELING = "labeling"
    ENRICHMENT = "enrichment"
    VALIDATION = "validation"
    PREPROCESSING = "preprocessing"


class DatasetTaskStatus(str, PyEnum):
    """Dataset task execution status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ModelStage(str, PyEnum):
    """Model development stage."""
    EXPERIMENTAL = "experimental"
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    ARCHIVED = "archived"


class DeploymentStatus(str, PyEnum):
    """Deployment status."""
    INACTIVE = "inactive"
    ACTIVE = "active"
    FAILED = "failed"
    SUSPENDED = "suspended"
