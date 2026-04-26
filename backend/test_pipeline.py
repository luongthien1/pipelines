import logging
logging.basicConfig(level=logging.INFO)

from db.model.pipeline import Pipeline, Node, Edge
from libs.database.connect import SessionMaker
from api.pipelines import sync_pipeline_graph
from schemas.pipeline import GraphSyncRequest, NodeCreate, EdgeCreate
from api.runs import start_pipeline_run
from worker import _scan_and_run

def test_pipeline():
    session = SessionMaker()
    
    # 1. Create pipeline
    pipe = Pipeline(name="Math Pipeline")
    session.add(pipe)
    session.commit()
    session.refresh(pipe)
    print(f"Created Pipeline ID: {pipe.id}")

    # 2. Add Graph
    sync_req = GraphSyncRequest(
        nodes=[
            NodeCreate(id="n1", node_type="random_number", config={"min": 1, "max": 10}),
            NodeCreate(id="n2", node_type="random_number", config={"min": 20, "max": 30}),
            NodeCreate(id="n3", node_type="math_add", config={}),
            NodeCreate(id="n4", node_type="print_log", config={"message": "Final result:"})
        ],
        edges=[
            EdgeCreate(id="e1", source_node_id="n1", target_node_id="n3", source_port="number", target_port="val1"),
            EdgeCreate(id="e2", source_node_id="n2", target_node_id="n3", source_port="number", target_port="val2"),
            EdgeCreate(id="e3", source_node_id="n3", target_node_id="n4", source_port="result", target_port="data")
        ]
    )
    sync_pipeline_graph(pipe.id, sync_req, session)
    print("Graph Synced")

    # 3. Start Run
    run = start_pipeline_run(pipe.id, session)
    print(f"Run Started ID: {run.id}")

    # 4. Trigger Worker
    print("--- Worker Scanning ---")
    for _ in range(5):
        _scan_and_run()
    
    print("--- Check Status ---")
    session.refresh(run)
    print(f"Pipeline Run Status: {run.status}")
    for nr in run.node_runs:
        print(f"Node {nr.node_id}: {nr.status} \n Inputs: {nr.inputs}\n Outputs: {nr.outputs}")

if __name__ == "__main__":
    test_pipeline()
