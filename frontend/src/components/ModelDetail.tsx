import React, { useState, useEffect } from 'react';
import { 
  useModel, 
  useModelVersions, 
  useModelVersionData, 
  useCreateModelVersion, 
  useUpdateModelVersion, 
  useDeleteModelVersion,
  useUploadModelFile,
  useModelInference,
  formatDate,
  BACKEND_URL
} from '../hooks/useApi';
import { 
  PlusOutlined, 
  HistoryOutlined,
  FileTextOutlined,
  AppstoreOutlined,
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  ExpandOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  RobotOutlined,
  DatabaseOutlined
} from '@ant-design/icons';
import { 
  Layout, Menu, Button, Space, Typography, Tag, Modal, Tabs, Card, Empty, 
  Badge, Image, Row, Col, Popconfirm, message, Spin, Divider, Slider
} from 'antd';
import type { ModelVersion } from '../types';
import ModelVersionForm from './ModelVersionForm';

const { Sider, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

interface ModelDetailProps {
  modelId: number;
  onBack: () => void;
}

const ModelDetail: React.FC<ModelDetailProps> = ({ modelId, onBack }) => {
  const { data: model, isLoading: isModelLoading } = useModel(modelId);
  const { data: versions, isLoading: isVersionsLoading } = useModelVersions(modelId);
  
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('description');
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [editingVersion, setEditingVersion] = useState<ModelVersion | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const createVersion = useCreateModelVersion(modelId);
  const updateVersion = useUpdateModelVersion(modelId);
  const deleteVersion = useDeleteModelVersion(modelId);
  const uploadModelFile = useUploadModelFile(modelId, selectedVersionId || 0);
  const runInference = useModelInference(modelId, selectedVersionId || 0);

  const selectedVersion = versions?.find(v => v.id === selectedVersionId) || (versions && versions.length > 0 ? versions[0] : null);

  useEffect(() => {
    if (versions && versions.length > 0 && !selectedVersionId) {
      setSelectedVersionId(versions[0].id);
    }
  }, [versions, selectedVersionId]);

  const handleOpenCreateVersion = () => {
    setEditingVersion(null);
    setIsVersionModalOpen(true);
  };

  const handleOpenEditVersion = (version: ModelVersion) => {
    setEditingVersion(version);
    setIsVersionModalOpen(true);
  };

  const handleCreateOrUpdateVersion = async (values: any) => {
    try {
      if (editingVersion) {
        await updateVersion.mutateAsync({ id: editingVersion.id, ...values });
        message.success('Version updated');
      } else {
        await createVersion.mutateAsync(values);
        message.success('Version created');
      }
      setIsVersionModalOpen(false);
      setEditingVersion(null);
    } catch (err: any) {
      message.error(`Operation failed: ${err.message}`);
    }
  };

  const handleDeleteVersion = async (id: number) => {
    try {
      await deleteVersion.mutateAsync(id);
      message.success('Version deleted');
      if (selectedVersionId === id) {
        const remaining = versions?.filter(v => v.id !== id);
        setSelectedVersionId(remaining && remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err: any) {
      message.error(`Delete failed: ${err.message}`);
    }
  };

  if (isModelLoading || isVersionsLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '400px' }}>
        <Spin size="large" tip="Loading model details..." />
      </div>
    );
  }

  if (!model) return <Empty description="Model not found" />;

  return (
    <Layout style={{ height: '100%', background: 'transparent' }}>
      {/* Header Area */}
      <div style={{ padding: '0 24px 16px 24px' }}>
        <Space direction="vertical" style={{ width: '100%' }} size={0}>
          <Button 
            type="link" 
            icon={<ArrowLeftOutlined />} 
            onClick={onBack}
            style={{ padding: 0, marginBottom: 8, color: 'var(--ant-primary-color)' }}
          >
            Back to Models
          </Button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <Title level={3} style={{ margin: 0 }}>{model.name}</Title>
              <Space split={<Divider type="vertical" />}>
                <Tag color="cyan">{model.task}</Tag>
                <Text type="secondary" style={{ fontSize: '13px' }}>ID: {model.id}</Text>
              </Space>
            </div>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={handleOpenCreateVersion}
            >
              New Version
            </Button>
          </div>
        </Space>
      </div>

      <Layout style={{ height: 'calc(100% - 80px)', background: '#fff', borderRadius: '16px', overflow: 'hidden', border: '1px solid #f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        {/* Versions Sider */}
        <Sider
          collapsible
          collapsed={sidebarCollapsed}
          onCollapse={(value) => setSidebarCollapsed(value)}
          width={240}
          theme="light"
          style={{ borderRight: '1px solid #f0f0f0' }}
        >
          <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0' }}>
            <Title level={5} style={{ margin: 0, fontSize: '11px', color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: '1px' }}>
              <HistoryOutlined style={{ marginRight: 8 }} />
              {!sidebarCollapsed && 'Checkpoint History'}
            </Title>
          </div>
          <Menu
            mode="inline"
            selectedKeys={selectedVersionId ? [selectedVersionId.toString()] : []}
            style={{ border: 'none', height: 'calc(100% - 90px)', overflowY: 'auto' }}
          >
            {versions?.map(v => (
              <Menu.Item 
                key={v.id} 
                onClick={() => setSelectedVersionId(v.id)}
                style={{ height: 'auto', padding: '12px 16px', lineHeight: 'normal' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontWeight: 600, color: selectedVersionId === v.id ? 'var(--ant-primary-color)' : 'inherit' }}>
                      {v.version_name}
                    </div>
                    {!sidebarCollapsed && (
                      <Space size={4} wrap>
                        <Badge status={v.stage === 'production' ? 'success' : 'default'} text={v.stage} style={{ fontSize: '10px' }} />
                      </Space>
                    )}
                  </div>
                  {!sidebarCollapsed && selectedVersionId === v.id && (
                    <div className="version-actions">
                      <Space size={4}>
                         <Button type="text" size="small" icon={<EditOutlined style={{fontSize: 12}}/>} onClick={(e) => { e.stopPropagation(); handleOpenEditVersion(v); }} />
                         <Popconfirm title="Delete version?" onConfirm={(e) => { e?.stopPropagation(); handleDeleteVersion(v.id); }}>
                            <Button type="text" size="small" danger icon={<DeleteOutlined style={{fontSize: 12}} />} onClick={e => e.stopPropagation()}/>
                         </Popconfirm>
                      </Space>
                    </div>
                  )}
                </div>
              </Menu.Item>
            ))}
          </Menu>
        </Sider>

        {/* Main Content Area */}
        <Content style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
          {selectedVersion ? (
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              tabBarStyle={{ padding: '0 24px', margin: 0, background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}
              items={[
                {
                  key: 'description',
                  label: <span><FileTextOutlined />Description</span>,
                  children: (
                    <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
                      <Card bordered={false} style={{ background: '#fafafa', borderRadius: '12px' }}>
                        <Title level={5}>Model Overview</Title>
                        <Paragraph style={{ whiteSpace: 'pre-wrap', color: '#595959' }}>
                          {model.description || 'No description provided for this model.'}
                        </Paragraph>
                        <Divider />
                        <Title level={5}>Version Info</Title>
                        <Space direction="vertical">
                          <Text>Stage: <Tag color={selectedVersion.stage === 'production' ? 'green' : 'default'}>{selectedVersion.stage.toUpperCase()}</Tag></Text>
                          <Text>Created: <Text type="secondary">{formatDate(selectedVersion.created_at)}</Text></Text>
                          {selectedVersion.status_note && (
                            <div style={{ marginTop: 8 }}>
                                <Text strong>Note:</Text>
                                <Paragraph type="secondary" style={{ fontStyle: 'italic' }}>"{selectedVersion.status_note}"</Paragraph>
                            </div>
                          )}
                        </Space>
                      </Card>
                    </div>
                  )
                },
                {
                  key: 'explorer',
                  label: <span><AppstoreOutlined />Files & Artifacts</span>,
                  children: (
                    <div style={{ height: 'calc(100vh - 250px)', overflow: 'hidden' }}>
                      <DataExplorer 
                        versionId={selectedVersion.id} 
                        onUpload={async (file) => {
                          try {
                            await uploadModelFile.mutateAsync(file);
                            message.success('File uploaded');
                          } catch (err: any) {
                            message.error(`Upload failed: ${err.message}`);
                          }
                        }}
                        isUploading={uploadModelFile.isPending}
                      />
                    </div>
                  )
                },
                {
                  key: 'inference',
                  label: <span><RobotOutlined />Inference Tester</span>,
                  children: (
                    <div style={{ height: 'calc(100vh - 250px)', overflowY: 'auto' }}>
                      <InferenceTester 
                        modelId={modelId}
                        versionId={selectedVersion.id}
                        runInference={runInference}
                      />
                    </div>
                  )
                }
              ]}
            />
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 48 }}>
              <Empty 
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No versions found. Create a version to upload weights."
              >
                <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreateVersion}>Create First Version</Button>
              </Empty>
            </div>
          )}
        </Content>
      </Layout>

      {/* Version Form Modal */}
      <Modal
        title={editingVersion ? 'Edit Version' : 'Create New Version'}
        open={isVersionModalOpen}
        onCancel={() => { setIsVersionModalOpen(false); setEditingVersion(null); }}
        footer={null}
        destroyOnClose
      >
        <ModelVersionForm
          initialValues={{
            stage: editingVersion?.stage || 'experimental',
            status_note: editingVersion?.status_note || '',
          }}
          onSubmit={handleCreateOrUpdateVersion}
          onCancel={() => { setIsVersionModalOpen(false); setEditingVersion(null); }}
          isEditing={!!editingVersion}
          loading={createVersion.isPending || updateVersion.isPending}
        />
      </Modal>
    </Layout>
  );
};

