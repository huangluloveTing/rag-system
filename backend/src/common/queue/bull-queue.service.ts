/**
 * Bull 队列服务
 * 处理异步任务（文档解析、向量化等）
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bull';

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
  private queue: Queue;
  private worker: Worker;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');

    // 创建队列
    this.queue = new Queue('document-processing', redisUrl, {
      defaultJobOptions: {
        attempts: 3, // 重试 3 次
        backoff: {
          type: 'exponential',
          delay: 1000, // 指数退避
        },
        removeOnComplete: 100, // 保留 100 个已完成任务
        removeOnFail: 1000, // 保留 1000 个失败任务
      },
    });

    // 创建工作器
    this.worker = new Worker(
      'document-processing',
      async (job: Job<DocumentProcessingJob, JobResult>) => {
        this.logger.log(`Processing job ${job.id}: ${job.data.documentId}`);
        
        // 这里只是占位，实际处理逻辑在 DocumentService 中
        // 工作器会在 DocumentModule 中初始化
        return {
          success: true,
          message: 'Job processed',
        };
      },
      { connection: redisUrl },
    );

    // 监听队列事件
    this.queue.on('error', (error) => {
      this.logger.error(`Queue error: ${error.message}`);
    });

    this.worker.on('error', (error) => {
      this.logger.error(`Worker error: ${error.message}`);
    });

    this.worker.on('completed', (job, result) => {
      this.logger.log(`Job ${job.id} completed: ${JSON.stringify(result)}`);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Job ${job?.id} failed: ${error.message}`);
    });

    this.logger.log('Bull queue initialized');
  }

  async onModuleDestroy() {
    await this.queue.close();
    await this.worker.close();
    this.logger.log('Bull queue closed');
  }

  /**
   * 添加文档处理任务到队列
   */
  async addDocumentProcessingJob(data: DocumentProcessingJob): Promise<Job> {
    const job = await this.queue.add('process-document', data, {
      priority: 1, // 普通优先级
    });
    this.logger.log(`Job added: ${job.id}`);
    return job;
  }

  /**
   * 添加延迟任务
   */
  async addDelayedJob(data: DocumentProcessingJob, delayMs: number): Promise<Job> {
    const job = await this.queue.add('process-document', data, {
      delay: delayMs,
    });
    this.logger.log(`Delayed job added: ${job.id}, delay: ${delayMs}ms`);
    return job;
  }

  /**
   * 获取任务状态
   */
  async getJobStatus(jobId: string): Promise<string> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      return 'not-found';
    }
    
    const state = await job.getState();
    return state;
  }

  /**
   * 获取队列统计信息
   */
  async getQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
    };
  }

  /**
   * 清空队列
   */
  async clearQueue() {
    await this.queue.obliterate({ force: true });
    this.logger.log('Queue cleared');
  }
}
