/**
 * Embedding + Rerank Service - TypeScript 版本
 * 支持本地模型和外部 API 两种模式
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';


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

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '8001', 10);
const HOST = process.env.HOST || '0.0.0.0';

// 配置
const USE_LOCAL_MODELS = process.env.USE_LOCAL_MODELS !== 'false'; // 默认使用本地模型
const EMBEDDING_API_URL = process.env.EMBEDDING_API_URL || '';
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY || '';
const RERANK_API_URL = process.env.RERANK_API_URL || '';
const RERANK_API_KEY = process.env.RERANK_API_KEY || '';

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));

/**
 * 调用外部 Embedding API
 */
async function callEmbeddingAPI(texts: string[]): Promise<number[][]> {
  if (!EMBEDDING_API_URL || !EMBEDDING_API_KEY) {
    throw new Error('Embedding API URL or API Key not configured');
  }
  

  const response = await fetch(EMBEDDING_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${EMBEDDING_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.EMBEDDING_MODEL || 'BAAI/bge-large-zh-v1.5',
      input: texts,
      encoding_format: 'float'
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Embedding API failed: ${response.status} - ${error}`);
  }

  const data = await response.json();
  // 按原始顺序返回 embeddings
  const sortedData = data.data.sort((a: any, b: any) => a.index - b.index);
  return sortedData.map((item: any) => item.embedding);
}

/**
 * 调用外部 Rerank API
 */
async function callRerankAPI(query: string, documents: string[], topK: number): Promise<Array<{ index: number; score: number }>> {
  if (!RERANK_API_URL) {
    throw new Error('Rerank API URL not configured');
  }

  // 判断是否是 Ollama API（通过 URL 判断）
  const isOllama = RERANK_API_URL.includes('localhost:11434') || RERANK_API_URL.includes('127.0.0.1:11434');

  if (isOllama) {
    // Ollama API 格式
    const results: Array<{ index: number; score: number }> = [];

    for (let i = 0; i < documents.length; i++) {
      const response = await fetch(`${RERANK_API_URL}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.RERANK_MODEL || 'dengcao/Qwen3-Reranker-0.6B:Q8_0',
          prompt: `Query: ${query}\nDocument: ${documents[i]}\nScore:`,
          stream: false,
          options: {
            num_predict: 10  // 只预测分数
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama Rerank API failed: ${response.status} - ${error}`);
      }

      const data = await response.json();
      // Ollama 返回的是生成的文本，需要解析分数
      const responseText = data.response || '';
      // 尝试从响应中提取分数（假设模型输出包含数字）
      const scoreMatch = responseText.match(/(\d+\.?\d*)/);
      const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;

      results.push({ index: i, score });
    }

    // 按分数降序排序并返回 topK
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  } else {
    // 标准 Rerank API 格式（如 SiliconFlow）
    if (!RERANK_API_KEY) {
      throw new Error('Rerank API Key not configured for external API');
    }

    const response = await fetch(`${RERANK_API_URL}/rerank`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RERANK_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.RERANK_MODEL || 'BAAI/bge-reranker-large',
        query,
        documents,
        top_n: topK
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Rerank API failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.results.map((item: any) => ({
      index: item.index,
      score: item.relevance_score
    }));
  }
}


/**
 * 健康检查接口
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    mode: USE_LOCAL_MODELS ? 'local' : 'api'
  });
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

    console.log(`📊 Generating embeddings for ${texts.length} texts... (mode: ${USE_LOCAL_MODELS ? 'local' : 'api'})`);

    let embeddings: number[][] = await callEmbeddingAPI(texts);
    let promptTokens = texts.reduce((sum, text) => sum + text.split(/\s+/).length, 0);

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

    console.log(`📊 Reranking ${documents.length} documents for query: "${query.substring(0, 50)}..." (mode: ${USE_LOCAL_MODELS ? 'local' : 'api'})`);

    let results: RerankResult[];

    
      // 外部 API
      const apiResults = await callRerankAPI(query, documents, top_k);

      results = apiResults.map((item, rank) => ({
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
    mode: USE_LOCAL_MODELS ? 'local' : 'api',
    embedding: {
      model: process.env.EMBEDDING_MODEL || 'BAAI/bge-large-zh-v1.5',
      dimension: 1024,
      loaded: USE_LOCAL_MODELS ? !!embeddingPipeline : true,
      api_url: USE_LOCAL_MODELS ? null : EMBEDDING_API_URL
    },
    rerank: {
      model: process.env.RERANK_MODEL || 'BAAI/bge-reranker-large',
      loaded: USE_LOCAL_MODELS ? !!rerankPipeline : true,
      api_url: USE_LOCAL_MODELS ? null : RERANK_API_URL
    }
  });
});

/**
 * 启动服务
 */
async function startServer() {
  try {
    app.listen(PORT, HOST, () => {
      console.log(`
╔════════════════════════════════════════════════════════╗
║  🚀 Embedding Service Started                          ║
║  Host: ${HOST.padEnd(40)}║
║  Port: ${String(PORT).padEnd(40)}║
║  Mode: ${(USE_LOCAL_MODELS ? 'Local Models' : 'External API').padEnd(38)}║
║  Models: bge-large-zh-v1.5, bge-reranker-large         ║
╚════════════════════════════════════════════════════════╝
      `);

      if (!USE_LOCAL_MODELS) {
        console.log('📡 Using external APIs:');
        console.log(`   Embedding: ${EMBEDDING_API_URL || 'Not configured'}`);
        console.log(`   Rerank: ${RERANK_API_URL || 'Not configured'}`);
      }
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


