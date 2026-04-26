import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, applyNodeChanges, applyEdgeChanges,
  type Node, type Edge, type OnConnect,
  type OnNodesChange, type OnEdgesChange, Panel,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Button, Drawer, Form, Input, InputNumber, Select, Space, Typography,
  Divider, Tag, Spin, Descriptions, Alert, message, Popover, Dropdown, type MenuProps,
} from 'antd';
import {
  SaveOutlined, PlayCircleOutlined, StopOutlined,
  ArrowLeftOutlined, PlusOutlined, ReloadOutlined, FullscreenOutlined, FullscreenExitOutlined,
} from '@ant-design/icons';
import PipelineFlowNode from '../components/FlowGraph/PipelineFlowNode';
import NodePicker from '../components/FlowGraph/NodePicker';
import type { TaskTypeSchema, PipelineDetail, PipelineRun, NodeRun, Pipeline } from '../types/pipeline';
import { NODE_STATUS_COLORS } from '../types/pipeline';
import {
  getPipeline, syncPipelineGraph, getTaskTypes,
  startPipelineRun, cancelPipelineRun, getRunStatus,
  getTaskInstanceSchema, getPipelines,
} from '../api/pipeline';


const nodeTypes = { pipelineNode: PipelineFlowNode };

type FlowNode = Node & {
  data: {
    node_type: string;
    config: Record<string, unknown>;
    label?: string;
    nodeRun?: NodeRun;
  };
};

