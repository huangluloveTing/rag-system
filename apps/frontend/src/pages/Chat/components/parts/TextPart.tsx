/**
 * TextPart Component
 * Renders text content with markdown formatting
 */
import React from 'react';
import ReactMarkdown from 'react-markdown';

interface TextPartProps {
  content: string;
  isStreaming?: boolean;
}

const TextPart: React.FC<TextPartProps> = ({ content, isStreaming }) => {
  return (
    <div
      style={{
        fontSize: '14px',
        lineHeight: '1.6',
        opacity: isStreaming ? 0.6 : 1,
        transition: 'opacity 0.5s ease-in-out',
        position: 'relative',
      }}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
      {isStreaming && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          fontSize: '11px',
          color: '#8c8c8c',
          fontStyle: 'italic',
        }}>
          正在生成...
        </div>
      )}
    </div>
  );
};

export default TextPart;