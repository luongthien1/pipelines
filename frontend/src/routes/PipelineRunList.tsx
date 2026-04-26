import { useState, useEffect } from 'react';
import { Table, Tag, Space, Button, Typography, message, Popconfirm } from 'antd';
import { SyncOutlined, StopOutlined, RetweetOutlined, EyeOutlined } from '@ant-design/icons';
import { getPipelineRuns, cancelPipelineRun } from '../api/pipeline';
import { useNavigate } from 'react-router-dom';
import type { PipelineRun } from '../types/pipeline';
import { NODE_STATUS_COLORS } from '../types/pipeline';

const { Title } = Typography;

export default function PipelineRunList() {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const data = await getPipelineRuns();
      setRuns(data);
    } catch (e) {
      console.error(e);
      message.error('Failed to fetch runs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
    const interval = setInterval(fetchRuns, 5000); // Polling every 5s
    return () => clearInterval(interval);
  }, []);

  const handleCancel = async (id: number) => {
    try {
      await cancelPipelineRun(id);
      message.success('Run cancelled');
      fetchRuns();
    } catch (e) {
      console.error(e);
      message.error('Failed to cancel run');
    }
  };

  const handleView = (id: number) => {
    navigate(`/runs/${id}`);
  };

  const columns = [
    { title: 'Run ID', dataIndex: 'id', width: 80 },
    { title: 'Pipeline', dataIndex: 'pipeline_name', ellipsis: true },
    {
      title: 'Priority',
      dataIndex: 'priority',
      width: 100,
      render: (p: number) => (
        <Tag color={p > 5 ? 'volcano' : 'blue'}>Prio: {p}</Tag>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (status: string) => (
        <Tag color={NODE_STATUS_COLORS[status] || 'default'} icon={status === 'running' ? <SyncOutlined spin /> : null}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Started',
      dataIndex: 'start_time',
      render: (v: string) => v ? new Date(v).toLocaleString() : '-',
    },
    {
      title: 'Duration',
      render: (_: any, record: PipelineRun) => {
        if (!record.start_time) return '-';
        const start = new Date(record.start_time).getTime();
        const end = record.end_time ? new Date(record.end_time).getTime() : Date.now();
        const diff = Math.floor((end - start) / 1000);
        return `${diff}s`;
      }
    },
    {
      title: 'Actions',
      width: 120,
      render: (_: any, record: PipelineRun) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleView(record.id)}>Logs</Button>
          {(record.status === 'pending' || record.status === 'running') && (
            <Popconfirm title="Cancel this run?" onConfirm={() => handleCancel(record.id)}>
              <Button size="small" danger icon={<StopOutlined />}>Cancel</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 24px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Execution History</Title>
        <Button icon={<RetweetOutlined />} onClick={fetchRuns}>Refresh</Button>
      </div>

      <Table
        rowKey="id"
        dataSource={runs}
        columns={columns}
        loading={loading}
        pagination={{ pageSize: 15 }}
      />
    </div>
  );
}
