# RAG 系统前端

基于 React 18 + Vite + TypeScript + Ant Design 5 的 RAG 系统前端应用。

## 📋 技术栈

- **框架**: React 18
- **构建工具**: Vite 5
- **语言**: TypeScript 5 (严格模式)
- **UI 组件库**: Ant Design 5
- **路由**: React Router 6
- **HTTP 客户端**: Axios
- **图标**: @ant-design/icons

## 🚀 快速开始

### 环境要求

- Node.js 20+
- npm 或 pnpm

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173

### 构建生产版本

```bash
npm run build
```

### 预览生产构建

```bash
npm run preview
```

## 📁 项目结构

```
frontend/
├── src/
│   ├── assets/          # 静态资源
│   ├── components/      # 公共组件
│   ├── layouts/         # 布局组件
│   │   └── BasicLayout/ # 基础布局（Header + Sider + Content）
│   ├── pages/           # 页面组件
│   │   ├── Login/       # 登录/注册页面
│   │   ├── Home/        # 首页
│   │   ├── Chat/        # 问答页面
│   │   ├── Documents/   # 文档管理页面
│   │   ├── Knowledge/   # 知识库页面
│   │   ├── Monitor/     # 监控仪表盘
│   │   └── Profile/     # 个人中心
│   ├── services/        # API 服务
│   │   └── auth.ts      # 认证相关 API
│   ├── types/           # TypeScript 类型定义
│   ├── utils/           # 工具函数
│   │   └── request.ts   # Axios 封装（JWT 拦截器）
│   ├── App.tsx          # 应用入口（路由配置）
│   ├── App.css          # 全局样式
│   └── main.tsx         # 入口文件
├── .env                 # 环境变量
├── .env.example         # 环境变量示例
├── vite.config.ts       # Vite 配置
├── tsconfig.json        # TypeScript 配置
├── package.json         # 依赖配置
└── README.md            # 项目说明
```

## ✅ 已完成功能 (Phase 1)

- [x] 使用 Vite 创建 React + TypeScript 项目
- [x] 配置 Ant Design 5（中文语言包）
- [x] 配置路由（React Router 6）
- [x] 配置 Axios 拦截器（JWT 认证）
- [x] 创建基础布局（Header + Sider + Content）
- [x] 登录/注册页面
- [x] 路由守卫（需要认证的页面）

## 🚧 待实现功能

### Phase 2: 核心页面

- [ ] 问答页面（聊天界面，支持流式输出）
- [ ] 文档管理页面（上传、列表、删除）
- [ ] 知识库管理页面
- [ ] 完善用户个人中心

### Phase 3: 功能实现

- [ ] 问答组件（SSE 流式渲染、引用展示）
- [ ] 文档上传组件（拖拽、进度条）
- [ ] 反馈组件（点赞/点踩）
- [ ] 监控仪表盘（ECharts 图表）

## 🔧 开发规范

- 使用函数组件 + Hooks
- TypeScript 严格模式
- 组件必须有注释
- 使用 `@/` 路径别名导入
- 遵循 ESLint 规则

## 🌐 API 配置

编辑 `.env` 文件配置 API 地址：

```env
VITE_API_URL=http://localhost:3000/api
```

## 📝 默认登录账号

后端启动后，使用以下账号登录（参考后端种子数据）：

- 用户名：`admin`
- 密码：`admin123`

## 🐛 常见问题

### 1. 跨域问题

开发环境已配置 Vite 代理，确保后端运行在 `http://localhost:3000`

### 2. Token 过期

Token 过期会自动跳转到登录页，重新登录即可

### 3. 类型错误

确保 TypeScript 严格模式，所有组件和函数都有明确的类型定义

## 📄 License

MIT
