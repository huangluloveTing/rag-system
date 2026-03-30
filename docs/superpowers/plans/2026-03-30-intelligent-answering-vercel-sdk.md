# Intelligent Answering Implementation Plan (Vercel SDK Native)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement intelligent RAG-powered answering using Vercel AI SDK native capabilities with automatic tool calling, reasoning support, and citation extraction.

**Architecture:** Use `streamText({ maxSteps: 5 })` + `toUIMessageStreamResponse()` for backend, standard `useChat` hook for frontend. SDK automatically manages tool calling loops, SSE serialization, and message formatting.

**Tech Stack:** NestJS, Vercel AI SDK (streamText, useChat), React, TypeScript, standard OpenAI API protocol.

---

## File Structure

**Backend (Modified):**
- `apps/backend/src/modules/llm/llm.service.ts` - Modify `generateStream` to return `toUIMessageStreamResponse()`, add `maxSteps: 5`
- `apps/backend/src/modules/chat/chat.service.ts` - Simplify `chatStream`, remove manual SSE helpers, add `saveAssistantMessage` and `extractCitations`
- `apps/backend/src/modules/chat/chat.controller.ts` - Update return type to `Promise<Response>`

**Frontend (Modified):**
- `apps/frontend/src/pages/Chat/index.tsx` - Replace custom provider with `useChat` hook, extract citations from `toolInvocations`, render reasoning

**Components (Reuse):**
- `apps/frontend/src/components/ThinkingCard.tsx` - Already implemented
- `apps/frontend/src/components/Citation.tsx` - Already implemented
- `apps/frontend/src/components/CitationPanel.tsx` - Already implemented

---

## Task 1: Backend - Modify LlmService.generateStream

**Files:**
- Modify: `apps/backend/src/modules/llm/llm.service.ts:291-327`

- [ ] **Step 1: Update method signature**

Change the return type from `AsyncIterable<string>` to `Promise<Response>`:

```typescript
async generateStream(
  messages: ChatMessage[],
  options: {
    temperature?: number;
    maxTokens?: number;
    enableToolCalling?: boolean;
  } = {},
): Promise<Response> {
```

- [ ] **Step 2: Add maxSteps parameter**

Inside the `streamText` call, uncomment and update the `maxSteps` line:

```typescript
const result = streamText({
  model: this.openai(this.model),
  messages,
  temperature,
  maxRetries: 3,
  maxSteps: enableToolCalling ? 5 : 1, // Enable up to 5 tool calling steps
  tools: enableToolCalling
    ? this.getKnowledgeBaseSearchTool()
    : undefined,
});
```

- [ ] **Step 3: Return UI Message Stream Response**

Replace `return result.textStream;` with:

```typescript
// Return standard UI Message Stream Response
return result.toUIMessageStreamResponse();
```

- [ ] **Step 4: Verify complete method**

Read the modified method to confirm it matches the spec.

- [ ] **Step 5: Commit backend LlmService changes**

```bash
git add apps/backend/src/modules/llm/llm.service.ts
git commit -m "feat(llm): use Vercel SDK toUIMessageStreamResponse

- Add maxSteps: 5 for automatic tool calling loops
- Return Response instead of textStream
- Enable SDK to manage SSE serialization"
```

---

## Task 2: Backend - Simplify ChatService

**Files:**
- Modify: `apps/backend/src/modules/chat/chat.service.ts`

- [ ] **Step 1: Remove manual SSE helper methods**

Delete these methods if they exist:
- `serializeSSEEvent`
- `buildThinkingInfo`
- `buildCitations`
- `buildFinalPrompt`
- `chatIntelligentStream` (if partially implemented)

- [ ] **Step 2: Simplify chatStream method**

Replace the existing `chatStream` method implementation with:

