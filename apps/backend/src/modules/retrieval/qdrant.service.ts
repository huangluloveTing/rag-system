/**
 * Qdrant 向量数据库服务
 * Phase 2 实现
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { AppConfigService } from '../../config/config.service';

@Injectable()
export class QdrantService implements OnModuleInit, OnModuleDestroy {
  private client: QdrantClient;
  private readonly collectionName = 'rag_chunks';

  constructor(private configService: AppConfigService) {}

  async onModuleInit() {
    const config = this.configService.qdrant;
    this.client = new QdrantClient({
      url: `http://${config.host}`,
      port: config.port,
      apiKey: config.apiKey,
    });

    // 确保集合存在
    await this.ensureCollection();
  }

  async onModuleDestroy() {
    // Qdrant client 不需要显式关闭
  }

  /**
   * 确保集合存在
   */
  private async ensureCollection() {
    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(
        (c) => c.name === this.collectionName,
      );

      if (!exists) {
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: 1024, // bge-large-zh 向量维度
            distance: 'Cosine',
          },
        });
      }
    } catch (error) {
      console.error('Failed to ensure Qdrant collection:', error);
    }
  }

  /**
   * 获取客户端实例
   */
  getClient(): QdrantClient {
    return this.client;
  }

  /**
   * 获取集合名称
   */
  getCollectionName(): string {
    return this.collectionName;
  }
}