export default function PipelineEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { screenToFlowPosition, getNodes } = useReactFlow();
  const pipelineId = Number(id);

  // Graph state
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [pipeline, setPipeline] = useState<PipelineDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Task registry
  const [taskTypes, setTaskTypes] = useState<TaskTypeSchema[]>([]);
  const [allPipelines, setAllPipelines] = useState<Pipeline[]>([]);
  const taskTypeMap = useRef<Map<string, TaskTypeSchema>>(new Map());

  // Right panel: config of selected node
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false);
  const [configForm] = Form.useForm();

  // Run tracking
  const [activeRun, setActiveRun] = useState<PipelineRun | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [priority, setPriority] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Advanced Node Selection State
  const [pickerPos, setPickerPos] = useState<{ x: number, y: number } | null>(null);
  const [pickerFilter, setPickerFilter] = useState<{ type: string, direction: 'source' | 'target' } | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number, y: number } | null>(null);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const draggingHandle = useRef<{ nodeId: string, handleId: string, type: 'source' | 'target' } | null>(null);
  const lastMousePos = useRef<{ x: number, y: number }>({ x: 0, y: 0 });

  // ── Load pipeline and task types ──
  useEffect(() => {
    Promise.all([getPipeline(pipelineId), getTaskTypes(), getPipelines()])
      .then(([data, types, pipelines]) => {
        setPipeline(data);
        setAllPipelines(pipelines.filter(p => p.id !== pipelineId)); // Don't allow self-nesting
        setTaskTypes(types);
        taskTypeMap.current = new Map(types.map(t => [t.name, t]));

        // Pre-fetch dynamic schemas for nodes
        const nodesPromises = data.nodes.map(async (n) => {
          const typeSchema = taskTypeMap.current.get(n.node_type);
          let inputs = typeSchema?.inputs;
          let outputs = typeSchema?.outputs;

          if (typeSchema?.is_dynamic) {
            try {
              const dynamicSchema = await getTaskInstanceSchema(n.node_type, n.config);
              inputs = dynamicSchema.inputs;
              outputs = dynamicSchema.outputs;
            } catch (e) {
              console.error(`Failed to fetch dynamic schema for node ${n.id}`, e);
            }
          }

          return {
            id: n.id,
            type: 'pipelineNode',
            position: { x: n.position_x, y: n.position_y },
            data: {
              node_type: n.node_type,
              config: n.config,
              label: typeSchema?.label ?? n.node_type,
              inputs,
              outputs,
              onViewSubRun: (runId: number) => window.open(`/runs/${runId}`, '_blank'),
            },
          };
        });

        Promise.all(nodesPromises).then(setNodes);

        setEdges(data.edges.map(e => {
          const sourceNode = data.nodes.find(n => n.id === e.source_node_id);
          const sourceSchema = taskTypeMap.current.get(sourceNode?.node_type || '');
          const portType = sourceSchema?.outputs.find(p => p.name === e.source_port)?.type || 'any';
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
            animated: false,
            style: { stroke: edgeColor, strokeWidth: 2 },
          };
        }));
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    return () => stopPolling();
  }, [pipelineId]);

  // ── Graph callbacks ──
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes(nds => applyNodeChanges(changes, nds) as FlowNode[]), []
  );
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges(eds => applyEdgeChanges(changes, eds)), []
  );
  const onConnect: OnConnect = useCallback(
    (params) => {
      const sourceNode = getNodes().find(n => n.id === params.source) as FlowNode | undefined;
      const sourceSchema = taskTypeMap.current.get(sourceNode?.data.node_type || '');
      const portType = sourceSchema?.outputs.find(p => p.name === params.sourceHandle)?.type || 'any';
      const edgeColor = {
        number: '#1677ff',
        string: '#52c41a',
        boolean: '#fa8c16',
        any: '#8c8c8c',
        default: '#722ed1'
      }[portType] || '#8c8c8c';

      return setEdges(eds => addEdge({ 
        ...params, 
        animated: !!activeRun,
        style: { stroke: edgeColor, strokeWidth: 2 }
      }, eds));
    },
    [activeRun, getNodes]
  );

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    const flowNode = node as FlowNode;
    setSelectedNode(flowNode);
    configForm.setFieldsValue(flowNode.data.config ?? {});
    setConfigDrawerOpen(true);
  }, [configForm]);

  const onConnectStart = useCallback((_event: any, { nodeId, handleId, handleType }: any) => {
    draggingHandle.current = { nodeId, handleId, type: handleType };
  }, []);

  const onConnectEnd = useCallback((event: any) => {
    if (!draggingHandle.current) return;
    
    // Suggest ONLY when dragging from a source (output) port
    if (draggingHandle.current.type !== 'source') {
      draggingHandle.current = null;
      return;
    }

    const target = event.target as HTMLElement;
    const isNode = !!target.closest('.react-flow__node');
    const isHandle = !!target.closest('.react-flow__handle');
    
    if (!isNode && !isHandle) {
      const { x, y } = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const sourceNode = getNodes().find(n => n.id === draggingHandle.current?.nodeId) as FlowNode | undefined;
      const sourceSchema = taskTypeMap.current.get(sourceNode?.data.node_type || '');
      
      let filterType = '';
      if (sourceSchema) {
        // Since we only suggest from source, we look for compatible inputs
        filterType = sourceSchema.outputs.find(p => p.name === draggingHandle.current?.handleId)?.type || '';
      }

      setPickerFilter({ type: filterType, direction: 'source' });
      setPickerPos({ x, y });
      // Keep draggingHandle active to auto-connect later
    } else {
      draggingHandle.current = null;
    }
  }, [screenToFlowPosition, getNodes]);

  const onPaneContextMenu = useCallback((event: any) => {
    event.preventDefault();
    setMenuPos({ x: event.clientX, y: event.clientY });
  }, []);

  const handleAddNodeFromMenu = () => {
    if (menuPos) {
      const { x, y } = screenToFlowPosition({ x: menuPos.x, y: menuPos.y });
      setPickerFilter(null);
      setPickerPos({ x, y });
      setMenuPos(null);
    }
  };

  const menuItems: MenuProps['items'] = [
    { key: 'add-node', label: 'Add Node', icon: <PlusOutlined />, onClick: handleAddNodeFromMenu },
  ];

  const onMouseMove = useCallback((event: any) => {
    lastMousePos.current = { x: event.clientX, y: event.clientY };
  }, []);

  // ── Add a new node from palette ──
  const addNode = (taskType: TaskTypeSchema, position?: { x: number, y: number }) => {
    const newId = `n-${Date.now()}`;
    const defaultConfig = Object.fromEntries(
      taskType.config_fields.map(f => [f.name, f.default ?? ''])
    );
    const newNode: FlowNode = {
      id: newId,
      type: 'pipelineNode',
      position: position || { x: 200 + Math.random() * 300, y: 100 + Math.random() * 200 },
      data: { 
        node_type: taskType.name, 
        config: defaultConfig, 
        label: taskType.label,
        inputs: taskType.inputs,
        outputs: taskType.outputs,
        onViewSubRun: (runId: number) => window.open(`/runs/${runId}`, '_blank'),
      },
    };
    setNodes(nds => [...nds, newNode]);
    return newId;
  };

  // ── Save config drawer ──
  const saveNodeConfig = async () => {
    if (!selectedNode) return;
    const values = configForm.getFieldsValue();
    const typeSchema = taskTypeMap.current.get(selectedNode.data.node_type);
    
    let inputs = selectedNode.data.inputs;
    let outputs = selectedNode.data.outputs;

    if (typeSchema?.is_dynamic) {
      try {
        const dynamicSchema = await getTaskInstanceSchema(selectedNode.data.node_type, values);
        inputs = dynamicSchema.inputs;
        outputs = dynamicSchema.outputs;
      } catch (e) {
        message.error("Failed to update dynamic ports");
      }
    }

    setNodes(nds => nds.map(n =>
      n.id === selectedNode.id ? { ...n, data: { ...n.data, config: values, inputs, outputs } } : n
    ));
    setConfigDrawerOpen(false);
  };

  // ── Save graph to backend ──
  const handleSaveGraph = async () => {
    setSaving(true);
    try {
      await syncPipelineGraph(
        pipelineId,
        nodes.map(n => ({
          id: n.id,
          node_type: n.data.node_type,
          config: n.data.config,
          position_x: Math.round(n.position.x),
          position_y: Math.round(n.position.y),
        })),
        edges.map(e => ({
          id: e.id,
          source_node_id: e.source,
          target_node_id: e.target,
          source_port: e.sourceHandle ?? undefined,
          target_port: e.targetHandle ?? undefined,
        }))
      );
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const pollRunStatus = (runId: number) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const status = await getRunStatus(runId);
        setActiveRun(status);
        if (status.node_runs) {
          setNodes(nds => nds.map(n => {
            const nr = status.node_runs!.find(r => r.node_id === n.id);
            return { ...n, data: { ...n.data, nodeRun: nr } };
          }));
          const isRunning = status.status === 'running';
          setEdges(eds => eds.map(e => ({ ...e, animated: isRunning })));
        }
        if (['success', 'failed', 'cancelled'].includes(status.status)) {
          stopPolling();
          setRunLoading(false);
        }
      } catch (e) { console.error(e); }
    }, 2000);
  };

  const handleRun = async () => {
    await handleSaveGraph();
    setRunLoading(true);
    try {
      const run = await startPipelineRun(pipelineId, priority);
      setActiveRun(run);
      pollRunStatus(run.id);
    } catch (e) {
      console.error(e);
      setRunLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!activeRun) return;
    try {
      await cancelPipelineRun(activeRun.id);
      stopPolling();
      const updated = await getRunStatus(activeRun.id);
      setActiveRun(updated);
    } catch (e) { console.error(e); }
  };

  const handleClearRun = () => {
    stopPolling();
    setActiveRun(null);
    setRunLoading(false);
    setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, nodeRun: undefined } })));
    setEdges(eds => eds.map(e => ({ ...e, animated: false })));
  };

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

  const renderConfigFields = () => {
    if (!selectedNode) return null;
    const schema = taskTypeMap.current.get(selectedNode.data.node_type);
    if (!schema || schema.config_fields.length === 0) {
      return <Alert message="No configurable fields for this task." type="info" showIcon />;
    }
    return schema.config_fields.map(field => {
      // Specialized picker for Pipeline Input/Output exposed_ports
      if (selectedNode.data.node_type === 'pipeline_output' || selectedNode.data.node_type === 'pipeline_input') {
        if (field.name === 'exposed_ports') {
          return (
            <Form.Item key={field.name} name={field.name} label={field.label} tooltip={field.description}>
              <Input.TextArea rows={4} placeholder="result_1\nresult_2" />
            </Form.Item>
          );
        }
      }

      // Specialized picker for Sub-pipeline ID
      if (selectedNode.data.node_type === 'sub_pipeline' && field.name === 'sub_pipeline_id') {
        return (
          <Form.Item key={field.name} name={field.name} label="Select Pipeline" rules={[{ required: true }]}>
            <Select 
              showSearch 
              optionFilterProp="label"
              options={allPipelines.map(p => ({ value: p.id, label: p.name }))} 
              placeholder="Pick a pipeline to nest"
            />
          </Form.Item>
        );
      }

      if (field.type === 'number') return (
        <Form.Item key={field.name} name={field.name} label={field.label}
          tooltip={field.description} extra={field.description}>
          <InputNumber style={{ width: '100%' }} placeholder={field.placeholder} />
        </Form.Item>
      );
      if (field.type === 'select') return (
        <Form.Item key={field.name} name={field.name} label={field.label}
          tooltip={field.description}>
          <Select options={field.options} placeholder={field.placeholder} />
        </Form.Item>
      );
      if (field.type === 'textarea') return (
        <Form.Item key={field.name} name={field.name} label={field.label}
          tooltip={field.description}>
          <Input.TextArea rows={3} placeholder={field.placeholder} />
        </Form.Item>
      );
      return (
        <Form.Item key={field.name} name={field.name} label={field.label}
          tooltip={field.description}>
          <Input placeholder={field.placeholder} />
        </Form.Item>
      );
    });
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spin size="large" /></div>;

  const selectedSchema = selectedNode ? taskTypeMap.current.get(selectedNode.data.node_type) : null;

  return (
    <div 
      ref={containerRef}
      onMouseMove={onMouseMove}
      style={{ 
        height: isFullscreen ? '100vh' : 'calc(100vh - 100px)', 
        display: 'flex', 
        flexDirection: 'column',
        position: 'relative',
        background: '#fff'
      }}
    >
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onPaneContextMenu={onPaneContextMenu}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode="Delete"
        >
          <Background />
          <Controls />
          <MiniMap nodeStrokeWidth={3} zoomable pannable />
          
          <Panel position="top-left" style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(255,255,255,0.8)', padding: '8px 12px', borderRadius: 12, backdropFilter: 'blur(8px)', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <Button shape="circle" icon={<ArrowLeftOutlined />} onClick={() => navigate('/pipelines')} />
            <Divider type="vertical" />
            <div style={{ marginRight: 8 }}>
              <Typography.Title level={5} style={{ margin: 0 }}>{pipeline?.name}</Typography.Title>
              {activeRun && (
                <Tag color={NODE_STATUS_COLORS[activeRun.status]} style={{ fontSize: '10px', marginTop: 2, display: 'block' }}>
                  {activeRun.status.toUpperCase()}
                </Tag>
              )}
            </div>
          </Panel>

          <Panel position="top-right" style={{ display: 'flex', gap: 8, background: 'rgba(255,255,255,0.8)', padding: '8px 12px', borderRadius: 12, backdropFilter: 'blur(8px)', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <Button icon={<SaveOutlined />} onClick={handleSaveGraph} loading={saving}>Save</Button>
            <Divider type="vertical" />
            {activeRun && ['running', 'pending'].includes(activeRun.status) ? (
              <Button icon={<StopOutlined />} danger onClick={handleCancel}>Stop</Button>
            ) : (
              <Space.Compact>
                <InputNumber 
                  placeholder="Prio"
                  value={priority} 
                  onChange={v => setPriority(v || 0)} 
                  style={{ width: 70 }}
                  min={0}
                />
                <Button type="primary" icon={<PlayCircleOutlined />} loading={runLoading} onClick={handleRun}>
                  Run
                </Button>
              </Space.Compact>
            )}
            {activeRun && !['running', 'pending'].includes(activeRun.status) && (
              <Button icon={<ReloadOutlined />} onClick={handleClearRun} />
            )}
            <Divider type="vertical" />
            <Button icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} onClick={toggleFullscreen} />
          </Panel>

          {/* Node Picker Popover */}
          <Popover
            open={!!pickerPos}
            onOpenChange={(open) => !open && setPickerPos(null)}
            content={
              <NodePicker 
                taskTypes={taskTypes} 
                pipelines={allPipelines}
                filterType={pickerFilter?.type}
                filterDirection={pickerFilter?.direction}
                onSelect={(task) => {
                  if (pickerPos) {
                    const newNodeId = addNode(task, pickerPos);
                    
                    // Auto-connect if it was a suggestion
                    if (draggingHandle.current) {
                      const { nodeId: sourceId, handleId: sourcePort } = draggingHandle.current;
                      // Find first compatible input port
                      const targetPort = task.inputs.find(p => p.type === pickerFilter?.type)?.name || task.inputs[0]?.name;
                      
                      if (targetPort) {
                        const portType = pickerFilter?.type || 'any';
                        const edgeColor = {
                          number: '#1677ff',
                          string: '#52c41a',
                          boolean: '#fa8c16',
                          any: '#8c8c8c',
                          default: '#722ed1'
                        }[portType] || '#8c8c8c';

                        setEdges(eds => addEdge({
                          id: `e-${Date.now()}`,
                          source: sourceId,
                          sourceHandle: sourcePort,
                          target: newNodeId,
                          targetHandle: targetPort,
                          animated: !!activeRun,
                          style: { stroke: edgeColor, strokeWidth: 2 }
                        }, eds));
                      }
                    }
                    
                    setPickerPos(null);
                    setPickerFilter(null);
                    draggingHandle.current = null;
                  }
                }}
              />
            }
            trigger="click"
            getPopupContainer={() => containerRef.current!}
          >
            <div style={{ position: 'fixed', left: pickerPos ? lastMousePos.current.x : -9999, top: pickerPos ? lastMousePos.current.y : -9999, width: 1, height: 1 }} />
          </Popover>

          {/* Context Menu Dropdown */}
          <Dropdown
            menu={{ items: menuItems }}
            trigger={['contextMenu']}
            open={!!menuPos}
            onOpenChange={(open) => !open && setMenuPos(null)}
            getPopupContainer={() => containerRef.current!}
          >
            <div style={{ position: 'fixed', left: menuPos?.x || 0, top: menuPos?.y || 0, width: 1, height: 1 }} />
          </Dropdown>

          {activeRun && (
            <Panel position="bottom-left">
              <div style={{ background: 'rgba(255,255,255,0.9)', padding: 12, borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: 200, backdropFilter: 'blur(4px)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography.Text strong>Run #{activeRun.id}</Typography.Text>
                  <Button type="link" size="small" onClick={() => setPanelExpanded(!panelExpanded)} style={{ fontSize: 10, padding: 0 }}>
                    {panelExpanded ? 'Collapse' : 'Expand'}
                  </Button>
                </div>
                <Descriptions column={1} size="small" style={{ marginTop: 6 }}>
                  <Descriptions.Item label="Status">
                    <Tag color={NODE_STATUS_COLORS[activeRun.status]}>{activeRun.status}</Tag>
                  </Descriptions.Item>
                  {activeRun.node_runs?.filter(nr => panelExpanded || ['running', 'pending', 'failed'].includes(nr.status)).map(nr => (
                    <Descriptions.Item key={nr.node_id} label={`Node ${nr.node_id.slice(-6)}`}>
                      <Tag color={NODE_STATUS_COLORS[nr.status]}>{nr.status}</Tag>
                    </Descriptions.Item>
                  ))}
                </Descriptions>
                {!panelExpanded && activeRun.node_runs && activeRun.node_runs.filter(nr => !['running', 'pending', 'failed'].includes(nr.status)).length > 0 && (
                  <div style={{ fontSize: 10, color: '#8c8c8c', marginTop: 4, textAlign: 'center' }}>
                    ... and {activeRun.node_runs.filter(nr => !['running', 'pending', 'failed'].includes(nr.status)).length} other nodes
                  </div>
                )}
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>

      <Drawer
        title={selectedSchema ? `Configure: ${selectedSchema.label}` : 'Configure Node'}
        placement="right"
        open={configDrawerOpen}
        onClose={() => setConfigDrawerOpen(false)}
        getContainer={() => containerRef.current!}
        footer={
          <Space>
            <Button onClick={() => setConfigDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={saveNodeConfig}>Apply</Button>
          </Space>
        }
        width={340}
      >
        {selectedSchema && (
          <>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>{selectedSchema.description}</Typography.Text>
            {selectedSchema.inputs.length > 0 && (
              <>
                <Typography.Text strong>Inputs</Typography.Text>
                <div style={{ marginBottom: 8 }}>
                  {selectedSchema.inputs.map(p => (
                    <Tag key={p.name} color="blue">{p.label} ({p.type})</Tag>
                  ))}
                </div>
              </>
            )}
            {selectedSchema.outputs.length > 0 && (
              <>
                <Typography.Text strong>Outputs</Typography.Text>
                <div style={{ marginBottom: 12 }}>
                  {selectedSchema.outputs.map(p => (
                    <Tag key={p.name} color="green">{p.label} ({p.type})</Tag>
                  ))}
                </div>
              </>
            )}
            <Divider>Config</Divider>
          </>
        )}
        <Form form={configForm} layout="vertical">
          {renderConfigFields()}
        </Form>

        {/* Node Run Info Section */}
        {selectedNode?.data?.nodeRun && (
          <div style={{ marginTop: 24 }}>
            <Divider style={{ margin: '16px 0' }}>Run Details</Divider>
            
            {selectedNode.data.nodeRun.outputs && Object.keys(selectedNode.data.nodeRun.outputs).length > 0 && (
              <>
                <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>Outputs</Typography.Text>
                <div style={{ background: '#fafafa', border: '1px solid #d9d9d9', padding: '8px 12px', borderRadius: 6, fontSize: 12, overflowX: 'auto', marginBottom: 16 }}>
                  <pre style={{ margin: 0 }}>
                    {JSON.stringify(selectedNode.data.nodeRun.outputs, null, 2)}
                  </pre>
                </div>
              </>
            )}
            
            {selectedNode.data.nodeRun.logs && (
              <>
                 <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>Execution Logs</Typography.Text>
                 <pre style={{ 
                    background: '#1e1e1e', 
                    color: '#00ff00', 
                    padding: '8px 12px', 
                    borderRadius: 6, 
                    fontSize: 11, 
                    overflowX: 'auto',
                    maxHeight: 300,
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace'
                 }}>
                    {selectedNode.data.nodeRun.logs}
                 </pre>
              </>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