```typescript
/**
 * 流式聊天（UI Message Stream）
 */
async chatStream(
  request: ChatRequest,
  userId: string,
): Promise<Response> {
  const { question, knowledgeBaseId, sessionId } = request;
  const startTime = Date.now();

  try {
    // 1. 创建/获取会话
    let session = sessionId
      ? await this.prisma.chatSession.findUnique({
          where: { id: sessionId },
        })
      : null;

    if (!session) {
      session = await this.prisma.chatSession.create({
        data: {
          userId,
          knowledgeBaseId,
          title: question.substring(0, 50),
        },
      });
      this.logger.debug(`Created new session: ${session.id}`);
    }

    // 2. 获取历史消息
    const history = await this.getChatHistory(session.id);

    // 3. 构建消息
    const messages: ChatMessage[] = [
      ...this.llmService.buildToolCallingPrompt(),
      ...history.slice(-12),
      { role: 'user', content: question },
    ];

    // 4. 保存用户消息
    await this.prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: question,
      },
    });

    // 5. 调用 LLM 流式生成（SDK 自动处理工具调用）
    const response = await this.llmService.generateStream(messages, {
      enableToolCalling: true,
    });

    // 6. 异步保存助手消息（流式结束后）
    this.saveAssistantMessage(response.clone(), session.id, startTime).catch(
      (err) => {
        this.logger.error('Failed to save assistant message:', err);
      },
    );

    return response;
  } catch (error) {
    this.logger.error(`Chat stream failed: ${error.message}`);
    throw error;
  }
}
```

- [ ] **Step 3: Add saveAssistantMessage method**

Add this new private method to handle async message saving:

```typescript
/**
 * 异步保存助手消息
 */
private async saveAssistantMessage(
  response: Response,
  sessionId: string,
  startTime: number,
): Promise<void> {
  try {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let fullContent = '';
    let toolInvocations: any[] = [];
    let usage = null;

    // 读取完整流
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });

      // 解析 UI Message Stream 格式（SSE）
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));

            if (data.content) {
              fullContent += data.content;
            }

            if (data.toolInvocations) {
              toolInvocations = data.toolInvocations;
            }

            if (data.usage) {
              usage = data.usage;
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }

    // 提取 citations
    const citations = this.extractCitations(toolInvocations);

    // 保存到数据库
    await this.prisma.chatMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content: fullContent,
        toolCalls:
          toolInvocations.length > 0
            ? ({ toJSON: () => toolInvocations } as any)
            : undefined,
        references:
          citations.length > 0
            ? ({ toJSON: () => citations } as any)
            : undefined,
        latencyMs: Date.now() - startTime,
        tokensUsed: usage?.totalTokens || 0,
      },
    });

    this.logger.debug(`Saved assistant message for session ${sessionId}`);
  } catch (error) {
    this.logger.error('Error saving assistant message:', error);
  }
}
```

- [ ] **Step 4: Add extractCitations method**

Add this helper to extract citations from tool invocations:

```typescript
/**
 * 从工具调用记录中提取 citations
 */
private extractCitations(toolInvocations: any[]): any[] {
  return toolInvocations
    .filter(
      (inv) =>
        inv.toolName === 'knowledge_base_search' && inv.result?.results,
    )
    .flatMap((inv) =>
      inv.result.results.map((r: any, idx: number) => ({
        index: idx + 1,
        chunkId: r.index.toString(),
        documentId: r.source || '',
        content: r.content,
        source: r.source || '未知文档',
        score: r.score,
      })),
    );
}
```

- [ ] **Step 5: Verify ChatService simplification**

Read the file to confirm:
- Manual SSE helpers removed
- `chatStream` simplified
- `saveAssistantMessage` and `extractCitations` added
- Uses `response.clone()` before async save

- [ ] **Step 6: Commit ChatService changes**

```bash
git add apps/backend/src/modules/chat/chat.service.ts
git commit -m "feat(chat): simplify to use Vercel SDK UI Message Stream

- Remove manual SSE serialization helpers
- Simplify chatStream to call LlmService.generateStream
- Add async saveAssistantMessage with stream reading
- Add extractCitations helper
- Use response.clone() for dual consumption"
```

