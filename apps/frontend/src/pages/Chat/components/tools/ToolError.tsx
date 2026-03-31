/**
 * ToolError Component
 * Error state display for tool invocations
 */
import React from 'react';
import { Alert } from 'antd';
import { CloseCircleOutlined } from '@ant-design/icons';

interface ToolErrorProps {
  toolName: string;
  error: string | Error;
  args?: Record<string, any>;
}

const ToolError: React.FC<ToolErrorProps> = ({ toolName, error, args }) => {
  const errorMessage = typeof error === 'string' ? error : error.message || '未知错误';

  return (
    <div>
      <div style={{ fontSize: '13px', fontWeight: 500, color: '#ff4d4f', marginBottom: '8px' }}>
        <CloseCircleOutlined /> 工具调用失败：{toolName}
      </div>

      <Alert
        type="error"
        message="执行错误"
        description={errorMessage}
        style={{ marginBottom: '8px' }}
      />

      {/* Show arguments if available */}
      {args && Object.keys(args).length > 0 && (
        <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
          <div>调用参数：</div>
          <pre
            style={{
              fontSize: '12px',
              backgroundColor: '#fff2f0',
              padding: '8px',
              borderRadius: '4px',
              overflow: 'auto',
              maxHeight: '200px',
            }}
          >
            {JSON.stringify(args, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ToolError;