/**
 * 知识库管理页面
 * 知识库创建、编辑、删除、统计
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  message,
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  Popconfirm,
  Tag,
  Descriptions,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  getKnowledgeBases,
  createKnowledgeBase,
  updateKnowledgeBase,
  deleteKnowledgeBase,
  getKnowledgeBaseStats,
  type KnowledgeBase,
  type KnowledgeBaseStats,
  type CreateKnowledgeBaseParams,
  type UpdateKnowledgeBaseParams,
} from '@/services/knowledge';
import './index.css';

const KnowledgePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingKb, setEditingKb] = useState<KnowledgeBase | null>(null);
  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const [currentStats, setCurrentStats] = useState<KnowledgeBaseStats | null>(null);
  const [form] = Form.useForm();

  // 加载知识库列表
  const loadKnowledgeBases = async () => {
    setLoading(true);
    try {
      const res = await getKnowledgeBases({ page, pageSize });
      setKnowledgeBases(res.data.items);
      setTotal(res.data.total);
    } catch (error) {
      console.error('Failed to load knowledge bases:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKnowledgeBases();
  }, [page, pageSize]);

  // 打开创建/编辑模态框
  const openModal = (kb?: KnowledgeBase) => {
    setEditingKb(kb || null);
    if (kb) {
      form.setFieldsValue({
        name: kb.name,
        description: kb.description,
        chunkSize: kb.config?.chunkSize || 500,
        chunkOverlap: kb.config?.chunkOverlap || 100,
        enableRerank: kb.config?.enableRerank !== false,
        similarityThreshold: kb.config?.similarityThreshold || 0.3,
      });
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editingKb) {
        const params: UpdateKnowledgeBaseParams = {
          name: values.name,
          description: values.description,
          config: {
            chunkSize: values.chunkSize,
            chunkOverlap: values.chunkOverlap,
            enableRerank: values.enableRerank,
            similarityThreshold: values.similarityThreshold,
          },
        };
        await updateKnowledgeBase(editingKb.id, params);
        message.success('更新成功');
      } else {
        const params: CreateKnowledgeBaseParams = {
          name: values.name,
          description: values.description,
          config: {
            chunkSize: values.chunkSize,
            chunkOverlap: values.chunkOverlap,
            enableRerank: values.enableRerank,
            similarityThreshold: values.similarityThreshold,
          },
        };
        await createKnowledgeBase(params);
        message.success('创建成功');
      }

      setModalVisible(false);
      loadKnowledgeBases();
    } catch (error) {
      console.error('Failed to submit:', error);
    }
  };

  // 删除知识库
  const handleDelete = async (id: string) => {
    try {
      await deleteKnowledgeBase(id);
      message.success('删除成功');
      loadKnowledgeBases();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  // 查看统计
  const handleViewStats = async (kb: KnowledgeBase) => {
    try {
      const res = await getKnowledgeBaseStats(kb.id);
      setCurrentStats(res.data);
      setStatsModalVisible(true);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  // 表格列定义
  const columns: ColumnsType<KnowledgeBase> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '配置',
      key: 'config',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size="small">
          <Tag>分块: {record.config?.chunkSize || 500}</Tag>
          <Tag>重叠: {record.config?.chunkOverlap || 100}</Tag>
          <Tag color={record.config?.enableRerank !== false ? 'success' : 'default'}>
            Rerank: {record.config?.enableRerank !== false ? '开启' : '关闭'}
          </Tag>
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<DatabaseOutlined />}
            onClick={() => handleViewStats(record)}
          >
            统计
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个知识库吗?"
            description="删除知识库会同时删除其中的所有文档和向量数据"
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
    <div className="knowledge-page">
      <Card
        title="知识库管理"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openModal()}
          >
            创建知识库
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={knowledgeBases}
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

      {/* 创建/编辑模态框 */}
      <Modal
        title={editingKb ? '编辑知识库' : '创建知识库'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            chunkSize: 500,
            chunkOverlap: 100,
            enableRerank: true,
            similarityThreshold: 0.3,
          }}
        >
          <Form.Item
            label="知识库名称"
            name="name"
            rules={[
              { required: true, message: '请输入知识库名称' },
              { max: 50, message: '名称不能超过 50 个字符' },
            ]}
          >
            <Input placeholder="请输入知识库名称" />
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
            rules={[{ max: 200, message: '描述不能超过 200 个字符' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="请输入知识库描述（可选）"
            />
          </Form.Item>

          <Card title="分块配置" size="small" style={{ marginBottom: 16 }}>
            <Form.Item
              label="分块大小"
              name="chunkSize"
              tooltip="每个文本块的字符数"
              rules={[
                { required: true, message: '请输入分块大小' },
                { type: 'number', min: 100, max: 2000, message: '分块大小应在 100-2000 之间' },
              ]}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={100}
                max={2000}
                step={50}
              />
            </Form.Item>

            <Form.Item
              label="分块重叠"
              name="chunkOverlap"
              tooltip="相邻文本块之间的重叠字符数"
              rules={[
                { required: true, message: '请输入分块重叠' },
                { type: 'number', min: 0, max: 500, message: '分块重叠应在 0-500 之间' },
              ]}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                max={500}
                step={10}
              />
            </Form.Item>
          </Card>

          <Card title="检索配置" size="small">
            <Form.Item
              label="启用 Rerank"
              name="enableRerank"
              valuePropName="checked"
              tooltip="是否启用重排序以提高检索准确度"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              label="相似度阈值"
              name="similarityThreshold"
              tooltip="过滤低于此相似度的检索结果"
              rules={[
                { required: true, message: '请输入相似度阈值' },
                { type: 'number', min: 0, max: 1, message: '相似度阈值应在 0-1 之间' },
              ]}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                max={1}
                step={0.1}
              />
            </Form.Item>
          </Card>
        </Form>
      </Modal>

      {/* 统计信息模态框 */}
      <Modal
        title="知识库统计"
        open={statsModalVisible}
        onCancel={() => setStatsModalVisible(false)}
        footer={null}
        width={600}
      >
        {currentStats && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Row gutter={16}>
              <Col span={12}>
                <Card>
                  <Statistic
                    title="文档总数"
                    value={currentStats.totalDocuments}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card>
                  <Statistic
                    title="总分块数"
                    value={currentStats.totalChunks}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
            </Row>

            <Card title="文档状态分布">
              <Descriptions column={2} bordered>
                <Descriptions.Item label="待处理">
                  <Tag color="default">{currentStats.documentsByStatus.pending}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="处理中">
                  <Tag color="processing">{currentStats.documentsByStatus.processing}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="已索引">
                  <Tag color="success">{currentStats.documentsByStatus.indexed}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="失败">
                  <Tag color="error">{currentStats.documentsByStatus.failed}</Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default KnowledgePage;
