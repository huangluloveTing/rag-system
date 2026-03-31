/**
 * 聊天控制器
 * 提供标准聊天接口和 OpenAI 兼容的 Chat Completions API
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
import { convertToModelMessages } from 'ai';

// OpenAI Chat Completion API 类型
export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIChatCompletionRequest {
  model: string;
  messages: OpenAIChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * 流式聊天（UI Message Stream）
   * POST /api/v1/chat/stream
   */
  @Post('stream')
  @Sse()
  @ApiOperation({ summary: '流式聊天（UI Message Stream）' })
  async streamMessage(
    @Body() request: ChatRequest,
    @CurrentUser() user: any,
  ): Promise<any> {
    const generator = await this.chatService.chatStream(request, user.id);
    return from(generator).pipe(
      map((chunk) => ({
        data: JSON.stringify(chunk),
      }))
    );
  }

  /**
   * OpenAI 兼容的 Chat Completions API
   * POST /api/v1/chat/completions
   */
  @Post('completions')
  @ApiOperation({ summary: 'OpenAI 兼容的 Chat Completions API' })
  async chatCompletions(
    @Body() request: OpenAIChatCompletionRequest,
    @CurrentUser() user: any
  ) {
    const { messages, temperature, max_tokens, stream = false } = request;

    const newMessages = await convertToModelMessages(messages as any);

    if (stream) {
      // 流式响应将在下面处理
      throw new Error('For streaming, use POST /chat/completions/stream');
    }

    // 非流式响应
    const result = await this.chatService.openAIChatCompletion(
       newMessages,
      {
        temperature,
        maxTokens: max_tokens,
      },
      user.id
    );

    return result;
  }

  /**
   * OpenAI 兼容的流式 Chat Completions API
   * POST /api/v1/chat/completions/stream
   */
  @Post('completions/stream')
  @Sse()
  @ApiOperation({ summary: 'OpenAI 兼容的流式 Chat Completions API' })
  async chatCompletionsStream(
    @Body() request: OpenAIChatCompletionRequest,
    @CurrentUser() user: any
  ): Promise<Observable<{ data: string }>> {
    const { messages, temperature, max_tokens } = request;

    const generator = this.chatService.openAIChatCompletionStream(
      messages,
      {
        temperature,
        maxTokens: max_tokens,
      },
      user.id
    );

    return from(generator).pipe(
      map((chunk) => ({
        data: JSON.stringify(chunk),
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