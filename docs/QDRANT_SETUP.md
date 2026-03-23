# Qdrant 向量数据库配置说明

**日期**: 2026-03-23  
**变更**: Milvus → Qdrant

---

## 🎯 为什么选择 Qdrant？

### Qdrant vs Milvus 对比

| 特性 | Qdrant | Milvus |
|------|--------|--------|
| **部署复杂度** | ⭐⭐⭐⭐⭐ 简单 | ⭐⭐ 复杂（依赖 etcd+MinIO） |
| **资源占用** | ⭐⭐⭐⭐⭐ 低（~500MB） | ⭐⭐ 高（~2GB+） |
| **启动速度** | ⭐⭐⭐⭐⭐ 快（10 秒） | ⭐⭐ 慢（1-2 分钟） |
| **Docker 容器** | 1 个 | 3-4 个 |
| **学习曲线** | ⭐⭐⭐⭐⭐ 平缓 | ⭐⭐⭐ 陡峭 |
| **性能** | ⭐⭐⭐⭐ 优秀 | ⭐⭐⭐⭐ 优秀 |
| **生态系统** | ⭐⭐⭐⭐ 成熟 | ⭐⭐⭐⭐⭐ 完善 |

### Qdrant 优势

- ✅ **轻量级**: 单个容器，无外部依赖
- ✅ **Rust 编写**: 高性能、内存安全
- ✅ **API 友好**: REST + gRPC 双支持
- ✅ **过滤强大**: 支持复杂的元数据过滤
- ✅ **易于维护**: 配置简单，故障排查容易

---

## 🚀 快速启动

### 方式一：使用启动脚本

```bash
cd /Users/daniel/Desktop/openclaw-projects/rag-system
./scripts/quick-start.sh
```

### 方式二：手动启动

```bash
# 创建 Docker 网络
docker network create rag-network

# 启动 Qdrant
docker run -d \
  --name rag-qdrant \
  --network rag-network \
  -p 6333:6333 \
  -p 6334:6334 \
  -v rag-qdrant-data:/qdrant/storage \
  --restart unless-stopped \
  qdrant/qdrant:v1.13.4
```

---

## 📍 访问地址

| 接口类型 | 地址 | 用途 |
|----------|------|------|
| REST API | http://localhost:6333 | HTTP API、Web UI |
| gRPC | localhost:6334 | 高性能客户端连接 |
| Web UI | http://localhost:6333/dashboard | 可视化管理界面 |

---

## 🔧 环境变量配置

### .env 文件配置

```bash
# Qdrant 配置
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_GRPC_PORT=6334
QDRANT_API_KEY=  # 可选，生产环境配置
```

### Docker Compose 配置

```yaml
services:
  api:
    environment:
      QDRANT_HOST: qdrant
      QDRANT_PORT: 6333
```

---

## 💻 Node.js 集成示例

### 安装 SDK

```bash
pnpm add qdrant-client
```

### 连接代码

```typescript
import { QdrantClient } from '@qdrant/js-client-rest';

// 创建客户端
const client = new QdrantClient({
  url: process.env.QDRANT_HOST || 'http://localhost:6333',
  port: parseInt(process.env.QDRANT_PORT || '6333'),
});

// 创建集合（Collection）
await client.createCollection('rag_chunks', {
  vectors: {
    size: 1024,  // bge-large-zh 向量维度
    distance: 'Cosine',
  },
});

// 上传向量
await client.upsert('rag_chunks', {
  points: [
    {
      id: 'chunk-001',
      vector: embeddingVector,
      payload: {
        doc_id: 'doc-001',
        content: '文档内容...',
        page: 1,
      },
    },
  ],
});

// 搜索相似向量
const searchResult = await client.search('rag_chunks', {
  vector: queryVector,
  limit: 5,
  filter: {
    must: [
      { key: 'doc_id', match: { value: 'doc-001' } }
    ]
  }
});
```

---

## 📊 集合设计

### RAG 系统集合结构

