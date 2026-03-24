/**
 * 反馈控制器
 * 处理用户反馈相关的 HTTP 请求
 */

import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FeedbackService, CreateFeedbackDto } from './feedback.service';

@ApiTags('feedback')
@ApiBearerAuth()
@Controller('feedback')
@UseGuards(JwtAuthGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @ApiOperation({ summary: '提交反馈' })
  @ApiResponse({ status: 201, description: '反馈已创建' })
  async createFeedback(
    @Body() data: CreateFeedbackDto,
    @CurrentUser() user: any
  ) {
    return this.feedbackService.createFeedback(data, user.userId);
  }

  @Get('message/:messageId')
  @ApiOperation({ summary: '获取消息的反馈列表' })
  async getMessageFeedback(@Param('messageId') messageId: string) {
    return this.feedbackService.getMessageFeedback(messageId);
  }

  @Get('stats')
  @ApiOperation({ summary: '获取反馈统计' })
  async getFeedbackStats(@Query('knowledgeBaseId') knowledgeBaseId?: string) {
    return this.feedbackService.getFeedbackStats(knowledgeBaseId);
  }

  @Get('my')
  @ApiOperation({ summary: '获取我的反馈列表' })
  async getUserFeedbacks(
    @CurrentUser() user: any,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20'
  ) {
    return this.feedbackService.getUserFeedbacks(
      user.userId,
      parseInt(page, 10),
      parseInt(pageSize, 10)
    );
  }

  @Delete(':feedbackId')
  @ApiOperation({ summary: '删除反馈' })
  async deleteFeedback(
    @Param('feedbackId') feedbackId: string,
    @CurrentUser() user: any
  ) {
    await this.feedbackService.deleteFeedback(feedbackId, user.userId);
    return { message: '反馈已删除' };
  }
}