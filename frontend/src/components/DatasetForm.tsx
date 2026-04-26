import React, { useEffect } from 'react';
import { Form, Input, Select, Button, Space } from 'antd';
import type { Task } from '../types';

interface DatasetFormProps {
  initialValues: {
    name: string;
    description: string;
    task: string;
  };
  tasks: Task[];
  onSubmit: (values: any) => void;
  onCancel: () => void;
  isEditing: boolean;
  loading?: boolean;
}

const DatasetForm: React.FC<DatasetFormProps> = ({
  initialValues,
  tasks,
  onSubmit,
  onCancel,
  isEditing,
  loading,
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    form.setFieldsValue(initialValues);
  }, [initialValues, form]);

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={onSubmit}
      initialValues={initialValues}
      style={{ marginTop: 16 }}
    >
      <Form.Item
        name="name"
        label="Dataset Name"
        rules={[{ required: true, message: 'Please input dataset name' }]}
      >
        <Input placeholder="e.g. Rice Disease Dataset" />
      </Form.Item>

      <Form.Item
        name="task"
        label="Associated Task"
        rules={[{ required: true, message: 'Please select a task' }]}
      >
        <Select placeholder="Select a task">
          {tasks.map((task) => (
            <Select.Option key={task.id} value={task.id}>
              {task.name}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item
        name="description"
        label="Description"
      >
        <Input.TextArea placeholder="Internal note or description" rows={3} />
      </Form.Item>

      <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
        <Space>
          <Button onClick={onCancel}>
            Cancel
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            {isEditing ? 'Update' : 'Create'}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default DatasetForm;

