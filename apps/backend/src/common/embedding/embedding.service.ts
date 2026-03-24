/**
 * Embedding 服务客户端
 * 调用 Embedding 微服务生成向量和 Rerank
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface RerankResult {
  index: number;
  document: string;
  score: number;
  rank: number;
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly serviceUrl: string;

  constructor(private configService: ConfigService) {
    this.serviceUrl = this.configService.get<string>(
      'EMBEDDING_SERVICE_URL',
      'http://localhost:8001'
    );
  }

  /**
   * 生成文本向量
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      this.logger.debug(`Generating embeddings for ${texts.length} texts`);

      const response = await axios.post<EmbeddingResult>(
        `${this.serviceUrl}/embed`,
        {
          texts,
          model_name: 'bge-large-zh-v1.5',
        },
        {
          timeout: 30000, // 30秒超时
        }
      );

      this.logger.debug(
        `Generated ${response.data.embeddings.length} embeddings`
      );
      return response.data.embeddings;
    } catch (error) {
      this.logger.error(`Failed to generate embeddings: ${error.message}`);
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }

  /**
   * 生成单个文本的向量
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const embeddings = await this.generateEmbeddings([text]);
    return embeddings[0];
  }

  /**
   * 重排序文档
   */
  async rerank(
    query: string,
    documents: string[],
    topK: number = 5
  ): Promise<RerankResult[]> {
    try {
      this.logger.debug(
        `Reranking ${documents.length} documents, topK: ${topK}`
      );

      const response = await axios.post<{ results: RerankResult[] }>(
        `${this.serviceUrl}/rerank`,
        {
          query,
          documents,
          top_k: topK,
        },
        {
          timeout: 30000,
        }
      );

      this.logger.debug(
        `Reranked documents, top score: ${response.data.results[0]?.score}`
      );
      return response.data.results;
    } catch (error) {
      this.logger.error(`Failed to rerank documents: ${error.message}`);
      throw new Error(`Rerank failed: ${error.message}`);
    }
  }

  /**
   * 检查服务健康状态
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.serviceUrl}/health`, {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      this.logger.error(`Embedding service health check failed: ${error.message}`);
      return false;
    }
  }
}