```typescript
// 集合名称：rag_chunks
{
  vectors: {
    size: 1024,       // 向量维度（bge-large-zh）
    distance: 'Cosine' // 余弦相似度
  },
  payload_schema: {
    doc_id: { type: 'keyword' },      // 文档 ID
    knowledge_base_id: { type: 'keyword' }, // 知识库 ID
    content: { type: 'text' },        // 文本内容
    page: { type: 'integer' },        // 页码
    chunk_index: { type: 'integer' }  // 片段索引
  }
}
```

---

## 🔍 常用 API 操作

### 1. 健康检查

```bash
curl http://localhost:6333/
```

### 2. 创建集合

```bash
curl -X PUT 'http://localhost:6333/collections/rag_chunks' \
  -H 'Content-Type: application/json' \
  -d '{
    "vectors": {
      "size": 1024,
      "distance": "Cosine"
    }
  }'
```

### 3. 查询集合信息

```bash
curl http://localhost:6333/collections/rag_chunks
```

### 4. 搜索向量

```bash
curl -X POST 'http://localhost:6333/collections/rag_chunks/points/search' \
  -H 'Content-Type: application/json' \
  -d '{
    "vector": [0.1, 0.2, ...],
    "limit": 5,
    "with_payload": true
  }'
```

---

## 🗑️ 数据管理

### 删除集合

```bash
curl -X DELETE 'http://localhost:6333/collections/rag_chunks'
```

### 清空集合

```bash
curl -X POST 'http://localhost:6333/collections/rag_chunks/points/clear'
```

### 批量删除

```bash
curl -X POST 'http://localhost:6333/collections/rag_chunks/points/delete' \
  -H 'Content-Type: application/json' \
  -d '{
    "filter": {
      "must": [
        { "key": "doc_id", "match": { "value": "doc-001" } }
      ]
    }
  }'
```

---

## 📈 性能优化

### 1. 索引优化

```typescript
// 创建 payload 索引
await client.createPayloadIndex('rag_chunks', {
  field_name: 'doc_id',
  field_schema: 'keyword',
});
```

### 2. 批量操作

```typescript
// 批量上传（推荐 100-500 条/批）
await client.upsert('rag_chunks', {
  points: pointsBatch, // 批量点
  wait: true,
});
```

### 3. 并行搜索

```typescript
// 多集合并行搜索
const [result1, result2] = await Promise.all([
  client.search('collection1', { vector: q, limit: 5 }),
  client.search('collection2', { vector: q, limit: 5 }),
]);
```

---

## 🔐 安全配置（生产环境）

### 1. 启用 API Key

```bash
docker run -d \
  -e QDRANT__SERVICE__GRPC_API_KEY=your-api-key \
  -e QDRANT__SERVICE__REST_API_KEY=your-api-key \
  qdrant/qdrant:v1.13.4
```

### 2. HTTPS 配置

```yaml
# docker-compose.yml
services:
  qdrant:
    environment:
      QDRANT__SERVICE__HTTPS_CERT: /certs/cert.pem
      QDRANT__SERVICE__HTTPS_KEY: /certs/key.pem
    volumes:
      - ./certs:/certs
```

---

## 🛠️ 故障排查

### Q1: 容器启动失败

```bash
# 查看日志
docker logs rag-qdrant

# 检查端口占用
lsof -i :6333
```

### Q2: 连接超时

```bash
# 测试连接
curl http://localhost:6333/

# 检查网络
docker network inspect rag-network
```

### Q3: 内存不足

```bash
# 限制内存
docker run -d --memory="2g" qdrant/qdrant:v1.13.4
```

---

## 📚 相关资源

- [Qdrant 官方文档](https://qdrant.tech/documentation/)
- [Qdrant GitHub](https://github.com/qdrant/qdrant)
- [Node.js SDK](https://github.com/qdrant/qdrant-js)
- [Qdrant Dashboard](http://localhost:6333/dashboard)

---

**维护者**: 软件开发小组  
**最后更新**: 2026-03-23
