import os
import shutil

old_frontend = r"E:\Code\Job\self\Pipelines\old_app\frontend\src"
new_frontend = r"E:\Code\Job\self\Pipelines\frontend\src"

# 1. Copy hooks
old_hooks = os.path.join(old_frontend, "hooks")
new_hooks = os.path.join(new_frontend, "hooks")
if not os.path.exists(new_hooks):
    shutil.copytree(old_hooks, new_hooks)
    
# 2. Copy types
old_types = os.path.join(old_frontend, "types")
new_types = os.path.join(new_frontend, "types")
for f in os.listdir(old_types):
    if f == "index.ts":
        shutil.copy(os.path.join(old_types, f), os.path.join(new_types, "index.ts"))

# 3. Copy components
comps_to_copy = [
    "DatasetDetail.tsx", "DatasetForm.tsx", "DatasetList.tsx", "DatasetVersionForm.tsx",
    "LabelingCanvas.tsx", "LabelingStudio.tsx", "Modal.tsx", "ModelDetail.tsx", 
    "ModelForm.tsx", "ModelList.tsx", "ModelVersionForm.tsx", "labeling"
]

old_components = os.path.join(old_frontend, "components")
new_components = os.path.join(new_frontend, "components")

for c in comps_to_copy:
    src = os.path.join(old_components, c)
    dst = os.path.join(new_components, c)
    if os.path.exists(src):
        if os.path.isdir(src):
            if not os.path.exists(dst):
                shutil.copytree(src, dst)
        else:
            shutil.copy(src, dst)

print("Frontend migration complete")
