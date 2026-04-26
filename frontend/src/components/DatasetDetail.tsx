import React, { useEffect, useState } from 'react';
import { 
  useDataset, 
  useDatasetVersions, 
  useDatasetVersionData, 
  useDatasetItem, 
  useCreateDatasetVersion, 
  useUpdateDatasetVersion, 
  useDeleteDatasetVersion, 
  useUploadDatasetFile, 
  useDeleteDatasetItems, 
  useVersionTasks, 
  useUpdateDatasetItem, 
  useVersionLabels, 
  formatDate, 
  BACKEND_URL 
} from '../hooks/useApi';
import LabelingStudio from './LabelingStudio';
import {
  PlusOutlined,
  HistoryOutlined,
  FileTextOutlined,
  AppstoreOutlined,
  EditOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  UploadOutlined,
  DeleteFilled,
  CloseOutlined,
  TagOutlined,
  ExpandOutlined
} from '@ant-design/icons';
import { 
  Layout, Menu, Button, Space, Typography, Tag, Modal, Tabs, Card, Empty, 
  Badge, Pagination, Image, Row, Col, Checkbox, Popconfirm, message, Spin, Divider
} from 'antd';
import type { DatasetVersion } from '../types';
import DatasetVersionForm from './DatasetVersionForm';

const { Sider, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

interface DatasetDetailProps {
  datasetId: number;
  onBack: () => void;
}

const DatasetDetail: React.FC<DatasetDetailProps> = ({ datasetId, onBack }) => {
  const { data: dataset, isLoading: isDatasetLoading } = useDataset(datasetId);
  const { data: versions, isLoading: isVersionsLoading } = useDatasetVersions(datasetId);
  
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('description');
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [editingVersion, setEditingVersion] = useState<DatasetVersion | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const createVersion = useCreateDatasetVersion(datasetId);
  const updateVersion = useUpdateDatasetVersion(datasetId);
  const deleteVersion = useDeleteDatasetVersion(datasetId);

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

  const handleOpenEditVersion = (version: DatasetVersion) => {
    setEditingVersion(version);
    setIsVersionModalOpen(true);
  };

  const handleCreateOrUpdateVersion = async (values: any) => {
    try {
      if (editingVersion) {
        await updateVersion.mutateAsync({ id: editingVersion.id, ...values });
        message.success('Version updated successfully');
      } else {
        await createVersion.mutateAsync(values);
        message.success('Version created successfully');
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

  if (isDatasetLoading || isVersionsLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '400px' }}>
        <Spin size="large" tip="Loading dataset details..." />
      </div>
    );
  }

  if (!dataset) return <Empty description="Dataset not found" />;

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
            Back to Datasets
          </Button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <Title level={3} style={{ margin: 0 }}>{dataset.name}</Title>
              <Space split={<Divider type="vertical" />}>
                <Tag color="blue">{dataset.task}</Tag>
                <Text type="secondary" style={{ fontSize: '13px' }}>Created {formatDate(dataset.created_at)}</Text>
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
              {!sidebarCollapsed && 'Version History'}
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
                      <div style={{ fontSize: '11px', color: '#8c8c8c' }}>{formatDate(v.created_at)}</div>
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
                        <Title level={5}>Version Overview</Title>
                        <Paragraph style={{ whiteSpace: 'pre-wrap', color: '#595959' }}>
                          {selectedVersion.data_info || 'No description provided for this version.'}
                        </Paragraph>
                      </Card>
                    </div>
                  )
                },
                {
                  key: 'explorer',
                  label: <span><AppstoreOutlined />Data Explorer</span>,
                  children: (
                    <div style={{ height: 'calc(100vh - 250px)', overflow: 'hidden' }}>
                      <DataExplorer 
                        versionId={selectedVersion.id} 
                        selectedVersion={selectedVersion} 
                        datasetTask={dataset?.task || ''} 
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
                description="No versions found. Create one to get started."
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
        <DatasetVersionForm
          initialValues={{
            version_name: editingVersion?.version_name || '',
            data_info: editingVersion?.data_info || '',
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

// Data Explorer Sub-component
const DataExplorer: React.FC<{ 
  versionId: number; 
  selectedVersion: DatasetVersion | null;
  datasetTask: string;
}> = ({ versionId, selectedVersion, datasetTask }) => {
  const [page, setPage] = useState(1);
  const [viewerItemId, setViewerItemId] = useState<number | null>(null);
  const [viewerShowAnnotations, setViewerShowAnnotations] = useState(false);
  const [viewerDims, setViewerDims] = useState<{ w: number; h: number } | null>(null);
  const size = 20;
  
  const { data: response, isLoading } = useDatasetVersionData(versionId, page, size, true);
  const { data: viewerItem, isLoading: isViewerLoading } = useDatasetItem(viewerItemId || 0, !!viewerItemId);
  const { data: versionTasks } = useVersionTasks(versionId);
  const { data: suggestedLabels = [] } = useVersionLabels(versionId);
  
  const [isEditingLabels, setIsEditingLabels] = useState(false);
  const updateItemMutation = useUpdateDatasetItem(versionId);

  const labelingTask = versionTasks?.find((t: any) => t.task_type === 'labeling');
  const availableLabels = labelingTask?.config?.labels || selectedVersion?.annotations?.labels || ['Object', 'Palm', 'Health', 'Pest'];

  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkLabeling, setIsBulkLabeling] = useState(false);
  const deleteItemsMutation = useDeleteDatasetItems(versionId);

  useEffect(() => { setSelectedIds(new Set()); }, [versionId, page]);
  useEffect(() => { setActiveFilters(new Set()); }, [versionId]);

  const toggleFilter = (label: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
    setSelectedIds(new Set());
  };

  const clearFilters = () => { setActiveFilters(new Set()); setSelectedIds(new Set()); };
  
  const toggleSelect = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (!filteredFiles) return;
    if (selectedIds.size === filteredFiles.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredFiles.map(f => f.id)));
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    try {
      await deleteItemsMutation.mutateAsync(Array.from(selectedIds));
      setSelectedIds(new Set());
      message.success(`Deleted ${selectedIds.size} items`);
    } catch (err: any) {
      message.error(`Delete failed: ${err.message}`);
    }
  };

  const files = response?.items || [];
  const total = response?.total || 0;

  const filteredFiles = activeFilters.size === 0
    ? files
    : files.filter(file => {
        const anns = file.annotations || [];
        if (activeFilters.has('__unlabeled__') && anns.length === 0) return true;
        const fileLabels = new Set(anns.map((a: any) => a.label).filter(Boolean));
        for (const f of activeFilters) {
          if (f !== '__unlabeled__' && fileLabels.has(f)) return true;
        }
        return false;
      });

  const pageLabels = Array.from(new Set(
    files.flatMap(f => (f.annotations || []).map((a: any) => a.label).filter(Boolean))
  )).sort() as string[];

  if (isLoading) return <div style={{ padding: 48, textAlign: 'center' }}><Spin tip="Loading data..." /></div>;

  return (
    <div style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space size={16}>
          <Title level={5} style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Samples <Text type="secondary" style={{ marginLeft: 8, fontWeight: 'normal' }}>{total} items</Text>
          </Title>
          {filteredFiles.length > 0 && (
            <Button type="link" size="small" onClick={selectAll} style={{ padding: 0 }}>
              {selectedIds.size === filteredFiles.length ? 'Deselect All' : 'Select All on Page'}
            </Button>
          )}
        </Space>
        <UploadButton versionId={versionId} />
      </div>

      <div style={{ marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Tag.CheckableTag checked={activeFilters.size === 0} onChange={clearFilters}>
          All Tag
        </Tag.CheckableTag>
        <Tag.CheckableTag 
          checked={activeFilters.has('__unlabeled__')} 
          onChange={() => toggleFilter('__unlabeled__')}
        >
          Unlabeled
        </Tag.CheckableTag>
        {Array.from(new Set([...suggestedLabels, ...pageLabels])).sort().map(label => (
          <Tag.CheckableTag 
            key={label}
            checked={activeFilters.has(label)}
            onChange={() => toggleFilter(label)}
          >
            {label}
          </Tag.CheckableTag>
        ))}
        {activeFilters.size > 0 && (
          <Button type="text" size="small" icon={<CloseOutlined />} onClick={clearFilters}>Clear</Button>
        )}
      </div>

      {selectedIds.size > 0 && (
        <AlertArea 
          count={selectedIds.size} 
          onCancel={() => setSelectedIds(new Set())} 
          onDelete={handleDeleteSelected} 
          onLabel={() => setIsBulkLabeling(true)}
        />
      )}

      {filteredFiles.length > 0 ? (
        <Row gutter={[16, 16]}>
          {filteredFiles.map((file) => (
            <Col xs={12} sm={8} md={6} lg={4} key={file.id}>
              <Card
                hoverable
                size="small"
                cover={
                  <div style={{ height: 140, overflow: 'hidden', background: '#f5f5f5', position: 'relative' }} onClick={() => setViewerItemId(file.id)}>
                    <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 10 }} onClick={e => e.stopPropagation()}>
                      <Checkbox checked={selectedIds.has(file.id)} onChange={() => toggleSelect(file.id)} />
                    </div>
                    {file.annotations && file.annotations.length > 0 && (
                      <Badge status="success" style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }} />
                    )}
                    <Image
                      src={`${BACKEND_URL}${file.thumbnail_url || file.preview_url}`}
                      alt={file.file_name}
                      preview={false}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      fallback="https://via.placeholder.com/150?text=No+Image"
                    />
                  </div>
                }
                bodyStyle={{ padding: '8px' }}
              >
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px', fontWeight: 600 }}>
                  {file.file_name}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#8c8c8c', marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: '10px' }}>{file.file_type.toUpperCase()}</Text>
                  <Text type="secondary" style={{ fontSize: '10px' }}>{(file.file_size / 1024).toFixed(1)} KB</Text>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Empty description="No samples match filters" style={{ padding: 48 }} />
      )}

      {response && response.pages > 1 && (
        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <Pagination 
            current={page} 
            total={total} 
            pageSize={size} 
            onChange={setPage} 
            showSizeChanger={false}
          />
        </div>
      )}

      {/* Viewer Modal (AntD) — for preview, not labeling */}
      <Modal
        title={viewerItem?.file_name}
        open={!!viewerItemId && !isEditingLabels}
        onCancel={() => { setViewerItemId(null); setIsEditingLabels(false); }}
        width={800}
        footer={null}
        destroyOnClose
      >
        <div style={{ padding: '16px 0' }}>
          {isViewerLoading ? (
            <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
          ) : viewerItem ? (
            <Space direction="vertical" style={{ width: '100%' }} size={16}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Space>
                  <Button 
                    type={viewerShowAnnotations ? 'primary' : 'default'} 
                    icon={<TagOutlined />} 
                    onClick={() => setViewerShowAnnotations(!viewerShowAnnotations)}
                  >
                    {viewerShowAnnotations ? 'Hide Annotations' : 'Show Annotations'}
                  </Button>
                  <Button icon={<EditOutlined />} onClick={() => setIsEditingLabels(true)}>
                    Edit Labels
                  </Button>
                </Space>
                <Button icon={<ExpandOutlined />} onClick={() => window.open(`${BACKEND_URL}${viewerItem.url}`, '_blank')}>
                  View Full Image
                </Button>
              </div>
              <div style={{ position: 'relative', width: '100%', background: '#000', borderRadius: '8px', overflow: 'hidden' }}>
                <Image
                  src={`${BACKEND_URL}${viewerItem.preview_url}`}
                  alt={viewerItem.file_name}
                  onLoad={(e: any) => setViewerDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                  style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain' }}
                  preview={false}
                />
                {viewerShowAnnotations && viewerItem.annotations && viewerItem.annotations.length > 0 && viewerDims && (
                  <svg
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                    viewBox={`0 0 ${viewerDims.w} ${viewerDims.h}`}
                  >
                    {viewerItem.annotations.map((ann: any, idx: number) => {
                      const [x, y, w, h] = ann.bbox || [0,0,0,0];
                      return (
                        <g key={idx}>
                          <rect x={x} y={y} width={w} height={h} fill="none" stroke="#ff4d4f" strokeWidth="4" />
                          <text x={x} y={y - 8} fill="#ff4d4f" fontSize="24" fontWeight="bold">{ann.label}</text>
                        </g>
                      );
                    })}
                  </svg>
                )}
              </div>
            </Space>
          ) : <Empty />}
        </div>
      </Modal>

      {/* Single item label editor — fixed full-screen overlay (no AntD modal) */}
      {isEditingLabels && viewerItem && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#0a0a0a', display: 'flex' }}>
          <LabelingStudio
            currentId={viewerItemId || 0}
            imageUrl={`${BACKEND_URL}${viewerItem.url}`}
            annotations={viewerItem.annotations || []}
            labels={availableLabels}
            suggestedLabels={suggestedLabels}
            items={files}
            onSelectItem={(id) => setViewerItemId(id)}
            onLoadMore={() => {}}
            datasetTask={datasetTask}
            onCancel={() => { setIsEditingLabels(false); setViewerItemId(null); }}
            onSave={async (newAnnots: any) => {
              try {
                await updateItemMutation.mutateAsync({ id: viewerItem.id, annotations: newAnnots });
                message.success('Labels saved');
              } catch (err: any) {
                message.error('Failed to save labels');
              }
            }}
          />
        </div>
      )}

      {/* Bulk Labeling — fixed full-screen overlay (no AntD modal) */}
      {isBulkLabeling && files.length > 0 && (() => {
        const firstId = Array.from(selectedIds)[0];
        const firstFile = files.find(f => f.id === firstId) || files[0];
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#0a0a0a', display: 'flex' }}>
            <LabelingStudio
              currentId={firstId}
              imageUrl={`${BACKEND_URL}${firstFile.url}`}
              annotations={firstFile.annotations || []}
              labels={availableLabels}
              suggestedLabels={suggestedLabels}
              items={files.filter(f => selectedIds.has(f.id))}
              onSelectItem={(_id) => {}}
              onLoadMore={() => {}}
              datasetTask={datasetTask}
              onCancel={() => setIsBulkLabeling(false)}
              onSave={async (newAnnots: any) => {
                try {
                  await updateItemMutation.mutateAsync({ id: firstFile.id, annotations: newAnnots });
                  message.success('Labels saved');
                } catch (err: any) {
                  message.error('Failed to save labels');
                }
              }}
            />
          </div>
        );
      })()}
    </div>
  );
};

const AlertArea = ({ count, onCancel, onDelete, onLabel }: { count: number, onCancel: () => void, onDelete: () => void, onLabel: () => void }) => (
  <div style={{ 
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
    background: '#e6f7ff', border: '1px solid #91d5ff', 
    padding: '12px 24px', borderRadius: '8px', marginBottom: 24 
  }}>
    <Text strong style={{ color: '#0050b3' }}>{count} items selected</Text>
    <Space>
      <Button icon={<TagOutlined />} type="primary" size="small" onClick={onLabel}>Label Assets</Button>
      <Button size="small" onClick={onCancel}>Cancel</Button>
      <Popconfirm title={`Delete ${count} items?`} onConfirm={onDelete} okText="Yes" cancelText="No">
        <Button size="small" danger icon={<DeleteFilled />}>Delete</Button>
      </Popconfirm>
    </Space>
  </div>
);

const UploadButton: React.FC<{ versionId: number }> = ({ versionId }) => {
  const [isUploading, setIsUploading] = useState(false);
  const uploadMutation = useUploadDatasetFile(versionId);

  const handleChange = async (info: any) => {
    const { fileList } = info;
    if (isUploading) return;
    
    setIsUploading(true);
    const hide = message.loading('Uploading files...', 0);
    
    try {
      for (const fileObj of fileList) {
        if (fileObj.originFileObj) {
          await uploadMutation.mutateAsync(fileObj.originFileObj);
        }
      }
      message.success('Upload complete');
    } catch (err) {
      message.error('Some uploads failed');
    } finally {
      setIsUploading(false);
      hide();
    }
  };

  return (
    <Space>
      <span style={{ fontSize: '12px', color: '#8c8c8c' }}>{isUploading && 'Processing...'}</span>
      <Button 
        icon={<UploadOutlined />} 
        loading={isUploading} 
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.accept = 'image/*';
          input.onchange = (e: any) => handleChange({ fileList: Array.from(e.target.files).map(f => ({ originFileObj: f })) });
          input.click();
        }}
        type="dashed"
      >
        Upload Data
      </Button>
    </Space>
  );
};

export default DatasetDetail;
