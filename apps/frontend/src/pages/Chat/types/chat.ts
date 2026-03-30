/**
 * Chat type definitions
 * Aligned with backend API and Vercel AI SDK message format
 */

// Session types
export interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionDetail {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

// Message types (Vercel AI SDK compatible)
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolInvocations?: ToolInvocation[];
  createdAt?: Date;
}

export interface ToolInvocation {
  toolName: string;
  toolCallId: string;
  args: Record<string, any>;
  result?: {
    results?: SearchResult[];
  };
  state: 'partial-call' | 'call' | 'result';
}

export interface SearchResult {
  index: number;
  source: string;
  content: string;
  score: number;
}

// Component prop types
export interface ThinkingCardProps {
  toolInvocations: ToolInvocation[];
  isStreaming?: boolean;
}

export interface SessionListProps {
  sessions: Session[];
  currentSessionId?: string;
  loading?: boolean;
  onSelect: (sessionId: string) => void;
  onCreate: () => void;
  onDelete: (sessionId: string) => void;
}

export interface ConversationProps {
  sessionId?: string;
  onSessionCreated?: (sessionId: string) => void;
}
