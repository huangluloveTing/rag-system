/**
 * 文档管理页面
 * 文档上传、列表、删除、重新索引
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  message,
  Modal,
  Upload,
  Select,
  Drawer,
  Descriptions,
  Popconfirm,
} from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  ReloadOutlined,
  EyeOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadProps } from 'antd';
import {
  getDocuments,
  uploadDocument,
  deleteDocument,
  reindexDocument,
  type Document,
  type DocumentStatus,
} from '@/services/documents';
import { getKnowledgeBases, type KnowledgeBase } from '@/services/knowledge';
import './index.css';

const { Dragger } = Upload;

const DocumentsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState<string>('');
  const [filterKnowledgeBaseId, setFilterKnowledgeBaseId] = useState<string>('');
  const [uploading, setUploading] = useState(false);

  // 加载知识库列表
  const loadKnowledgeBases = async () => {
    try {
      const res = await getKnowledgeBases({ page: 1, pageSize: 100 });
      setKnowledgeBases(res.data.items);
      if (res.data.items.length > 0 && !selectedKnowledgeBaseId) {
        setSelectedKnowledgeBaseId(res.data.items[0].id);
      }
    } catch (error) {
      console.error('Failed to load knowledge bases:', error);
    }
  };

  // 加载文档列表
  const loadDocuments = async () => {
    setLoading(true);
    try {
      const res = await getDocuments({
        page,
        pageSize,
        knowledgeBaseId: filterKnowledgeBaseId || undefined,
      });
      setDocuments(res.data.items);
      setTotal(res.data.total);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKnowledgeBases();
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [page, pageSize, filterKnowledgeBaseId]);

  // 状态标签
  const getStatusTag = (status: DocumentStatus) => {
    const statusMap: Record<DocumentStatus, { color: string; text: string }> = {
      pending: { color: 'default', text: '待处理' },
      processing: { color: 'processing', text: '处理中' },
      indexed: { color: 'success', text: '已索引' },
      failed: { color: 'error', text: '失败' },
    };
    const config = statusMap[status];
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 上传配置
  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    beforeUpload: () => false,
    maxCount: 1,
    accept: '.pdf,.doc,.docx,.txt,.md',
  };

  // 处理上传
  const handleUpload = async (file: File) => {
    if (!selectedKnowledgeBaseId) {
      message.error('请选择知识库');
      return;
    }

    setUploading(true);
    try {
      await uploadDocument(file, selectedKnowledgeBaseId);
      message.success('文档上传成功');
      setUploadModalVisible(false);
      loadDocuments();
    } catch (error) {
      console.error('Failed to upload document:', error);
    } finally {
      setUploading(false);
    }
  };

  // 删除文档
  const handleDelete = async (id: string) => {
    try {
      await deleteDocument(id);
      message.success('删除成功');
      loadDocuments();
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  };

  // 重新索引
  const handleReindex = async (id: string) => {
    try {
      await reindexDocument(id);
      message.success('重新索引任务已提交');
      loadDocuments();
    } catch (error) {
      console.error('Failed to reindex document:', error);
    }
  };

  // 查看详情
  const handleViewDetail = (record: Document) => {
    setSelectedDocument(record);
    setDetailDrawerVisible(true);
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  // 表格列定义
  const columns: ColumnsType<Document> = [
    {
      title: '文件名',
      dataIndex: 'filename',
      key: 'filename',
      ellipsis: true,
    },
    {
      title: '知识库',
      dataIndex: ['knowledgeBase', 'name'],
      key: 'knowledgeBase',
      ellipsis: true,
    },
    {
      title: '文件类型',
      dataIndex: 'fileType',
      key: 'fileType',
      width: 100,
    },
    {
      title: '大小',
      dataIndex: 'fileSize',
      key: 'fileSize',
      width: 100,
      render: (size: number) => formatFileSize(size),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: DocumentStatus) => getStatusTag(status),
    },
    {
      title: '分块数',
      dataIndex: 'totalChunks',
      key: 'totalChunks',
      width: 100,
    },
    {
      title: '上传时间',
      dataIndex: 'uploadedAt',
      key: 'uploadedAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => handleReindex(record.id)}
            disabled={record.status === 'processing'}
          >
            重新索引
          </Button>
          <Popconfirm
            title="确定要删除这个文档吗?"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="documents-page">
      <Card
        title="文档管理"
        extra={
          <Space>
            <Select
              placeholder="筛选知识库"
              style={{ width: 200 }}
              allowClear
              value={filterKnowledgeBaseId || undefined}
              onChange={(value) => setFilterKnowledgeBaseId(value || '')}
            >
              {knowledgeBases.map((kb) => (
                <Select.Option key={kb.id} value={kb.id}>
                  {kb.name}
                </Select.Option>
              ))}
            </Select>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => setUploadModalVisible(true)}
            >
              上传文档
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={documents}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPage(page);
              setPageSize(pageSize);
            },
          }}
        />
      </Card>

      {/* 上传文档模态框 */}
      <Modal
        title="上传文档"
        open={uploadModalVisible}
        onCancel={() => setUploadModalVisible(false)}
        footer={null}
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <div style={{ marginBottom: 8 }}>选择知识库</div>
            <Select
              placeholder="请选择知识库"
              style={{ width: '100%' }}
              value={selectedKnowledgeBaseId}
              onChange={setSelectedKnowledgeBaseId}
            >
              {knowledgeBases.map((kb) => (
                <Select.Option key={kb.id} value={kb.id}>
                  {kb.name}
                </Select.Option>
              ))}
            </Select>
          </div>

          <Dragger
            {...uploadProps}
            customRequest={({ file }) => handleUpload(file as File)}
            disabled={!selectedKnowledgeBaseId || uploading}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p className="ant-upload-hint">
              支持 PDF、Word、Markdown、TXT 格式
            </p>
          </Dragger>
        </Space>
      </Modal>

      {/* 文档详情抽屉 */}
      <Drawer
        title="文档详情"
        placement="right"
        width={600}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
      >
        {selectedDocument && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="文件名">
              {selectedDocument.filename}
            </Descriptions.Item>
            <Descriptions.Item label="知识库">
              {selectedDocument.knowledgeBase?.name}
            </Descriptions.Item>
            <Descriptions.Item label="文件类型">
              {selectedDocument.fileType}
            </Descriptions.Item>
            <Descriptions.Item label="文件大小">
              {formatFileSize(selectedDocument.fileSize)}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              {getStatusTag(selectedDocument.status)}
            </Descriptions.Item>
            <Descriptions.Item label="分块数量">
              {selectedDocument.totalChunks}
            </Descriptions.Item>
            <Descriptions.Item label="上传时间">
              {new Date(selectedDocument.uploadedAt).toLocaleString('zh-CN')}
            </Descriptions.Item>
            {selectedDocument.processedAt && (
              <Descriptions.Item label="处理时间">
                {new Date(selectedDocument.processedAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
            )}
            {selectedDocument.metadata && (
              <Descriptions.Item label="元数据">
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(selectedDocument.metadata, null, 2)}
                </pre>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};

export default DocumentsPage;
