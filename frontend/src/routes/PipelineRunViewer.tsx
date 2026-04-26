import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow, Background, Controls, MiniMap, Panel,
  type Node, type Edge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button, Drawer, Typography, Tag, Spin, Divider, message } from 'antd';
import { ArrowLeftOutlined, FullscreenOutlined, FullscreenExitOutlined } from '@ant-design/icons';
import PipelineFlowNode from '../components/FlowGraph/PipelineFlowNode';
import type { PipelineDetail, PipelineRun, NodeRun, TaskTypeSchema } from '../types/pipeline';
import { NODE_STATUS_COLORS } from '../types/pipeline';
import { getPipeline, getRunStatus, getTaskTypes } from '../api/pipeline';

const { Title, Text } = Typography;

const nodeTypes = { pipelineNode: PipelineFlowNode };

type FlowNode = Node & {
  data: {
    node_type: string;
    config: Record<string, unknown>;
    label?: string;
    nodeRun?: NodeRun;
  };
};

export default function PipelineRunViewer() {
  const { runId: runIdParam } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const runId = Number(runIdParam);

  // Graph state
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [pipeline, setPipeline] = useState<PipelineDetail | null>(null);
  const [runData, setRunData] = useState<PipelineRun | null>(null);
  const [loading, setLoading] = useState(true);

  // Detail panel state
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const taskTypeMap = useRef<Map<string, TaskTypeSchema>>(new Map());
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);



  useEffect(() => {
    // Initial fetch
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const runRes = await getRunStatus(runId);
        const [pipeRes, typesRes] = await Promise.all([
          getPipeline(runRes.pipeline_id),
          getTaskTypes(),
        ]);

        if (!mounted) return;

        setRunData(runRes);
        setPipeline(pipeRes);
        taskTypeMap.current = new Map(typesRes.map(t => [t.name, t]));

        const typeSchemas = new Map(typesRes.map(t => [t.name, t]));
        
        const isRunning = runRes.status === 'running' || runRes.status === 'pending';
        setEdges(pipeRes.edges.map(e => {
          const sourceNode = pipeRes.nodes.find(n => n.id === e.source_node_id);
          const sourceSchema = typeSchemas.get(sourceNode?.node_type || '');
          const portType = sourceSchema?.outputs.find(p => p.name === e.source_port)?.type || 'any';
          
          // Import PORT_COLORS if needed or redefine
          const edgeColor = {
            number: '#1677ff',
            string: '#52c41a',
            boolean: '#fa8c16',
            any: '#8c8c8c',
            default: '#722ed1'
          }[portType] || '#8c8c8c';

          return {
            id: e.id,
            source: e.source_node_id,
            target: e.target_node_id,
            sourceHandle: e.source_port,
            targetHandle: e.target_port,
            animated: isRunning,
            style: { stroke: edgeColor, strokeWidth: 2 },
          };
        }));

        setNodes(pipeRes.nodes.map(n => {
          const nr = runRes.node_runs?.find(r => r.node_id === n.id);
          const typeSchema = typeSchemas.get(n.node_type);
          return {
            id: n.id,
            type: 'pipelineNode',
            position: { x: n.position_x, y: n.position_y },
            draggable: false, // Read only
            connectable: false, // Read only
            data: {
              node_type: n.node_type,
              config: n.config,
              label: typeSchema?.label ?? n.node_type,
              inputs: typeSchema?.inputs,
              outputs: typeSchema?.outputs,
              nodeRun: nr,
            },
          };
        }));
        
        // Start polling if still pending or running
        if (isRunning) {
          pollRef.current = setInterval(async () => {
            try {
              const updatedRun = await getRunStatus(runId);
              setRunData(updatedRun);
              
              setNodes(prev => prev.map(n => {
                const nr = updatedRun.node_runs?.find(r => r.node_id === n.id);
                return { ...n, data: { ...n.data, nodeRun: nr } };
              }));

              const curRunning = updatedRun.status === 'running' || updatedRun.status === 'pending';
              setEdges(prev => prev.map(e => ({ ...e, animated: curRunning })));

              if (!curRunning && pollRef.current) {
                clearInterval(pollRef.current);
              }
            } catch (err) {
              console.error(err);
            }
          }, 2000);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [runId]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        message.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    const flowNode = node as FlowNode;
    setSelectedNode(flowNode);
    setDrawerOpen(true);
  }, []);



  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spin size="large" /></div>;

  const selectedSchema = selectedNode ? taskTypeMap.current.get(selectedNode.data.node_type) : null;
  const selectedNodeRun = selectedNode?.data.nodeRun;

  return (
    <div 
      ref={containerRef}
      style={{ 
        height: isFullscreen ? '100vh' : 'calc(100vh - 100px)', 
        display: 'flex', 
        flexDirection: 'column',
        position: 'relative',
        background: '#fff'
      }}
    >
      {/* Canvas */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
        >
          <Background />
          <Controls />
          <MiniMap nodeStrokeWidth={3} zoomable pannable />

          {/* Floating Top Bar - Left */}
          <Panel position="top-left" style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(255,255,255,0.8)', padding: '8px 12px', borderRadius: 12, backdropFilter: 'blur(8px)', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <Button shape="circle" icon={<ArrowLeftOutlined />} onClick={() => navigate('/runs')} />
            <Divider type="vertical" />
            <div style={{ marginRight: 8 }}>
              <Title level={5} style={{ margin: 0 }}>Run #{runId}</Title>
              <Text type="secondary" style={{ fontSize: '11px' }}>{pipeline?.name}</Text>
            </div>
            {runData && (
              <Tag color={NODE_STATUS_COLORS[runData.status]}>{runData.status.toUpperCase()}</Tag>
            )}
          </Panel>

          {/* Floating Top Bar - Right */}
          <Panel position="top-right" style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(255,255,255,0.8)', padding: '8px 12px', borderRadius: 12, backdropFilter: 'blur(8px)', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            {runData && ['running', 'pending'].includes(runData.status) && (
              <>
                <Spin size="small" />
                <Text type="secondary" style={{ fontSize: '12px' }}>Live</Text>
              </>
            )}
            <Divider type="vertical" />
            <Button 
              icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} 
              onClick={toggleFullscreen} 
            />
          </Panel>
        </ReactFlow>
      </div>

      {/* Logs Drawer */}
      <Drawer
        title={`Logs: ${selectedSchema?.label || 'Node'}`}
        placement="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        getContainer={() => containerRef.current!}
        width={500}
      >
        {selectedNodeRun ? (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>Status: </Text>
              <Tag color={NODE_STATUS_COLORS[selectedNodeRun.status]}>{selectedNodeRun.status.toUpperCase()}</Tag>
              {selectedNodeRun.start_time && (
                <Text type="secondary" style={{ marginLeft: 8 }}>
                   Started at {new Date(selectedNodeRun.start_time).toLocaleTimeString()}
                </Text>
              )}
            </div>

            <Typography.Title level={5}>Runtime Logs</Typography.Title>
            <pre style={{ 
              background: '#fafafa', 
              padding: 12, 
              borderRadius: 4, 
              whiteSpace: 'pre-wrap',
              border: '1px solid #e8e8e8',
              maxHeight: 400,
              overflowY: 'auto'
            }}>
              {selectedNodeRun.logs || 'No logs available.'}
            </pre>

            <Typography.Title level={5} style={{ marginTop: 24 }}>Inputs Received</Typography.Title>
            <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
              {JSON.stringify(selectedNodeRun.inputs || {}, null, 2)}
            </pre>

            <Typography.Title level={5} style={{ marginTop: 24 }}>Outputs Generated</Typography.Title>
            <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
              {JSON.stringify(selectedNodeRun.outputs || {}, null, 2)}
            </pre>
            
            <Typography.Title level={5} style={{ marginTop: 24 }}>Initial Config</Typography.Title>
            <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
              {JSON.stringify(selectedNode.data.config || {}, null, 2)}
            </pre>
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginTop: 40 }}>
             <Text type="secondary">This node has not started yet.</Text>
             <br/><br/>
             <Typography.Title level={5}>Config Setup</Typography.Title>
             <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, textAlign: 'left' }}>
               {JSON.stringify(selectedNode?.data.config || {}, null, 2)}
             </pre>
          </div>
        )}
      </Drawer>
    </div>
  );
}
