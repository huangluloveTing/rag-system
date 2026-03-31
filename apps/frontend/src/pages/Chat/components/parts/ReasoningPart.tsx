/**
 * ReasoningPart Component
 * Renders thinking/reasoning content in collapsible section
 */
import React from 'react';
import { Collapse } from 'antd';
import ReactMarkdown from 'react-markdown';
import { BulbOutlined } from '@ant-design/icons';

interface ReasoningPartProps {
  content: string;
  isStreaming?: boolean;
}

const ReasoningPart: React.FC<ReasoningPartProps> = ({ content, isStreaming }) => {
  return (
    <Collapse
      ghost
      items={[
        {
          key: 'reasoning',
          label: (
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#666' }}>
              <BulbOutlined /> 思考过程
              {isStreaming && (
                <span style={{ marginLeft: '8px', fontSize: '11px', fontStyle: 'italic' }}>
                  (正在思考...)
                </span>
              )}
            </span>
          ),
          children: (
            <div
              style={{
                fontSize: '13px',
                lineHeight: '1.5',
                backgroundColor: '#f5f5f5',
                padding: '8px',
                borderRadius: '4px',
                opacity: isStreaming ? 0.6 : 1,
                transition: 'opacity 0.5s ease-in-out',
              }}
            >
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          ),
        },
      ]}
      defaultActiveKey={[]}
    />
  );
};

export default ReasoningPart;