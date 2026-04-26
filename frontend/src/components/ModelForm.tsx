import React, { useEffect } from 'react';
import { Form, Input, Select, Button, Space } from 'antd';
import type { Task } from '../types';

interface ModelFormProps {
  initialValues: {
    name: string;
    description: string;
    task: string;
  };
  tasks: Task[];
  onSubmit: (values: any) => void;
  onCancel: () => void;
  loading?: boolean;
}

const ModelForm: React.FC<ModelFormProps> = ({
  initialValues,
  tasks,
  onSubmit,
  onCancel,
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
        label="Model Name"
        rules={[{ required: true, message: 'Please input model name' }]}
      >
        <Input placeholder="e.g. YOLOv8-Agricultural-Pests" />
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
        <Input.TextArea placeholder="Model purpose or training details" rows={3} />
      </Form.Item>

      <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
        <Space>
          <Button onClick={onCancel}>
            Cancel
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            {initialValues.name ? 'Update' : 'Create'}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default ModelForm;

