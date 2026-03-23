# RAG 系统开发启动报告

**日期**: 2026-03-23  
**状态**: 开发中 🚧

---

## ✅ 已完成

### 1. 项目初始化
- ✅ 创建项目目录结构
- ✅ 编写 README.md
- ✅ 配置环境变量模板 (.env.example)
- ✅ 创建 Docker Compose 配置
- ✅ 编写开发启动脚本

### 2. 后端基础 (Dev-Backend 子代理进行中)
- ✅ package.json 依赖配置
- 🚧 NestJS 项目结构初始化
- 🚧 Prisma Schema 定义
- 🚧 用户认证模块
- 🚧 文档上传接口

### 3. 前端基础 (Dev-Frontend 子代理进行中)
- 🚧 React + Vite 项目初始化
- 🚧 Ant Design 配置
- 🚧 基础路由配置
- 🚧 问答页面框架

### 4. AI 服务
- ✅ Python Embedding 服务 Dockerfile
- ✅ Embedding API 实现 (main.py)
- ✅ 依赖配置 (requirements.txt)

---

## 📁 项目结构

```
rag-system/
├── backend/                 # NestJS 后端 (开发中)
│   ├── prisma/
│   │   └── schema.prisma   # 数据库 Schema
│   ├── src/
│   │   ├── modules/        # 功能模块
│   │   │   ├── auth/       # 认证模块
│   │   │   ├── document/   # 文档模块
│   │   │   ├── chat/       # 问答模块
│   │   │   └── retrieval/  # 检索模块
│   │   └── main.ts
│   ├── package.json
│   └── Dockerfile.dev
├── frontend/               # React 前端 (开发中)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── App.tsx
│   ├── package.json
│   └── Dockerfile.dev
├── services/
│   └── embedding/          # Python Embedding 服务 ✅
│       ├── main.py
│       ├── requirements.txt
│       └── Dockerfile
├── scripts/
│   └── dev-start.sh        # 启动脚本 ✅
├── docker-compose.yml      # Docker 编排 ✅
├── .env.example            # 环境变量模板 ✅
└── README.md               # 项目文档 ✅
```

---

## 🚀 快速开始

### 方式 1: 一键启动（推荐）

```bash
cd /Users/daniel/Desktop/openclaw-projects/rag-system

# 复制环境变量
cp .env.example .env

# 编辑 .env 填入 LLM API Key
# LLM_API_KEY=your-api-key-here

# 启动所有服务
./scripts/dev-start.sh
```

### 方式 2: 手动启动

```bash
# 1. 启动 Docker 服务
docker-compose up -d

# 2. 等待服务就绪 (约 30 秒)
sleep 30

# 3. 后端开发模式
cd backend
pnpm install
pnpm prisma migrate deploy
pnpm run dev

# 4. 前端开发模式（新终端）
cd frontend
pnpm install
pnpm run dev
```

---

## 📍 访问地址

| 服务 | URL | 备注 |
|------|-----|------|
| 前端 | http://localhost:5173 | React 开发服务器 |
| 后端 API | http://localhost:3000 | NestJS API |
| API 文档 | http://localhost:3000/api/docs | Swagger UI |
| MinIO 控制台 | http://localhost:9001 | minioadmin/minioadmin |
| Embedding 服务 | http://localhost:8001 | Python 微服务 |

---

## 🔑 默认账号

开发环境自动创建：

- **用户名**: `admin`
- **密码**: `admin123`
- **角色**: `admin`

⚠️ 生产环境务必修改！

---

## 📊 开发进度

| 阶段 | 任务 | 状态 | 负责人 |
|------|------|------|--------|
| Phase 1 | 基础框架 | 🚧 进行中 | Dev-Backend |
| Phase 1 | 前端初始化 | 🚧 进行中 | Dev-Frontend |
| Phase 2 | 核心引擎 | ⏳ 待开始 | Dev-Backend |
| Phase 2 | 核心页面 | ⏳ 待开始 | Dev-Frontend |
| Phase 3 | 问答功能 | ⏳ 待开始 | 双方协作 |
| Phase 4 | 测试优化 | ⏳ 待开始 | 双方协作 |

---

## 🎯 下一步行动

### 立即可做

1. **编辑 .env 文件**
   ```bash
   cd /Users/daniel/Desktop/openclaw-projects/rag-system
   cp .env.example .env
   # 编辑 .env，填入你的通义千问 API Key
   ```

2. **启动开发环境**
   ```bash
   ./scripts/dev-start.sh
   ```

3. **等待子代理完成开发**
   - Dev-Backend: 完成后会通知
   - Dev-Frontend: 完成后会通知

### 开发完成后

1. 测试后端 API（Swagger UI）
2. 测试前端页面
3. 上传测试文档
4. 验证问答功能

---

## 📝 开发规范

### Git 提交规范

```bash
feat: 新功能
fix: Bug 修复
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试
chore: 构建/工具
```

### 代码审查要点

- [ ] TypeScript 类型定义完整
- [ ] 关键逻辑有注释
- [ ] 包含单元测试
- [ ] 遵循 ESLint 规则
- [ ] 错误处理完善

---

## ⚠️ 注意事项

1. **环境变量**: 不要将 `.env` 提交到 Git
2. **API Key**: 妥善保管 LLM API Key
3. **默认密码**: 生产环境修改 admin 密码
4. **数据持久化**: Docker volumes 存储数据，定期备份

---

## 📞 问题排查

### 常见問題

**Q: Docker 服务启动失败？**
```bash
# 查看日志
docker-compose logs

# 重启服务
docker-compose restart

# 完全重建
docker-compose down -v && docker-compose up -d
```

**Q: 后端无法连接数据库？**
```bash
# 检查 PostgreSQL 是否就绪
docker-compose logs postgres

# 等待健康检查通过
docker-compose exec postgres pg_isready -U rag
```

**Q: 前端无法连接后端？**
```bash
# 检查后端是否运行
curl http://localhost:3000/health

# 检查 CORS 配置
# 确保 .env 中 CORS_ORIGIN=http://localhost:5173
```

---

## 📚 相关文档

- [产品需求文档](../../workspace-soft-team/docs/001-rag-system-product-requirements.md)
- [技术方案设计](../../workspace-soft-team/docs/002-rag-system-technical-design.md)

---

**开发团队**: 软件开发小组  
**最后更新**: 2026-03-23  
**当前状态**: 开发中 🚧
