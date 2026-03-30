/**
 * ChatInput Component
 * Input area with text field and send button
 */
import React from 'react';
import { Sender } from '@ant-design/x';
import { Button, Space } from 'antd';
import { StopOutlined } from '@ant-design/icons';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  loading?: boolean;
  disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  onStop,
  loading = false,
  disabled = false,
}) => {
  return (
    <div style={{ padding: '16px', borderTop: '1px solid #e0e0e0' }}>
      <Space.Compact style={{ width: '100%' }}>
        <Sender
          value={value}
          onChange={onChange}
          onSubmit={onSend}
          loading={loading}
          disabled={disabled || loading}
          placeholder="输入您的问题..."
          style={{ flex: 1 }}
        />
        {loading && onStop && (
          <Button
            type="default"
            icon={<StopOutlined />}
            onClick={onStop}
            style={{ marginLeft: '8px' }}
          >
            停止生成
          </Button>
        )}
      </Space.Compact>
    </div>
  );
};

export default ChatInput;
