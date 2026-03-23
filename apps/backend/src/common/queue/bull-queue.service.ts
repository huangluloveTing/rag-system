/**
 * Bull 队列服务 - 简化版
 * 处理异步任务（文档解析、向量化等）
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Bull from 'bull';

export interface DocumentProcessingJob {
  documentId: string;
  filePath: string;
  knowledgeBaseId: string;
}

export interface JobResult {
  success: boolean;
  message?: string;
  error?: string;
}

@Injectable()
export class BullQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BullQueueService.name);
  private queue: Bull.Queue;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');

    // 创建队列
    this.queue = new Bull('document-processing', redisUrl, {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    });

    // 监听队列事件
    this.queue.on('error', (err) => {
      this.logger.error('Queue error:', err);
    });

    this.queue.on('waiting', (jobId) => {
      this.logger.debug(`Job ${jobId} waiting`);
    });

    this.logger.log('Bull queue initialized');
  }

  async onModuleDestroy() {
    if (this.queue) {
      await this.queue.close();
      this.logger.log('Bull queue closed');
    }
  }

  /**
   * 添加文档处理任务到队列
   */
  async addDocumentJob(data: DocumentProcessingJob): Promise<Bull.Job<DocumentProcessingJob>> {
    const job = await this.queue.add(data, {
      removeOnComplete: true,
      removeOnFail: true,
    });
    this.logger.log(`Job ${job.id} added to queue`);
    return job;
  }

  /**
   * 添加文档处理任务（别名，兼容旧代码）
   */
  async addDocumentProcessingJob(data: DocumentProcessingJob): Promise<Bull.Job<DocumentProcessingJob>> {
    return this.addDocumentJob(data);
  }

  /**
   * 获取队列状态
   */
  async getQueueStats(): Promise<{ waiting: number; active: number; completed: number; failed: number }> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }

  /**
   * 清空队列
   */
  async clearQueue(): Promise<void> {
    await this.queue.obliterate({ force: true });
    this.logger.log('Queue cleared');
  }
}
