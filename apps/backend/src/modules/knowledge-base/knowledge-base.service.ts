/**
 * 知识库服务
 * 处理知识库的创建、配置、管理
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateKnowledgeBaseDto {
  name: string;
  description?: string;
  config?: {
    chunkSize?: number;
    overlap?: number;
    embeddingModel?: string;
    topK?: number;
  };
}

export interface UpdateKnowledgeBaseDto {
  name?: string;
  description?: string;
  config?: any;
}

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 创建知识库
   */
  async create(data: CreateKnowledgeBaseDto, userId: string) {
    const kb = await this.prisma.knowledgeBase.create({
      data: {
        name: data.name,
        description: data.description,
        config: data.config || {
          chunkSize: 500,
          overlap: 100,
          embeddingModel: 'bge-large-zh-v1.5',
          topK: 5,
        },
        createdBy: userId,
      },
    });

    this.logger.log(`Created knowledge base: ${kb.id}`);
    return kb;
  }

  /**
   * 获取知识库列表
   */
  async getList(page: number = 1, pageSize: number = 20) {
    const [knowledgeBases, total] = await Promise.all([
      this.prisma.knowledgeBase.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          _count: {
            select: { documents: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.knowledgeBase.count(),
    ]);

    return {
      knowledgeBases: knowledgeBases.map((kb) => ({
        ...kb,
        documentCount: kb._count.documents,
      })),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 获取知识库详情
   */
  async getById(id: string) {
    const kb = await this.prisma.knowledgeBase.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        documents: {
          select: {
            id: true,
            filename: true,
            fileType: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: { documents: true },
        },
      },
    });

    if (!kb) {
      throw new NotFoundException('知识库不存在');
    }

    return {
      ...kb,
      documentCount: kb._count.documents,
    };
  }

  /**
   * 更新知识库
   */
  async update(id: string, data: UpdateKnowledgeBaseDto) {
    const kb = await this.prisma.knowledgeBase.findUnique({
      where: { id },
    });

    if (!kb) {
      throw new NotFoundException('知识库不存在');
    }

    const updated = await this.prisma.knowledgeBase.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        config: data.config,
      },
    });

    this.logger.log(`Updated knowledge base: ${id}`);
    return updated;
  }

  /**
   * 删除知识库
   */
  async delete(id: string) {
    const kb = await this.prisma.knowledgeBase.findUnique({
      where: { id },
      include: {
        _count: {
          select: { documents: true },
        },
      },
    });

    if (!kb) {
      throw new NotFoundException('知识库不存在');
    }

    if (kb._count.documents > 0) {
      throw new BadRequestException(
        '知识库中还有文档，无法删除。请先删除所有文档。'
      );
    }

    await this.prisma.knowledgeBase.delete({
      where: { id },
    });

    this.logger.log(`Deleted knowledge base: ${id}`);
  }

  /**
   * 获取知识库统计信息
   */
  async getStats(id: string) {
    const kb = await this.prisma.knowledgeBase.findUnique({
      where: { id },
    });

    if (!kb) {
      throw new NotFoundException('知识库不存在');
    }

    const [documentStats, chunkStats] = await Promise.all([
      this.prisma.document.groupBy({
        by: ['status'],
        where: { knowledgeBaseId: id },
        _count: true,
      }),
      this.prisma.chunk.count({
        where: {
          document: {
            knowledgeBaseId: id,
          },
        },
      }),
    ]);

    return {
      documents: documentStats.reduce(
        (acc, item) => {
          acc[item.status] = item._count;
          return acc;
        },
        {} as Record<string, number>
      ),
      totalChunks: chunkStats,
    };
  }
}