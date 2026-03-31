/**
 * ToolInvocationPart Component
 * Renders tool invocation with full details
 * Uses RAGToolDisplay for retrieval tools, generic display for others
 */
import React from 'react';
import { Card } from 'antd';
import type { ToolInvocation } from '../types/chat';
import ToolCallSummary from '../tools/ToolCallSummary';
import ToolArguments from '../tools/ToolArguments';
import ToolResult from '../tools/ToolResult';
import ToolError from '../tools/ToolError';
import RAGToolDisplay from '../tools/RAGToolDisplay';

interface ToolInvocationPartProps {
  toolInvocation: ToolInvocation;
  isStreaming: boolean;
}

const ToolInvocationPart: React.FC<ToolInvocationPartProps> = ({
  toolInvocation,
  isStreaming,
}) => {
  const { toolName, state, args, result } = toolInvocation;

  // Check for error state (result might contain error)
  const hasError = result && typeof result === 'object' && result.error;

  // Check if this is a RAG retrieval tool
  const isRAGTool = toolName.includes('search') || toolName.includes('retrieve') || toolName.includes('knowledge');

  return (
    <Card
      size="small"
      style={{
        backgroundColor: hasError ? '#fff2f0' : '#fffbe6',
        border: hasError ? '1px solid #ffccc7' : '1px solid #ffe58f',
        borderRadius: '8px',
        marginBottom: '12px',
      }}
      styles={{ body: { padding: '12px' } }}
    >
      {/* Tool name and status */}
      <ToolCallSummary toolName={toolName} state={state} />

      {/* Error display */}
      {hasError && (
        <div style={{ marginTop: '8px' }}>
          <ToolError
            toolName={toolName}
            error={result.error}
            args={args}
          />
        </div>
      )}

      {/* RAG-specific display for retrieval tools */}
      {!hasError && isRAGTool && (
        <div style={{ marginTop: '8px' }}>
          <RAGToolDisplay
            toolName={toolName}
            args={args}
            result={result}
            state={state}
          />
        </div>
      )}

      {/* Generic display for non-RAG tools */}
      {!hasError && !isRAGTool && (
        <>
          {/* Arguments display (expandable) */}
          {args && Object.keys(args).length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <ToolArguments args={args} isStreaming={isStreaming && state === 'partial-call'} />
            </div>
          )}

          {/* Result display (expandable) */}
          {result && state === 'result' && (
            <div style={{ marginTop: '8px' }}>
              <ToolResult result={result} isStreaming={state === 'partial-result'} />
            </div>
          )}
        </>
      )}
    </Card>
  );
};

export default ToolInvocationPart;