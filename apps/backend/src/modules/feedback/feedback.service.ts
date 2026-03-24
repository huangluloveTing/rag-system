/**
 * 反馈服务
 * 处理用户对回答的反馈
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateFeedbackDto {
  chatMessageId: string;
  rating: number; // 1: 点赞, -1: 点踩
  comment?: string;
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
        where: { ...where, rating: 1 },
      }),
      this.prisma.feedback.count({
        where: { ...where, rating: -1 },
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
}