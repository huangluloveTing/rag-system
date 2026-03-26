/**
 * Qdrant 向量数据库服务
 * 处理向量存储和检索
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';

export interface VectorPoint {
  id: number;
  vector: number[];
  payload?: Record<string, any>;
}

export interface SearchResult {
  id: string;
  score: number;
  payload?: Record<string, any>;
}

@Injectable()
export class QdrantService implements OnModuleInit {
  private readonly logger = new Logger(QdrantService.name);
  private client: QdrantClient;
  private readonly collectionName = 'rag_documents';

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.get<string>('QDRANT_HOST', 'localhost');
    const port = this.configService.get<number>('QDRANT_PORT', 6333);
    const apiKey = this.configService.get<string>('QDRANT_API_KEY');

    this.client = new QdrantClient({
      host,
      port,
      apiKey: apiKey || undefined,
    });

    this.logger.log(`Qdrant client initialized: ${host}:${port}`);

    // 确保集合存在
    await this.ensureCollection();
  }

  /**
   * 确保集合存在，不存在则创建
   */
  private async ensureCollection() {
    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(
        (c) => c.name === this.collectionName
      );

      if (!exists) {
        // 从环境变量获取向量维度，默认 2560 (qwen/qwen3-embedding-4b)
        const vectorSize = this.configService.get<number>('EMBEDDING_DIMENSION', 2560);

        this.logger.log(`Creating collection: ${this.collectionName} with vector size ${vectorSize}`);
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: vectorSize,
            distance: 'Cosine',
          },
        });
        this.logger.log(`Collection created: ${this.collectionName}`);
      }
    } catch (error) {
      this.logger.error(`Failed to ensure collection: ${error.message}`);
      throw error;
    }
  }

  /**
   * 插入向量点
   */
  async upsertPoints(points: VectorPoint[]): Promise<void> {
    try {
      await this.client.upsert(this.collectionName, {
        wait: true,
        points: points.map((p) => ({
          id: p.id,
          vector: p.vector,
          payload: p.payload,
        })),
      });
      this.logger.log(`Upserted ${points.length} points to Qdrant`);
    } catch (error) {
      this.logger.error(`Failed to upsert points: ${error.message}`);
      throw error;
    }
  }

  /**
   * 向量相似度搜索
   */
  async search(
    vector: number[],
    topK: number = 5,
    filter?: Record<string, any>
  ): Promise<SearchResult[]> {
    try {
      const results = await this.client.search(this.collectionName, {
        vector,
        limit: topK,
        filter: filter ? this.buildFilter(filter) : undefined,
      });

      return results.map((r) => ({
        id: r.id as string,
        score: r.score,
        payload: r.payload || undefined,
      }));
    } catch (error) {
      this.logger.error(`Search failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 删除指定文档的所有向量
   */
  async deleteByDocumentId(documentId: string): Promise<void> {
    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        filter: {
          must: [
            {
              key: 'documentId',
              match: { value: documentId },
            },
          ],
        },
      });
      this.logger.log(`Deleted vectors for document: ${documentId}`);
    } catch (error) {
      this.logger.error(`Failed to delete document vectors: ${error.message}`);
      throw error;
    }
  }

  /**
   * 删除单个向量点
   */
  async deletePoint(pointId: string): Promise<void> {
    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        points: [pointId],
      });
      this.logger.log(`Deleted point: ${pointId}`);
    } catch (error) {
      this.logger.error(`Failed to delete point: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取集合统计信息
   */
  async getCollectionInfo() {
    try {
      const info = await this.client.getCollection(this.collectionName);
      return {
        vectorsCount: info.indexed_vectors_count || 0,
        pointsCount: info.points_count || 0,
        status: info.status,
      };
    } catch (error) {
      this.logger.error(`Failed to get collection info: ${error.message}`);
      throw error;
    }
  }

  /**
   * 构建 Qdrant 过滤器
   */
  private buildFilter(filter: Record<string, any>): any {
    const must: any[] = [];

    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null) {
        must.push({
          key,
          match: { value },
        });
      }
    }

    return must.length > 0 ? { must } : undefined;
  }
}