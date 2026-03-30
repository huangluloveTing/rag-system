/**
 * 思考过程展示卡片组件
 * 展示检索状态、关键词、结果统计
 */
import React, { useState } from 'react';
import { Card, Collapse, Tag, Typography, Spin } from 'antd';
import {
  SearchOutlined,
  DatabaseOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import './ThinkingCard.css';

const { Text, Paragraph } = Typography;

export interface ThinkingCardProps {
  usedToolCalling: boolean;
  searchQuery?: string;
  resultCount?: number;
  topScore?: number;
  message?: string;
  isLoading?: boolean;
}

export const ThinkingCard: React.FC<ThinkingCardProps> = ({
  usedToolCalling,
  searchQuery,
  resultCount,
  topScore,
  message,
  isLoading,
}) => {
  const [expanded, setExpanded] = useState(true);

  if (isLoading) {
    return (
      <div className="thinking-card thinking-card-loading">
        <Spin size="small" />
        <Text type="secondary" className="thinking-card-loading-text">
          检索中...
        </Text>
      </div>
    );
  }

  if (!usedToolCalling && !message) {
    return null;
  }

  return (
    <Card
      size="small"
      className={`thinking-card ${!usedToolCalling ? 'thinking-card-no-retrieval' : ''}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="thinking-card-header">
        <div className="thinking-card-title">
          {usedToolCalling ? (
            <>
              <DatabaseOutlined className="thinking-card-icon" />
              <Text strong>已检索知识库</Text>
            </>
          ) : (
            <>
              <InfoCircleOutlined className="thinking-card-icon" />
              <Text strong>基于通用知识回答</Text>
            </>
          )}
        </div>
        <Text type="secondary" className="thinking-card-toggle">
          {expanded ? '收起' : '展开'}
        </Text>
      </div>

      {expanded && usedToolCalling && (
        <div className="thinking-card-content">
          {searchQuery && (
            <div className="thinking-card-row">
              <SearchOutlined className="thinking-card-row-icon" />
              <Text type="secondary">检索关键词：</Text>
              <Tag color="blue">{searchQuery}</Tag>
            </div>
          )}
          {resultCount !== undefined && (
            <div className="thinking-card-row">
              <CheckCircleOutlined className="thinking-card-row-icon" />
              <Text type="secondary">找到 </Text>
              <Text strong>{resultCount}</Text>
              <Text type="secondary"> 条相关信息</Text>
            </div>
          )}
          {topScore !== undefined && (
            <div className="thinking-card-row">
              <DatabaseOutlined className="thinking-card-row-icon" />
              <Text type="secondary">最高相似度：</Text>
              <Text strong>{(topScore * 100).toFixed(1)}%</Text>
            </div>
          )}
        </div>
      )}

      {expanded && message && !usedToolCalling && (
        <div className="thinking-card-content">
          <Paragraph type="secondary">{message}</Paragraph>
        </div>
      )}
    </Card>
  );
};
