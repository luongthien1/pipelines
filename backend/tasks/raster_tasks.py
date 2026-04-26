from libs.job.task_base import BaseTask, InputPort, OutputPort, ConfigField
from libs.job.registry import task_registry
from make_task import raster

@task_registry.register
class RasterMergeTask(BaseTask):
    """Gộp nhiều file GeoTIFF thành một file duy nhất (mosaic)."""
    name = "raster_merge"
    label = "Raster Merge"
    description = "Merges multiple TIFF files into a single mosaic GeoTIFF."
    category = "raster"

    inputs = [
        InputPort(name="file_paths", label="TIFF Paths", type="any", required=True, description="List of file paths to merge."),
    ]
    outputs = [
        OutputPort(name="output_path", label="Merged TIFF Path", type="string"),
    ]
    config_fields = [
        ConfigField(name="output_filename", label="Output Filename", type="string", default="mosaic.tif"),
    ]

    def execute(self, inputs: dict, config: dict) -> dict:
        files = inputs["file_paths"]
        output_name = config.get("output_filename", "mosaic.tif")
        
        # We need a temporary or permanent place to store this
        # For now we'll just use the current directory or a configured output dir
        output_path = f"./data/raster/{output_name}"
        
        raster.merge_tiffs(files, output_path)
        return {"output_path": output_path}

@task_registry.register
class RasterClipTask(BaseTask):
    """Cắt ảnh Raster bằng ranh giới của một dữ liệu Vector (GeoDataFrame)."""
    name = "raster_clip"
    label = "Raster Clip"
    description = "Clips a raster file using a GeoDataFrame boundary."
    category = "raster"

    inputs = [
        InputPort(name="raster_path", label="Raster Path", type="string", required=True),
        InputPort(name="gdf", label="Mask GDF", type="any", required=True),
    ]
    outputs = [
        OutputPort(name="clipped_path", label="Clipped Path", type="string"),
    ]

    def execute(self, inputs: dict, config: dict) -> dict:
        raster_path = inputs["raster_path"]
        gdf = inputs["gdf"]
        
        output_path = raster_path.replace(".tif", "_clipped.tif")
        raster.clip_raster_by_gdf(raster_path, gdf, output_path)
        
        return {"clipped_path": output_path}
