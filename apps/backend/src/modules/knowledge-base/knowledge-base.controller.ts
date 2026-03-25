/**
 * 知识库控制器
 */

import {
  Controller,
  Get,
  Post,
  Put,
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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  KnowledgeBaseService,
  CreateKnowledgeBaseDto,
  UpdateKnowledgeBaseDto,
} from './knowledge-base.service';

@ApiTags('knowledge-base')
@ApiBearerAuth()
@Controller('knowledge-bases')
@UseGuards(JwtAuthGuard)
export class KnowledgeBaseController {
  constructor(private readonly kbService: KnowledgeBaseService) {}

  @Post()
  @ApiOperation({ summary: '创建知识库' })
  async create(
    @Body() data: CreateKnowledgeBaseDto,
    @CurrentUser() user: any
  ) {
    return this.kbService.create(data, user.id);
  }

  @Get()
  @ApiOperation({ summary: '获取知识库列表' })
  async getList(
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20'
  ) {
    return this.kbService.getList(parseInt(page, 10), parseInt(pageSize, 10));
  }

  @Get(':id')
  @ApiOperation({ summary: '获取知识库详情' })
  async getById(@Param('id') id: string) {
    return this.kbService.getById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新知识库' })
  async update(
    @Param('id') id: string,
    @Body() data: UpdateKnowledgeBaseDto
  ) {
    return this.kbService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除知识库' })
  async delete(@Param('id') id: string) {
    await this.kbService.delete(id);
    return { message: '知识库已删除' };
  }

  @Get(':id/stats')
  @ApiOperation({ summary: '获取知识库统计信息' })
  async getStats(@Param('id') id: string) {
    return this.kbService.getStats(id);
  }
}