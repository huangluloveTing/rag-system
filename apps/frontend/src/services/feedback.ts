/**
 * 反馈相关 API
 */
import { get } from '@/utils/request';

// 反馈统计
export interface FeedbackStats {
  totalFeedback: number;
  totalLikes: number;
  totalDislikes: number;
  likeRate: number;
}

/**
 * 获取反馈统计
 */
export function getFeedbackStats(params?: {
  startDate?: string;
  endDate?: string;
}) {
  const query = new URLSearchParams();
  if (params?.startDate) query.append('startDate', params.startDate);
  if (params?.endDate) query.append('endDate', params.endDate);

  return get<FeedbackStats>(`/v1/feedback/stats?${query.toString()}`);
}
