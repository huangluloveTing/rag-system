---
title: 聊天页面重设计
date: 2026-03-30
type: design
status: approved
---

# 前端聊天功能重设计

## 概述

重新实现前端问答聊天功能，使用 Vercel AI SDK 的 `useChat` hook 和 Ant Design X UI 组件，简化功能并优化用户体验。

## 背景

现有聊天页面功能过于复杂，包含文档引用（citations）、反馈系统等众多功能，导致代码复杂度高、维护困难。用户希望重新实现一个简化版本，保留核心的流式对话、thinking 过程展示、工具调用显示等功能，暂时不实现文档引用功能。

## 设计目标

1. **简洁清晰**：去除不必要的功能，代码结构清晰易懂
2. **用户体验**：流畅的流式输出体验，直观的 thinking 过程展示
3. **易于维护**：使用标准的 Ant Design X 组件，减少自定义逻辑
4. **可扩展性**：为后续文档引用等功能预留扩展空间

## 核心功能

### 保留功能
- 多轮对话（useChat hook）
- 流式输出（实时显示助手回复）
- Thinking 过程独立展示
- 工具调用状态显示
- 会话列表管理

### 移除功能
- 文档引用（citations）展示
- 反馈系统（点赞/点踩）
- 复杂的自定义消息渲染

### 暂不实现
- 文件附件上传
- 知识库选择器

## 技术方案

### 核心技术栈
- **UI 组件**: `@ant-design/x` - Bubble.List, Sender, useXChat
- **状态管理**: `@ai-sdk/react` - useChat hook
- **路由**: `react-router-dom`
- **HTTP**: 直接使用 useChat 内置的 fetch

### API 接口
- **流式对话**: `POST /api/v1/chat/stream`
- **会话列表**: `GET /api/v1/chat/sessions`
- **会话详情**: `GET /api/v1/chat/sessions/:id`
- **删除会话**: `DELETE /api/v1/chat/sessions/:id`

## 页面布局

### 整体结构
采用经典的双栏布局：
- **左侧**：280px 固定宽度，会话列表
- **右侧**：自适应宽度，对话区域

```
┌─────────────────────────────────────────────────────────┐
│ Chat Page                                               │
├─────────────┬───────────────────────────────────────────┤
│             │ 对话标题                                  │
│ 会话列表    ├───────────────────────────────────────────┤
│ (280px)     │                                           │
│             │ 消息列表区域                              │
│ + 新建对话  │ - 用户消息 (右侧蓝色)                    │
│             │ - Thinking Card (左侧灰色)                │
│ 历史会话... │ - 助手消息 (左侧灰色)                    │
│             │                                           │
│             ├───────────────────────────────────────────┤
│             │ 输入区域                                  │
│             │ [文本输入框] [发送按钮]                  │
└─────────────┴───────────────────────────────────────────┘
```

### 左侧会话列表

**组件**: `SessionList` (新建)

**功能**:
- 新建对话按钮
- 历史会话卡片列表
- 点击切换会话
- 删除会话操作

**状态**:
```typescript
interface SessionListProps {
  sessions: Session[];
  currentSessionId?: string;
  onSelect: (sessionId: string) => void;
  onCreate: () => void;
  onDelete: (sessionId: string) => void;
}

interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}
```

### 右侧对话区域

**主组件**: `ChatConversation` (新建)

**子组件**:
- `ConversationHeader` - 显示对话标题
- `MessageList` - 消息列表容器（使用 Ant Design X 的 Bubble.List）
- `ThinkingCard` - 思考过程展示卡片
- `ChatInput` - 输入框区域（使用 Ant Design X 的 Sender）

## 消息渲染逻辑

### useChat 集成

使用 `@ai-sdk/react` 的 `useChat` hook：

```typescript
const {
  messages,        // 消息数组
  input,           // 输入文本
  handleInputChange, // 输入变化处理
  handleSubmit,    // 提交处理
  isLoading,       // 加载状态
  error,           // 错误状态
  stop,            // 停止生成
  setMessages,     // 设置消息（用于加载历史）
} = useChat({
  api: '/api/v1/chat/stream',
  headers: {
    Authorization: `Bearer ${token}`,
  },
  body: {
    sessionId: currentSessionId,
  },
});
```

### 消息类型扩展

