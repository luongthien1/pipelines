import os
import shutil

old_app_services = r"E:\Code\Job\self\Pipelines\old_app\backend\services"
old_app_routers = r"E:\Code\Job\self\Pipelines\old_app\backend\routers"

backend_services = r"E:\Code\Job\self\Pipelines\backend\services"
backend_api = r"E:\Code\Job\self\Pipelines\backend\api"

os.makedirs(backend_services, exist_ok=True)

# 1. Services
services_to_copy = ["dataset_service.py", "training_service.py"]
for f in services_to_copy:
    src = os.path.join(old_app_services, f)
    dst = os.path.join(backend_services, f)
    if os.path.exists(src):
        shutil.copy(src, dst)
        with open(dst, "r", encoding="utf-8") as file:
            content = file.read()
        content = content.replace("from ..models.dataset", "from db.model.dataset")
        content = content.replace("from ..models.model", "from db.model.model")
        content = content.replace("from ..db import get_db", "from libs.database.connect import get_db")
        with open(dst, "w", encoding="utf-8") as file:
            file.write(content)

# 2. Routers -> APIs
routers_to_copy = ["datasets.py", "models.py"]
for f in routers_to_copy:
    src = os.path.join(old_app_routers, f)
    dst = os.path.join(backend_api, f)
    if os.path.exists(src):
        shutil.copy(src, dst)
        with open(dst, "r", encoding="utf-8") as file:
            content = file.read()
        content = content.replace("from ..models.dataset", "from db.model.dataset")
        content = content.replace("from ..models.model", "from db.model.model")
        content = content.replace("from ..db import get_db", "from libs.database.connect import get_db")
        content = content.replace("from ..services.dataset_service", "from services.dataset_service")
        content = content.replace("from ..services.training_service", "from services.training_service")
        content = content.replace("from ..models.pipeline", "from db.model.pipeline")
        content = content.replace("from ..services.background_task_manager", "from services.background_task_manager")
        with open(dst, "w", encoding="utf-8") as file:
            file.write(content)

# Also copy background_task_manager if models.py needs it
bgtask = os.path.join(old_app_services, "background_task_manager.py")
if os.path.exists(bgtask):
    shutil.copy(bgtask, os.path.join(backend_services, "background_task_manager.py"))
