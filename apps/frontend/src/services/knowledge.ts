/**
 * 知识库管理相关 API
 */
import { get, post, put, del } from '@/utils/request';

// 知识库信息
export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  config?: {
    chunkSize?: number;
    chunkOverlap?: number;
    enableRerank?: boolean;
    similarityThreshold?: number;
  };
  createdAt: string;
  updatedAt: string;
}

// 知识库列表响应
export interface KnowledgeBaseListResponse {
  items: KnowledgeBase[];
  total: number;
  page: number;
  pageSize: number;
}

// 知识库统计信息
export interface KnowledgeBaseStats {
  totalDocuments: number;
  totalChunks: number;
  documentsByStatus: {
    pending: number;
    processing: number;
    indexed: number;
    failed: number;
  };
}

// 创建知识库参数
export interface CreateKnowledgeBaseParams {
  name: string;
  description?: string;
  config?: {
    chunkSize?: number;
    chunkOverlap?: number;
    enableRerank?: boolean;
    similarityThreshold?: number;
  };
}

// 更新知识库参数
export interface UpdateKnowledgeBaseParams {
  name?: string;
  description?: string;
  config?: {
    chunkSize?: number;
    chunkOverlap?: number;
    enableRerank?: boolean;
    similarityThreshold?: number;
  };
}

/**
 * 获取知识库列表
 */
export function getKnowledgeBases(params?: {
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', String(params.page));
  if (params?.pageSize) query.append('pageSize', String(params.pageSize));

  return get<KnowledgeBaseListResponse>(`/v1/knowledge-bases?${query.toString()}`);
}

/**
 * 获取知识库详情
 */
export function getKnowledgeBase(id: string) {
  return get<KnowledgeBase>(`/v1/knowledge-bases/${id}`);
}

/**
 * 创建知识库
 */
export function createKnowledgeBase(data: CreateKnowledgeBaseParams) {
  return post<KnowledgeBase>('/v1/knowledge-bases', data);
}

/**
 * 更新知识库
 */
export function updateKnowledgeBase(id: string, data: UpdateKnowledgeBaseParams) {
  return put<KnowledgeBase>(`/v1/knowledge-bases/${id}`, data);
}

/**
 * 删除知识库
 */
export function deleteKnowledgeBase(id: string) {
  return del(`/v1/knowledge-bases/${id}`);
}

/**
 * 获取知识库统计信息
 */
export function getKnowledgeBaseStats(id: string) {
  return get<KnowledgeBaseStats>(`/v1/knowledge-bases/${id}/stats`);
}
