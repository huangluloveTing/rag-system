/**
 * 配置服务
 * 提供类型安全的配置访问
 */

import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

export interface DatabaseConfig {
  url: string;
}

export interface MilvusConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface MinIOConfig {
  endPoint: string;
  accessKey: string;
  secretKey: string;
  useSSL: boolean;
}

export interface LLMConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export interface JWTConfig {
  secret: string;
  expiration: string;
  refreshSecret: string;
  refreshExpiration: string;
}

@Injectable()
export class AppConfigService {
  constructor(private configService: NestConfigService) {}

  get database(): DatabaseConfig {
    return {
      url: this.configService.get<string>('DATABASE_URL', ''),
    };
  }

  get milvus(): MilvusConfig {
    return {
      host: this.configService.get<string>('MILVUS_HOST', 'localhost'),
      port: this.configService.get<number>('MILVUS_PORT', 19530),
      username: this.configService.get<string>('MILVUS_USERNAME'),
      password: this.configService.get<string>('MILVUS_PASSWORD'),
    };
  }

  get minio(): MinIOConfig {
    return {
      endPoint: this.configService.get<string>('MINIO_ENDPOINT', 'localhost:9000'),
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
      useSSL: this.configService.get<boolean>('MINIO_USE_SSL', false),
    };
  }

  get llm(): LLMConfig {
    return {
      apiKey: this.configService.get<string>('LLM_API_KEY', ''),
      model: this.configService.get<string>('LLM_MODEL', 'qwen3.5-plus'),
      baseUrl: this.configService.get<string>(
        'LLM_BASE_URL',
        'https://dashscope.aliyuncs.com/compatible-mode/v1',
      ),
    };
  }

  get jwt(): JWTConfig {
    return {
      secret: this.configService.get<string>('JWT_SECRET', 'dev-secret'),
      expiration: this.configService.get<string>('JWT_EXPIRATION', '24h'),
      refreshSecret: this.configService.get<string>(
        'JWT_REFRESH_SECRET',
        'dev-refresh-secret',
      ),
      refreshExpiration: this.configService.get<string>(
        'JWT_REFRESH_EXPIRATION',
        '7d',
      ),
    };
  }

  get redis(): string {
    return this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
  }

  get embeddingServiceUrl(): string {
    return this.configService.get<string>(
      'EMBEDDING_SERVICE_URL',
      'http://localhost:8001',
    );
  }

  get chunkSize(): number {
    return this.configService.get<number>('CHUNK_SIZE', 500);
  }

  get chunkOverlap(): number {
    return this.configService.get<number>('CHUNK_OVERLAP', 100);
  }

  get topK(): number {
    return this.configService.get<number>('TOP_K', 5);
  }

  get similarityThreshold(): number {
    return this.configService.get<number>('SIMILARITY_THRESHOLD', 0.3);
  }

  get maxFileSize(): number {
    return this.configService.get<number>('MAX_FILE_SIZE', 52428800); // 50MB
  }
}
