/**
 * 文档控制器
 * 提供文档上传、列表、详情、删除等接口
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { DocumentService } from './document.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserType } from '../../common/decorators/current-user.decorator';
import { UploadResponseDto, DocumentListResponseDto, DocumentDetailDto } from './dto/document.dto';
import { ConfigService } from '@nestjs/config';

@ApiTags('文档')
@Controller('documents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DocumentController {
  constructor(
    private documentService: DocumentService,
    private configService: ConfigService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传文档' })
  @ApiResponse({ status: 202, description: '上传成功', type: UploadResponseDto })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserType,
    @Body('knowledge_base_id') knowledgeBaseId: string,
    @Body('tags') tags?: string,
    @Body('is_public') isPublic?: string,
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new Error('请上传文件');
    }

    if (!knowledgeBaseId) {
      throw new Error('请指定知识库 ID');
    }

    // 验证文件大小
    const maxFileSize = this.configService.get<number>('MAX_FILE_SIZE', 52428800);
    if (file.size > maxFileSize) {
      throw new Error(`文件大小超过限制 (${maxFileSize / 1024 / 1024}MB)`);
    }

    // 解析标签和公开设置
    const parsedTags = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
    const parsedIsPublic = isPublic === 'true';

    const result = await this.documentService.uploadFile(file, user.id, {
      knowledgeBaseId,
      tags: parsedTags,
      isPublic: parsedIsPublic,
    });

    return {
      document_id: result.documentId,
      status: result.status,
      message: '文档已接收，正在异步处理',
    };
  }

  @Get()
  @ApiOperation({ summary: '获取文档列表' })
  @ApiResponse({ status: 200, description: '获取成功', type: DocumentListResponseDto })
  async getDocuments(
    @Query('knowledge_base_id') knowledgeBaseId?: string,
    @Query('status') status?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('page_size', new ParseIntPipe({ optional: true })) pageSize: number = 20,
  ): Promise<DocumentListResponseDto> {
    return this.documentService.getDocuments(knowledgeBaseId, status, page, pageSize);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取文档详情' })
  @ApiResponse({ status: 200, description: '获取成功', type: DocumentDetailDto })
  @ApiResponse({ status: 404, description: '文档不存在' })
  async getDocument(@Param('id') id: string): Promise<DocumentDetailDto> {
    return this.documentService.getDocumentById(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除文档' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 404, description: '文档不存在' })
  async deleteDocument(@Param('id') id: string): Promise<{ message: string }> {
    await this.documentService.deleteDocument(id);
    return { message: '文档已删除' };
  }

  @Post(':id/reindex')
  @ApiOperation({ summary: '重新索引文档' })
  @ApiResponse({ status: 202, description: '重新索引成功' })
  @ApiResponse({ status: 404, description: '文档不存在' })
  async reindexDocument(@Param('id') id: string): Promise<{ documentId: string; status: string }> {
    return this.documentService.reindexDocument(id);
  }
}
