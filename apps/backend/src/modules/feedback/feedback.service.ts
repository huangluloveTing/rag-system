/**
 * 反馈服务
 * 处理用户对回答的反馈
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateFeedbackDto {
  chatMessageId: string;
  rating: number; // 1-5: 星评分
  comment?: string;
  tags?: string[]; // 反馈标签：["不准确", "不完整", "来源错误"]
}

export interface UpdateFeedbackDto {
  status?: string; // pending/resolved/ignored
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface FeedbackStats {
  total: number;
  positive: number;
  negative: number;
  positiveRate: number;
}

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 创建反馈
   */
  async createFeedback(
    data: CreateFeedbackDto,
    userId: string
  ) {
    try {
      // 验证消息是否存在
      const message = await this.prisma.chatMessage.findUnique({
        where: { id: data.chatMessageId },
      });

      if (!message) {
        throw new NotFoundException('消息不存在');
      }

      // 验证评分范围
      if (data.rating < 1 || data.rating > 5) {
        throw new BadRequestException('评分必须在 1-5 之间');
      }

      // 检查是否已经反馈过
      const existingFeedback = await this.prisma.feedback.findFirst({
        where: {
          chatMessageId: data.chatMessageId,
          userId,
        },
      });

      if (existingFeedback) {
        // 更新反馈
        const updated = await this.prisma.feedback.update({
          where: { id: existingFeedback.id },
          data: {
            rating: data.rating,
            comment: data.comment,
            tags: data.tags,
          },
        });
        this.logger.log(`Updated feedback for message: ${data.chatMessageId}`);
        return updated;
      }

      // 创建新反馈
      const feedback = await this.prisma.feedback.create({
        data: {
          chatMessageId: data.chatMessageId,
          userId,
          rating: data.rating,
          comment: data.comment,
          tags: data.tags || [],
        },
      });

      this.logger.log(`Created feedback for message: ${data.chatMessageId}`);
      return feedback;
    } catch (error) {
      this.logger.error(`Failed to create feedback: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取消息的反馈
   */
  async getMessageFeedback(messageId: string) {
    const feedbacks = await this.prisma.feedback.findMany({
      where: { chatMessageId: messageId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return feedbacks;
  }

  /**
   * 获取反馈统计
   */
  async getFeedbackStats(knowledgeBaseId?: string): Promise<FeedbackStats> {
    const where: any = {};

    if (knowledgeBaseId) {
      where.chatMessage = {
        session: {
          knowledgeBaseId,
        },
      };
    }

    const [total, positive, negative] = await Promise.all([
      this.prisma.feedback.count({ where }),
      this.prisma.feedback.count({
        where: { ...where, rating: { gte: 4 } }, // 4-5 星为正面
      }),
      this.prisma.feedback.count({
        where: { ...where, rating: { lte: 2 } }, // 1-2 星为负面
      }),
    ]);

    return {
      total,
      positive,
      negative,
      positiveRate: total > 0 ? (positive / total) * 100 : 0,
    };
  }

  /**
   * 获取用户的反馈列表
   */
  async getUserFeedbacks(
    userId: string,
    page: number = 1,
    pageSize: number = 20
  ) {
    const [feedbacks, total] = await Promise.all([
      this.prisma.feedback.findMany({
        where: { userId },
        include: {
          chatMessage: {
            select: {
              id: true,
              content: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.feedback.count({ where: { userId } }),
    ]);

    return {
      feedbacks,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 获取所有反馈列表（管理员）
   */
  async getAllFeedbacks(
    page: number = 1,
    pageSize: number = 20,
    filters?: {
      status?: string;
      rating?: number;
      knowledgeBaseId?: string;
    }
  ) {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.rating) {
      where.rating = filters.rating;
    }

    if (filters?.knowledgeBaseId) {
      where.chatMessage = {
        session: {
          knowledgeBaseId: filters.knowledgeBaseId,
        },
      };
    }

    const [feedbacks, total] = await Promise.all([
      this.prisma.feedback.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          chatMessage: {
            select: {
              id: true,
              content: true,
              role: true,
              createdAt: true,
              session: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.feedback.count({ where }),
    ]);

    return {
      feedbacks,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 获取反馈详情（管理员）
   */
  async getFeedbackDetail(feedbackId: string) {
    const feedback = await this.prisma.feedback.findUnique({
      where: { id: feedbackId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        chatMessage: {
          include: {
            session: {
              select: {
                id: true,
                title: true,
                user: {
                  select: {
                    id: true,
                    username: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!feedback) {
      throw new NotFoundException('反馈不存在');
    }

    return feedback;
  }

  /**
   * 更新反馈状态（管理员）
   */
  async updateFeedbackStatus(
    feedbackId: string,
    status: string,
    resolvedBy: string
  ) {
    const feedback = await this.prisma.feedback.findUnique({
      where: { id: feedbackId },
    });

    if (!feedback) {
      throw new NotFoundException('反馈不存在');
    }

    const updated = await this.prisma.feedback.update({
      where: { id: feedbackId },
      data: {
        status,
        resolvedAt: status === 'resolved' ? new Date() : null,
        resolvedBy: status === 'resolved' ? resolvedBy : null,
      },
    });

    this.logger.log(`Updated feedback ${feedbackId} status to: ${status}`);
    return updated;
  }

  /**
   * 删除反馈
   */
  async deleteFeedback(feedbackId: string, userId: string) {
    const feedback = await this.prisma.feedback.findUnique({
      where: { id: feedbackId },
    });

    if (!feedback) {
      throw new NotFoundException('反馈不存在');
    }

    if (feedback.userId !== userId) {
      throw new Error('无权删除此反馈');
    }

    await this.prisma.feedback.delete({
      where: { id: feedbackId },
    });

    this.logger.log(`Deleted feedback: ${feedbackId}`);
  }

  /**
   * 导出反馈为 CSV 格式
   */
  async exportFeedbacksToCsv(): Promise<string> {
    const feedbacks = await this.prisma.feedback.findMany({
      include: {
        user: {
          select: {
            username: true,
            email: true,
          },
        },
        chatMessage: {
          select: {
            content: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // CSV header
    const headers = ['ID', 'Username', 'Email', 'Rating', 'Comment', 'Tags', 'Status', 'MessageContent', 'CreatedAt'];

    // CSV rows
    const rows = feedbacks.map((f) => [
      f.id,
      f.user.username,
      f.user.email,
      f.rating.toString(),
      (f.comment || '').replace(/[\n\r]+/g, ' '),
      (f.tags || []).join(';'),
      f.status,
      (f.chatMessage.content || '').replace(/[\n\r]+/g, ' '),
      f.createdAt.toISOString(),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}
