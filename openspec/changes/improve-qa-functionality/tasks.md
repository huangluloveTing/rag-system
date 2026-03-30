## 1. 数据库迁移

- [x] 1.1 创建 Feedback 模型 Prisma Schema（包含 rating、comment、tags、status 字段）
- [x] 1.2 运行 `pnpm db:migrate` 创建数据库表
- [x] 1.3 验证迁移：`pnpm prisma migrate status`
- [x] 1.4 更新 Prisma Client：`pnpm prisma generate`

## 2. 后端 - 反馈模块

- [x] 2.1 创建 Feedback 模块结构（modules/feedback/）
- [x] 2.2 实现 FeedbackService（createFeedback、getFeedbackList、getFeedbackDetail、resolveFeedback）
- [x] 2.3 实现 FeedbackController（POST /feedback、GET /feedback、GET /feedback/:id、PATCH /feedback/:id/resolve）
- [x] 2.4 添加 FeedbackModule 到 AppModule
- [ ] 2.5 编写单元测试（覆盖率 80%+）
- [ ] 2.6 添加 JWT AuthGuard 和 AdminGuard 到管理接口

## 3. 后端 - 聊天服务优化

- [x] 3.1 优化 ChatService 处理引用标注（解析 LLM 返回的 `[1]` 标记）
- [x] 3.2 修改 ChatResponse 类型，新增 citations 和 thinking 字段
- [x] 3.3 优化 LlmService 的 System Prompt（增加引用标记引导）
- [x] 3.4 扩展历史消息数量从 6 条到 12 条
- [x] 3.5 优化 RetrievalService 的 Rerank 参数（topK=8，增加 Rerank 阈值过滤）
- [x] 3.6 实现动态相似度阈值（根据查询长度调整）
- [ ] 3.7 编写集成测试（验证完整聊天流程）

## 4. 后端 - API 文档

- [x] 4.1 更新 Swagger 文档（新增 Feedback 相关接口）
- [x] 4.2 验证 API 文档：访问 http://localhost:3000/api/docs

## 5. 前端 - 引用标注展示

- [x] 5.1 创建 Citation 组件（支持上标、Tooltip、点击展开）
- [x] 5.2 创建 CitationPanel 组件（侧边面板显示来源详情）
- [x] 5.3 修改 Chat 页面解析答案中的 `[1]` 标记并渲染为 Citation 组件
- [x] 5.4 实现无引用时的提示展示
- [x] 5.5 添加响应式样式（移动端适配）

## 6. 前端 - 思考过程展示

- [x] 6.1 创建 ThinkingCard 组件（展示检索状态、关键词、结果统计）
- [x] 6.2 实现折叠/展开交互
- [x] 6.3 实现加载动画（检索中状态）
- [x] 6.4 集成到 Chat 页面消息气泡
- [x] 6.5 处理无检索和检索失败的展示逻辑

## 7. 前端 - 反馈功能

- [x] 7.1 创建 FeedbackForm 组件（评分、标签选择、评论输入）
- [x] 7.2 创建 FeedbackButton 组件（点赞/点踩按钮）
- [x] 7.3 实现反馈提交逻辑（调用 POST /feedback）
- [x] 7.4 实现反馈频率限制（前端防重复提交）
- [x] 7.5 未登录用户提示跳转登录
- [x] 7.6 集成到 Chat 页面每条消息下方

## 8. 前端 - 反馈管理后台

- [ ] 8.1 创建 FeedbackList 页面（列表、筛选、分页）
- [ ] 8.2 创建 FeedbackDetail 页面（完整对话上下文、用户评论）
- [ ] 8.3 实现标记已处理功能
- [ ] 8.4 实现反馈导出 CSV 功能
- [ ] 8.5 添加路由：/admin/feedback
- [ ] 8.6 添加管理员权限校验

## 9. 前端 - 服务层改造

- [x] 9.1 修改 chat.service.ts 适配新的 API 响应格式（citations、thinking 字段）
- [x] 9.2 新增 feedback.service.ts（提交反馈、获取反馈列表）
- [x] 9.3 更新 API 类型定义（types/index.ts）

## 10. 测试与验证

- [ ] 10.1 后端单元测试：`pnpm test`（覆盖率 80%+）
- [ ] 10.2 前端组件测试（Citation、FeedbackForm 等关键组件）
- [ ] 10.3 手动测试：完整聊天流程（引用标注、思考展示、反馈提交）
- [ ] 10.4 多轮对话测试（指代消解、上下文理解）
- [ ] 10.5 性能测试（响应时间 < 3 秒）
- [ ] 10.6 浏览器兼容性测试（Chrome、Safari、Firefox）

## 11. 文档与部署

- [ ] 11.1 更新 README.md（新增功能说明）
- [ ] 11.2 更新 API 文档（Feedback 接口说明）
- [ ] 11.3 编写部署检查清单
- [ ] 11.4 生产环境验证（灰度发布）
