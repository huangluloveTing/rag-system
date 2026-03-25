/**
 * 文档管理相关 API
 */
import { get, post, del, upload } from '@/utils/request';

// 文档状态类型
export type DocumentStatus = 'pending' | 'processing' | 'indexed' | 'failed';

// 文档信息
export interface Document {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  knowledgeBaseId: string;
  status: DocumentStatus;
  totalChunks: number;
  metadata?: Record<string, any>;
  uploadedAt: string;
  processedAt?: string;
  knowledgeBase?: {
    id: string;
    name: string;
  };
}

// 文档列表响应
export interface DocumentListResponse {
  items: Document[];
  total: number;
  page: number;
  pageSize: number;
}

// 上传文档响应
export interface UploadDocumentResponse {
  id: string;
  filename: string;
  fileSize: number;
  status: DocumentStatus;
}

/**
 * 上传文档
 */
export function uploadDocument(file: File, knowledgeBaseId: string) {
  return upload<UploadDocumentResponse>('/v1/documents/upload', file, {
    knowledgeBaseId,
  });
}

/**
 * 获取文档列表
 */
export function getDocuments(params?: {
  page?: number;
  pageSize?: number;
  knowledgeBaseId?: string;
  status?: DocumentStatus;
}) {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', String(params.page));
  if (params?.pageSize) query.append('pageSize', String(params.pageSize));
  if (params?.knowledgeBaseId) query.append('knowledgeBaseId', params.knowledgeBaseId);
  if (params?.status) query.append('status', params.status);

  return get<DocumentListResponse>(`/v1/documents?${query.toString()}`);
}

/**
 * 获取文档详情
 */
export function getDocument(id: string) {
  return get<Document>(`/v1/documents/${id}`);
}

/**
 * 删除文档
 */
export function deleteDocument(id: string) {
  return del(`/v1/documents/${id}`);
}

/**
 * 重新索引文档
 */
export function reindexDocument(id: string) {
  return post(`/v1/documents/${id}/reindex`);
}
