/**
 * 文档上传响应 DTO
 */

import { ApiProperty } from '@nestjs/swagger';

export class UploadResponseDto {
  @ApiProperty({ description: '文档 ID', example: 'uuid-xxx' })
  document_id: string;

  @ApiProperty({ description: '状态', example: 'processing', enum: ['pending', 'processing', 'indexed', 'failed'] })
  status: string;

  @ApiProperty({ description: '消息', example: '文档已接收，正在异步处理' })
  message: string;
}

export class DocumentDto {
  @ApiProperty({ description: '文档 ID', example: 'uuid-xxx' })
  id: string;

  @ApiProperty({ description: '文件名', example: 'employee-handbook.pdf' })
  filename: string;

  @ApiProperty({ description: '文件大小（字节）', example: 1048576 })
  fileSize: number;

  @ApiProperty({ description: '文件类型', example: 'pdf', enum: ['pdf', 'docx', 'markdown', 'txt'] })
  fileType: string;

  @ApiProperty({ description: '状态', example: 'indexed', enum: ['pending', 'processing', 'indexed', 'failed'] })
  status: string;

  @ApiProperty({ description: '错误信息', example: null, required: false })
  errorMessage?: string;
}

export class DocumentListResponseDto {
  @ApiProperty({ description: '文档列表', type: [DocumentDto] })
  documents: DocumentDto[];

  @ApiProperty({ description: '总数', example: 10 })
  total: number;

  @ApiProperty({ description: '当前页', example: 1 })
  page: number;

  @ApiProperty({ description: '每页数量', example: 20 })
  pageSize: number;
}

export class DocumentDto {
  @ApiProperty({ description: '文档 ID', example: 'uuid-xxx' })
  id: string;

  @ApiProperty({ description: '文件名', example: 'employee-handbook.pdf' })
  filename: string;

  @ApiProperty({ description: '文件大小（字节）', example: 1048576 })
  fileSize: number;

  @ApiProperty({ description: '文件类型', example: 'pdf', enum: ['pdf', 'docx', 'markdown', 'txt'] })
  fileType: string;

  @ApiProperty({ description: '状态', example: 'indexed', enum: ['pending', 'processing', 'indexed', 'failed'] })
  status: string;

  @ApiProperty({ description: '错误信息', example: null, required: false })
  errorMessage?: string;

  @ApiProperty({ description: '标签', example: ['制度', '人事'], required: false })
  tags?: string[];

  @ApiProperty({ description: '是否公开', example: true })
  isPublic: boolean;

  @ApiProperty({ description: '创建时间', example: '2026-03-23T12:00:00Z' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间', example: '2026-03-23T12:00:00Z' })
  updatedAt: Date;
}

export class DocumentDetailDto extends DocumentDto {
  @ApiProperty({ description: '知识库 ID', example: 'kb-xxx' })
  knowledgeBaseId: string;

  @ApiProperty({ description: '创建者 ID', example: 'user-xxx', required: false })
  createdBy?: string;

  @ApiProperty({ description: '文件路径', example: 'documents/uuid-xxx.pdf', required: false })
  filePath?: string;

  @ApiProperty({ description: '内容哈希', example: 'sha256-xxx', required: false })
  contentHash?: string;

  @ApiProperty({ description: '元数据', required: false })
  metadata?: any;
}
