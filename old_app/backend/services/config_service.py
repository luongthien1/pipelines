from typing import Any, Dict, List

from ..funcs.basemodel.architecture import get_model_architectures


class ConfigService:
    @staticmethod
    def get_tasks() -> List[Dict[str, str]]:
        """
        Returns a list of available AI tasks.
        In a real application, this could come from a database.
        """
        return [
            {"id": "image_classification", "name": "Image Classification"},
            {"id": "object_detection", "name": "Object Detection"},
            {"id": "semantic_segmentation", "name": "Semantic Segmentation"},
            {"id": "instance_segmentation", "name": "Instance Segmentation"},
            {"id": "text_classification", "name": "Text Classification"},
            {"id": "named_entity_recognition", "name": "Named Entity Recognition"},
            {"id": "sentiment_analysis", "name": "Sentiment Analysis"},
            {"id": "speech_recognition", "name": "Speech Recognition"},
            {"id": "tabular_regression", "name": "Tabular Regression"},
            {"id": "tabular_classification", "name": "Tabular Classification"},
        ]

    @staticmethod
    def get_model_architectures() -> List[Dict[str, Any]]:
        return get_model_architectures()

config_service = ConfigService()
