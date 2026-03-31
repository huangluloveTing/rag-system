/**
 * ToolResult Component
 * Expandable result display
 */
import React, { useMemo } from 'react';
import { Collapse } from 'antd';

interface ToolResultProps {
  result: any;
  isStreaming?: boolean;
}

const ToolResult: React.FC<ToolResultProps> = ({ result, isStreaming }) => {
  if (!result) {
    return null;
  }

  // Try to format the result nicely
  const resultDisplay = useMemo(() =>
    typeof result === 'object'
      ? JSON.stringify(result, null, 2)
      : String(result),
    [result]
  );

  // Truncate very long results for preview
  const preview = resultDisplay.length > 100
    ? resultDisplay.substring(0, 100) + '...'
    : resultDisplay;

  return (
    <Collapse
      ghost
      items={[
        {
          key: 'result',
          label: (
            <span style={{ fontSize: '12px', color: '#52c41a' }}>
              • 查看结果详情
            </span>
          ),
          children: (
            <pre
              role="region"
              aria-label="Tool result"
              style={{
                fontSize: '12px',
                backgroundColor: '#f5f5f5',
                padding: '8px',
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '300px',
                opacity: isStreaming ? 0.7 : 1,
              }}
            >
              {resultDisplay}
            </pre>
          ),
        },
      ]}
      defaultActiveKey={[]}
    />
  );
};

export default ToolResult;