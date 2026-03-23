/**
 * 文档服务
 * 处理文档上传、解析、索引等逻辑
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MinioService } from '../../common/minio/minio.service';
import { BullQueueService } from '../../common/queue/bull-queue.service';
import { DocumentDetailDto, DocumentListResponseDto, DocumentDto } from './dto/document.dto';
import * as crypto from 'crypto';

interface UploadOptions {
  knowledgeBaseId: string;
  tags?: string[];
  isPublic?: boolean;
}

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);
  private readonly bucketName = 'rag-documents';

  constructor(
    private prisma: PrismaService,
    private minioService: MinioService,
    private queueService: BullQueueService,
  ) {}

  /**
   * 上传文档
   */
  async uploadFile(
    file: Express.Multer.File,
    userId: string,
    options: UploadOptions,
  ): Promise<{ documentId: string; status: string }> {
    const { knowledgeBaseId, tags = [], isPublic = true } = options;

    try {
      // 1. 验证知识库是否存在
      const kb = await this.prisma.knowledgeBase.findUnique({
        where: { id: knowledgeBaseId },
      });

      if (!kb) {
        throw new BadRequestException('知识库不存在');
      }

      // 2. 上传文件到 MinIO
      const folder = `kb-${knowledgeBaseId}`;
      const filePath = await this.minioService.uploadFile(file, this.bucketName, folder);
      this.logger.log(`File uploaded to MinIO: ${filePath}`);

      // 3. 计算文件哈希（用于去重）
      const contentHash = this.calculateFileHash(file.buffer);

      // 4. 检测文件类型
      const fileType = this.detectFileType(file.mimetype, file.originalname);

      // 5. 创建数据库记录
      const document = await this.prisma.document.create({
        data: {
          filename: file.originalname,
          filePath,
          fileSize: BigInt(file.size),
          fileType,
          contentHash,
          status: 'pending',
          knowledgeBaseId,
          createdBy: userId,
          tags,
          isPublic,
          metadata: {
            originalName: file.originalname,
            mimetype: file.mimetype,
            uploadTime: new Date().toISOString(),
          },
        },
      });

      this.logger.log(`Document created: ${document.id}`);

      // 6. 添加到异步处理队列
      await this.queueService.addDocumentProcessingJob({
        documentId: document.id,
        filePath,
        knowledgeBaseId,
      });

      // 7. 更新状态为 processing
      await this.prisma.document.update({
        where: { id: document.id },
        data: { status: 'processing' },
      });

      return {
        documentId: document.id,
        status: 'processing',
      };
    } catch (error) {
      this.logger.error(`Error uploading file: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取文档列表
   */
  async getDocuments(
    knowledgeBaseId?: string,
    status?: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<DocumentListResponseDto> {
    const where: any = {};

    if (knowledgeBaseId) {
      where.knowledgeBaseId = knowledgeBaseId;
    }

    if (status) {
      where.status = status;
    }

    const [documents, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        select: {
          id: true,
          filename: true,
          fileSize: true,
          fileType: true,
          status: true,
          errorMessage: true,
          tags: true,
          isPublic: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.document.count({ where }),
    ]);

    return {
      documents: documents.map((doc) => ({
        id: doc.id,
        filename: doc.filename,
        fileSize: Number(doc.fileSize),
        fileType: doc.fileType ?? null,
        status: doc.status,
        errorMessage: doc.errorMessage ?? null,
        tags: doc.tags,
        isPublic: doc.isPublic,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 获取文档详情
   */
  async getDocumentById(documentId: string): Promise<DocumentDetailDto> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        chunks: {
          select: {
            id: true,
            chunkIndex: true,
            content: true,
            page: true,
          },
          orderBy: { chunkIndex: 'asc' },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('文档不存在');
    }

    return {
      id: document.id,
      filename: document.filename,
      fileSize: Number(document.fileSize),
      fileType: document.fileType ?? null,
      status: document.status,
      errorMessage: document.errorMessage ?? null,
      tags: document.tags,
      isPublic: document.isPublic,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      knowledgeBaseId: document.knowledgeBaseId,
      createdBy: document.createdBy,
      filePath: document.filePath ?? undefined,
      contentHash: document.contentHash ?? undefined,
      metadata: document.metadata ?? undefined,
      creator: document.creator
        ? {
            id: document.creator.id,
            username: document.creator.username,
            email: document.creator.email,
          }
        : null,
      chunks: document.chunks.map((chunk) => ({
        id: chunk.id,
        content: chunk.content,
        page: chunk.page,
        chunkIndex: chunk.chunkIndex,
      })),
    };
  }

  /**
   * 删除文档
   */
  async deleteDocument(documentId: string): Promise<void> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('文档不存在');
    }

    // 1. 从 MinIO 删除文件
    if (document.filePath) {
      try {
        await this.minioService.deleteFile(this.bucketName, document.filePath);
        this.logger.log(`File deleted from MinIO: ${document.filePath}`);
      } catch (error) {
        this.logger.error(`Error deleting file from MinIO: ${error.message}`);
      }
    }

    // 2. 从数据库删除（级联删除 chunks）
    await this.prisma.document.delete({
      where: { id: documentId },
    });

    this.logger.log(`Document deleted: ${documentId}`);
  }

  /**
   * 重新索引文档
   */
  async reindexDocument(documentId: string): Promise<{ documentId: string; status: string }> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('文档不存在');
    }

    if (!document.filePath) {
      throw new BadRequestException('文档文件不存在');
    }

    // 1. 删除旧的 chunks
    await this.prisma.chunk.deleteMany({
      where: { docId: documentId },
    });

    // 2. 更新状态为 pending
    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'pending',
        errorMessage: null,
      },
    });

    // 3. 重新加入队列
    await this.queueService.addDocumentProcessingJob({
      documentId: document.id,
      filePath: document.filePath,
      knowledgeBaseId: document.knowledgeBaseId,
    });

    // 4. 更新状态为 processing
    await this.prisma.document.update({
      where: { id: documentId },
      data: { status: 'processing' },
    });

    return {
      documentId: document.id,
      status: 'processing',
    };
  }

  /**
   * 计算文件哈希
   */
  private calculateFileHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * 检测文件类型
   */
  private detectFileType(mimetype: string, filename: string): string {
    // 根据 mimetype 判断
    if (mimetype.includes('pdf')) return 'pdf';
    if (mimetype.includes('word') || mimetype.includes('officedocument')) return 'docx';
    if (mimetype.includes('markdown') || mimetype.includes('text')) {
      // 进一步根据扩展名判断
      if (filename.endsWith('.md')) return 'markdown';
      return 'txt';
    }

    // 根据扩展名判断
    if (filename.endsWith('.pdf')) return 'pdf';
    if (filename.endsWith('.docx')) return 'docx';
    if (filename.endsWith('.md')) return 'markdown';
    if (filename.endsWith('.txt')) return 'txt';

    return 'unknown';
  }
}
