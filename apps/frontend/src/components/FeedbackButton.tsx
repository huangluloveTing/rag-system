/**
 * 反馈按钮组件
 * 点赞/点踩按钮
 */
import React, { useState } from 'react';
import { Button, Space, Tooltip, message } from 'antd';
import {
  LikeOutlined,
  DislikeOutlined,
  LikeFilled,
  DislikeFilled,
} from '@ant-design/icons';
import { FeedbackForm } from './FeedbackForm';
import './FeedbackButton.css';

export interface FeedbackButtonProps {
  chatMessageId: string;
  onFeedbackSubmitted?: () => void;
}

export const FeedbackButton: React.FC<FeedbackButtonProps> = ({
  chatMessageId,
  onFeedbackSubmitted,
}) => {
  const [formOpen, setFormOpen] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(null);

  const handleLike = () => {
    if (userRating === 5) {
      // 取消点赞
      setUserRating(null);
      return;
    }
    setUserRating(5);
    // 直接提交点赞，不需要表单
    onFeedbackSubmitted?.();
  };

  const handleDislike = () => {
    if (userRating === 1) {
      // 取消点踩
      setUserRating(null);
      return;
    }
    setFormOpen(true);
  };

  const handleFormSubmit = (data: { rating: number; comment?: string; tags?: string[] }) => {
    setUserRating(data.rating);
    onFeedbackSubmitted?.();
    message.success('反馈已提交，感谢您的意见！');
  };

  return (
    <>
      <Space className="feedback-button-space">
        <Tooltip title={userRating === 5 ? '取消点赞' : '点赞'}>
          <Button
            type={userRating === 5 ? 'primary' : 'default'}
            icon={userRating === 5 ? <LikeFilled /> : <LikeOutlined />}
            onClick={handleLike}
            className={`feedback-button ${userRating === 5 ? 'feedback-button-liked' : ''}`}
          />
        </Tooltip>
        <Tooltip title={userRating === 1 ? '已点踩' : '点踩'}>
          <Button
            type={userRating === 1 ? 'primary' : 'default'}
            icon={userRating === 1 ? <DislikeFilled /> : <DislikeOutlined />}
            onClick={handleDislike}
            className={`feedback-button ${userRating === 1 ? 'feedback-button-disliked' : ''}`}
          />
        </Tooltip>
      </Space>

      <FeedbackForm
        open={formOpen}
        rating={userRating}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
      />
    </>
  );
};
