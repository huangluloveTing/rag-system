/**
 * MessageHeader Component
 * Displays message metadata (role, timestamp, annotations)
 */
import React, { useMemo } from 'react';
import { Space, Tag } from 'antd';
import { UserOutlined, RobotOutlined, WarningOutlined } from '@ant-design/icons';

interface MessageHeaderProps {
  role: 'user' | 'assistant' | 'system';
  timestamp?: string;
  annotations?: Record<string, any>;
  hasError?: boolean;
}

const MessageHeader: React.FC<MessageHeaderProps> = ({
  role,
  timestamp,
  annotations,
  hasError = false,
}) => {
  // Role display
  const roleDisplay = useMemo(() => ({
    user: { icon: <UserOutlined />, text: '用户', color: 'blue' },
    assistant: { icon: <RobotOutlined />, text: 'AI 助手', color: hasError ? 'red' : 'green' },
    system: { icon: <RobotOutlined />, text: '系统', color: 'orange' },
  }), [hasError]);

  const roleInfo = roleDisplay[role] || roleDisplay.assistant;

  // Extract annotations
  const usage = annotations?.usage;
  const duration = annotations?.duration;
  const model = annotations?.model;

  return (
    <div
      role="banner"
      aria-label="Message metadata"
      style={{
        marginBottom: '8px',
        fontSize: '12px',
        color: hasError ? '#ff4d4f' : '#8c8c8c',
        borderBottom: hasError ? '1px solid #ffccc7' : '1px solid #f0f0f0',
        paddingBottom: '8px'
      }}
    >
      <Space size="small" wrap>
        {/* Role */}
        <span style={{ color: hasError ? '#ff4d4f' : 'inherit' }}>
          {roleInfo.icon} {roleInfo.text}
        </span>

        {/* Timestamp */}
        {timestamp && (
          <span>• {timestamp}</span>
        )}

        {/* Error tag */}
        {hasError && (
          <Tag color="error" style={{ fontSize: '11px', margin: 0 }}>
            错误
          </Tag>
        )}

        {/* Token usage */}
        {usage && (
          <Tag color="default" style={{ fontSize: '11px', margin: 0 }}>
            {usage.totalTokens || 0} tokens
          </Tag>
        )}

        {/* Duration */}
        {duration && (
          <Tag color="default" style={{ fontSize: '11px', margin: 0 }}>
            {(duration / 1000).toFixed(1)}s
          </Tag>
        )}

        {/* Model */}
        {model && (
          <Tag color="blue" style={{ fontSize: '11px', margin: 0 }}>
            {model}
          </Tag>
        )}
      </Space>
    </div>
  );
};

export default MessageHeader;