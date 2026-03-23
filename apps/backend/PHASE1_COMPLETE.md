# RAG System Backend - Phase 1 快速开始指南

## ✅ Phase 1 完成状态

### 已完成功能

1. ✅ **NestJS 项目结构初始化**
   - 完整的目录结构
   - TypeScript 配置
   - NestJS CLI 配置

2. ✅ **Prisma Schema 配置**
   - 完整的数据库模型定义（7 个表）
   - 索引和关系配置
   - 类型安全的 Prisma Client

3. ✅ **数据库迁移脚本**
   - Prisma Migrate 集成
   - 种子数据脚本（3 个测试账号 + 2 个知识库）

4. ✅ **用户认证模块**
   - JWT Token 认证
   - Passport Strategy
   - JWT Guard + Roles Guard
   - 登录/注册/刷新 Token 接口
   - 密码 bcrypt 加密

5. ✅ **文档上传接口**
   - MinIO 对象存储集成
   - Bull 异步任务队列
   - 文件上传/列表/详情/删除接口
   - 文件去重（SHA256 哈希）
   - 文件类型自动检测

## 🚀 启动方式

### 方式一：使用 Docker Compose（推荐）

```bash
# 1. 进入项目目录
cd /Users/daniel/Desktop/openclaw-projects/rag-system/backend

# 2. 复制环境变量文件
cp .env.example .env

# 3. 编辑 .env 文件（可选，使用默认值也可以启动）
# 至少需要配置 LLM_API_KEY

# 4. 启动所有服务
docker-compose up -d

# 5. 等待服务就绪（约 1-2 分钟）
docker-compose logs -f

# 6. 访问 API 文档
# http://localhost:3000/api/docs
```

### 方式二：本地开发

#### 前置要求

- Node.js 20+
- pnpm
- PostgreSQL 15
- Redis 7
- MinIO
- Milvus 2.4（Phase 2 需要）

#### 步骤

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 3. 启动基础设施（PostgreSQL + Redis + MinIO）
# 可以使用 docker-compose 只启动基础设施
docker-compose up -d postgres redis minio

# 4. 生成 Prisma Client
pnpm prisma generate

# 5. 运行数据库迁移
pnpm prisma migrate dev --name init

# 6. 插入种子数据
pnpm prisma db seed

# 7. 启动开发服务器
pnpm run dev
```

## 📝 测试账号

种子数据创建了以下测试账号：

| 角色 | 用户名 | 密码 | 权限 |
|------|--------|------|------|
| Admin | admin | admin123 | 全部权限 |
| Editor | editor | editor123 | 上传/管理文档 |
| Viewer | viewer | viewer123 | 仅查看 |

## 🔧 测试 API

### 1. 登录获取 Token

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

响应：
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 86400
}
```

### 2. 获取当前用户信息

```bash
curl -X GET http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer {access_token}"
```

### 3. 上传文档

```bash
curl -X POST http://localhost:3000/api/v1/documents/upload \
  -H "Authorization: Bearer {access_token}" \
  -F "file=@/path/to/your/file.pdf" \
  -F "knowledge_base_id={kb-id}" \
  -F "tags=测试，文档" \
  -F "is_public=true"
```

### 4. 获取文档列表

```bash
curl -X GET "http://localhost:3000/api/v1/documents?knowledge_base_id={kb-id}&page=1&page_size=20" \
  -H "Authorization: Bearer {access_token}"
```

## 📚 API 文档

启动服务后访问 Swagger UI：
- **URL**: http://localhost:3000/api/docs
- **功能**: 完整的 API 文档和在线测试

## 🏗️ 项目结构

```
backend/
├── prisma/
│   ├── schema.prisma          # 数据库 Schema
│   ├── migrations/            # 迁移脚本（自动生成）
│   └── seed.ts                # 种子数据
├── src/
│   ├── main.ts                # 应用入口
│   ├── app.module.ts          # 根模块
│   ├── common/                # 公共模块
│   │   ├── decorators/
│   │   │   └── current-user.decorator.ts
│   │   ├── guards/
│   │   ├── minio/
│   │   │   ├── minio.service.ts
│   │   │   └── minio.module.ts
│   │   └── queue/
│   │       ├── bull-queue.service.ts
│   │       └── bull-queue.module.ts
│   ├── modules/
│   │   ├── auth/              # ✅ 认证模块
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.module.ts
│   │   │   ├── dto/
│   │   │   ├── guards/
│   │   │   └── strategies/
│   │   ├── user/              # ✅ 用户模块
│   │   ├── document/          # ✅ 文档模块
│   │   ├── chat/              # ⏳ Phase 3
│   │   ├── retrieval/         # ⏳ Phase 2
│   │   ├── llm/               # ⏳ Phase 3
│   │   └── feedback/          # ⏳ Phase 3
│   └── config/
│       ├── config.module.ts
│       └── config.service.ts
├── tests/
│   ├── auth.e2e-spec.ts       # E2E 测试
│   └── jest-e2e.json
├── scripts/
│   └── dev-start.sh           # 开发启动脚本
├── docker-compose.yml
├── Dockerfile
├── Dockerfile.dev
└── README.md
```

## 🧪 运行测试

```bash
# 单元测试
pnpm run test

# 单元测试（监听模式）
pnpm run test:watch

# 代码覆盖率
pnpm run test:cov

# E2E 测试
pnpm run test:e2e
```

## 📊 数据库管理

```bash
# 打开 Prisma Studio（数据库可视化）
pnpm prisma studio

# 生成新的迁移
pnpm prisma migrate dev --name add_new_field

# 应用生产迁移
pnpm prisma migrate deploy

# 重置数据库（开发环境）
pnpm prisma migrate reset
```

## ⚠️ 注意事项

1. **环境变量**: 生产环境务必修改 `.env` 中的密钥
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - `DATABASE_URL`
   - `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY`

2. **MinIO Bucket**: 首次启动会自动创建 `rag-documents` bucket

3. **文件上传限制**: 默认 50MB，可在 `.env` 中修改 `MAX_FILE_SIZE`

4. **CORS**: 开发模式允许所有来源，生产环境需要配置白名单

## 🎯 Phase 2 计划

下一步将实现：
- [ ] 文档解析器（PDF/Word/Markdown）
- [ ] 文本分块逻辑
- [ ] Milvus 向量数据库集成
- [ ] 向量检索接口

## 🐛 常见问题

### Q: Docker Compose 启动失败？
A: 确保端口 5432、6379、9000、9001、19530 未被占用

### Q: 数据库迁移失败？
A: 检查 PostgreSQL 是否启动，DATABASE_URL 是否正确

### Q: MinIO 连接失败？
A: 确保 MinIO 容器已启动，访问 http://localhost:9001 确认

### Q: 测试账号无法登录？
A: 确认已运行 `pnpm prisma db seed` 插入种子数据

## 📞 技术支持

如有问题，请查看：
- 完整文档：`/Users/daniel/.openclaw/workspace-soft-team/docs/002-rag-system-technical-design.md`
- API 文档：http://localhost:3000/api/docs
