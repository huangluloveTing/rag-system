# RAG System Backend

基于 NestJS 的 RAG（检索增强生成）系统后端服务。

## 技术栈

- **框架**: NestJS 10 + TypeScript
- **数据库**: PostgreSQL 15 + Prisma ORM
- **向量数据库**: Milvus 2.4
- **对象存储**: MinIO
- **任务队列**: Bull + Redis
- **LLM**: 通义千问 Qwen3.5-plus

## 项目结构

```
backend/
├── prisma/
│   ├── schema.prisma          # 数据库 schema
│   ├── migrations/            # 迁移脚本
│   └── seed.ts                # 种子数据
├── src/
│   ├── main.ts                # 应用入口
│   ├── app.module.ts          # 根模块
│   ├── common/                # 公共模块
│   │   ├── decorators/        # 装饰器
│   │   ├── guards/            # 守卫
│   │   ├── minio/             # MinIO 服务
│   │   └── queue/             # Bull 队列
│   ├── modules/               # 功能模块
│   │   ├── auth/              # 认证模块
│   │   ├── user/              # 用户模块
│   │   ├── document/          # 文档模块
│   │   ├── chat/              # 问答模块
│   │   ├── retrieval/         # 检索模块
│   │   ├── llm/               # LLM 模块
│   │   └── feedback/          # 反馈模块
│   └── config/                # 配置模块
├── tests/
│   ├── e2e/                   # E2E 测试
│   └── unit/                  # 单元测试
└── package.json
```

## 快速开始

### 1. 环境准备

确保已安装：
- Node.js 20+
- pnpm
- PostgreSQL 15
- Redis 7
- MinIO
- Milvus 2.4

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，填入实际配置
```

### 4. 初始化数据库

```bash
# 生成 Prisma Client
pnpm prisma generate

# 运行数据库迁移
pnpm prisma migrate dev --name init

# 插入种子数据
pnpm prisma db seed
```

### 5. 启动服务

```bash
# 开发模式
pnpm run dev

# 生产模式
pnpm run build
pnpm run start:prod
```

服务将在 http://localhost:3000 启动

## API 文档

启动服务后访问：http://localhost:3000/api/docs

## 默认账号

种子数据创建了以下测试账号：

| 角色 | 用户名 | 密码 |
|------|--------|------|
| Admin | admin | admin123 |
| Editor | editor | editor123 |
| Viewer | viewer | viewer123 |

## 核心功能

### Phase 1: 基础框架 ✅

- [x] NestJS 项目结构
- [x] Prisma Schema 配置
- [x] 数据库迁移脚本
- [x] 用户认证模块（JWT + Guard）
- [x] 文档上传接口（MinIO 集成）

### Phase 2: 核心引擎 ⏳

- [ ] 文档解析器（PDF/Word/Markdown）
- [ ] 文本分块逻辑
- [ ] Milvus 向量数据库集成
- [ ] 向量检索接口

### Phase 3: 问答功能 ⏳

- [ ] 通义千问 LLM API 集成
- [ ] Prompt 管理
- [ ] 问答接口（SSE 流式输出）

## 开发规范

### 代码提交

使用 Conventional Commits：

```
feat: 新功能
fix: Bug 修复
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试相关
chore: 构建/工具/配置
```

### 测试

```bash
# 运行单元测试
pnpm run test

# 运行覆盖率测试
pnpm run test:cov

# 运行 E2E 测试
pnpm run test:e2e
```

## Docker 部署

使用 Docker Compose 一键部署所有服务：

```bash
# 启动开发环境
docker-compose up -d

# 查看日志
docker-compose logs -f api

# 停止服务
docker-compose down
```

## 相关文档

- [产品需求文档](../../../docs/001-rag-system-product-requirements.md)
- [技术设计方案](../../../docs/002-rag-system-technical-design.md)

## License

MIT