Vercel AI SDK 的消息包含 `toolInvocations` 字段：

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolInvocations?: ToolInvocation[];
}

interface ToolInvocation {
  toolName: string;
  toolCallId: string;
  args: Record<string, any>;
  result?: {
    results?: SearchResult[];
  };
  state: 'partial-call' | 'call' | 'result';
}

interface SearchResult {
  index: number;
  source: string;
  content: string;
  score: number;
}
```

### Thinking 过程展示

当助手消息包含 `toolInvocations` 时，在消息前显示 Thinking Card：

```typescript
// 判断是否需要显示 Thinking Card
const hasToolInvocations = message.toolInvocations &&
                           message.toolInvocations.length > 0;

// 提取工具调用信息
const toolCall = message.toolInvocations?.[0];
const isToolComplete = toolCall?.state === 'result';
```

**Thinking Card 显示内容**:
- 工具名称（如 `knowledge_base_search`）
- 搜索查询内容
- 结果数量
- 最高相似度分数
- 执行状态（进行中/已完成）

### 消息列表渲染

使用 Ant Design X 的 `Bubble.List` 组件：

```typescript
<Bubble.List
  items={items}
  style={{ height: 'calc(100vh - 200px)' }}
/>
```

转换为 Bubble.List 的 items 格式：

```typescript
const items = messages.flatMap(message => {
  const items = [];

  // 如果有工具调用，先添加 Thinking Card
  if (message.role === 'assistant' && hasToolInvocations(message)) {
    items.push({
      key: `${message.id}-thinking`,
      placement: 'left',
      type: 'thinking',
      content: <ThinkingCard toolInvocations={message.toolInvocations} />,
    });
  }

  // 然后添加消息本身
  items.push({
    key: message.id,
    placement: message.role === 'user' ? 'end' : 'start',
    type: message.role,
    content: message.content,
    typing: message.role === 'assistant' && isLoading,
  });

  return items;
});
```

## ThinkingCard 组件设计

### 功能

展示工具调用的详细过程，让用户了解系统如何检索信息。

### 视觉设计

- **位置**: 助手消息前独立展示
- **样式**: 灰色背景，带边框，图标标识
- **内容**:
  - 标题：🔍 思考过程
  - 工具名称和状态
  - 搜索查询内容
  - 结果数量和相似度分数

### 状态显示

- **进行中**: 显示加载动画，状态图标为 ⏳
- **已完成**: 显示具体数据，状态图标为 ✓，相似度分数绿色显示

### Props 定义

```typescript
interface ThinkingCardProps {
  toolInvocations: ToolInvocation[];
  isStreaming?: boolean;
}
```

## 会话管理逻辑

### 会话切换流程

1. 点击左侧会话卡片
2. 调用 `GET /api/v1/chat/sessions/:id` 获取历史消息
3. 使用 `setMessages()` 更新当前对话的消息列表
4. 更新 `currentSessionId` 状态

### 新建会话流程

1. 点击"新建对话"按钮
2. 清空当前消息列表 `setMessages([])`
3. 清空 `currentSessionId`（后端会自动创建新会话）
4. 用户发送第一条消息时，后端返回新的 `sessionId`

### 会话删除流程

1. 点击会话卡片上的删除图标
2. 调用 `DELETE /api/v1/chat/sessions/:id`
3. 如果删除的是当前会话，清空消息列表并切换到默认状态
4. 从会话列表中移除该项

## 组件文件结构

```
apps/frontend/src/pages/Chat/
├── index.tsx              # 主页面组件
├── components/
│   ├── SessionList.tsx    # 会话列表组件
│   ├── Conversation.tsx   # 对话区域主组件
│   ├── ThinkingCard.tsx   # 思考过程卡片
│   └── ChatInput.tsx      # 输入区域组件
├── hooks/
│   └── useSessionManager.ts # 会话管理 hook
├── types/
│   └── chat.ts            # 类型定义
└── index.css              # 样式文件（如需要）
```

## 状态管理

### 主要状态

```typescript
// Chat 页面主状态
const [sessions, setSessions] = useState<Session[]>([]);
const [currentSessionId, setCurrentSessionId] = useState<string>();
const [loadingSessions, setLoadingSessions] = useState(false);

