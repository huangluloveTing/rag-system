/**
 * 反馈控制器
 * 处理用户反馈相关的 HTTP 请求
 */

import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FeedbackService, CreateFeedbackDto, UpdateFeedbackDto } from './feedback.service';
import { Response } from 'express';

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

  // 管理员接口
  @Get('admin/all')
  @ApiOperation({ summary: '获取所有反馈列表（管理员）' })
  @ApiResponse({ status: 200, description: '返回所有反馈列表' })
  async getAllFeedbacks(
    @CurrentUser() user: any,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('status') status?: string,
    @Query('rating') rating?: number,
    @Query('knowledgeBaseId') knowledgeBaseId?: string
  ) {
    // TODO: 添加管理员权限校验
    return this.feedbackService.getAllFeedbacks(
      parseInt(page, 10),
      parseInt(pageSize, 10),
      { status, rating, knowledgeBaseId }
    );
  }

  @Get('admin/:feedbackId')
  @ApiOperation({ summary: '获取反馈详情（管理员）' })
  async getFeedbackDetail(@Param('feedbackId') feedbackId: string) {
    return this.feedbackService.getFeedbackDetail(feedbackId);
  }

  @Patch('admin/:feedbackId/status')
  @ApiOperation({ summary: '更新反馈状态（管理员）' })
  async updateFeedbackStatus(
    @Param('feedbackId') feedbackId: string,
    @Body() data: UpdateFeedbackDto,
    @CurrentUser() user: any
  ) {
    return this.feedbackService.updateFeedbackStatus(
      feedbackId,
      data.status || 'pending',
      user.userId
    );
  }

  @Get('admin/export/csv')
  @ApiOperation({ summary: '导出反馈为 CSV（管理员）' })
  @ApiResponse({ status: 200, description: '返回 CSV 文件' })
  async exportCsv(
    @Res() res: Response,
    @Headers('user-agent') ua: string
  ) {
    const csv = await this.feedbackService.exportFeedbacksToCsv();

    const isIE = ua.indexOf('MSIE') !== -1 || ua.indexOf('Trident') !== -1;
    const fileName = 'feedback-export.csv';

    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': csv.length,
    });

    if (isIE) {
      res.set('Cache-Control', 'public, no-cache, no-store');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }

    res.send(csv);
  }
}
