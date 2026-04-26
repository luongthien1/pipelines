from libs.job.task_base import BaseTask, InputPort, OutputPort, ConfigField
from libs.job.registry import task_registry
from libs.database.connect import SessionMaker
from db.model.pipeline import Pipeline, Node as DbNode
from db.model.run import PipelineRun, NodeRun
import time
import datetime

@task_registry.register
class PipelineInputTask(BaseTask):
    """
    Source node: Khởi tạo giá trị từ tham số đầu vào của toàn bộ Pipeline.
    Cổng ra được sinh tự động dựa trên cấu hình.
    """
    name = "pipeline_input"
    label = "Pipeline Input"
    description = "Defines global pipeline inputs. Its outputs will take values from the run's input parameters."
    category = "system"
    is_dynamic = True

    inputs = []
    outputs = []
    
    config_fields = [
        ConfigField(
            name="exposed_ports", 
            label="Input Parameters", 
            type="textarea", 
            default="input1",
            placeholder="One parameter name per line",
            description="Each line defines a global input parameter for this pipeline."
        ),
    ]

    @classmethod
    def get_dynamic_outputs(cls, config: dict) -> list[OutputPort]:
        ports_str = config.get("exposed_ports", "input1")
        port_names = [p.strip() for p in ports_str.replace(",", "\n").split("\n") if p.strip()]
        return [
            OutputPort(name=name, label=name.capitalize(), type="any")
            for name in port_names
        ]

    def execute(self, inputs: dict, config: dict, **kwargs) -> dict:
        pipeline_run = kwargs.get("pipeline_run")
        if not pipeline_run:
            return {}
        
        # Lấy giá trị từ inputs toàn cục của pipeline run
        global_inputs = getattr(pipeline_run, "inputs", {}) or {}
        
        # Trả về các giá trị tương ứng với cổng đã định nghĩa
        ports_str = config.get("exposed_ports", "input1")
        port_names = [p.strip() for p in ports_str.replace(",", "\n").split("\n") if p.strip()]
        
        return {name: global_inputs.get(name) for name in port_names}


@task_registry.register
class PipelineOutputTask(BaseTask):
    """
    Sink node: Tập hợp các kết quả muốn xuất ra cuối cùng của Pipeline.
    Cổng vào được sinh tự động dựa trên cấu hình.
    """
    name = "pipeline_output"
    label = "Pipeline Output"
    description = "Defines which task results should be exposed as the final pipeline outputs."
    category = "system"
    is_dynamic = True

    inputs = []
    outputs = []
    
    config_fields = [
        ConfigField(
            name="exposed_ports", 
            label="Exposed Outputs", 
            type="textarea", 
            default="result",
            placeholder="One result name per line",
            description="Each input connected here will be collected as a final pipeline output."
        ),
    ]

    @classmethod
    def get_dynamic_inputs(cls, config: dict) -> list[InputPort]:
        ports_str = config.get("exposed_ports", "result")
        port_names = [p.strip() for p in ports_str.replace(",", "\n").split("\n") if p.strip()]
        return [
            InputPort(name=name, label=name.capitalize(), type="any")
            for name in port_names
        ]

    def execute(self, inputs: dict, config: dict, **kwargs) -> dict:
        pipeline_run = kwargs.get("pipeline_run")
        db = kwargs.get("db")
        
        if pipeline_run and db:
            # Cập nhật kết quả đầu ra toàn cục của pipeline run
            current_outputs = dict(getattr(pipeline_run, "outputs", {}) or {})
            current_outputs.update(inputs)
            pipeline_run.outputs = current_outputs
            db.commit()
            
        return inputs

@task_registry.register
class SubPipelineTask(BaseTask):
    """
    Node đại diện cho một Pipeline khác. 
    Cho phép thực thi lồng nhau và tái sử dụng graph.
    """
    name = "sub_pipeline"
    label = "Sub-Pipeline"
    description = "Executes another pipeline as a child process."
    category = "system"
    is_dynamic = True

    config_fields = [
        ConfigField(
            name="sub_pipeline_id", 
            label="Target Pipeline ID", 
            type="number", 
            required=True,
            description="The ID of the pipeline to execute."
        ),
    ]

    @classmethod
    def get_dynamic_inputs(cls, config: dict) -> list[InputPort]:
        # Connect to DB to find the target pipeline's input nodes
        sub_id = config.get("sub_pipeline_id")
        if not sub_id: return []
        
        db = SessionMaker()
        try:
            input_nodes = db.query(DbNode).filter(
                DbNode.pipeline_id == int(sub_id), 
                DbNode.node_type == "pipeline_input"
            ).all()
            
            ports = []
            for node in input_nodes:
                ports_str = node.config.get("exposed_ports", "input1")
                port_names = [p.strip() for p in ports_str.replace(",", "\n").split("\n") if p.strip()]
                for name in port_names:
                    ports.append(InputPort(name=name, label=name.capitalize()))
            return ports
        except:
            return []
        finally:
            db.close()

    @classmethod
    def get_dynamic_outputs(cls, config: dict) -> list[OutputPort]:
        sub_id = config.get("sub_pipeline_id")
        if not sub_id: return []
        
        db = SessionMaker()
        try:
            output_nodes = db.query(DbNode).filter(
                DbNode.pipeline_id == int(sub_id), 
                DbNode.node_type == "pipeline_output"
            ).all()
            
            ports = []
            for node in output_nodes:
                ports_str = node.config.get("exposed_ports", "result")
                port_names = [p.strip() for p in ports_str.replace(",", "\n").split("\n") if p.strip()]
                for name in port_names:
                    ports.append(OutputPort(name=name, label=name.capitalize()))
            return ports
        except:
            return []
        finally:
            db.close()

    def execute(self, inputs: dict, config: dict, **kwargs) -> dict:
        sub_id = int(config.get("sub_pipeline_id", 0))
        if not sub_id:
            raise ValueError("No sub_pipeline_id provided")

        # 1. Start a new PipelineRun
        db = SessionMaker()
        try:
            pipeline = db.get(Pipeline, sub_id)
            if not pipeline: raise ValueError(f"Pipeline {sub_id} not found")
            
            run = PipelineRun(
                pipeline_id=sub_id,
                status="pending",
                priority=getattr(kwargs.get("pipeline_run"), "priority", 0),
                inputs=inputs,
                start_time=datetime.datetime.utcnow()
            )
            db.add(run)
            db.commit()
            db.refresh(run)

            # Initialize NodeRuns
            target_ids = {e.target_node_id for e in pipeline.edges}
            for node in pipeline.nodes:
                status = "pending" if node.id not in target_ids else "waiting"
                n_run = NodeRun(pipeline_run_id=run.id, node_id=node.id, status=status)
                db.add(n_run)
            
            # Record child_run_id in the *parent* node run's outputs so UI can link to it
            parent_node_run_id = kwargs.get("node_run_id")
            if parent_node_run_id:
                parent_node_run = db.get(NodeRun, parent_node_run_id)
                if parent_node_run:
                    parent_node_run.outputs = {"_child_run_id": run.id}
            
            db.commit()

            # 2. Polling for completion
            while True:
                db.refresh(run)
                if run.status in ["success", "failed", "cancelled"]:
                    break
                time.sleep(1)
            
            if run.status != "success":
                raise RuntimeError(f"Sub-pipeline {sub_id} failed with status: {run.status}")
                
            return run.outputs or {}
        finally:
            db.close()
