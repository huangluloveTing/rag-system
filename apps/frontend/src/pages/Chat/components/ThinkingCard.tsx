/**
 * ThinkingCard Component
 * Displays tool invocation details before assistant messages
 */
import React from 'react';
import { Card, Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import type { ThinkingCardProps, ToolInvocation } from '../types/chat';

const ThinkingCard: React.FC<ThinkingCardProps> = ({
  toolInvocations,
  isStreaming = false,
}) => {
  if (!toolInvocations || toolInvocations.length === 0) {
    return null;
  }

  const toolCall = toolInvocations[0];
  const isComplete = toolCall.state === 'result';
  const toolName = toolCall.toolName;

  // Extract search query from tool arguments
  const searchQuery = toolCall.args?.query || '正在搜索...';

  // Extract result information from tool result
  const results = toolCall.result?.results || [];
  const resultCount = results.length;
  const topScore = results.length > 0 ? results[0].score : 0;

  return (
    <Card
      size="small"
      style={{
        backgroundColor: '#f0f0f0',
        border: '1px solid #d9d9d9',
        borderRadius: '8px',
        marginBottom: '12px',
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 500, color: '#666', marginBottom: '8px' }}>
        🔍 思考过程
      </div>

      <div style={{ fontSize: '12px', color: '#666' }}>
        {/* Tool name and status */}
        <div style={{ marginBottom: '4px' }}>
          {isComplete ? (
            <span style={{ color: '#52c41a' }}>✓ 工具调用：{toolName}</span>
          ) : (
            <span>
              <Spin indicator={<LoadingOutlined spin />} size="small" />
              <span style={{ marginLeft: '8px' }}>⏳ 工具调用：{toolName}</span>
            </span>
          )}
        </div>

        {/* Search query */}
        <div style={{ marginBottom: '4px' }}>
          • 搜索查询：{searchQuery}
        </div>

        {/* Result count */}
        {!isStreaming && isComplete && (
          <div style={{ marginBottom: '4px' }}>
            • 找到 {resultCount} 个相关文档片段
          </div>
        )}

        {/* Top similarity score */}
        {isComplete && topScore > 0 && (
          <div style={{ color: '#52c41a' }}>
            • 最高相似度：{topScore.toFixed(2)}
          </div>
        )}
      </div>
    </Card>
  );
};

export default ThinkingCard;
