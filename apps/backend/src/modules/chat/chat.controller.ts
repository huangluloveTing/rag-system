/**
 * 聊天控制器
 * 处理聊天相关的 HTTP 请求
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
  Req,
  Sse,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChatService, ChatRequest, ChatResponse } from './chat.service';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ApiOperation({ summary: '发送消息（非流式）' })
  @ApiResponse({ status: 201, description: '返回答案' })
  async sendMessage(
    @Body() request: ChatRequest,
    @CurrentUser() user: any
  ): Promise<ChatResponse> {
    return this.chatService.chat(request, user.id);
  }

  @Post('stream')
  @Sse()
  @ApiOperation({ summary: '发送消息（SSE 流式）' })
  async streamMessage(
    @Body() request: ChatRequest,
    @CurrentUser() user: any
  ): Promise<Observable<{ data: string }>> {
    const generator = this.chatService.chatStream(request, user.id);

    return from(generator).pipe(
      map((chunk) => ({
        data: chunk,
      }))
    );
  }

  @Get('sessions')
  @ApiOperation({ summary: '获取用户的会话列表' })
  async getUserSessions(
    @CurrentUser() user: any,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20'
  ) {
    return this.chatService.getUserSessions(
      user.id,
      parseInt(page, 10),
      parseInt(pageSize, 10)
    );
  }

  @Get('sessions/:sessionId')
  @ApiOperation({ summary: '获取会话详情' })
  async getSessionMessages(@Param('sessionId') sessionId: string) {
    return this.chatService.getSessionMessages(sessionId);
  }

  @Delete('sessions/:sessionId')
  @ApiOperation({ summary: '删除会话' })
  async deleteSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: any
  ) {
    await this.chatService.deleteSession(sessionId, user.id);
    return { message: '会话已删除' };
  }
}