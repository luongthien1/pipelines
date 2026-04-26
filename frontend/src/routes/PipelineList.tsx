import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, Button, Space, Popconfirm, Modal, Form, Input, Typography, Tag,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ApiOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Pipeline } from '../types/pipeline';
import { getPipelines, createPipeline, updatePipeline, deletePipeline } from '../api/pipeline';

const { Title } = Typography;

export default function PipelineList() {
  const navigate = useNavigate();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);
  const [form] = Form.useForm();

  const fetchPipelines = async () => {
    setLoading(true);
    try {
      const data = await getPipelines();
      setPipelines(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPipelines(); }, []);

  const handleOpenCreate = () => {
    setEditingPipeline(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleOpenEdit = (record: Pipeline) => {
    setEditingPipeline(record);
    form.setFieldsValue({ name: record.name, description: record.description });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingPipeline) {
        await updatePipeline(editingPipeline.id, values);
      } else {
        await createPipeline(values);
      }
      setModalOpen(false);
      fetchPipelines();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deletePipeline(id);
      fetchPipelines();
    } catch (e) {
      console.error(e);
    }
  };

  const columns: ColumnsType<Pipeline> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: 'Name',
      dataIndex: 'name',
      render: (name, record) => (
        <a onClick={() => navigate(`/pipelines/${record.id}`)} style={{ fontWeight: 600 }}>{name}</a>
      ),
    },
    { title: 'Description', dataIndex: 'description', render: (v) => v || <Tag color="default">—</Tag> },
    {
      title: 'Created',
      dataIndex: 'created_at',
      render: (v) => new Date(v).toLocaleString(),
      width: 180,
    },
    {
      title: 'Actions',
      width: 220,
      render: (_, record) => (
        <Space>
          <Button
            icon={<ApiOutlined />}
            size="small"
            onClick={() => navigate(`/pipelines/${record.id}`)}
          >
            Editor
          </Button>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleOpenEdit(record)}>
            Edit
          </Button>
          <Popconfirm
            title="Delete this pipeline?"
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            okType="danger"
          >
            <Button icon={<DeleteOutlined />} size="small" danger>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Pipelines</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
          New Pipeline
        </Button>
      </div>

      <Table
        rowKey="id"
        dataSource={pipelines}
        columns={columns}
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingPipeline ? 'Edit Pipeline' : 'Create Pipeline'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editingPipeline ? 'Update' : 'Create'}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Please enter a name' }]}>
            <Input placeholder="My Pipeline" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea placeholder="Optional description..." rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
