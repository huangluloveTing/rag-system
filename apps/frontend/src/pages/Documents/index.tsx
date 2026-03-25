/**
 * 文档管理页面
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Button,
  Card,
  Drawer,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Upload,
} from 'antd';
import type { UploadProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { InboxOutlined } from '@ant-design/icons';
import {
  deleteDocument,
  getDocumentDetail,
  getDocumentPreview,
  getDocumentVersions,
  listDocuments,
  reindexDocument,
  restoreDocumentVersion,
  uploadDocument,
  uploadDocuments,
  type DocumentDetail,
  type DocumentDto,
  type DocumentStatus,
  type DocumentVersionDto,
} from '@/services/document';
import { listKnowledgeBases, type KnowledgeBase } from '@/services/knowledgeBase';

const { Dragger } = Upload;

const statusColor: Record<DocumentStatus, string> = {
  pending: 'default',
  processing: 'blue',
  indexed: 'green',
  failed: 'red',
};

const DocumentsPage: React.FC = () => {
  const [kbLoading, setKbLoading] = useState(false);
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DocumentDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [selectedKbId, setSelectedKbId] = useState<string | undefined>();
  const [status, setStatus] = useState<DocumentStatus | undefined>();
  const [tags, setTags] = useState<string>('');
  const [searchTags, setSearchTags] = useState<string[]>([]); // 用于筛选的标签

  const pollTimer = useRef<number | null>(null);

  // 常用标签
  const commonTags = useMemo(
    () => ['制度', '人事', '技术文档', '产品', '财务', '培训', 'FAQ'],
    []
  );

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<DocumentDetail | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewType, setPreviewType] = useState<string>('text');

  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versions, setVersions] = useState<DocumentVersionDto[]>([]);

  const fetchKbs = async () => {
    setKbLoading(true);
    try {
      const res = await listKnowledgeBases({ page: 1, pageSize: 200 });
      setKbs(res.data.knowledgeBases);
    } finally {
      setKbLoading(false);
    }
  };

  const fetchDocs = async (next?: { page?: number; pageSize?: number }) => {
    setLoading(true);
    try {
      const res = await listDocuments({
        knowledge_base_id: selectedKbId,
        status,
        page: next?.page ?? page,
        page_size: next?.pageSize ?? pageSize,
      });
      setItems(res.data.documents);
      setTotal(res.data.total);
      setPage(res.data.page);
      setPageSize(res.data.pageSize);

      const needPoll = res.data.documents.some(
        (d) => d.status === 'pending' || d.status === 'processing'
      );
      if (needPoll && pollTimer.current == null) {
        pollTimer.current = window.setInterval(() => {
          fetchDocs();
        }, 4000);
      }
      if (!needPoll && pollTimer.current != null) {
        window.clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKbs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchDocs({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKbId, status]);

  // 筛选过滤后的文档
  const filteredItems = useMemo(() => {
    if (searchTags.length === 0) {
      return items;
    }
    return items.filter((item) => {
      if (!item.tags || item.tags.length === 0) return false;
      return searchTags.some((tag) => item.tags?.includes(tag));
    });
  }, [items, searchTags]);

  useEffect(() => {
    return () => {
      if (pollTimer.current != null) {
        window.clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, []);

  const kbOptions = useMemo(
    () => kbs.map((kb) => ({ label: kb.name, value: kb.id })),
    [kbs]
  );

  const openDetail = async (id: string) => {
    setDetailOpen(true);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await getDocumentDetail(id);
      setDetail(res.data);
    } finally {
      setDetailLoading(false);
    }
  };

  const openPreview = async (id: string) => {
    setPreviewOpen(true);
    setPreviewContent('');
    setPreviewLoading(true);
    try {
      const res = await getDocumentPreview(id);
      setPreviewContent(res.data.content);
      setPreviewType(res.data.type);
    } finally {
      setPreviewLoading(false);
    }
  };

  const openVersions = async (id: string) => {
    setVersionsOpen(true);
    setVersions([]);
    setVersionsLoading(true);
    try {
      const res = await getDocumentVersions(id);
      setVersions(res.data.versions);
    } finally {
      setVersionsLoading(false);
    }
  };

  const onRestoreVersion = async (documentId: string, versionId: string) => {
    await restoreDocumentVersion(documentId, versionId);
    await fetchDocs();
    setVersionsOpen(false);
  };

  const onDelete = async (id: string) => {
    await deleteDocument(id);
    await fetchDocs();
  };

  const onReindex = async (id: string) => {
    await reindexDocument(id);
    await fetchDocs();
  };

  const uploadProps: UploadProps = {
    multiple: true,
    maxCount: 20,
    showUploadList: true,
    beforeUpload: () => false, // 阻止默认上传
    customRequest: async (options) => {
      const file = options.file as File;
      if (!selectedKbId) {
        options.onError?.(new Error('请先选择知识库'));
        return;
      }

      try {
        // 判断是单文件还是多文件上传
        if (Array.isArray(file)) {
          const res = await uploadDocuments(file, {
            knowledge_base_id: selectedKbId,
            tags: tags || undefined,
            is_public: 'true',
          });
          options.onSuccess?.(res.data, undefined as any);
        } else {
          const res = await uploadDocument(file, {
            knowledge_base_id: selectedKbId,
            tags: tags || undefined,
            is_public: 'true',
          });
          options.onSuccess?.(res.data, undefined as any);
        }
        await fetchDocs({ page: 1 });
      } catch (e) {
        options.onError?.(e as Error);
      }
    },
  };

  const columns: ColumnsType<DocumentDto> = [
    {
      title: '文件名',
      dataIndex: 'filename',
      key: 'filename',
      render: (v: string, record) => (
        <Space>
          <Button type="link" onClick={() => openDetail(record.id)}>
            {v}
          </Button>
          <Button type="link" size="small" onClick={() => openPreview(record.id)}>
            预览
          </Button>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'fileType',
      key: 'fileType',
      width: 100,
      render: (v: string | null | undefined) => v || '-',
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 200,
      render: (v: string[] | undefined) =>
        v && v.length > 0 ? (
          <Space size={[0, 4]} wrap>
            {v.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </Space>
        ) : (
          '-'
        ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (v: DocumentStatus, record) => (
        <Space direction="vertical" size={0}>
          <Tag color={statusColor[v]}>{v}</Tag>
          {record.errorMessage ? (
            <span style={{ color: '#ff4d4f', fontSize: 12 }}>{record.errorMessage}</span>
          ) : null}
        </Space>
      ),
    },
    {
      title: '大小',
      dataIndex: 'fileSize',
      key: 'fileSize',
      width: 120,
      render: (v: number) => {
        if (!v && v !== 0) return '-';
        if (v < 1024) return `${v} B`;
        if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
        return `${(v / 1024 / 1024).toFixed(1)} MB`;
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (v: string | undefined) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 300,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openVersions(record.id)}>
            版本历史
          </Button>
          <Button size="small" onClick={() => onReindex(record.id)}>
            重新索引
          </Button>
          <Popconfirm title="确认删除该文档？" onConfirm={() => onDelete(record.id)}>
            <Button danger size="small">
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
          <Button onClick={() => fetchDocs()} loading={loading}>
            刷新
          </Button>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Card size="small" title="筛选与上传">
            <Space wrap style={{ width: '100%' }} direction="vertical">
              <Space wrap>
                <Space>
                  <span>知识库：</span>
                  <Select
                    style={{ width: 260 }}
                    loading={kbLoading}
                    placeholder="选择知识库"
                    options={kbOptions}
                    value={selectedKbId}
                    onChange={(v) => setSelectedKbId(v)}
                    allowClear
                  />
                </Space>

                <Space>
                  <span>状态：</span>
                  <Select
                    style={{ width: 200 }}
                    placeholder="全部"
                    value={status}
                    onChange={(v) => setStatus(v)}
                    allowClear
                    options={[
                      { label: 'pending', value: 'pending' },
                      { label: 'processing', value: 'processing' },
                      { label: 'indexed', value: 'indexed' },
                      { label: 'failed', value: 'failed' },
                    ]}
                  />
                </Space>
              </Space>

              <Space wrap>
                <span>上传标签：</span>
                <Input
                  style={{ width: 260 }}
                  placeholder="制度,人事 (逗号分隔)"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </Space>

              <Space wrap direction="vertical" style={{ width: '100%' }}>
                <span>筛选标签：</span>
                <Space wrap>
                  {commonTags.map((tag) => (
                    <Tag.CheckableTag
                      key={tag}
                      checked={searchTags.includes(tag)}
                      onChange={(checked) => {
                        if (checked) {
                          setSearchTags([...searchTags, tag]);
                        } else {
                          setSearchTags(searchTags.filter((t) => t !== tag));
                        }
                      }}
                    >
                      {tag}
                    </Tag.CheckableTag>
                  ))}
                </Space>
                {searchTags.length > 0 && (
                  <Button size="small" onClick={() => setSearchTags([])}>
                    清除筛选
                  </Button>
                )}
              </Space>
            </Space>

            <div style={{ marginTop: 16 }}>
              <Dragger {...uploadProps} disabled={!selectedKbId}>
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">
                  拖拽文件到这里，或点击上传（需先选择知识库）
                </p>
                <p className="ant-upload-hint">支持 PDF / DOCX / Markdown / TXT / HTML</p>
              </Dragger>
            </div>
          </Card>

          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={filteredItems}
            pagination={{
              current: page,
              pageSize,
              total: searchTags.length > 0 ? filteredItems.length : total,
              showSizeChanger: true,
              onChange: (p, ps) => fetchDocs({ page: p, pageSize: ps }),
            }}
          />
        </Space>

        <Drawer
          title={detail ? `文档详情：${detail.filename}` : '文档详情'}
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          width={720}
        >
          <Card loading={detailLoading}>
            {detail ? (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <div>
                  <b>状态：</b> <Tag color={statusColor[detail.status]}>{detail.status}</Tag>
                </div>
                <div>
                  <b>版本：</b> v{detail.version} {detail.isLatest && '(最新)'}
                </div>
                <div>
                  <b>大小：</b> {detail.fileSize} bytes
                </div>
                <div>
                  <b>chunks：</b> {detail.chunks?.length ?? 0}
                </div>
                <Card size="small" title="片段预览（最多 5 条）">
                  {(detail.chunks || []).slice(0, 5).map((c) => (
                    <Card key={c.id} size="small" style={{ marginBottom: 8 }}>
                      <div style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{c.content}</div>
                    </Card>
                  ))}
                </Card>
              </Space>
            ) : null}
          </Card>
        </Drawer>

        <Drawer
          title="文档预览"
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          width={900}
        >
          <Card loading={previewLoading}>
            {previewContent ? (
              <div style={{ maxHeight: '80vh', overflow: 'auto' }}>
                {previewType === 'markdown' ? (
                  <ReactMarkdown>{previewContent}</ReactMarkdown>
                ) : previewType === 'html' ? (
                  <div dangerouslySetInnerHTML={{ __html: previewContent }} />
                ) : (
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {previewContent}
                  </pre>
                )}
              </div>
            ) : null}
          </Card>
        </Drawer>

        <Drawer
          title="文档预览"
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          width={900}
        >
          <Card loading={previewLoading}>
            {previewContent ? (
              <div style={{ maxHeight: '80vh', overflow: 'auto' }}>
                {previewType === 'markdown' ? (
                  <ReactMarkdown>{previewContent}</ReactMarkdown>
                ) : previewType === 'html' ? (
                  <div dangerouslySetInnerHTML={{ __html: previewContent }} />
                ) : (
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {previewContent}
                  </pre>
                )}
              </div>
            ) : null}
          </Card>
        </Drawer>

        <Drawer
          title="版本历史"
          open={versionsOpen}
          onClose={() => setVersionsOpen(false)}
          width={720}
        >
          <Card loading={versionsLoading}>
            <Table
              rowKey="id"
              dataSource={versions}
              pagination={false}
              columns={[
                {
                  title: '版本',
                  dataIndex: 'version',
                  key: 'version',
                  width: 80,
                  render: (v: number) => `v${v}`,
                },
                {
                  title: '文件名',
                  dataIndex: 'filename',
                  key: 'filename',
                },
                {
                  title: '大小',
                  dataIndex: 'fileSize',
                  key: 'fileSize',
                  width: 120,
                  render: (v: number) => {
                    if (!v && v !== 0) return '-';
                    if (v < 1024) return `${v} B`;
                    if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
                    return `${(v / 1024 / 1024).toFixed(1)} MB`;
                  },
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  width: 100,
                  render: (v: string) => <Tag color={statusColor[v as DocumentStatus]}>{v}</Tag>,
                },
                {
                  title: '创建时间',
                  dataIndex: 'createdAt',
                  key: 'createdAt',
                  width: 180,
                  render: (v: string) => new Date(v).toLocaleString(),
                },
                {
                  title: '操作',
                  key: 'actions',
                  width: 100,
                  render: (_, record) => (
                    <Popconfirm
                      title="确认恢复到该版本？"
                      onConfirm={() => onRestoreVersion(detail?.id || '', record.id)}
                    >
                      <Button size="small">恢复</Button>
                    </Popconfirm>
                  ),
                },
              ]}
            />
          </Card>
        </Drawer>
      </Card>
    </div>
  );
};

export default DocumentsPage;
