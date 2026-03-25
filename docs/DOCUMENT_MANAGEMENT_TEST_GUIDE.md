# 文档管理模块测试指南

## ✅ 已完成的功能

### 1. 批量上传
- ✅ 支持拖拽多个文件上传（最多 20 个）
- ✅ 支持 PDF、DOCX、Markdown、TXT、HTML 格式
- ✅ 自动文件大小验证（默认 50MB 限制）

### 2. 文档版本管理
- ✅ 上传同名文件自动创建新版本
- ✅ 保留完整历史版本记录
- ✅ 查看版本历史列表
- ✅ 恢复到任意历史版本

### 3. 文档在线预览
- ✅ Markdown 渲染预览
- ✅ HTML 原生渲染
- ✅ TXT 纯文本格式化显示
- ✅ PDF/DOCX 分块文本预览

### 4. 文档分类和标签
- ✅ 上传时添加标签（逗号分隔）
- ✅ 预定义常用标签快捷选择
- ✅ 按标签筛选文档
- ✅ 表格中显示文档标签

### 5. HTML 格式支持
- ✅ 支持 .html 和 .htm 文件
- ✅ HTML 内容解析和索引
- ✅ HTML 文档预览渲染

## 🧪 测试步骤

### 前提条件
1. 确保后端服务运行：`http://localhost:3000`
2. 确保前端服务运行：`http://localhost:5173`
3. 确保数据库已应用最新迁移
4. 确保有可用的知识库

### 测试用例

#### 测试 1：单文件上传
1. 访问：`http://localhost:5173/documents`
2. 选择一个知识库
3. 输入标签：`测试,单文件`
4. 拖拽或选择一个 Markdown 文件
5. 等待上传完成
6. ✅ 验证：文档出现在列表中，状态为 `processing` 或 `indexed`

#### 测试 2：批量上传
1. 选择知识库
2. 输入标签：`测试,批量上传`
3. 同时选择 3-5 个不同格式的文件（PDF、TXT、Markdown、HTML）
4. 拖拽到上传区域
5. ✅ 验证：所有文件都成功上传，显示在列表中

#### 测试 3：文档预览
1. 在列表中找到一个 Markdown 或 TXT 文件
2. 点击文件名旁边的"预览"按钮
3. ✅ 验证：
   - Markdown 文件正确渲染
   - TXT 文件正确格式化显示
   - HTML 文件正确渲染
   - 可以滚动查看完整内容

#### 测试 4：版本管理
1. 上传一个文件（如 `test.md`）
2. 等待处理完成
3. 修改文件内容
4. 再次上传同名文件 `test.md`
5. 点击"版本历史"按钮
6. ✅ 验证：
   - 显示 2 个版本（v1 和 v2）
   - 可以查看每个版本的信息
   - 文档详情显示当前版本号

#### 测试 5：版本恢复
1. 在版本历史中选择旧版本
2. 点击"恢复"按钮
3. 确认操作
4. ✅ 验证：
   - 文档恢复到选定版本
   - 版本号递增（如 v3）
   - 内容是旧版本的内容

#### 测试 6：标签筛选
1. 上传多个文件，分别添加不同标签：
   - 文件 A：`技术文档,产品`
   - 文件 B：`制度,人事`
   - 文件 C：`技术文档,FAQ`
2. 在筛选区域选择标签"技术文档"
3. ✅ 验证：只显示文件 A 和 C
4. 选择多个标签"技术文档"和"制度"
5. ✅ 验证：显示文件 A、B、C
6. 点击"清除筛选"
7. ✅ 验证：显示所有文档

#### 测试 7：文档详情
1. 点击任意文档的文件名
2. 查看文档详情抽屉
3. ✅ 验证：
   - 显示文档状态
   - 显示版本号
   - 显示文件大小
   - 显示 chunks 数量
   - 显示前 5 个文档片段

#### 测试 8：重新索引
1. 选择一个已索引的文档
2. 点击"重新索引"按钮
3. ✅ 验证：
   - 文档状态变为 `processing`
   - 等待后状态变回 `indexed`
   - chunks 重新生成

#### 测试 9：删除文档
1. 选择一个文档
2. 点击"删除"按钮
3. 确认删除
4. ✅ 验证：
   - 文档从列表中移除
   - MinIO 中的文件被删除
   - 数据库记录被删除

#### 测试 10：HTML 文档
1. 创建一个 HTML 文件：
```html
<!DOCTYPE html>
<html>
<head><title>测试</title></head>
<body>
  <h1>HTML 测试文档</h1>
  <p>这是一个<strong>HTML</strong>文档。</p>
</body>
</html>
```
2. 上传该文件
3. 点击预览
4. ✅ 验证：HTML 正确渲染，样式保留

## 🔍 问题排查

### 后端未启动
```bash
cd /Users/huanglu/Desktop/demo/rag-system
pnpm run dev:backend
```

### 前端未启动
```bash
cd /Users/huanglu/Desktop/demo/rag-system
pnpm run dev:frontend
```

### 数据库迁移未应用
```bash
cd apps/backend
npx prisma migrate dev
npx prisma generate
```

### 文档处理失败
- 检查 Redis 是否运行
- 检查 MinIO 是否运行
- 检查 Embedding 服务是否运行
- 查看后端日志

### 文档上传失败
- 检查文件大小是否超过限制
- 检查文件格式是否支持
- 检查知识库是否存在
- 查看浏览器控制台错误

## 📊 API 测试

### 获取 Token
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"Test123!"}' \
  | jq -r '.access_token')
```

### 创建知识库
```bash
KB_ID=$(curl -s -X POST http://localhost:3000/api/v1/knowledge-bases \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"测试知识库","description":"用于测试"}' \
  | jq -r '.id')
```

### 上传文档
```bash
curl -X POST http://localhost:3000/api/v1/documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.md" \
  -F "knowledge_base_id=$KB_ID" \
  -F "tags=测试,Markdown" \
  -F "is_public=true"
```

### 获取文档列表
```bash
curl -s -X GET "http://localhost:3000/api/v1/documents?knowledge_base_id=$KB_ID" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 获取文档详情
```bash
DOC_ID="your-document-id"
curl -s -X GET "http://localhost:3000/api/v1/documents/$DOC_ID" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 获取版本历史
```bash
curl -s -X GET "http://localhost:3000/api/v1/documents/$DOC_ID/versions" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 文档预览
```bash
curl -s -X GET "http://localhost:3000/api/v1/documents/$DOC_ID/preview" \
  -H "Authorization: Bearer $TOKEN" | jq
```

## 📝 注意事项

1. **文件大小限制**：默认 50MB，可在 `.env.local` 中修改 `MAX_FILE_SIZE`
2. **并发上传**：批量上传最多 20 个文件
3. **版本管理**：基于文件名和知识库 ID 判断是否同名
4. **标签筛选**：客户端过滤，性能良好
5. **预览限制**：PDF/DOCX 仅显示文本内容，不保留格式

## ✨ 下一步优化建议

1. **PDF 原生预览**：使用 PDF.js 实现原生 PDF 渲染
2. **DOCX 格式预览**：转换为 HTML 或 PDF 预览
3. **版本对比**：实现两个版本之间的 diff
4. **批量操作**：支持批量删除、批量添加标签
5. **高级筛选**：支持文件类型、大小、日期范围筛选
6. **文档权限**：基于标签或文档的细粒度权限控制

---

**测试完成日期**: 2026-03-25
**文档版本**: v1.0
