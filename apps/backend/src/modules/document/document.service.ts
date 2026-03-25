/**
 * 文档服务
 * 处理文档上传、解析、索引等逻辑
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MinioService } from '../../common/minio/minio.service';
import { BullQueueService } from '../../common/queue/bull-queue.service';
import {
  DocumentDetailDto,
  DocumentListResponseDto,
  DocumentDto,
  DocumentVersionDto,
  DocumentVersionListResponseDto,
} from './dto/document.dto';
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

      // 2. 计算文件哈希
      const contentHash = this.calculateFileHash(file.buffer);

      // 3. 检查是否存在同名文件（用于版本管理）
      const existingDocument = await this.prisma.document.findFirst({
        where: {
          filename: file.originalname,
          knowledgeBaseId,
          isLatest: true,
        },
      });

      let documentId: string;

      if (existingDocument) {
        // 如果存在同名文件，创建新版本
        this.logger.log(`Found existing document: ${existingDocument.id}, creating new version`);

        // 将当前版本标记为历史版本
        await this.prisma.documentVersion.create({
          data: {
            documentId: existingDocument.id,
            version: existingDocument.version,
            filename: existingDocument.filename,
            filePath: existingDocument.filePath || '',
            fileSize: existingDocument.fileSize || BigInt(0),
            fileType: existingDocument.fileType,
            contentHash: existingDocument.contentHash || '',
            status: existingDocument.status,
            errorMessage: existingDocument.errorMessage,
            metadata: existingDocument.metadata as any,
            tags: existingDocument.tags,
          },
        });

        // 上传新文件到 MinIO
        const folder = `kb-${knowledgeBaseId}`;
        const filePath = await this.minioService.uploadFile(file, this.bucketName, folder);
        this.logger.log(`File uploaded to MinIO: ${filePath}`);

        // 检测文件类型
        const fileType = this.detectFileType(file.mimetype, file.originalname);

        // 更新文档记录
        await this.prisma.document.update({
          where: { id: existingDocument.id },
          data: {
            filePath,
            fileSize: BigInt(file.size),
            fileType,
            contentHash,
            status: 'pending',
            errorMessage: null,
            version: existingDocument.version + 1,
            tags,
            isPublic,
            metadata: {
              originalName: file.originalname,
              mimetype: file.mimetype,
              uploadTime: new Date().toISOString(),
            },
          },
        });

        documentId = existingDocument.id;
      } else {
        // 新文档
        // 4. 上传文件到 MinIO
        const folder = `kb-${knowledgeBaseId}`;
        const filePath = await this.minioService.uploadFile(file, this.bucketName, folder);
        this.logger.log(`File uploaded to MinIO: ${filePath}`);

        // 5. 检测文件类型
        const fileType = this.detectFileType(file.mimetype, file.originalname);

        // 6. 创建数据库记录
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
            version: 1,
            isLatest: true,
            metadata: {
              originalName: file.originalname,
              mimetype: file.mimetype,
              uploadTime: new Date().toISOString(),
            },
          },
        });

        documentId = document.id;
      }

      this.logger.log(`Document created/updated: ${documentId}`);

      // 删除旧的 chunks（如果是更新版本）
      if (existingDocument) {
        await this.prisma.chunk.deleteMany({
          where: { docId: documentId },
        });
      }

      // 添加到异步处理队列
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
      });

      await this.queueService.addDocumentProcessingJob({
        documentId,
        filePath: document!.filePath!,
        knowledgeBaseId,
      });

      // 更新状态为 processing
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'processing' },
      });

      return {
        documentId,
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
      version: document.version,
      isLatest: document.isLatest,
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
    if (mimetype.includes('html')) return 'html';
    if (mimetype.includes('markdown') || mimetype.includes('text')) {
      // 进一步根据扩展名判断
      if (filename.endsWith('.md')) return 'markdown';
      if (filename.endsWith('.html') || filename.endsWith('.htm')) return 'html';
      return 'txt';
    }

    // 根据扩展名判断
    if (filename.endsWith('.pdf')) return 'pdf';
    if (filename.endsWith('.docx')) return 'docx';
    if (filename.endsWith('.html') || filename.endsWith('.htm')) return 'html';
    if (filename.endsWith('.md')) return 'markdown';
    if (filename.endsWith('.txt')) return 'txt';

    return 'unknown';
  }

  /**
   * 获取文档版本历史
   */
  async getDocumentVersions(documentId: string): Promise<DocumentVersionListResponseDto> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('文档不存在');
    }

    const versions = await this.prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { version: 'desc' },
    });

    return {
      versions: versions.map((v) => ({
        id: v.id,
        version: v.version,
        filename: v.filename,
        fileSize: Number(v.fileSize),
        fileType: v.fileType ?? null,
        contentHash: v.contentHash ?? null,
        status: v.status,
        errorMessage: v.errorMessage ?? null,
        tags: v.tags,
        createdAt: v.createdAt,
      })),
      total: versions.length,
    };
  }

  /**
   * 恢复文档到指定版本
   */
  async restoreDocumentVersion(
    documentId: string,
    versionId: string,
  ): Promise<{ message: string; documentId: string }> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('文档不存在');
    }

    const version = await this.prisma.documentVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || version.documentId !== documentId) {
      throw new NotFoundException('版本不存在或不属于该文档');
    }

    // 1. 将当前版本保存为历史版本（如果还未保存）
    const currentVersion = await this.prisma.documentVersion.findFirst({
      where: {
        documentId,
        version: document.version,
      },
    });

    if (!currentVersion && document.filePath) {
      await this.prisma.documentVersion.create({
        data: {
          documentId,
          version: document.version,
          filename: document.filename,
          filePath: document.filePath,
          fileSize: document.fileSize || BigInt(0),
          fileType: document.fileType,
          contentHash: document.contentHash || '',
          status: document.status,
          errorMessage: document.errorMessage,
          metadata: document.metadata as any,
          tags: document.tags,
        },
      });
    }

    // 2. 删除当前文档的 chunks
    await this.prisma.chunk.deleteMany({
      where: { docId: documentId },
    });

    // 3. 更新文档为指定版本
    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        filename: version.filename,
        filePath: version.filePath,
        fileSize: version.fileSize,
        fileType: version.fileType,
        contentHash: version.contentHash,
        status: 'pending',
        errorMessage: null,
        metadata: version.metadata as any,
        tags: version.tags,
        version: document.version + 1, // 增加版本号
      },
    });

    // 4. 重新加入队列
    await this.queueService.addDocumentProcessingJob({
      documentId,
      filePath: version.filePath,
      knowledgeBaseId: document.knowledgeBaseId,
    });

    // 5. 更新状态为 processing
    await this.prisma.document.update({
      where: { id: documentId },
      data: { status: 'processing' },
    });

    return {
      message: `已恢复到版本 ${version.version}`,
      documentId,
    };
  }

  /**
   * 获取文档预览内容
   */
  async getDocumentPreview(documentId: string): Promise<{ content: string; type: string }> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        chunks: {
          select: {
            content: true,
            page: true,
            chunkIndex: true,
          },
          orderBy: { chunkIndex: 'asc' },
          take: 100, // 最多返回 100 个 chunks
        },
      },
    });

    if (!document) {
      throw new NotFoundException('文档不存在');
    }

    if (!document.filePath) {
      throw new BadRequestException('文档文件不存在');
    }

    // 如果文档是 TXT/Markdown/HTML，从 MinIO 读取原始内容
    if (
      document.fileType === 'txt' ||
      document.fileType === 'markdown' ||
      document.fileType === 'html'
    ) {
      try {
        const fileStream = await this.minioService.getFile(this.bucketName, document.filePath);
        const chunks: Buffer[] = [];

        for await (const chunk of fileStream) {
          chunks.push(Buffer.from(chunk));
        }

        const content = Buffer.concat(chunks).toString('utf-8');
        return {
          content,
          type: document.fileType,
        };
      } catch (error) {
        this.logger.error(`Error reading file from MinIO: ${error.message}`);
        throw new BadRequestException('无法读取文件内容');
      }
    }

    // 对于 PDF/DOCX，返回 chunks 拼接的内容
    if (document.chunks.length === 0) {
      return {
        content: '文档尚未处理完成，请稍后再试',
        type: 'text',
      };
    }

    const content = document.chunks.map((chunk) => chunk.content).join('\n\n');
    return {
      content,
      type: 'text',
    };
  }
}
