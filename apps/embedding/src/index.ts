/**
 * Embedding + Rerank Service - TypeScript 版本
 * 使用 @xenova/transformers 在 Node.js 中运行本地模型
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '8001', 10);
const HOST = process.env.HOST || '0.0.0.0';

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// transformers 延迟加载（避免启动时引入可选原生依赖，例如 sharp）
let transformers: typeof import('@xenova/transformers') | null = null;
async function getTransformers() {
  if (!transformers) {
    transformers = await import('@xenova/transformers');
    // 禁用 Transformers.js 的远程模型下载（使用本地模型）
    transformers.env.allowLocalModels = true;
    transformers.env.useBrowserCache = false;
  }
  return transformers;
}

// 模型缓存
let embeddingPipeline: any = null;
let rerankPipeline: any = null;

/**
 * 加载 Embedding 模型
 */
async function loadEmbeddingModel() {
  if (!embeddingPipeline) {
    console.log('🔄 Loading embedding model: bge-large-zh-v1.5...');
    embeddingPipeline = await (await getTransformers()).pipeline(
      'feature-extraction',
      'Xenova/bge-large-zh-v1.5',
      { quantized: false }
    );
    console.log('✅ Embedding model loaded.');
  }
  return embeddingPipeline;
}

/**
 * 加载 Rerank 模型
 */
async function loadRerankModel() {
  if (!rerankPipeline) {
    console.log('🔄 Loading rerank model: bge-reranker-large...');
    rerankPipeline = await (await getTransformers()).pipeline(
      'text-classification',
      'Xenova/bge-reranker-large',
      { quantized: false }
    );
    console.log('✅ Rerank model loaded.');
  }
  return rerankPipeline;
}

// 请求类型定义
interface EmbeddingRequest {
  texts: string[];
  model_name?: string;
}

interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

interface RerankRequest {
  query: string;
  documents: string[];
  top_k?: number;
}

interface RerankResult {
  index: number;
  document: string;
  score: number;
  rank: number;
}

interface RerankResponse {
  results: RerankResult[];
  model: string;
}

/**
 * 健康检查接口
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

/**
 * Embedding 接口
 * POST /embed
 */
app.post('/embed', async (req: Request, res: Response) => {
  try {
    const { texts, model_name = 'bge-large-zh-v1.5' }: EmbeddingRequest = req.body;

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'texts field is required and must be a non-empty array'
      });
    }

    console.log(`📊 Generating embeddings for ${texts.length} texts...`);

    // 加载模型
    const extractor = await loadEmbeddingModel();

    // 生成 embeddings
    const output = await extractor(texts, {
      pooling: 'mean',
      normalize: true
    });

    // 转换为数组格式
    const embeddings = Array.from(output.data) as number[][];

    // 计算 token 数（估算）
    const promptTokens = texts.reduce((sum, text) => sum + text.split(/\s+/).length, 0);

    const response: EmbeddingResponse = {
      embeddings,
      model: model_name,
      usage: {
        prompt_tokens: promptTokens,
        total_tokens: promptTokens
      }
    };

    console.log(`✅ Generated ${embeddings.length} embeddings (${embeddings[0]?.length || 0} dimensions)`);
    res.json(response);
  } catch (error: any) {
    console.error('❌ Embedding failed:', error.message);
    res.status(500).json({
      error: 'Embedding failed',
      message: error.message
    });
  }
});

/**
 * Rerank 接口
 * POST /rerank
 */
app.post('/rerank', async (req: Request, res: Response) => {
  try {
    const { query, documents, top_k = 5 }: RerankRequest = req.body;

    if (!query || !documents || !Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'query and documents fields are required'
      });
    }

    if (top_k < 1 || top_k > 50) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'top_k must be between 1 and 50'
      });
    }

    console.log(`📊 Reranking ${documents.length} documents for query: "${query.substring(0, 50)}..."`);

    // 加载模型
    const ranker = await loadRerankModel();

    // 构建句子对
    const pairs = documents.map(doc => [query, doc]);

    // 计算相关性分数
    const scores: number[] = [];
    for (const pair of pairs) {
      const result = await ranker(pair, { topk: 1 });
      // 提取分数（根据不同模型格式）
      const score = result[0]?.score || result[0]?.probability || 0;
      scores.push(score);
    }

    // 创建带索引的分数列表
    const indexedScores = scores.map((score, index) => ({ index, score }));

    // 按分数降序排序
    const sortedResults = indexedScores.sort((a, b) => b.score - a.score);

    // 取 top_k
    const topResults = sortedResults.slice(0, top_k);

    // 构建返回结果
    const results: RerankResult[] = topResults.map((item, rank) => ({
      index: item.index,
      document: documents[item.index],
      score: item.score,
      rank: rank + 1
    }));

    const response: RerankResponse = {
      results,
      model: 'bge-reranker-large'
    };

    console.log(`✅ Reranked documents, top score: ${results[0]?.score?.toFixed(4) || 'N/A'}`);
    res.json(response);
  } catch (error: any) {
    console.error('❌ Rerank failed:', error.message);
    res.status(500).json({
      error: 'Rerank failed',
      message: error.message
    });
  }
});

/**
 * 模型信息接口
 * GET /models
 */
app.get('/models', async (req: Request, res: Response) => {
  res.json({
    embedding: {
      model: 'Xenova/bge-large-zh-v1.5',
      dimension: 1024,
      loaded: !!embeddingPipeline
    },
    rerank: {
      model: 'Xenova/bge-reranker-large',
      loaded: !!rerankPipeline
    }
  });
});

/**
 * 启动服务
 */
async function startServer() {
  try {
    // 预加载模型（可选，避免首次请求慢）
    if (process.env.PRELOAD_MODELS === 'true') {
      console.log('🔄 Preloading models...');
      await loadEmbeddingModel();
      await loadRerankModel();
      console.log('✅ Models preloaded.');
    }

    app.listen(PORT, HOST, () => {
      console.log(`
╔════════════════════════════════════════════════════════╗
║  🚀 Embedding Service Started                          ║
║  Host: ${HOST.padEnd(40)}║
║  Port: ${String(PORT).padEnd(40)}║
║  Models: bge-large-zh-v1.5, bge-reranker-large         ║
╚════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error: any) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// 启动服务
startServer();
