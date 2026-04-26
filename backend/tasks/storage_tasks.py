from libs.job.task_base import BaseTask, InputPort, OutputPort, ConfigField
from libs.job.registry import task_registry
from make_task import s3, utils

@task_registry.register
class S3DownloadTask(BaseTask):
    """Tải file từ S3 (hoặc MinIO) về máy local."""
    name = "s3_download"
    label = "S3 Download"
    description = "Downloads a file from S3 bucket to local path."
    category = "storage"

    inputs = []
    outputs = [
        OutputPort(name="local_path", label="Local Path", type="string"),
    ]
    config_fields = [
        ConfigField(name="s3_path", label="S3 Key/Path", type="string", required=True),
        ConfigField(name="local_dest", label="Local Destination", type="string", default="./data/temp/downloaded.file"),
    ]

    def execute(self, inputs: dict, config: dict) -> dict:
        s3_path = config["s3_path"]
        local_path = config.get("local_dest", "./data/temp/downloaded.file")
        
        s3.download(s3_path, local_path, replace=True)
        return {"local_path": local_path}

@task_registry.register
class S3UploadTask(BaseTask):
    """Tải file từ local lên S3 (hoặc MinIO)."""
    name = "s3_upload"
    label = "S3 Upload"
    description = "Uploads a local file to S3 bucket."
    category = "storage"

    inputs = [
        InputPort(name="local_path", label="Local Path", type="string", required=True),
    ]
    outputs = [
        OutputPort(name="s3_url", label="S3 URL/Key", type="string"),
    ]
    config_fields = [
        ConfigField(name="s3_dest", label="S3 Destination Key", type="string", required=True),
    ]

    def execute(self, inputs: dict, config: dict) -> dict:
        local_path = inputs["local_path"]
        s3_path = config["s3_dest"]
        
        s3.upload(local_path, s3_path)
        return {"s3_url": s3_path}

@task_registry.register
class UnzipTask(BaseTask):
    """Giải nén file ZIP."""
    name = "unzip"
    label = "Unzip File"
    description = "Extracts all files from a ZIP archive."
    category = "utils"

    inputs = [
        InputPort(name="zip_path", label="ZIP Path", type="string", required=True),
    ]
    outputs = [
        OutputPort(name="extracted_dir", label="Extracted Dir", type="string"),
    ]
    config_fields = [
        ConfigField(name="output_dir", label="Output Directory", type="string", default="./data/temp/extracted"),
    ]

    def execute(self, inputs: dict, config: dict) -> dict:
        zip_path = inputs["zip_path"]
        output_dir = config.get("output_dir", "./data/temp/extracted")
        
        utils.unzip_safe(zip_path, output_dir)
        return {"extracted_dir": output_dir}
