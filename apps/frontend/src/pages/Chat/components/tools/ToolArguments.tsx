/**
 * ToolArguments Component
 * Expandable JSON viewer for tool arguments
 */
import React, { useMemo } from 'react';
import { Collapse } from 'antd';

interface ToolArgumentsProps {
  args: Record<string, any>;
  isStreaming?: boolean;
}

const ToolArguments: React.FC<ToolArgumentsProps> = ({ args, isStreaming }) => {
  const hasArgs = useMemo(() =>
    args && Object.keys(args).length > 0,
    [args]
  );

  if (!hasArgs) {
    return null;
  }

  return (
    <Collapse
      ghost
      items={[
        {
          key: 'args',
          label: (
            <span style={{ fontSize: '12px', color: '#666' }}>
              • 查看参数详情
            </span>
          ),
          children: (
            <pre
              role="region"
              aria-label="Tool arguments"
              style={{
                fontSize: '12px',
                backgroundColor: '#f5f5f5',
                padding: '8px',
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '200px',
                opacity: isStreaming ? 0.7 : 1,
              }}
            >
              {useMemo(() => JSON.stringify(args, null, 2), [args])}
            </pre>
          ),
        },
      ]}
      defaultActiveKey={[]}
    />
  );
};

export default ToolArguments;