---

## Task 3: Backend - Update ChatController

**Files:**
- Modify: `apps/backend/src/modules/chat/chat.controller.ts:66-80`

- [ ] **Step 1: Update stream endpoint return type**

Locate the `@Post('stream')` endpoint and update to:

```typescript
/**
 * 流式聊天（UI Message Stream）
 * POST /api/v1/chat/stream
 */
@Post('stream')
@ApiOperation({ summary: '流式聊天（UI Message Stream）' })
async streamMessage(
  @Body() request: ChatRequest,
  @CurrentUser() user: any,
): Promise<Response> {
  return this.chatService.chatStream(request, user.id);
}
```

- [ ] **Step 2: Verify import**

Ensure `Response` type is imported (should be from `node-fetch` or global):

```typescript
// At top of file if not already present
import type { Response } from 'node-fetch';
```

- [ ] **Step 3: Commit controller changes**

```bash
git add apps/backend/src/modules/chat/chat.controller.ts
git commit -m "feat(chat): return Response from stream endpoint

- Update return type to Promise<Response>
- Directly return UI Message Stream Response"
```

---

## Task 4: Backend - Test UI Message Stream

**Files:**
- None (manual testing)

- [ ] **Step 1: Start backend server**

Run: `pnpm dev:backend`
Wait for server to start on port 3000

- [ ] **Step 2: Test successful retrieval scenario**

Run curl to test the UI Message Stream:

```bash
curl -X POST http://localhost:3000/api/v1/chat/stream \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"question":"报销流程是什么？"}' \
  --no-buffer
```

Expected: SSE events in UI Message Stream format:
```
data: {"id":"msg-xxx","role":"assistant","content":""}
data: {"content":"公司的"}
data: {"toolInvocations":[...]}
data: {"content":"需要提交发票 [1]。"}
data: [DONE]
```

- [ ] **Step 3: Verify database save**

Check that `chat_messages` table has:
- User message with role='user'
- Assistant message with toolCalls and references JSON
- tokensUsed and latencyMs populated

- [ ] **Step 4: Mark backend testing complete**

Backend is working if:
- ✅ UI Message Stream format returned
- ✅ Tool invocations present
- ✅ Citations extracted
- ✅ Messages saved to database

---

## Task 5: Frontend - Update ChatPage with useChat

**Files:**
- Modify: `apps/frontend/src/pages/Chat/index.tsx`

- [ ] **Step 1: Replace imports**

Replace existing imports with:

```typescript
/**
 * 聊天页面 - 使用 Vercel AI SDK useChat
 */
import React, { useState } from 'react';
import { useChat } from 'ai/react';
import { ThinkingCard } from '@/components/ThinkingCard';
import { Citation } from '@/components/Citation';
import { CitationPanel, CitationItem } from '@/components/CitationPanel';
import './index.css';
```

- [ ] **Step 2: Replace component with useChat hook**

Replace the entire ChatPage component with:

```typescript
const ChatPage: React.FC = () => {
  const token = localStorage.getItem('token') || '';

  // 引用面板状态
  const [citationPanelOpen, setCitationPanelOpen] = useState(false);
  const [currentCitations, setCurrentCitations] = useState<CitationItem[]>(
    [],
  );

  // 使用 Vercel AI SDK 的 useChat hook
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
  } = useChat({
    api: `${
      import.meta.env.VITE_API_URL || 'http://localhost:3000'
    }/api/v1/chat/stream`,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });
```

- [ ] **Step 3: Add extractCitations helper**

Add after the useChat hook:

