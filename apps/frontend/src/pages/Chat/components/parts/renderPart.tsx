/**
 * Message Part Renderer
 * Maps message part types to appropriate components
 */
import React from 'react';
import TextPart from './TextPart';
import ReasoningPart from './ReasoningPart';
import ToolInvocationPart from './ToolInvocationPart';
import type { Tool, UIMessage, UITool, UIToolInvocation } from 'ai';

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
  part: UIMessage["parts"][number],
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

    case 'reasoning':
      return (
        <ReasoningPart
          key={key}
          content={part.text}
          isStreaming={isStreaming}
        />
      );

    default:
      if (part.type.startsWith('tool-')) {
        return (
          <ToolInvocationPart
            key={key}
            toolInvocation={part as UIToolInvocation<UITool | Tool>}
            isStreaming={isStreaming}
          />
        );
      }
      // For unknown part types, render nothing or a placeholder
      console.warn(`Unknown message part type: ${part.type}`);
      return null
  }
}