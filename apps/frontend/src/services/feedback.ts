/**
 * 反馈相关 API
 */
import { get, post } from '@/utils/request';

// 反馈统计
export interface FeedbackStats {
  total: number;
  positive: number;
  negative: number;
  positiveRate: number;
}

// 反馈请求
export interface CreateFeedbackData {
  chatMessageId: string;
  rating: number; // 1-5
  comment?: string;
  tags?: string[];
}

// 反馈响应
export interface Feedback {
  id: string;
  chatMessageId: string;
  userId: string;
  rating: number;
  comment?: string;
  tags: string[];
  status: string;
  createdAt: string;
}

// 管理员反馈列表响应
export interface FeedbackListResponse {
  feedbacks: Array<Feedback & {
    user: {
      id: string;
      username: string;
      email: string;
    };
    chatMessage: {
      id: string;
      content: string;
      role: string;
      createdAt: string;
      session: {
        id: string;
        title: string;
      };
    };
  }>;
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 获取反馈统计
 */
export function getFeedbackStats(params?: {
  knowledgeBaseId?: string;
}) {
  const query = new URLSearchParams();
  if (params?.knowledgeBaseId) query.append('knowledgeBaseId', params.knowledgeBaseId);

  return get<FeedbackStats>(`/v1/feedback/stats?${query.toString()}`);
}

/**
 * 提交反馈
 */
export function submitFeedback(data: CreateFeedbackData) {
  return post<Feedback>('/v1/feedback', data);
}

/**
 * 获取我的反馈列表
 */
export function getMyFeedbacks(page = 1, pageSize = 20) {
  return get<FeedbackListResponse>(`/v1/feedback/my?page=${page}&pageSize=${pageSize}`);
}

/**
 * 获取所有反馈列表（管理员）
 */
export function getAllFeedbacks(
  page = 1,
  pageSize = 20,
  filters?: {
    status?: string;
    rating?: number;
    knowledgeBaseId?: string;
  }
) {
  const query = new URLSearchParams();
  query.append('page', page.toString());
  query.append('pageSize', pageSize.toString());
  if (filters?.status) query.append('status', filters.status);
  if (filters?.rating) query.append('rating', filters.rating.toString());
  if (filters?.knowledgeBaseId) query.append('knowledgeBaseId', filters.knowledgeBaseId);

  return get<FeedbackListResponse>(`/v1/feedback/admin/all?${query.toString()}`);
}

/**
 * 获取反馈详情（管理员）
 */
export function getFeedbackDetail(feedbackId: string) {
  return get<Feedback>(`/v1/feedback/admin/${feedbackId}`);
}

/**
 * 更新反馈状态（管理员）
 */
export function updateFeedbackStatus(
  feedbackId: string,
  status: string
) {
  return post<{ status: string }>(`/v1/feedback/admin/${feedbackId}/status`, { status });
}

/**
 * 导出反馈为 CSV（管理员）
 */
export function exportFeedbacksCsv() {
  const token = localStorage.getItem('token');
  const url = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/v1/feedback/admin/export/csv`;

  fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })
    .then((response) => response.blob())
    .then((blob) => {
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'feedback-export.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    })
    .catch((error) => {
      console.error('Export failed:', error);
    });
}

/**
 * 删除反馈
 */
export function deleteFeedback(feedbackId: string) {
  return post<{ message: string }>(`/v1/feedback/${feedbackId}`, {});
}
