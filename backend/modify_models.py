import os
import shutil

src_dir = r"E:\Code\Job\self\Pipelines\old_app\backend\models"
dest_dir = r"E:\Code\Job\self\Pipelines\backend\db\model"

files_to_copy = ["project.py", "dataset.py", "model.py", "enums.py"]

for f in files_to_copy:
    src = os.path.join(src_dir, f)
    dst = os.path.join(dest_dir, f)
    shutil.copy(src, dst)
    
    with open(dst, "r", encoding="utf-8") as file:
        content = file.read()
    
    content = content.replace("from ..db import Base", "from db.migrations.base import Base")
    content = content.replace("from .pipeline import Pipeline", "# from .pipeline import Pipeline") 
    # In model.py, "pipelines = relationship('Pipeline', ...)" uses string, so we don't strictly need to import Pipeline.
    
    with open(dst, "w", encoding="utf-8") as file:
        file.write(content)

# Update __init__.py
init_path = os.path.join(dest_dir, "__init__.py")
with open(init_path, "a", encoding="utf-8") as file:
    file.write("\nfrom .project import Project\nfrom .dataset import Dataset, DatasetVersion, DatasetItem, DatasetTask\nfrom .model import Model, ModelVersion\n__all__.extend(['Project', 'Dataset', 'DatasetVersion', 'DatasetItem', 'DatasetTask', 'Model', 'ModelVersion'])\n")
