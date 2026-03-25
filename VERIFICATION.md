# 前端开发完成 - 验证步骤

## 修改文件列表

### 新增服务文件
1. `/apps/frontend/src/services/documents.ts` - 文档管理 API
2. `/apps/frontend/src/services/knowledge.ts` - 知识库管理 API
3. `/apps/frontend/src/services/user.ts` - 用户信息 API
4. `/apps/frontend/src/services/feedback.ts` - 反馈统计 API

### 修改的服务文件
5. `/apps/frontend/src/services/auth.ts`
   - 修复登录响应接口，使用 `access_token` 而非 `token`
   - 修改 `getCurrentUser` 为 GET 请求

### 修改的页面文件
6. `/apps/frontend/src/pages/Login/index.tsx`
   - 修复 token 存储：使用 `res.data.access_token`
   - 支持 `refresh_token` 存储

7. `/apps/frontend/src/pages/Documents/index.tsx`
   - 完整实现文档管理功能
   - 支持知识库选择
   - 支持拖拽上传
   - 文档列表、删除、重新索引
   - 详情抽屉

8. `/apps/frontend/src/pages/Knowledge/index.tsx`
   - 完整实现知识库管理
   - 创建/编辑/删除知识库
   - 分块和检索参数配置
   - 统计信息展示

9. `/apps/frontend/src/pages/Profile/index.tsx`
   - 完整实现个人中心
   - 从 API 获取用户信息
   - 编辑邮箱和密码
   - 退出登录

10. `/apps/frontend/src/pages/Home/index.tsx`
    - 使用真实数据替换硬编码
    - 展示知识库、文档、反馈统计
    - 快捷操作导航

### 新增样式文件
11. `/apps/frontend/src/pages/Documents/index.css`
12. `/apps/frontend/src/pages/Knowledge/index.css`
13. `/apps/frontend/src/pages/Profile/index.css`
14. `/apps/frontend/src/pages/Home/index.css`

### 修改的工具文件
15. `/apps/frontend/src/utils/request.ts`
    - 修复响应拦截器，适配 NestJS 直接返回数据的格式
    - 清除 refresh_token

## 手工验证步骤

### 前置条件
```bash
# 1. 启动基础设施
pnpm docker:infra

# 2. 启动后端服务
pnpm dev:backend

# 3. 启动 Embedding 服务
pnpm dev:embedding

# 4. 启动前端服务
pnpm dev:frontend
```

### 验证流程

#### 1. 登录/注册
- 访问 http://localhost:5173/login
- 测试注册功能（用户名、邮箱、密码）
- 测试登录功能
- 验证 token 正确存储在 localStorage
- 验证登录后跳转到首页

#### 2. 首页（Home）
- 验证显示真实的统计数据：
  - 知识库总数
  - 文档总数
  - 总反馈数
  - 好评率
- 验证反馈统计卡片（点赞数、点踩数、满意度进度条）
- 测试快捷操作按钮：
  - 点击"开始对话"跳转到 /chat
  - 点击"上传文档"跳转到 /documents
  - 点击"知识库管理"跳转到 /knowledge
  - 点击"反馈监控"跳转到 /monitor

#### 3. 知识库管理（Knowledge）
- 点击"创建知识库"按钮
- 填写表单：
  - 名称（必填）
  - 描述（可选）
  - 分块大小（100-2000）
  - 分块重叠（0-500）
  - 启用 Rerank 开关
  - 相似度阈值（0-1）
- 验证创建成功后列表更新
- 点击"编辑"按钮，修改知识库配置
- 点击"统计"按钮，查看：
  - 文档总数
  - 总分块数
  - 文档状态分布（待处理、处理中、已索引、失败）
- 点击"删除"按钮，确认删除（带警告提示）

#### 4. 文档管理（Documents）
- 使用知识库筛选下拉框过滤文档
- 点击"上传文档"按钮
- 选择知识库
- 拖拽或点击上传文件（支持 PDF、Word、Markdown、TXT）
- 验证上传进度和结果
- 查看文档列表：
  - 文件名、知识库、文件类型、大小
  - 状态标签（待处理/处理中/已索引/失败）
  - 分块数、上传时间
- 点击"详情"查看文档元数据
- 点击"重新索引"触发重新处理
- 点击"删除"删除文档
- 测试分页功能

#### 5. 个人中心（Profile）
- 验证显示当前用户信息：
  - 用户名
  - 邮箱
  - 角色
  - 创建时间
- 点击"编辑资料"
- 修改邮箱（验证邮箱格式）
- 修改密码（验证至少 6 位，确认密码一致）
- 验证更新成功
- 点击"退出登录"，确认退出并跳转到登录页

#### 6. 聊天功能（Chat）
- 已在之前完成，验证与新功能的联动：
  - 确保聊天使用的知识库与 Knowledge 页面一致
  - 确保引用的文档与 Documents 页面一致

### API 接口验证

打开浏览器开发者工具（F12）Network 面板，验证以下请求：

#### Auth
- `POST /api/v1/auth/login` - 返回 `access_token`
- `POST /api/v1/auth/register` - 返回 `access_token`

#### Users
- `GET /api/v1/users/me` - 获取当前用户
- `PUT /api/v1/users/me` - 更新用户信息

#### Knowledge Bases
- `GET /api/v1/knowledge-bases` - 列表（带分页）
- `POST /api/v1/knowledge-bases` - 创建
- `GET /api/v1/knowledge-bases/:id` - 详情
- `PUT /api/v1/knowledge-bases/:id` - 更新
- `DELETE /api/v1/knowledge-bases/:id` - 删除
- `GET /api/v1/knowledge-bases/:id/stats` - 统计

#### Documents
- `GET /api/v1/documents` - 列表（带分页和过滤）
- `POST /api/v1/documents/upload` - 上传（FormData）
- `GET /api/v1/documents/:id` - 详情
- `DELETE /api/v1/documents/:id` - 删除
- `POST /api/v1/documents/:id/reindex` - 重新索引

#### Feedback
- `GET /api/v1/feedback/stats` - 统计（用于首页）

### 错误处理验证

1. 测试未登录访问受保护路由 - 应跳转到登录页
2. 测试 401 错误 - 应清除 token 并跳转登录
3. 测试网络错误 - 应显示友好提示
4. 测试表单验证 - 各种字段验证规则

### 构建验证

```bash
# 前端构建（已通过）
pnpm --filter @rag-system/frontend run build

# 后端构建（已通过）
pnpm --filter @rag-system/backend run build
```

## 已知问题和注意事项

1. 后端 API 需要先创建测试数据（知识库、文档）才能完整测试前端功能
2. 首次启动 Embedding 服务会下载模型，需要等待
3. 需要配置 `LLM_API_KEY` 才能使用聊天功能
4. 文档上传的文件大小限制需要根据后端配置调整

## 开发完成清单

- [x] 修复登录/注册 token 存储
- [x] 实现 Documents 页面（上传、列表、删除、重新索引）
- [x] 实现 Knowledge 页面（CRUD、配置、统计）
- [x] 实现 Profile 页面（查看、编辑、退出）
- [x] 实现 Home 页面（真实数据统计）
- [x] 创建所有必需的服务 API 文件
- [x] 前端构建无 TypeScript 错误
- [x] 后端构建无 TypeScript 错误
- [x] 保持与现有 Chat 页面的一致性（Ant Design X SDK）
