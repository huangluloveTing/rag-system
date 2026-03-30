## ADDED Requirements

### Requirement: 思考过程展示

系统 SHALL 向用户展示 LLM 的思考过程和检索元数据。

#### Scenario: 展示检索触发
- **WHEN** LLM 调用了 knowledge_base_search tool
- **THEN** 在答案上方显示"已检索知识库"图标和文字

#### Scenario: 展示检索关键词
- **WHEN** tool 被调用
- **THEN** 显示检索关键词（来自 tool args.query）

#### Scenario: 展示检索结果统计
- **WHEN** 检索完成
- **THEN** 显示"找到 X 条相关信息，最高相似度 0.XX"

#### Scenario: 无检索时的展示
- **WHEN** LLM 未调用 tool（直接回答）
- **THEN** 显示"基于通用知识回答"提示

#### Scenario: 检索失败处理
- **WHEN** 检索服务异常
- **THEN** 显示"检索服务暂时不可用，基于通用知识回答"

### Requirement: 思考过程 UI 交互

系统 SHALL 提供友好的思考过程 UI 交互。

#### Scenario: 折叠/展开
- **WHEN** 用户点击思考过程区域
- **THEN** 折叠或展开详细信息

#### Scenario: 加载动画
- **WHEN** 检索正在进行中
- **THEN** 显示加载动画和"检索中..."文字

#### Scenario: 来源链接跳转
- **WHEN** 用户点击思考过程中的文档名称
- **THEN** 跳转到文档管理页面的对应文档
