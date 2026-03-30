/**
 * 检索服务
 * 处理向量检索、混合检索、Rerank 等逻辑
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { QdrantService } from '../../common/qdrant/qdrant.service';
import { EmbeddingService } from '../../common/embedding/embedding.service';

export interface RetrievalResult {
  chunkId: string;
  documentId: string;
  content: string;
  score: number;
  metadata?: any;
}

export interface SearchOptions {
  knowledgeBaseId?: string;
  topK?: number;
  similarityThreshold?: number;
  enableRerank?: boolean;
}

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    private prisma: PrismaService,
    private qdrantService: QdrantService,
    private embeddingService: EmbeddingService,
    private configService: ConfigService
  ) {}

  /**
   * 检索相关文档片段
   */
  async retrieve(
    query: string,
    options: SearchOptions = {}
  ): Promise<RetrievalResult[]> {
    const {
      knowledgeBaseId,
      topK = this.configService.get<number>('TOP_K', 8), // 从 5 调整为 8
      similarityThreshold = this.getDynamicSimilarityThreshold(query), // 动态阈值
      enableRerank = this.configService.get<boolean>('ENABLE_RERANK', true),
    } = options;

    this.logger.debug(
      `Retrieving documents for query: "${query.substring(0, 50)}..."`
    );

    try {
      // 1. 生成查询向量
      const queryVector = await this.embeddingService.generateEmbedding(query);

      // 2. 构建过滤器
      const filter: any = {};
      if (knowledgeBaseId) {
        filter.knowledgeBaseId = knowledgeBaseId;
      }

      // 3. 向量相似度搜索
      const searchResults = await this.qdrantService.search(
        queryVector,
        topK * 2, // 取更多结果用于 Rerank
        filter
      );

      if (searchResults.length === 0) {
        this.logger.warn('No relevant documents found');
        return [];
      }

      // 4. 过滤低相似度结果
      const filteredResults = searchResults.filter(
        (r) => r.score >= similarityThreshold
      );

      if (filteredResults.length === 0) {
        this.logger.warn(
          `All results below similarity threshold: ${similarityThreshold}`
        );
        return [];
      }

      // 5. 获取 Chunk 详情
      const chunkIds = filteredResults.map((r) => r.id);
      const chunks = await this.prisma.chunk.findMany({
        where: { chunkId: { in: chunkIds } },
        include: {
          document: {
            select: {
              id: true,
              filename: true,
              fileType: true,
            },
          },
        },
      });

      // 构建 Chunk Map
      const chunkMap = new Map(chunks.map((c) => [c.chunkId, c]));

      // 6. 组装结果
      let results: RetrievalResult[] = filteredResults.map((r) => {
        const chunk = chunkMap.get(r.id);
        return {
          chunkId: r.id,
          documentId: chunk?.docId || '',
          content: chunk?.content || '',
          score: r.score,
          metadata: {
            ...r.payload,
            document: chunk?.document,
            page: chunk?.page,
            chunkIndex: chunk?.chunkIndex,
          },
        };
      });

      // 7. Rerank（如果启用）
      if (enableRerank && results.length > 0) {
        results = await this.rerankResults(query, results, topK);

        // 增加 Rerank 阈值过滤：过滤掉 Rerank 后分数低于 0.5 的结果
        const rerankThreshold = 0.5;
        results = results.filter(r => r.score >= rerankThreshold);

        if (results.length === 0) {
          this.logger.warn(`All results filtered by rerank threshold: ${rerankThreshold}`);
        }
      }

      // 8. 限制返回数量
      return results.slice(0, topK);
    } catch (error) {
      this.logger.error(`Retrieval failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 使用 Rerank 模型重排序结果
   */
  private async rerankResults(
    query: string,
    results: RetrievalResult[],
    topK: number
  ): Promise<RetrievalResult[]> {
    try {
      this.logger.debug(`Reranking ${results.length} results`);

      const documents = results.map((r) => r.content);
      const rerankResults = await this.embeddingService.rerank(
        query,
        documents,
        topK
      );

      // 按照 Rerank 结果重新排序
      const rerankedResults = rerankResults.map((rerankItem) => {
        const originalResult = results[rerankItem.index];
        return {
          ...originalResult,
          score: rerankItem.score, // 使用 Rerank 分数
        };
      });

      this.logger.debug(
        `Reranked, top score: ${rerankedResults[0]?.score.toFixed(4)}`
      );
      return rerankedResults;
    } catch (error) {
      this.logger.error(`Rerank failed: ${error.message}`);
      // Rerank 失败时返回原始结果
      return results;
    }
  }

  /**
   * 动态相似度阈值（根据查询长度调整）
   * 长查询更难匹配，降低阈值
   */
  private getDynamicSimilarityThreshold(query: string): number {
    const baseThreshold = this.configService.get<number>('SIMILARITY_THRESHOLD', 0.3);

    // 查询长度超过 20 字时，降低阈值
    if (query.length > 20) {
      return Math.max(0.2, baseThreshold - 0.05); // 最低 0.2
    }

    return baseThreshold;
  }

  /**
   * 根据文档 ID 检索所有相关的 Chunks
   */
  async getChunksByDocumentId(documentId: string): Promise<RetrievalResult[]> {
    try {
      const chunks = await this.prisma.chunk.findMany({
        where: { docId: documentId },
        orderBy: { chunkIndex: 'asc' },
      });

      return chunks.map((chunk) => ({
        chunkId: chunk.chunkId,
        documentId: chunk.docId,
        content: chunk.content,
        score: 1.0,
        metadata: {
          page: chunk.page,
          chunkIndex: chunk.chunkIndex,
        },
      }));
    } catch (error) {
      this.logger.error(
        `Failed to get chunks for document ${documentId}: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * 批量检索多个查询
   */
  async batchRetrieve(
    queries: string[],
    options: SearchOptions = {}
  ): Promise<RetrievalResult[][]> {
    const results = await Promise.all(
      queries.map((query) => this.retrieve(query, options))
    );
    return results;
  }
}