```typescript
  // 从 toolInvocations 提取 citations
  const extractCitations = (toolInvocations: any[]): CitationItem[] => {
    return toolInvocations
      .filter(
        (inv) =>
          inv.toolName === 'knowledge_base_search' && inv.result?.results,
      )
      .flatMap((inv) =>
        inv.result.results.map((r: any, idx: number) => ({
          index: idx + 1,
          chunkId: r.index.toString(),
          documentId: r.source || '',
          content: r.content,
          source: r.source || '未知文档',
          score: r.score,
        })),
      );
  };
```

- [ ] **Step 4: Add renderContentWithCitations helper**

Add after extractCitations:

```typescript
  // 渲染带引用标记的内容
  const renderContentWithCitations = (
    content: string,
    citations: CitationItem[],
  ) => {
    if (!citations || citations.length === 0) {
      return <span>{content}</span>;
    }

    const parts = content.split(/(\[\d+\])/g);

    return (
      <div className="message-content">
        <div className="message-text">
          {parts.map((part, idx) => {
            const match = part.match(/\[(\d+)\]/);
            if (match) {
              const citationIndex = parseInt(match[1]);
              const citation = citations.find((c) => c.index === citationIndex);
              if (citation) {
                return (
                  <Citation
                    key={idx}
                    index={citation.index}
                    source={citation.source}
                    score={citation.score}
                    onClick={() => {
                      setCurrentCitations(citations);
                      setCitationPanelOpen(true);
                    }}
                  />
                );
              }
            }
            return <span key={idx}>{part}</span>;
          })}
        </div>
      </div>
    );
  };
```

- [ ] **Step 5: Add message rendering**

Add the return statement with message rendering:

```typescript
  return (
    <div className="chat-page">
      <div className="chat-container">
        {/* 消息列表 */}
        <div className="chat-messages">
          {messages.map((msg) => {
            const isAssistant = msg.role === 'assistant';

            // 提取 citations
            const citations =
              isAssistant && (msg as any).toolInvocations
                ? extractCitations((msg as any).toolInvocations)
                : [];

            // 提取检索元数据
            const toolInvocations = (msg as any).toolInvocations || [];
            const searchTool = toolInvocations.find(
              (inv: any) => inv.toolName === 'knowledge_base_search',
            );

            return (
              <div key={msg.id} className={`message ${msg.role}`}>
                {/* Reasoning 展示（如果有） */}
                {isAssistant && (msg as any).reasoning && (
                  <div className="message-reasoning">
                    <details>
                      <summary>思考过程</summary>
                      <div className="reasoning-content">
                        {(msg as any).reasoning}
                      </div>
                    </details>
                  </div>
                )}

                {/* Thinking Card（检索元数据） */}
                {isAssistant && searchTool && (
                  <ThinkingCard
                    usedToolCalling={true}
                    searchQuery={searchTool.args?.query}
                    resultCount={searchTool.result?.results?.length || 0}
                    topScore={searchTool.result?.results?.[0]?.score}
                    isLoading={false}
                  />
                )}

                {/* 消息内容 */}
                <div className="message-content">
                  {isAssistant
                    ? renderContentWithCitations(msg.content, citations)
                    : msg.content}
                </div>
              </div>
            );
          })}
        </div>

        {/* 输入表单 */}
        <form onSubmit={handleSubmit} className="chat-input">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="输入你的问题..."
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? '发送中...' : '发送'}
          </button>
        </form>
      </div>

      {/* 引用来源面板 */}
      <CitationPanel
        open={citationPanelOpen}
        onClose={() => setCitationPanelOpen(false)}
        citations={currentCitations}
      />
    </div>
  );
};

export default ChatPage;
```

- [ ] **Step 6: Verify complete ChatPage**

Read the file to confirm all changes are integrated properly.

- [ ] **Step 7: Commit frontend changes**

```bash
git add apps/frontend/src/pages/Chat/index.tsx
git commit -m "feat(frontend): use Vercel AI SDK useChat hook

- Replace custom provider with standard useChat
- Extract citations from message.toolInvocations
- Render reasoning and thinking card
- Parse citation markers in answer text
- Use CitationPanel for source details"
```

