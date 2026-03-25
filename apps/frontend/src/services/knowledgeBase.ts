/**
 * 知识库相关 API
 */
import { get, post, put, del } from '@/utils/request';

export interface KnowledgeBaseConfig {
  chunkSize?: number;
  overlap?: number;
  embeddingModel?: string;
  topK?: number;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string | null;
  config: KnowledgeBaseConfig;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  documentCount?: number;
  creator?: {
    id: string;
    username: string;
    email: string;
  };
}

export interface KnowledgeBaseListResponse {
  knowledgeBases: KnowledgeBase[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateKnowledgeBaseParams {
  name: string;
  description?: string;
  config?: KnowledgeBaseConfig;
}

export interface UpdateKnowledgeBaseParams {
  name?: string;
  description?: string;
  config?: KnowledgeBaseConfig;
}

export interface KnowledgeBaseStats {
  documents: Record<string, number>;
  totalChunks: number;
}

export function createKnowledgeBase(data: CreateKnowledgeBaseParams) {
  return post<KnowledgeBase>('/v1/knowledge-bases', data);
}

export function listKnowledgeBases(params?: { page?: number; pageSize?: number }) {
  return get<KnowledgeBaseListResponse>('/v1/knowledge-bases', { params });
}

export function getKnowledgeBase(id: string) {
  return get<KnowledgeBase>(`/v1/knowledge-bases/${id}`);
}

export function updateKnowledgeBase(id: string, data: UpdateKnowledgeBaseParams) {
  return put<KnowledgeBase>(`/v1/knowledge-bases/${id}`, data);
}

export function deleteKnowledgeBase(id: string) {
  return del<{ message: string }>(`/v1/knowledge-bases/${id}`);
}

export function getKnowledgeBaseStats(id: string) {
  return get<KnowledgeBaseStats>(`/v1/knowledge-bases/${id}/stats`);
}
