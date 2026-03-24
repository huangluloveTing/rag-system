/**
 * 文档处理器
 * 处理文档解析、分块、向量化等逻辑
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { MinioService } from '../minio/minio.service';
import { QdrantService } from '../qdrant/qdrant.service';
import { EmbeddingService } from '../embedding/embedding.service';
import * as pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import * as MarkdownIt from 'markdown-it';

export interface ChunkData {
  content: string;
  page?: number;
  chunkIndex: number;
  metadata?: any;
}

@Injectable()
export class DocumentProcessor {
  private readonly logger = new Logger(DocumentProcessor.name);
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;
  private readonly md: any;

  constructor(
    private prisma: PrismaService,
    private minioService: MinioService,
    private qdrantService: QdrantService,
    private embeddingService: EmbeddingService,
    private configService: ConfigService
  ) {
    this.chunkSize = this.configService.get<number>('CHUNK_SIZE', 500);
    this.chunkOverlap = this.configService.get<number>('CHUNK_OVERLAP', 100);
    this.md = new MarkdownIt();
  }

  /**
   * 处理文档（解析 -> 分块 -> 向量化 -> 存储）
   */
  async processDocument(documentId: string): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.log(`Processing document: ${documentId}`);

      // 1. 获取文档信息
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document || !document.filePath) {
        throw new Error('Document not found or file path missing');
      }

      // 2. 从 MinIO 下载文件
      const fileBuffer = await this.minioService.downloadFile(
        'rag-documents',
        document.filePath
      );

      this.logger.debug(`Downloaded file: ${document.filePath}`);

      // 3. 解析文档提取文本
      const text = await this.parseDocument(
        fileBuffer,
        document.fileType || 'unknown'
      );

      this.logger.debug(`Extracted ${text.length} characters`);

      // 4. 分块
      const chunks = this.splitText(text);
      this.logger.debug(`Split into ${chunks.length} chunks`);

      // 5. 批量生成向量
      const embeddings = await this.embeddingService.generateEmbeddings(
        chunks.map((c) => c.content)
      );

      this.logger.debug(`Generated ${embeddings.length} embeddings`);

      // 6. 保存到数据库
      const savedChunks = await this.prisma.chunk.createMany({
        data: chunks.map((chunk, index) => ({
          chunkId: `${documentId}-${index}`,
          docId: documentId,
          content: chunk.content,
          page: chunk.page,
          chunkIndex: chunk.chunkIndex,
          metadata: chunk.metadata,
        })),
      });

      this.logger.debug(`Saved ${savedChunks.count} chunks to database`);

      // 7. 存储到 Qdrant
      const points = chunks.map((chunk, index) => ({
        id: `${documentId}-${index}`,
        vector: embeddings[index],
        payload: {
          documentId,
          knowledgeBaseId: document.knowledgeBaseId,
          content: chunk.content.substring(0, 500), // 只存储前 500 字符
          page: chunk.page,
          chunkIndex: chunk.chunkIndex,
        },
      }));

      await this.qdrantService.upsertPoints(points);
      this.logger.debug(`Stored ${points.length} vectors in Qdrant`);

      // 8. 更新文档状态
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'indexed',
          metadata: {
            ...((document.metadata as object) || {}),
            chunkCount: chunks.length,
            processedAt: new Date().toISOString(),
            processingTimeMs: Date.now() - startTime,
          },
        },
      });

      this.logger.log(
        `Document processed successfully: ${documentId} (${Date.now() - startTime}ms)`
      );
    } catch (error) {
      this.logger.error(`Failed to process document: ${error.message}`);

      // 更新错误状态
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'failed',
          errorMessage: error.message,
        },
      });

      throw error;
    }
  }

  /**
   * 解析文档提取文本
   */
  private async parseDocument(
    fileBuffer: Buffer,
    fileType: string
  ): Promise<string> {
    try {
      switch (fileType) {
        case 'pdf':
          return await this.parsePDF(fileBuffer);
        case 'docx':
          return await this.parseDocx(fileBuffer);
        case 'markdown':
        case 'txt':
          return fileBuffer.toString('utf-8');
        default:
          this.logger.warn(`Unsupported file type: ${fileType}, treating as text`);
          return fileBuffer.toString('utf-8');
      }
    } catch (error) {
      this.logger.error(`Failed to parse document: ${error.message}`);
      throw new Error(`Document parsing failed: ${error.message}`);
    }
  }

  /**
   * 解析 PDF
   */
  private async parsePDF(buffer: Buffer): Promise<string> {
    const data = await pdfParse(buffer);
    return data.text;
  }

  /**
   * 解析 Word 文档
   */
  private async parseDocx(buffer: Buffer): Promise<string> {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  /**
   * 文本分块
   */
  private splitText(text: string): ChunkData[] {
    const chunks: ChunkData[] = [];

    // 按段落分割
    const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);

    let currentChunk = '';
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      // 如果单个段落就超过 chunk 大小，需要进一步分割
      if (paragraph.length > this.chunkSize) {
        // 先保存当前块
        if (currentChunk.trim().length > 0) {
          chunks.push({
            content: currentChunk.trim(),
            chunkIndex: chunkIndex++,
          });
          currentChunk = '';
        }

        // 分割大段落
        const sentences = paragraph.split(/([。！？\n])/);
        let tempChunk = '';

        for (let i = 0; i < sentences.length; i += 2) {
          const sentence = sentences[i] + (sentences[i + 1] || '');

          if (tempChunk.length + sentence.length > this.chunkSize) {
            if (tempChunk.trim().length > 0) {
              chunks.push({
                content: tempChunk.trim(),
                chunkIndex: chunkIndex++,
              });
            }
            tempChunk = sentence;
          } else {
            tempChunk += sentence;
          }
        }

        if (tempChunk.trim().length > 0) {
          currentChunk = tempChunk;
        }
      } else {
        // 添加段落到当前块
        if (currentChunk.length + paragraph.length + 2 > this.chunkSize) {
          // 当前块已满，保存
          if (currentChunk.trim().length > 0) {
            chunks.push({
              content: currentChunk.trim(),
              chunkIndex: chunkIndex++,
            });
          }
          currentChunk = paragraph;
        } else {
          currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        }
      }
    }

    // 保存最后一个块
    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        chunkIndex: chunkIndex++,
      });
    }

    return chunks;
  }

  /**
   * 删除文档的所有向量和 chunks
   */
  async deleteDocumentVectors(documentId: string): Promise<void> {
    try {
      // 1. 从 Qdrant 删除向量
      await this.qdrantService.deleteByDocumentId(documentId);

      // 2. 从数据库删除 chunks（会自动级联删除）
      this.logger.log(`Deleted vectors and chunks for document: ${documentId}`);
    } catch (error) {
      this.logger.error(`Failed to delete document vectors: ${error.message}`);
      throw error;
    }
  }
}