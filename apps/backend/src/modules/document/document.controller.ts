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
  UploadedFiles,
  UseGuards,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { DocumentService } from './document.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserType } from '../../common/decorators/current-user.decorator';
import { UploadResponseDto, DocumentListResponseDto, DocumentDetailDto, DocumentVersionListResponseDto } from './dto/document.dto';
import { ConfigService } from '@nestjs/config';

@ApiTags('文档')
@Controller('documents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DocumentController {
  constructor(
    private documentService: DocumentService,
    private configService: ConfigService,
  ) {
    
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传文档（单文件）' })
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
      throw new BadRequestException('请上传文件');
    }

    if (!knowledgeBaseId) {
      throw new BadRequestException('请指定知识库 ID');
    }

    // 修复文件名编码（Multer 默认使用 Latin-1，需要转换为 UTF-8）
    if (file.originalname) {
      file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    }

    // 验证文件大小
    const maxFileSize = this.configService.get<number>('MAX_FILE_SIZE', 52428800);
    if (file.size > maxFileSize) {
      throw new BadRequestException(`文件大小超过限制 (${maxFileSize / 1024 / 1024}MB)`);
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
      message: '文档已接收，正在异步处理!',
    };
  }

  @Post('upload/batch')
  @UseInterceptors(FilesInterceptor('files', 20))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '批量上传文档（支持多文件）' })
  @ApiResponse({ status: 202, description: '上传成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  async uploadBatch(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: CurrentUserType,
    @Body('knowledge_base_id') knowledgeBaseId: string,
    @Body('tags') tags?: string,
    @Body('is_public') isPublic?: string,
  ): Promise<{ documents: Array<{ document_id: string; status: string; filename: string }> }> {
    if (!files || files.length === 0) {
      throw new BadRequestException('请上传至少一个文件');
    }

    if (!knowledgeBaseId) {
      throw new BadRequestException('请指定知识库 ID');
    }

    // 修复所有文件的文件名编码
    files.forEach((file) => {
      if (file.originalname) {
        file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
      }
    });

    // 验证文件大小
    const maxFileSize = this.configService.get<number>('MAX_FILE_SIZE', 52428800);
    const oversizedFiles = files.filter((f) => f.size > maxFileSize);
    if (oversizedFiles.length > 0) {
      throw new BadRequestException(
        `以下文件超过大小限制 (${maxFileSize / 1024 / 1024}MB): ${oversizedFiles.map((f) => f.originalname).join(', ')}`,
      );
    }

    // 解析标签和公开设置
    const parsedTags = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
    const parsedIsPublic = isPublic === 'true';

    const results = await Promise.all(
      files.map((file) =>
        this.documentService.uploadFile(file, user.id, {
          knowledgeBaseId,
          tags: parsedTags,
          isPublic: parsedIsPublic,
        }),
      ),
    );

    return {
      documents: results.map((result, index) => ({
        document_id: result.documentId,
        status: result.status,
        filename: files[index].originalname,
      })),
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

  @Get(':id/versions')
  @ApiOperation({ summary: '获取文档版本历史' })
  @ApiResponse({ status: 200, description: '获取成功', type: DocumentVersionListResponseDto })
  @ApiResponse({ status: 404, description: '文档不存在' })
  async getDocumentVersions(@Param('id') id: string): Promise<DocumentVersionListResponseDto> {
    return this.documentService.getDocumentVersions(id);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: '恢复文档到指定版本' })
  @ApiResponse({ status: 200, description: '恢复成功' })
  @ApiResponse({ status: 404, description: '文档或版本不存在' })
  async restoreDocumentVersion(
    @Param('id') id: string,
    @Body('version_id') versionId: string,
  ): Promise<{ message: string; documentId: string }> {
    return this.documentService.restoreDocumentVersion(id, versionId);
  }

  @Get(':id/preview')
  @ApiOperation({ summary: '获取文档预览内容' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '文档不存在' })
  async previewDocument(@Param('id') id: string): Promise<{ content: string; type: string }> {
    return this.documentService.getDocumentPreview(id);
  }
}
