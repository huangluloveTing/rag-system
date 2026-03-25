/**
 * 首页
 * 显示系统概览和快捷入口
 */
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Progress } from 'antd';
import {
  FileTextOutlined,
  CommentOutlined,
  DatabaseOutlined,
  LikeOutlined,
  DislikeOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getKnowledgeBases } from '@/services/knowledge';
import { getDocuments } from '@/services/documents';
import { getFeedbackStats } from '@/services/feedback';
import './index.css';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    knowledgeBaseCount: 0,
    documentCount: 0,
    totalFeedback: 0,
    totalLikes: 0,
    totalDislikes: 0,
    likeRate: 0,
  });

  // 加载统计数据
  const loadStats = async () => {
    setLoading(true);
    try {
      const [kbRes, docRes, feedbackRes] = await Promise.all([
        getKnowledgeBases({ page: 1, pageSize: 1 }),
        getDocuments({ page: 1, pageSize: 1 }),
        getFeedbackStats(),
      ]);

      setStats({
        knowledgeBaseCount: kbRes.data.total,
        documentCount: docRes.data.total,
        totalFeedback: feedbackRes.data.totalFeedback,
        totalLikes: feedbackRes.data.totalLikes,
        totalDislikes: feedbackRes.data.totalDislikes,
        likeRate: feedbackRes.data.likeRate,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div className="home-page">
      <h1>欢迎使用 RAG 系统</h1>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="知识库总数"
              value={stats.knowledgeBaseCount}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="文档总数"
              value={stats.documentCount}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="总反馈数"
              value={stats.totalFeedback}
              prefix={<CommentOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="好评率"
              value={stats.likeRate}
              precision={1}
              suffix="%"
              prefix={<LikeOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="反馈统计" loading={loading}>
            <div style={{ padding: '16px 0' }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic
                    title="点赞数"
                    value={stats.totalLikes}
                    prefix={<LikeOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="点踩数"
                    value={stats.totalDislikes}
                    prefix={<DislikeOutlined />}
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                </Col>
              </Row>
              <div style={{ marginTop: 24 }}>
                <div style={{ marginBottom: 8 }}>用户满意度</div>
                <Progress
                  percent={stats.likeRate}
                  status="active"
                  strokeColor="#52c41a"
                />
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="快捷操作">
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card
                  hoverable
                  size="small"
                  onClick={() => navigate('/chat')}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <CommentOutlined style={{ fontSize: 32, color: '#1890ff' }} />
                    <div style={{ marginTop: 12, fontSize: 16 }}>开始对话</div>
                  </div>
                </Card>
              </Col>
              <Col span={12}>
                <Card
                  hoverable
                  size="small"
                  onClick={() => navigate('/documents')}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <FileTextOutlined style={{ fontSize: 32, color: '#52c41a' }} />
                    <div style={{ marginTop: 12, fontSize: 16 }}>上传文档</div>
                  </div>
                </Card>
              </Col>
              <Col span={12}>
                <Card
                  hoverable
                  size="small"
                  onClick={() => navigate('/knowledge')}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <DatabaseOutlined style={{ fontSize: 32, color: '#722ed1' }} />
                    <div style={{ marginTop: 12, fontSize: 16 }}>知识库管理</div>
                  </div>
                </Card>
              </Col>
              <Col span={12}>
                <Card
                  hoverable
                  size="small"
                  onClick={() => navigate('/monitor')}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <CommentOutlined style={{ fontSize: 32, color: '#faad14' }} />
                    <div style={{ marginTop: 12, fontSize: 16 }}>反馈监控</div>
                  </div>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default HomePage;
