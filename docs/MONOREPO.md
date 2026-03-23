# RAG System Monorepo 架构

**改造日期**: 2026-03-23  
**包管理器**: pnpm workspace

---

## 📦 Monorepo 结构

```
rag-system/
├── package.json              # 根 package.json (workspace 配置)
├── pnpm-workspace.yaml       # pnpm workspace 配置
├── .npmrc                    # pnpm 配置
├── pnpm-lock.yaml            # 锁定文件
├── docker-compose.yml        # 前后端编排
├── docker-compose.infra.yml  # 基础设施编排
│
├── backend/                  # NestJS 后端
│   ├── package.json          # @rag-system/backend
│   ├── src/
│   └── ...
│
├── frontend/                 # React 前端
│   ├── package.json          # @rag-system/frontend
│   ├── src/
│   └── ...
│
└── services/
    └── embedding/            # Embedding 微服务
        ├── package.json      # @rag-system/embedding-service
        └── ...
```

---

## 🎯 包命名规范

| 包名 | 路径 | 说明 |
|------|------|------|
| `@rag-system/backend` | `backend/` | NestJS 后端 API |
| `@rag-system/frontend` | `frontend/` | React 前端应用 |
| `@rag-system/embedding-service` | `services/embedding/` | Embedding 微服务 |

---

## 🚀 常用命令

### 全局命令（根目录执行）

```bash
# 安装所有依赖
pnpm install

# 启动所有服务（并行）
pnpm dev

# 构建所有包
pnpm build

# 运行所有测试
pnpm test

# 代码检查
pnpm lint

# 清理构建产物
pnpm clean
```

### 指定包命令

```bash
# 只启动后端
pnpm --filter @rag-system/backend run dev

# 只启动前端
pnpm --filter @rag-system/frontend run dev

# 只启动 embedding 服务
pnpm --filter @rag-system/embedding-service run dev

# 后端数据库迁移
pnpm --filter @rag-system/backend prisma migrate dev

# 后端添加依赖
pnpm --filter @rag-system/backend add @nestjs/config
```

### 快捷命令

```bash
# 启动基础设施
pnpm docker:infra

# 启动前后端
pnpm docker:up

# 数据库操作
pnpm db:migrate
pnpm db:seed
pnpm db:studio
```

---

## 📝 依赖管理

### 添加工作区依赖

```bash
# 后端添加共享工具包（如果未来有 @rag-system/shared）
pnpm --filter @rag-system/backend add @rag-system/shared

# 前端添加后端类型定义
pnpm --filter @rag-system/frontend add -D @rag-system/backend
```

### 添加外部依赖

```bash
# 为单个包添加依赖
pnpm --filter @rag-system/backend add @nestjs/config
pnpm --filter @rag-system/frontend add antd

# 为所有包添加依赖（不推荐）
pnpm add -w typescript
```

---

## 🔧 开发工作流

### 1. 初始化

```bash
# 克隆项目后
cd rag-system

# 安装所有依赖
pnpm install

# 启动基础设施
pnpm docker:infra
```

### 2. 开发模式

```bash
# 方式一：启动所有服务（并行）
pnpm dev

# 方式二：分别启动（不同终端）
# Terminal 1
pnpm --filter @rag-system/backend run dev

# Terminal 2
pnpm --filter @rag-system/frontend run dev

# Terminal 3
pnpm --filter @rag-system/embedding-service run dev
```

### 3. 构建

```bash
# 构建所有包
pnpm build

# 只构建后端
pnpm --filter @rag-system/backend run build
```

---

## 📊 优势

### 改造前（独立项目）

- ❌ 依赖重复安装
- ❌ 版本管理困难
- ❌ 代码复用麻烦
- ❌ 需要多个 git 仓库

### 改造后（Monorepo）

- ✅ 依赖共享（节省磁盘空间）
- ✅ 统一版本管理
- ✅ 代码复用方便
- ✅ 单一 git 仓库
- ✅ 原子性提交
- ✅ 统一代码规范

---

## 🎯 共享代码（未来规划）

### 计划创建的共享包

```
packages/
├── shared/           # 共享工具函数
│   ├── types/       # 共享 TypeScript 类型
│   ├── utils/       # 工具函数
│   └── constants/   # 常量定义
│
├── ui-kit/          # 共享 UI 组件
│   ├── components/
│   └── hooks/
│
└── config/          # 共享配置
    ├── eslint/
    ├── prettier/
    └── typescript/
```

### 使用示例

```typescript
// backend 和 frontend 共享类型
import { User, Document } from '@rag-system/shared/types';

// 前端使用共享 UI 组件
import { Button, Table } from '@rag-system/ui-kit';
```

---

## 🛠️ 工具配置

### pnpm workspace 优势

- 🚀 **快速**: 硬链接依赖，节省磁盘空间
- 🔒 **严格**: 避免幽灵依赖和依赖提升问题
- 📦 **高效**: 并行安装，增量构建

### 推荐工具

```bash
# 安装 Turborepo（可选，用于更强大的构建编排）
pnpm add -D turbo -w

# 使用 turbo 运行任务
pnpm turbo run build
```

---

## 📋 最佳实践

### ✅ 推荐

- 使用 `pnpm --filter` 指定包
- 在根目录运行全局任务
- 共享依赖版本保持一致
- 使用 workspace 协议引用内部包

### ❌ 避免

- 直接 `cd` 到子目录安装依赖
- 手动修改 `pnpm-lock.yaml`
- 跨包循环依赖
- 硬编码包路径

---

## 🔄 迁移步骤

1. ✅ 创建根 `package.json`
2. ✅ 创建 `pnpm-workspace.yaml`
3. ✅ 重命名子包名称（添加 `@rag-system/` 前缀）
4. ✅ 配置 `.npmrc`
5. ⏳ 删除各子目录的 `node_modules`
6. ⏳ 在根目录执行 `pnpm install`
7. ⏳ 测试所有命令

---

**维护者**: 软件开发小组  
**最后更新**: 2026-03-23