// useChat 提供的状态
const { messages, input, isLoading, ... } = useChat();
```

### 会话管理 Hook

封装会话加载、切换、创建、删除逻辑：

```typescript
const {
  sessions,
  currentSessionId,
  loading,
  loadSessions,
  switchSession,
  createNewSession,
  deleteSession,
} = useSessionManager();
```

## 流式输出体验优化

### 打字效果

Ant Design X 的 Bubble 组件内置 `typing` 属性，自动显示流式输出的打字效果：

```typescript
content: message.content,
typing: isLoading && message.role === 'assistant',
```

### 停止生成

提供停止按钮，调用 `useChat` 的 `stop()` 方法：

```typescript
<Button onClick={stop} disabled={!isLoading}>
  停止生成
</Button>
```

### 加载状态

- 发送消息时禁用输入框
- 显示发送按钮的加载状态
- 消息列表滚动到底部

## 错误处理

### API 错误

useChat 的 `onError` 回调：

```typescript
useChat({
  onError: (error) => {
    console.error('Chat error:', error);
    message.error('发送失败，请重试');
  },
});
```

### 会话加载错误

```typescript
try {
  const sessionDetail = await getSession(sessionId);
  setMessages(sessionDetail.messages);
} catch (error) {
  message.error('加载会话失败');
}
```

## 样式设计

### 主要样式

- **左侧会话列表**: 固定宽度 280px，白色背景，右边框分隔
- **会话卡片**: padding 12px，hover 效果，选中时背景色高亮
- **消息气泡**:
  - 用户：右侧对齐，蓝色背景 (#1890ff)，白色文字
  - 助手：左侧对齐，灰色背景 (#f5f5f5)，最大宽度 70%
- **Thinking Card**: 浅灰背景 (#f0f0f0)，边框，圆角 8px
- **输入区域**: 底部固定，padding 16px，输入框高度自适应

### Ant Design X 组件样式

使用 Bubble.List 和 Sender 的默认样式，必要时通过 `style` prop 微调：

```typescript
<Bubble.List style={{ height: 'calc(100vh - 200px)', padding: '16px' }} />
<Sender style={{ width: '100%' }} />
```

## 性能优化

### 消息列表滚动

使用 Bubble.List 的内置滚动管理，避免手动控制：

```typescript
// Bubble.List 自动管理滚动到底部
<Bubble.List items={items} />
```

### 会话列表分页

初始加载限制数量，后续按需加载：

```typescript
// 加载最近 20 个会话
loadSessions({ page: 1, pageSize: 20 });
```

### 消息历史限制

后端已限制历史消息数量（最近 12 条），前端无需额外截断。

## 测试要点

### 功能测试

1. **流式输出**: 验证消息实时显示，无卡顿
2. **多轮对话**: 验证历史消息正确发送，上下文连贯
3. **会话切换**: 验证切换会话后消息正确加载
4. **新建会话**: 验证第一条消息后正确创建新会话
5. **Thinking 显示**: 验证工具调用信息正确展示
6. **停止生成**: 验证可以中途停止流式输出

### 交互测试

1. **输入体验**: 输入框响应流畅，发送按钮状态正确
2. **会话列表**: 点击、删除操作正常
3. **滚动体验**: 新消息自动滚动到底部
4. **加载状态**: 加载时 UI 正确显示 loading 状态

## 实现优先级

1. **P0 - 核心对话功能**
   - Chat 主页面布局
   - useChat hook 集成
   - Bubble.List 消息渲染
   - Sender 输入组件
   - 流式输出展示

2. **P1 - Thinking 和工具调用**
   - ThinkingCard 组件
   - toolInvocations 提取和展示
   - 工具调用状态显示

3. **P2 - 会话管理**
   - SessionList 组件
   - 会话加载和切换
   - 新建会话
   - 删除会话

## 未来扩展

预留以下功能的扩展空间：

1. **文档引用**: 在助手消息中添加引用标记，点击查看原文
2. **文件上传**: 输入框添加附件按钮，支持文档上传
3. **知识库选择**: 添加知识库下拉选择器
4. **反馈系统**: 添加点赞/点踩功能

## 总结

本设计重新实现了简化的聊天功能，聚焦核心的多轮对话和流式输出体验，使用标准的 Ant Design X 和 Vercel AI SDK 组件，代码结构清晰，易于维护和扩展。通过独立的 Thinking Card 展示思考过程，让用户了解系统的检索行为，提升透明度和信任感。