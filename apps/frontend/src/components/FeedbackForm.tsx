/**
 * 反馈表单组件
 * 评分、标签选择、评论输入
 */
import React, { useState } from 'react';
import { Modal, Rate, Input, Checkbox, Button, message } from 'antd';
import {
  LikeOutlined,
  DislikeOutlined,
  DislikeFilled,
  LikeFilled,
} from '@ant-design/icons';
import './FeedbackForm.css';

const FEEDBACK_TAGS = [
  '不准确',
  '不完整',
  '来源错误',
  '其他',
];

export interface FeedbackFormProps {
  open: boolean;
  rating: number | null; // 1-5
  onClose: () => void;
  onSubmit: (data: { rating: number; comment?: string; tags?: string[] }) => void;
}

export const FeedbackForm: React.FC<FeedbackFormProps> = ({
  open,
  rating: initialRating,
  onClose,
  onSubmit,
}) => {
  const [rating, setRating] = useState<number>(initialRating || 0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const handleSubmit = () => {
    if (rating === 0) {
      message.warning('请选择评分');
      return;
    }

    onSubmit({
      rating,
      comment: comment || undefined,
      tags: selectedTags,
    });

    // 重置表单
    setRating(0);
    setComment('');
    setSelectedTags([]);
    onClose();
  };

  const handleTagChange = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <Modal
      title="提交反馈"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="提交"
      cancelText="取消"
      className="feedback-form-modal"
    >
      <div className="feedback-form-content">
        <div className="feedback-form-section">
          <label className="feedback-form-label">评分</label>
          <Rate
            value={rating}
            onChange={setRating}
            character={({ index }) =>
              index! < rating ? <LikeFilled /> : <LikeOutlined />
            }
            className="feedback-form-rate"
          />
        </div>

        {rating <= 2 && rating > 0 && (
          <div className="feedback-form-section">
            <label className="feedback-form-label">问题类型（可选）</label>
            <div className="feedback-form-tags">
              {FEEDBACK_TAGS.map((tag) => (
                <Checkbox
                  key={tag}
                  checked={selectedTags.includes(tag)}
                  onChange={() => handleTagChange(tag)}
                >
                  {tag}
                </Checkbox>
              ))}
            </div>
          </div>
        )}

        <div className="feedback-form-section">
          <label className="feedback-form-label">
            评论（可选）
          </label>
          <Input.TextArea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="请告诉我们您的具体意见..."
            rows={4}
            maxLength={500}
            showCount
          />
        </div>
      </div>
    </Modal>
  );
};
