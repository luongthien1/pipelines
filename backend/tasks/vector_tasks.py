import geopandas as gpd
from libs.job.task_base import BaseTask, InputPort, OutputPort, ConfigField
from libs.job.registry import task_registry
from make_task import vector

@task_registry.register
class VectorClipTask(BaseTask):
    """Cắt dữ liệu vector nguồn bằng một dữ liệu vector khác (clip)."""
    name = "vector_clip"
    label = "Vector Clip"
    description = "Clips a source GeoDataFrame by a mask GeoDataFrame."
    category = "vector"

    inputs = [
        InputPort(name="source", label="Source GDF", type="any", required=True, description="The vector data to be clipped."),
        InputPort(name="mask", label="Mask GDF", type="any", required=True, description="The clipping boundary."),
    ]
    outputs = [
        OutputPort(name="clipped", label="Clipped GDF", type="any"),
    ]
    config_fields = [
        ConfigField(name="batch_size", label="Batch Size", type="number", default=1000, description="Processing batch size for large datasets."),
    ]

    def execute(self, inputs: dict, config: dict) -> dict:
        gdf_src = inputs["source"]
        gdf_mask = inputs["mask"]
        batch_size = int(config.get("batch_size", 1000))
        
        # Ensure they are GeoDataFrames
        if not isinstance(gdf_src, gpd.GeoDataFrame) or not isinstance(gdf_mask, gpd.GeoDataFrame):
            raise TypeError("Inputs must be GeoDataFrames")
            
        result = vector.clip(gdf_src, gdf_mask, batch_size=batch_size)
        return {"clipped": result}

@task_registry.register
class VectorBufferTask(BaseTask):
    """Tạo vùng đệm (buffer) quanh các đối tượng vector."""
    name = "vector_buffer"
    label = "Vector Buffer"
    description = "Creates a buffer around geometries with a specified distance."
    category = "vector"

    inputs = [
        InputPort(name="gdf", label="Input GDF", type="any", required=True),
    ]
    outputs = [
        OutputPort(name="buffered", label="Buffered GDF", type="any"),
    ]
    config_fields = [
        ConfigField(name="distance", label="Distance (m)", type="number", default=100.0, description="Buffer distance in meters."),
        ConfigField(name="resolution", label="Resolution", type="number", default=8, description="Number of segments used to approximate a quarter circle."),
    ]

    def execute(self, inputs: dict, config: dict) -> dict:
        gdf = inputs["gdf"]
        dist = float(config.get("distance", 100.0))
        res = int(config.get("resolution", 8))
        
        result = vector.buffer(gdf, distance_m=dist, resolution=res)
        return {"buffered": result}

@task_registry.register
class VectorAddAreaTask(BaseTask):
    """Tính toán và thêm cột diện tích (area) cho dữ liệu vector."""
    name = "vector_add_area"
    label = "Vector Add Area"
    description = "Calculates geodesic area for each geometry and adds it as an 'area' column."
    category = "vector"

    inputs = [
        InputPort(name="gdf", label="Input GDF", type="any", required=True),
    ]
    outputs = [
        OutputPort(name="gdf_with_area", label="GDF with Area", type="any"),
    ]

    def execute(self, inputs: dict, config: dict) -> dict:
        gdf = inputs["gdf"]
        result = vector.add_area(gdf)
        return {"gdf_with_area": result}