// Data Explorer Sub-component for model artifacts
const DataExplorer: React.FC<{ 
  versionId: number; 
  onUpload: (file: File) => Promise<void>; 
  isUploading: boolean;
}> = ({ versionId, onUpload, isUploading }) => {
  const { data: files, isLoading } = useModelVersionData(versionId);

  if (isLoading) return <div style={{ padding: 48, textAlign: 'center' }}><Spin tip="Loading artifacts..." /></div>;

  return (
    <div style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={5} style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase' }}>Artifact Storage</Title>
          <Text type="secondary" style={{ fontSize: '12px' }}>Checkpoints, weights, and exported models</Text>
        </div>
        <Button 
          icon={<UploadOutlined />} 
          loading={isUploading}
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.onchange = (e: any) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
            };
            input.click();
          }}
        >
          Upload Artifact
        </Button>
      </div>

      {files && files.length > 0 ? (
        <Row gutter={[16, 16]}>
          {files.map((file) => (
            <Col xs={24} sm={12} md={8} lg={6} key={file.id}>
              <Card
                hoverable
                size="small"
                cover={
                  <div style={{ height: 120, background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {file.preview_url ? (
                      <Image
                        src={`${BACKEND_URL}${file.preview_url}`}
                        style={{ height: '100%', width: '100%', objectFit: 'contain' }}
                        preview={false}
                      />
                    ) : (
                      <DatabaseOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                    )}
                  </div>
                }
                actions={[
                   <Button type="link" icon={<ExpandOutlined />} onClick={() => window.open(`${BACKEND_URL}${file.url}`, '_blank')}>Open</Button>
                ]}
              >
                <Card.Meta 
                  title={<Text strong style={{ fontSize: '12px' }} ellipsis title={file.file_name}>{file.file_name}</Text>}
                  description={
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                      <Tag style={{ fontSize: '9px', margin: 0 }}>{file.file_type.toUpperCase()}</Tag>
                      <Text type="secondary">{(file.file_size / 1024).toFixed(1)} KB</Text>
                    </div>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Empty description="No artifacts found for this version" style={{ padding: 48 }} />
      )}
    </div>
  );
};

// Inference Tester Sub-component
const InferenceTester: React.FC<{
  modelId: number;
  versionId: number;
  runInference: any;
}> = ({ runInference }) => {
  const [testImage, setTestImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [confidence, setConfidence] = useState(0.3);

  const handleImageSelect = (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      setTestImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
    }
  };

  const handleRun = async () => {
    if (!testImage) return;
    try {
      const data = await runInference.mutateAsync({ file: testImage, conf: confidence });
      setResult(data);
    } catch (err) {
      message.error('Inference failed. Check if model checkpoint exists.');
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={48}>
        <Col span={12}>
          <Space direction="vertical" size={24} style={{ width: '100%' }}>
            <Card 
              title="Test Input" 
              style={{ textAlign: 'center', height: '100%', minHeight: '300px', display: 'flex', flexDirection: 'column' }}
              bodyStyle={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {previewUrl ? (
                <Image src={previewUrl} style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain' }} />
              ) : (
                <Empty description="Upload an image to start" />
              )}
              <div style={{ marginTop: 24 }}>
                <Button 
                  icon={<UploadOutlined />} 
                  onClick={() => document.getElementById('inference-input')?.click()}
                >
                  Select Test Image
                </Button>
                <input id="inference-input" type="file" hidden onChange={handleImageSelect} />
              </div>
            </Card>

            <Card size="small">
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                <Text strong>Confidence Threshold</Text>
                <Text strong style={{ color: 'var(--ant-primary-color)' }}>{Math.round(confidence * 100)}%</Text>
              </div>
              <Slider 
                min={0.05} max={0.95} step={0.05} 
                value={confidence} 
                onChange={(val) => { setConfidence(val); setResult(null); }} 
              />
            </Card>

            <Button 
                type="primary" 
                size="large" 
                block 
                icon={<PlayCircleOutlined />} 
                loading={runInference.isPending}
                disabled={!testImage}
                onClick={handleRun}
            >
                {runInference.isPending ? 'Running Processing...' : 'Run Inference'}
            </Button>
          </Space>
        </Col>

        <Col span={12}>
          <Card title="Results" style={{ minHeight: '500px' }}>
            {result ? (
              <Space direction="vertical" size={24} style={{ width: '100%' }}>
                <div style={{ background: '#000', borderRadius: '8px', overflow: 'hidden', textAlign: 'center' }}>
                  <Image
                    src={`data:image/jpeg;base64,${result.image_base64}`}
                    alt="Results"
                    style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong><SettingOutlined /> Detections Found:</Text>
                    <Badge count={result.detections?.length || 0} showZero color="#52c41a" />
                </div>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {result.detections?.map((det: any, i: number) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: '6px', marginBottom: 8 }}>
                            <Text strong style={{ textTransform: 'capitalize' }}>{det.label || det.class}</Text>
                            <Tag color={det.confidence > 0.7 ? 'green' : 'orange'}>{(det.confidence * 100).toFixed(1)}%</Tag>
                        </div>
                    ))}
                </div>
              </Space>
            ) : (
                <Empty 
                    image={<RobotOutlined style={{ fontSize: 64, opacity: 0.1 }} />} 
                    description="No inference results yet" 
                />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ModelDetail;
