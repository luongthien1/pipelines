import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Tooltip, Typography, Tag, Button } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { NODE_STATUS_COLORS, NodeRun, NodeType } from '../../types/pipeline';

const { Text } = Typography;

export const PORT_COLORS: Record<string, string> = {
  number: '#1677ff',
  string: '#52c41a',
  boolean: '#fa8c16',
  any: '#8c8c8c',
  default: '#722ed1'
};

interface PipelineNodeData {
  label?: string;
  node_type: NodeType;
  config: Record<string, unknown>;
  inputs?: { name: string, label: string, type: string }[];
  outputs?: { name: string, label: string, type: string }[];
  nodeRun?: NodeRun;
  onConfigChange?: (config: Record<string, unknown>) => void;
  onViewSubRun?: (runId: number) => void;
  [key: string]: unknown;
}

const STATUS_ICONS: Record<string, string> = {
  waiting: '⏳',
  pending: '🟡',
  running: '🔵',
  success: '✅',
  failed: '❌',
  cancelled: '⛔',
};

function PipelineNode({ data, selected }: NodeProps) {
  const nodeData = data as PipelineNodeData;
  const status = nodeData.nodeRun?.status;
  const color = status ? NODE_STATUS_COLORS[status] : '#595959';
  const nodeLabel = nodeData.label ?? nodeData.node_type;

  const border = selected ? '2px solid #1677ff' : `2px solid ${color}`;

  const PortRow = ({ port, type }: { port: { name: string, type: string, label: string }, type: 'source' | 'target' }) => {
    const portColor = PORT_COLORS[port.type] || PORT_COLORS.default;
    const isSource = type === 'source';
    
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: isSource ? 'flex-end' : 'flex-start',
        position: 'relative',
        height: 24, // Consistent row height for alignment
        padding: isSource ? '0 0 0 10px' : '0 10px 0 0'
      }}>
        <Handle
          type={type}
          position={isSource ? Position.Right : Position.Left}
          id={port.name}
          style={{ 
            background: portColor,
            width: 8,
            height: 8,
            border: '2px solid #fff',
            boxShadow: '0 0 2px rgba(0,0,0,0.2)',
            zIndex: 10,
            // Align with center of the row
            [isSource ? 'right' : 'left']: -14, // Hang off the side
            top: '50%',
            transform: 'translateY(-50%)'
          }}
        />
        <Tooltip title={port.type} placement={isSource ? 'right' : 'left'}>
          <Text style={{ fontSize: 10, color: '#333' }}>{port.label || port.name}</Text>
        </Tooltip>
      </div>
    );
  };

  return (
    <div
      style={{
        minWidth: 160,
        maxWidth: 240,
        borderRadius: 8,
        border,
        background: '#fff',
        boxShadow: selected ? '0 0 0 3px rgba(22,119,255,0.2)' : '0 2px 8px rgba(0,0,0,0.12)',
        transition: 'all 0.2s',
        position: 'relative'
      }}
    >
      {/* Header */}
      <div
        style={{
          background: color,
          color: '#fff',
          padding: '6px 10px',
          borderRadius: '6px 6px 0 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        <span>{nodeLabel}</span>
        {status && <span>{STATUS_ICONS[status]}</span>}
      </div>

      {/* Body */}
      <div style={{ padding: '8px 4px', fontSize: 12 }}>
        {/* Ports Labels Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          {/* Inputs Column */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            {nodeData.inputs?.map((p) => (
              <PortRow key={p.name} port={p} type="target" />
            ))}
          </div>

          {/* Outputs Column */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            {nodeData.outputs?.map((p) => (
              <PortRow key={p.name} port={p} type="source" />
            ))}
          </div>
        </div>

        {(nodeData.config as any) && Object.keys(nodeData.config as any).length > 0 && (
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 6, margin: '4px 6px 0 6px' }}>
            {Object.entries(nodeData.config as any).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 4, marginBottom: 2 }}>
                <Text type="secondary" style={{ fontSize: 9 }}>{k}:</Text>
                <Text style={{ fontSize: 9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>{String(v)}</Text>
              </div>
            ))}
          </div>
        )}

        {/* Show child run link if available */}
        {(nodeData.nodeRun?.outputs as any)?._child_run_id && (
          <div style={{ padding: '0 6px' }}>
            <Button 
              size="small" 
              type="primary" 
              ghost 
              block 
              style={{ fontSize: 10, marginTop: 4, height: 22 }}
              onClick={() => nodeData.onViewSubRun?.((nodeData.nodeRun?.outputs as any)?._child_run_id)}
              icon={<PlayCircleOutlined style={{ fontSize: 10 }} />}
            >
              View Sub-run
            </Button>
          </div>
        )}

        {/* Show logs if available */}
        {nodeData.nodeRun?.logs && (
          <div style={{ padding: '0 6px' }}>
            <Tooltip title={<pre style={{ margin: 0, fontSize: 10 }}>{nodeData.nodeRun.logs}</pre>}>
              <Tag color={status === 'failed' ? 'red' : 'green'} style={{ marginTop: 8, fontSize: 9, cursor: 'help', width: '100%', textAlign: 'center', marginInlineEnd: 0 }}>
                {status === 'failed' ? '⚠ Error' : 'View Logs'}
              </Tag>
            </Tooltip>
          </div>
        )}
      </div>
      
      {/* Fallback handles if no metadata available yet */}
      {(!nodeData.inputs || nodeData.inputs.length === 0) && (
        <Handle type="target" position={Position.Left} style={{ top: '50%', background: '#8c8c8c' }} />
      )}
      {(!nodeData.outputs || nodeData.outputs.length === 0) && (
        <Handle type="source" position={Position.Right} style={{ top: '50%', background: '#8c8c8c' }} />
      )}
    </div>
  );
}

export default memo(PipelineNode);
