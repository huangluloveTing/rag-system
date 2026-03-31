/**
 * 知识库管理页面
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  createKnowledgeBase,
  deleteKnowledgeBase,
  getKnowledgeBaseStats,
  listKnowledgeBases,
  updateKnowledgeBase,
  type KnowledgeBase,
  type KnowledgeBaseStats,
} from '@/services/knowledgeBase';

type ModalMode = 'create' | 'edit';

const KnowledgePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<KnowledgeBase[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editing, setEditing] = useState<KnowledgeBase | null>(null);
  const [form] = Form.useForm();

  const [statsOpen, setStatsOpen] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsKb, setStatsKb] = useState<KnowledgeBase | null>(null);
  const [stats, setStats] = useState<KnowledgeBaseStats | null>(null);

  const fetchList = async (next?: { page?: number; pageSize?: number }) => {
    setLoading(true);
    try {
      const res = await listKnowledgeBases({
        page: next?.page ?? page,
        pageSize: next?.pageSize ?? pageSize,
      });
      setItems(res.data.knowledgeBases);
      setTotal(res.data.total);
      setPage(res.data.page);
      setPageSize(res.data.pageSize);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setModalMode('create');
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (kb: KnowledgeBase) => {
    setModalMode('edit');
    setEditing(kb);
    form.setFieldsValue({
      name: kb.name,
      description: kb.description ?? undefined,
      chunkSize: kb.config?.chunkSize,
      overlap: kb.config?.overlap,
      topK: kb.config?.topK,
    });
    setModalOpen(true);
  };

  const submitModal = async () => {
    const values = await form.validateFields();

    const payload = {
      name: values.name,
      description: values.description,
      config: {
        chunkSize: values.chunkSize,
        overlap: values.overlap,
        topK: values.topK,
      },
    };

    if (modalMode === 'create') {
      await createKnowledgeBase(payload);
    } else if (editing) {
      await updateKnowledgeBase(editing.id, payload);
    }

    setModalOpen(false);
    await fetchList();
  };

  const onDelete = async (id: string) => {
    await deleteKnowledgeBase(id);
    await fetchList();
  };

  const openStats = async (kb: KnowledgeBase) => {
    setStatsOpen(true);
    setStatsKb(kb);
    setStats(null);
    setStatsLoading(true);
    try {
      const res = await getKnowledgeBaseStats(kb.id);
      setStats(res.data);
    } finally {
      setStatsLoading(false);
    }
  };

  const statusTags = useMemo(
    () =>
      (s?: KnowledgeBaseStats | null) => {
        const docs = s?.documents || {};
        const entries = Object.entries(docs);
        if (entries.length === 0) return <Tag>无文档</Tag>;
        return (
          <Space wrap>
            {entries.map(([k, v]) => (
              <Tag key={k} color={k === 'indexed' ? 'green' : k === 'failed' ? 'red' : 'blue'}>
                {k}: {v}
              </Tag>
            ))}
          </Space>
        );
      },
    []
  );

  const columns: ColumnsType<KnowledgeBase> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (v: string | null | undefined) => v || <span style={{ color: '#999', wordBreak: 'break-all' }}>-</span>,
    },
    {
      title: '文档数',
      dataIndex: 'documentCount',
      key: 'documentCount',
      width: 80,
      render: (v: number | undefined) => v ?? 0,
    },
    {
      title: '创建者',
      dataIndex: 'creator',
      key: 'creator',
      width: 100,
      render: (c: any) => c?.username || <span style={{ color: '#999' }}>-</span>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 100,
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 240,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Button size="small" onClick={() => openStats(record)}>
            统计
          </Button>
          <Popconfirm
            title="确认删除该知识库？"
            description="知识库下仍有文档时将无法删除。"
            onConfirm={() => onDelete(record.id)}
          >
            <Button danger size="small">
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
          <Space>
            <Button onClick={() => fetchList()}>刷新</Button>
            <Button type="primary" onClick={openCreate}>
              新建知识库
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={items}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (p, ps) => fetchList({ page: p, pageSize: ps }),
          }}
        />

        <Modal
          title={modalMode === 'create' ? '新建知识库' : '编辑知识库'}
          open={modalOpen}
          onCancel={() => setModalOpen(false)}
          onOk={submitModal}
          okText={modalMode === 'create' ? '创建' : '保存'}
        >
          <Form form={form} layout="vertical">
            <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
              <Input placeholder="例如：员工手册" />
            </Form.Item>
            <Form.Item name="description" label="描述">
              <Input.TextArea rows={3} placeholder="可选" />
            </Form.Item>

            <Card size="small" title="分块/检索配置（可选）">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Form.Item name="chunkSize" label="chunkSize" style={{ marginBottom: 0 }}>
                  <InputNumber min={100} max={2000} style={{ width: '100%' }} placeholder="默认 500" />
                </Form.Item>
                <Form.Item name="overlap" label="overlap" style={{ marginBottom: 0 }}>
                  <InputNumber min={0} max={500} style={{ width: '100%' }} placeholder="默认 100" />
                </Form.Item>
                <Form.Item name="topK" label="topK" style={{ marginBottom: 0 }}>
                  <InputNumber min={1} max={50} style={{ width: '100%' }} placeholder="默认 5" />
                </Form.Item>
              </Space>
            </Card>
          </Form>
        </Modal>

        <Drawer
          title={statsKb ? `统计：${statsKb.name}` : '统计'}
          open={statsOpen}
          onClose={() => setStatsOpen(false)}
          width={480}
        >
          <Card loading={statsLoading}>
            <div style={{ marginBottom: 12 }}>文档状态：</div>
            {statusTags(stats)}
            <div style={{ marginTop: 16 }}>总 chunks：{stats?.totalChunks ?? '-'}</div>
          </Card>
        </Drawer>
      </Card>
    </div>
  );
};

export default KnowledgePage;
