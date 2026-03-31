/**
 * RAGToolDisplay Component
 * Specialized display for RAG retrieval tool results
 */
import React, { useState, useMemo } from 'react';
import { Collapse, Tag, Empty } from 'antd';
import { SearchOutlined, FileTextOutlined } from '@ant-design/icons';
import type { SearchResult } from '../types/chat';

interface RAGToolDisplayProps {
  toolName: string;
  args: { query?: string; knowledgeBaseId?: string };
  result?: { results?: SearchResult[] };
  state: 'partial-call' | 'call' | 'partial-result' | 'result';
}

const RAGToolDisplay: React.FC<RAGToolDisplayProps> = ({
  toolName,
  args,
  result,
  state,
}) => {
  const [showAll, setShowAll] = useState(false);

  // Extract query
  const query = useMemo(() => args?.query || '未知查询', [args]);

  // Extract results
  const results = useMemo(() => result?.results || [], [result]);
  const resultCount = results.length;
  const isComplete = state === 'result';

  // Display top 3 or all based on toggle
  const displayResults = useMemo(() =>
    showAll ? results : results.slice(0, 3),
    [showAll, results]
  );
  const hasMoreResults = results.length > 3;

  if (!isComplete || !results || results.length === 0) {
    return (
      <div style={{ fontSize: '12px', color: '#666' }}>
        <div style={{ marginBottom: '4px' }}>
          <SearchOutlined /> 搜索查询：{query}
        </div>
        {state === 'call' && (
          <div>正在检索相关文档...</div>
        )}
        {isComplete && resultCount === 0 && (
          <Empty description="未找到相关文档" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </div>
    );
  }

  return (
    <div role="region" aria-label="Search results">
      {/* Query display */}
      <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>
        <SearchOutlined /> 搜索查询："{query}"
      </div>

      {/* Result count */}
      <div style={{ fontSize: '12px', color: '#52c41a', marginBottom: '8px' }}>
        ✓ 找到 {resultCount} 个相关文档片段
      </div>

      {/* Top results */}
      <div role="list" aria-label="Search results" style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>
          {showAll ? '全部结果' : 'Top 3 结果'}:
        </div>

        {displayResults.map((item, index) => (
          <div
            key={index}
            role="listitem"
            aria-label={`Result ${index + 1}: ${item.source} (score: ${item.score.toFixed(2)})`}
            style={{
              fontSize: '12px',
              padding: '6px',
              marginBottom: '4px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
            }}
          >
            <div style={{ fontWeight: 500 }}>
              {index + 1}. <Tag color="green">{item.score.toFixed(2)}</Tag>
              <FileTextOutlined style={{ marginLeft: '4px' }} />
              {item.source}
            </div>
            <div
              style={{
                marginTop: '4px',
                color: '#8c8c8c',
                lineHeight: '1.4',
                maxHeight: '40px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {item.content}
            </div>
          </div>
        ))}
      </div>

      {/* Show all toggle */}
      {hasMoreResults && !showAll && (
        <button
          style={{
            fontSize: '12px',
            color: '#1890ff',
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            padding: 0,
          }}
          onClick={() => setShowAll(true)}
          aria-label="Show all results"
        >
          [展开查看全部 {resultCount} 个结果]
        </button>
      )}

      {/* Collapse all */}
      {showAll && hasMoreResults && (
        <button
          style={{
            fontSize: '12px',
            color: '#1890ff',
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            padding: 0,
          }}
          onClick={() => setShowAll(false)}
          aria-label="Show only top 3 results"
        >
          [收起显示前 3 个结果]
        </button>
      )}
    </div>
  );
};

export default RAGToolDisplay;