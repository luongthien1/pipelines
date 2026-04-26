import os

from core.config import Settings
from fastapi import APIRouter
from fastapi.responses import FileResponse

from .counter import router as counter_router
from .pipelines import router as pipelines_router
from .runs import router as runs_router
from .task_types import router as task_types_router
from .datasets import router as datasets_router
from .models import router as models_router
from .configs import router as configs_router

router = APIRouter()
router.include_router(counter_router, prefix="/counter", tags=["Counter"])
router.include_router(pipelines_router, prefix="/pipelines", tags=["Pipelines"])
router.include_router(runs_router, prefix="/runs", tags=["Runs"])
router.include_router(task_types_router, prefix="/task-types", tags=["Task Types"])
router.include_router(datasets_router, prefix="/datasets", tags=["Datasets"])
router.include_router(models_router, prefix="/models", tags=["Models"])
router.include_router(configs_router, prefix="/configs", tags=["Configs"])



@router.get("/files/{file_path}")
def get_image(file_path: str):
    path = os.path.join(Settings.media_dir, file_path)
    return FileResponse(path)
