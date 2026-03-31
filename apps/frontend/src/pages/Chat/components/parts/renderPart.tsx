/**
 * Message Part Renderer
 * Maps message part types to appropriate components
 */
import React from 'react';
import TextPart from './TextPart';
import ReasoningPart from './ReasoningPart';
import ToolInvocationPart from './ToolInvocationPart';

// Part types from Vercel AI SDK
export type MessagePart = {
  type: 'text';
  text: string;
} | {
  type: 'tool-invocation';
  toolInvocation: any;
} | {
  type: 'reasoning';
  text: string;
} | {
  type: string; // Allow other part types
  [key: string]: any;
};

/**
 * Render a message part based on its type
 */
export function renderMessagePart(
  part: MessagePart,
  isStreaming: boolean,
  index: number
): React.ReactElement {
  const key = `part-${index}`;

  switch (part.type) {
    case 'text':
      return (
        <TextPart
          key={key}
          content={part.text}
          isStreaming={isStreaming}
        />
      );

    case 'tool-invocation':
      return (
        <ToolInvocationPart
          key={key}
          toolInvocation={part.toolInvocation}
          isStreaming={isStreaming}
        />
      );

    case 'reasoning':
      return (
        <ReasoningPart
          key={key}
          content={part.text}
          isStreaming={isStreaming}
        />
      );

    default:
      // Unknown part type - show as fallback
      return (
        <div key={key} style={{ fontSize: '14px' }}>
          {JSON.stringify(part)}
        </div>
      );
  }
}