/**
 * 文档相关 API
 */
import { get, post, del, upload } from '@/utils/request';

export type DocumentStatus = 'pending' | 'processing' | 'indexed' | 'failed';

export interface DocumentDto {
  id: string;
  filename: string;
  fileSize: number;
  fileType?: string | null;
  status: DocumentStatus;
  errorMessage?: string | null;
  tags?: string[];
  isPublic?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface DocumentListResponse {
  documents: DocumentDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UploadDocumentResponse {
  document_id: string;
  status: DocumentStatus;
  message: string;
}

export interface BatchUploadResponse {
  documents: Array<{
    document_id: string;
    status: DocumentStatus;
    filename: string;
  }>;
}

export interface DocumentDetail extends DocumentDto {
  knowledgeBaseId: string;
  createdBy?: string | null;
  filePath?: string;
  contentHash?: string;
  metadata?: any;
  version: number;
  isLatest: boolean;
  creator?: {
    id: string;
    username: string;
    email: string;
  } | null;
  chunks?: Array<{
    id: string;
    content: string;
    page: number | null;
    chunkIndex: number;
  }>;
  versions?: Array<{
    id: string;
    version: number;
    filename: string;
    fileSize: number;
    fileType: string | null;
    contentHash: string | null;
    status: string;
    errorMessage: string | null;
    tags: string[];
    createdAt: string;
  }>;
}

export interface DocumentVersionDto {
  id: string;
  version: number;
  filename: string;
  fileSize: number;
  fileType?: string | null;
  contentHash?: string | null;
  status: string;
  errorMessage?: string | null;
  tags?: string[];
  createdAt: string;
}

export interface DocumentVersionListResponse {
  versions: DocumentVersionDto[];
  total: number;
}

export function uploadDocument(file: File, data: {
  knowledge_base_id: string;
  tags?: string;
  is_public?: string; // 'true' | 'false'
}) {
  return upload<UploadDocumentResponse>('/v1/documents/upload', file, data);
}

export function uploadDocuments(files: File[], data: {
  knowledge_base_id: string;
  tags?: string;
  is_public?: string; // 'true' | 'false'
}) {
  const formData = new FormData();

  // 添加多个文件
  files.forEach((file) => {
    formData.append('files', file);
  });

  // 添加其他数据
  Object.keys(data).forEach((key) => {
    formData.append(key, data[key as keyof typeof data] || '');
  });

  return post<BatchUploadResponse>('/v1/documents/upload/batch', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
}

export function listDocuments(params?: {
  knowledge_base_id?: string;
  status?: DocumentStatus;
  page?: number;
  page_size?: number;
}) {
  return get<DocumentListResponse>('/v1/documents', { params });
}

export function getDocumentDetail(id: string) {
  return get<DocumentDetail>(`/v1/documents/${id}`);
}

export function deleteDocument(id: string) {
  return del<{ message: string }>(`/v1/documents/${id}`);
}

export function reindexDocument(id: string) {
  return post<{ documentId: string; status: string }>(`/v1/documents/${id}/reindex`);
}

export function getDocumentVersions(id: string) {
  return get<DocumentVersionListResponse>(`/v1/documents/${id}/versions`);
}

export function restoreDocumentVersion(id: string, versionId: string) {
  return post<{ message: string; documentId: string }>(`/v1/documents/${id}/restore`, {
    version_id: versionId,
  });
}

export function getDocumentPreview(id: string) {
  return get<{ content: string; type: string }>(`/v1/documents/${id}/preview`);
}
