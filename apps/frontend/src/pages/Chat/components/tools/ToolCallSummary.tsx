/**
 * ToolCallSummary Component
 * Header showing tool name and status
 */
import React, { useMemo } from 'react';
import { CheckCircleOutlined, LoadingOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { Spin } from 'antd';

interface ToolCallSummaryProps {
  toolName: string;
  state: 'partial-call' | 'call' | 'partial-result' | 'result';
}

const ToolCallSummary: React.FC<ToolCallSummaryProps> = ({ toolName, state }) => {
  const status = useMemo(() => {
    switch (state) {
      case 'partial-call':
        return {
          icon: <Spin indicator={<LoadingOutlined spin />} size="small" />,
          text: '⏳ 参数流式传输...',
          color: '#faad14',
        };
      case 'call':
        return {
          icon: <Spin indicator={<LoadingOutlined spin />} size="small" />,
          text: '⏳ 执行中...',
          color: '#faad14',
        };
      case 'partial-result':
        return {
          icon: <Spin indicator={<LoadingOutlined spin />} size="small" />,
          text: '⏳ 处理结果...',
          color: '#faad14',
        };
      case 'result':
        return {
          icon: <CheckCircleOutlined />,
          text: '✓ 完成',
          color: '#52c41a',
        };
      default:
        return {
          icon: <LoadingOutlined />,
          text: '处理中...',
          color: '#8c8c8c',
        };
    }
  }, [state]);

  return (
    <div role="status" aria-live="polite" aria-label={`Tool ${toolName} status: ${status.text}`} style={{ fontSize: '13px', fontWeight: 500, color: '#666' }}>
      🔧 工具调用：{toolName}
      <span style={{ marginLeft: '8px', color: status.color }}>
        {status.icon}
        <span style={{ marginLeft: '4px' }}>{status.text}</span>
      </span>
    </div>
  );
};

export default ToolCallSummary;