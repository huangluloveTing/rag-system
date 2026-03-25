/**
 * 首页
 * 显示系统概览和快捷入口
 */
import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Progress, Space, Button } from 'antd';
import {
  FileTextOutlined,
  CommentOutlined,
  DatabaseOutlined,
  LikeOutlined,
} from '@ant-design/icons';
import { listDocuments } from '@/services/document';
import { listKnowledgeBases } from '@/services/knowledgeBase';
import { get, type ResponseData } from '@/utils/request';

interface SessionsListResponse {
  sessions: Array<{ id: string; title: string; createdAt: string; updatedAt: string; knowledgeBaseId?: string | null }>;
  total: number;
  page: number;
  pageSize: number;
}

interface FeedbackStats {
  total: number;
  positive: number;
  negative: number;
  positiveRate: number;
}

const HomePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [docTotal, setDocTotal] = useState<number>(0);
  const [kbTotal, setKbTotal] = useState<number>(0);
  const [sessionTotal, setSessionTotal] = useState<number>(0);
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [docsRes, kbRes, sessionsRes, feedbackRes] = await Promise.all([
        listDocuments({ page: 1, page_size: 1 }),
        listKnowledgeBases({ page: 1, pageSize: 1 }),
        get<SessionsListResponse>('/v1/chat/sessions', { params: { page: 1, pageSize: 1 } }) as Promise<ResponseData<SessionsListResponse>>,
        get<FeedbackStats>('/v1/feedback/stats') as Promise<ResponseData<FeedbackStats>>,
      ]);

      setDocTotal(docsRes.data.total);
      setKbTotal(kbRes.data.total);
      setSessionTotal(sessionsRes.data.total);
      setFeedbackStats(feedbackRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="home-page">
      <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>欢迎使用 RAG 系统</h1>
        <Space>
          <span style={{ color: '#999' }}>{loading ? '加载中...' : ''}</span>
        </Space>
      </Space>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="文档总数"
              value={docTotal}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="会话总数"
              value={sessionTotal}
              prefix={<CommentOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="知识库"
              value={kbTotal}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="好评率"
              value={feedbackStats ? Math.round(feedbackStats.positiveRate * 100) : 0}
              suffix="%"
              prefix={<LikeOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="系统状态">
            <div style={{ padding: '16px 0' }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 8 }}>向量数据库</div>
                <Progress percent={98} status="active" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 8 }}>存储空间</div>
                <Progress percent={75} />
              </div>
              <div>
                <div style={{ marginBottom: 8 }}>API 健康</div>
                <Progress percent={100} strokeColor="#52c41a" />
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="反馈统计">
            <div style={{ padding: '16px 0' }}>
              <div style={{ marginBottom: 12 }}>
                总反馈：{feedbackStats?.total ?? '-'}，点赞：{feedbackStats?.positive ?? '-'}，点踩：{feedbackStats?.negative ?? '-'}
              </div>
              <Button onClick={fetchStats} loading={loading}>
                刷新数据
              </Button>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default HomePage;
