/**
 * MessageItem Component
 * Renders a single UIMessage with full structure support
 */
import React, { useMemo } from 'react';
import type { UIMessage } from 'ai';
import MessageHeader from './MessageHeader';
import { renderMessagePart } from './parts/renderPart';
import { Card } from 'antd';

interface MessageItemProps {
  message: UIMessage;
  isStreaming: boolean;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, isStreaming }) => {
  // Role display text for accessibility
  const roleDisplay = useMemo(() => ({
    user: '用户',
    assistant: 'AI 助手',
    system: '系统',
  }), []);

  // Determine message role styling
  const isUser = message.role === 'user';

  // Check for message-level error (if exists in message metadata)
  const hasError = useMemo(() => (message as any).error || false, [message]);
  const errorMessage = useMemo(() => (message as any).errorMessage || '', [message]);

  // Format relative timestamp (UIMessage may not have createdAt, use current time as fallback)
  const relativeTime = useMemo(() => {
    // UIMessage doesn't have createdAt in current version, skip for now
    return '';
  }, []);

  // Render message content - use parts if available, fallback to content
  const contentElements = useMemo(() => {
    // Check if message has parts (Vercel AI SDK v4+)
    if (message.parts && message.parts.length > 0) {
      return message.parts.map((part, index) =>
        renderMessagePart(part, isStreaming, index)
      );
    }

    // Fallback to content string for legacy messages
    // UIMessage has content property
    const content = (message as any).content || '';
    return (
      <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
        {content}
      </div>
    );
  }, [message, isStreaming]);

  return (
    <Card
      size="small"
      role="article"
      aria-label={`${roleDisplay[message.role] || 'AI'} message`}
      aria-live={isStreaming ? 'polite' : 'off'}
      style={{
        marginBottom: '16px',
        backgroundColor: hasError ? '#fff2f0' : (isUser ? '#e6f7ff' : '#ffffff'),
        border: hasError ? '1px solid #ffccc7' : `1px solid ${isUser ? '#1890ff' : '#e0e0e0'}`,
        borderRadius: '8px',
      }}
      styles={{ body: { padding: '12px' } }}
    >
      {/* Header with role, timestamp, metadata */}
      <MessageHeader
        role={message.role}
        timestamp={relativeTime}
        annotations={undefined}
        hasError={hasError}
      />

      {/* Error message if present */}
      {hasError && (
        <div style={{
          marginBottom: '8px',
          padding: '8px',
          backgroundColor: '#ffccc7',
          borderRadius: '4px',
          fontSize: '13px',
          color: '#ff4d4f'
        }}>
          ⚠️ {errorMessage || '发生错误'}
        </div>
      )}

      {/* Message content (parts or fallback) */}
      <div style={{ marginTop: '8px' }}>
        {contentElements}
      </div>

      {/* Streaming indicator with fade effect */}
      {isStreaming && !hasError && (
        <div style={{
          marginTop: '8px',
          fontSize: '12px',
          color: '#8c8c8c',
          fontStyle: 'italic',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}>
          <span style={{ opacity: 0.7 }}>正在输入...</span>
        </div>
      )}
    </Card>
  );
};

export default React.memo(MessageItem);