# Design: Frontend UIMessage Rendering Optimization

## Architecture Overview

### Component Hierarchy

```
ChatPage
├── SessionList (unchanged)
└── ConversationArea
    ├── MessageList (new)
    │   ├── MessageItem (new, per message)
    │   │   ├── MessageHeader (timestamp, role, metadata)
    │   │   ├── MessageContent (parts renderer)
    │   │   │   ├── TextPart (markdown rendering)
    │   │   │   ├── ToolInvocationPart (per tool call)
    │   │   │   │   ├── ToolCallSummary (collapsible header)
    │   │   │   │   ├── ToolArguments (expandable JSON viewer)
    │   │   │   │   ├── ToolResult (expandable result display)
    │   │   │   │   └── ToolError (error state)
    │   │   │   └── ReasoningPart (thinking content)
    │   │   └── MessageAnnotations (token usage, sources)
    │   └── StreamingIndicator
    └── ChatInput (unchanged)
```

### Data Flow

1. `useChat()` returns UIMessage[] with full structure
2. Messages are rendered as MessageItem components
3. Each message renders its `parts` array (if available) or falls back to `content`
4. Tool invocations are rendered individually with full details
5. Annotations are extracted and displayed in message header/footer

## Key Design Decisions

### 1. Use Message Parts Instead of Tool Invocations Array

**Decision**: Render `message.parts` instead of `message.toolInvocations`

**Rationale**:
- Vercel AI SDK v4+ uses `parts` as the canonical way to represent message content
- Parts include text, tool invocations, attachments, reasoning - all in order
- Allows interleaved text and tool calls (e.g., "Let me search..." then tool call)
- Better represents the actual conversation flow

**Implementation**:
```typescript
// Check if message has parts (v4+ API)
if (message.parts && message.parts.length > 0) {
  // Render parts in order
  message.parts.map(part => renderPart(part))
} else {
  // Fallback to content string (legacy)
  renderText(message.content)
}
```

### 2. Tool Invocation States

**States to handle**:
- `partial-call`: Tool name known, arguments still being streamed
- `call`: Tool call complete, waiting for result
- `partial-result`: Result being streamed
- `result`: Tool execution complete

**Visual Design**:
- `partial-call`: Spinner with tool name, streaming arguments
- `call`: Spinner with "Executing...", frozen arguments
- `partial-result`: Spinner with "Processing result...", partial result
- `result`: Success icon, complete result in expandable section

### 3. Expandable/Collapsible Details

**Default State**:
- Tool summary visible (tool name, status, brief info)
- Arguments collapsed
- Results collapsed

**Expanded State**:
- Full argument JSON with formatting
- Full result with search results list (for RAG)
- Each search result shows: content, source, score

**Implementation**: Use Ant Design's Collapse component

### 4. RAG-Specific Tool Display

**For retrieval tools** (`search_knowledge_base`):
- Show query prominently
- Show document count
- List top 3 results with scores and sources
- Expandable to see all results
- Click to view full document content (future)

**Format**:
```
🔍 搜索知识库
查询: "如何实现 RAG?"
状态: ✓ 完成
找到 5 个相关文档

Top 3 结果:
1. [0.89] RAG系统架构设计.md
2. [0.85] 向量检索原理.md
3. [0.82] Embedding模型选择.md

[展开查看全部结果]
```

### 5. Reasoning/Thinking Content

**Detection**:
- Check for `annotations.reasoning` field
- Or check for parts with `type: 'reasoning'`

**Display**:
- Light gray background
- Collapsible by default
- Shows thinking process before final answer
- Markdown formatted

### 6. Error Handling

**Tool Errors**:
- Show tool name with error icon
- Display error message prominently
- Show partial arguments if available
- Allow retry (future feature)

**Message Errors**:
- Red border/background
- Error message in header
- Original content still visible
- Retry button

### 7. Annotations/Metadata

**Display in MessageHeader**:
- Timestamp: `createdAt` formatted as relative time
- Token usage: If `annotations.usage` exists
- Model: If `annotations.model` exists
- Duration: If `annotations.duration` exists

**Format**:
```
AI Assistant • 2 min ago • 245 tokens • 1.2s
```

### 8. Streaming Indicators

**During streaming**:
- Show typing indicator at message bottom
- Show partial content with fade effect
- Tool calls show live argument streaming
- Stop button visible

## Component Design

### MessageItem Component

```typescript
interface MessageItemProps {
  message: UIMessage;
  isStreaming: boolean;
}

// Renders:
// - Header (role, timestamp, metadata)
// - Parts (text, tools, reasoning) or content fallback
// - Annotations
```

### ToolInvocationPart Component

```typescript
interface ToolInvocationPartProps {
  toolInvocation: ToolInvocation;
  isStreaming: boolean;
}

// Renders:
// - Tool name and status icon
// - Collapsible arguments section
// - Collapsible results section
// - Error display if failed
```

### RAGToolDisplay Component (specialized)

```typescript
interface RAGToolDisplayProps {
  toolName: string;
  args: { query: string; knowledgeBaseId?: string };
  result?: { results: SearchResult[] };
  state: ToolInvocationState;
}

// Renders RAG-specific visualization:
// - Query in search format
// - Document results with scores
// - Expandable source content
```

## Styling Approach

### Color Scheme
- User messages: Blue accent
- Assistant messages: Gray/white
- Tool calls: Yellow/amber background
- Success: Green checkmark
- Error: Red border
- Reasoning: Light gray

### Typography
- Headers: 14px bold
- Content: 14px regular
- Metadata: 12px light gray
- Tool details: 13px monospace for JSON

### Spacing
- Message gap: 16px
- Part gap: 12px
- Tool call padding: 12px
- Section padding: 8px

## Migration Strategy

### Phase 1: MessageItem Component
1. Create MessageItem to replace direct Bubble rendering
2. Use parts-based rendering with fallback to content
3. Preserve existing ThinkingCard temporarily

### Phase 2: Tool Invocation Enhancement
1. Replace ThinkingCard with ToolInvocationPart
2. Implement expandable arguments/results
3. Add RAG-specific display

### Phase 3: Metadata and Annotations
1. Add MessageHeader with timestamps
2. Display token usage from annotations
3. Show reasoning content

### Phase 4: Polish
1. Add error states
2. Improve streaming visualization
3. Add accessibility features
4. Optimize performance

## Technical Considerations

### Performance
- Use React.memo for MessageItem
- Virtualize long conversations (optional)
- Debounce expand/collapse animations

### Accessibility
- ARIA labels for tool states
- Keyboard navigation for expandable sections
- Screen reader announcements for streaming

### Testing
- Test all tool invocation states
- Test streaming updates
- Test error scenarios
- Test parts vs content fallback

## Dependencies

Existing packages suffice:
- `ai` (v6.0.134) - UIMessage types
- `@ai-sdk/react` (v3.0.136) - useChat hook
- `antd` (v5.29.3) - UI components
- `react-markdown` (v10.1.0) - Markdown rendering

No new dependencies needed.