---

## Task 6: Frontend - Test Integration

**Files:**
- None (manual testing)

- [ ] **Step 1: Start frontend dev server**

Run: `pnpm dev:frontend`
Wait for Vite to start on port 5173

- [ ] **Step 2: Open chat page**

Navigate to: `http://localhost:5173/chat`
Expected: Chat interface loads with input field

- [ ] **Step 3: Test retrieval scenario**

Type: "报销流程是什么？"
Press Enter
Expected:
- Messages appear in real-time
- ThinkingCard shows searchQuery and resultCount
- Answer streams with citation markers [1], [2]
- Reasoning panel visible (if model supports)

- [ ] **Step 4: Test citation interaction**

Click on a citation marker [1]
Expected: CitationPanel opens on right side showing citation details

- [ ] **Step 5: Test no results scenario**

Type: "如何造火箭？"
Expected: ThinkingCard shows "找到 0 条结果"

- [ ] **Step 6: Mark frontend testing complete**

Frontend is working if:
- ✅ Messages stream in real-time
- ✅ ThinkingCard displays correctly
- ✅ Reasoning panel works
- ✅ Citation markers render and are clickable
- ✅ CitationPanel shows details

---

## Task 7: Final Integration Test

**Files:**
- None (end-to-end testing)

- [ ] **Step 1: Run full stack**

Run: `pnpm dev` (starts both backend and frontend)
Wait for both services to be ready

- [ ] **Step 2: Complete user journey test**

1. Open chat page at `http://localhost:5173/chat`
2. Ask question: "公司的报销流程是什么？"
3. Verify reasoning panel appears (if model supports)
4. Verify ThinkingCard shows search metadata
5. Verify answer streams with [1], [2] markers
6. Click citation marker [1]
7. Verify CitationPanel opens with full details
8. Check FeedbackButton appears (if implemented)

- [ ] **Step 3: Verify database records**

Run: `pnpm db:studio`
Check:
- ✅ ChatSession created with correct title
- ✅ ChatMessage records for user and assistant
- ✅ Assistant message has toolCalls JSON
- ✅ Assistant message has references JSON with citations
- ✅ tokensUsed and latencyMs recorded

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat: complete intelligent answering with Vercel SDK

Backend:
- Use streamText with maxSteps: 5 for automatic tool calling
- Return UI Message Stream via toUIMessageStreamResponse
- Async message saving with citation extraction
- Remove manual SSE handling

Frontend:
- Use standard useChat hook
- Extract citations from toolInvocations
- Render reasoning and thinking card
- Parse citation markers in answers

Testing:
- Verified successful retrieval scenarios
- Verified citation interaction
- Database records correctly saved"
```

---

## Self-Review Checklist

**Spec Coverage:**
- ✅ `streamText({ maxSteps: 5 })` (Task 1)
- ✅ `toUIMessageStreamResponse()` (Task 1)
- ✅ Simplified ChatService (Task 2)
- ✅ Async message saving (Task 2)
- ✅ Controller returns Response (Task 3)
- ✅ Frontend useChat hook (Task 5)
- ✅ Extract citations from toolInvocations (Task 5)
- ✅ Render reasoning (Task 5)
- ✅ Parse citation markers (Task 5)

**Placeholder Scan:**
- ✅ No TBD/TODO comments
- ✅ All code shown in steps
- ✅ All imports and types defined
- ✅ Complete methods provided

**Type Consistency:**
- ✅ `Promise<Response>` return type matches across backend
- ✅ `CitationItem` interface matches backend citation structure
- ✅ `toolInvocations` accessed as `any[]` (SDK provides types)
- ✅ `reasoning` accessed as optional string

**Plan saved to:** `docs/superpowers/plans/2026-03-30-intelligent-answering-vercel-sdk.md`