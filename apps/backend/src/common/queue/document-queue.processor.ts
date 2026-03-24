/**
 * 文档处理队列处理器
 */

import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { DocumentProcessor } from '../processor/document-processor.service';
import { DocumentProcessingJob } from './bull-queue.service';

@Processor('document-processing')
export class DocumentQueueProcessor {
  private readonly logger = new Logger(DocumentQueueProcessor.name);

  constructor(private documentProcessor: DocumentProcessor) {}

  @Process()
  async handleDocumentProcessing(job: Job<DocumentProcessingJob>) {
    const { documentId, filePath, knowledgeBaseId } = job.data;

    this.logger.log(
      `Processing document: ${documentId}, job ID: ${job.id}`
    );

    try {
      await this.documentProcessor.processDocument(documentId);

      this.logger.log(`Document processed successfully: ${documentId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process document ${documentId}: ${error.message}`
      );
      throw error;
    }
  }
}