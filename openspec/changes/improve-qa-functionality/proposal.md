## Why

当前 RAG 系统的知识问答功能已实现基础的 Tool Calling 智能检索，但在实际使用中存在以下问题：

1. **回答准确性不足**：检索结果与问题的相关性判断不够精准，Rerank 效果未达最优
2. **缺少引用来源标注**：用户无法追溯答案来源，降低可信度
3. **无多轮对话优化**：历史上下文利用不充分，连续追问体验差
4. **缺少反馈机制**：无法收集用户对答案的满意度，难以持续优化
5. **前端展示简陋**：缺少加载状态、错误提示、思考过程可视化

本变更旨在系统性提升知识问答功能的准确性、功能特性和用户体验。

## What Changes

### 新增功能
- **智能引用标注**：答案中自动标注来源文档和页码，支持点击跳转
- **多轮对话优化**：基于会话上下文的指代消解和意图理解
- **用户反馈系统**：点赞/点踩 + 文字反馈，支持反馈查看和处理
- **思考过程展示**：显示 LLM 是否调用了知识库检索、检索关键词等
- **答案生成优化**：Prompt 工程优化，提升回答准确性和完整性

### 改进功能
- **Rerank 策略优化**：调整 Rerank 模型参数，提升排序质量
- **检索结果过滤**：增加智能阈值，避免低质量结果影响答案
- **前端 UI 重构**：改进聊天界面，增加来源卡片、反馈入口、加载动画

### 非目标（Non-goals）
- 不改变现有的 Tool Calling 架构
- 不替换当前的 LLM 模型和 Embedding 模型
- 不涉及知识库管理功能的改动
- 不改变数据库核心结构（仅新增反馈表）

## Capabilities

### New Capabilities
- `answer-citation`: 答案引用来源标注功能，支持文档跳转
- `conversation-context`: 多轮对话上下文理解和指代消解
- `feedback-system`: 用户反馈收集、查看和处理
- `thinking-display`: 显示 LLM 思考过程和 tool calling 元数据
- `prompt-optimization`: 优化的 System Prompt 和答案生成策略

### Modified Capabilities
- `knowledge-base-tool-calling`: 优化检索参数和 Rerank 策略，提升检索质量

## Impact

###  affected 代码
- **后端**:
  - `apps/backend/src/modules/chat/chat.service.ts` - 核心聊天逻辑改造
  - `apps/backend/src/modules/feedback/` - 新增反馈模块
  - `apps/backend/src/modules/llm/llm.service.ts` - Prompt 优化
  - `apps/backend/src/modules/retrieval/retrieval.service.ts` - Rerank 优化
- **前端**:
  - `apps/frontend/src/pages/Chat/` - 聊天页面 UI 重构
  - `apps/frontend/src/services/chat.service.ts` - API 调用改造
- **数据库**:
  - 新增 `Feedback` 模型
  - `ChatMessage` 模型扩展字段

### API 变更
- `POST /api/v1/chat` - 响应新增 `citations` 和 `thinking` 字段
- `POST /api/v1/feedback` - 新增反馈提交接口
- `GET /api/v1/feedback` - 新增反馈列表接口（管理员）

### 依赖
- 无新增外部依赖
- 需要重新运行数据库迁移

### 性能影响
- 单次回答延迟增加约 200-500ms（Rerank 和优化处理）
- 前端渲染复杂度略有增加
