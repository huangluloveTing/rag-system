# Proposal: Optimize Frontend UIMessage Rendering

## What

Optimize the frontend chat interface to fully leverage Vercel AI SDK's UIMessage model for rich conversation rendering, including:
- Complete tool invocation visualization (all tools, not just first one)
- Detailed tool call arguments and results display
- Conversation metadata (timestamps, reasoning steps, annotations)
- Better message part rendering (attachments, reasoning content)
- Enhanced conversation flow visualization

## Why

### Current Issues

1. **Incomplete Tool Invocation Display**: ThinkingCard only shows the first tool invocation, missing subsequent calls
2. **Limited Tool Details**: Only shows basic query and result count, not full argument/result structure
3. **Missing Conversation Context**: No timestamps, token usage, or message metadata
4. **Poor Multi-Tool Support**: Can't display sequential or parallel tool calls properly
5. **No Reasoning Display**: Doesn't show assistant reasoning/thinking content
6. **Limited Error Visualization**: Tool errors aren't properly displayed

### Benefits

1. **Better UX**: Users can see the full RAG process - what queries were made, what documents were retrieved
2. **Transparency**: Clear visualization of how the AI arrives at answers
3. **Debugging**: Easier to understand when/why tool calls fail
4. **Trust**: Users can verify sources and reasoning
5. **Rich Interactions**: Support for future features like attachments, multi-modal content

### Technical Alignment

The Vercel AI SDK's UIMessage model already provides:
- `parts`: Array of message parts (text, tool invocations, attachments)
- `toolInvocations`: Detailed tool call information with states
- `annotations`: Custom metadata (timestamps, token usage, reasoning)
- `createdAt`: Message creation time

We should leverage these features fully rather than just using `content` string.

## Success Criteria

1. All tool invocations in a message are displayed
2. Tool arguments and results are shown in expandable sections
3. Timestamps and metadata are visible
4. Reasoning/thinking content is displayed when present
5. Tool errors are clearly shown with error details
6. Conversation flow is clear and intuitive