/**
 * 引用标注组件
 * 支持上标、Tooltip、点击展开
 */
import React, { useState } from 'react';
import { Tooltip } from 'antd';
import './Citation.css';

export interface CitationProps {
  index: number;
  source: string;
  score: number;
  onClick?: () => void;
}

export const Citation: React.FC<CitationProps> = ({
  index,
  source,
  score,
  onClick,
}) => {
  const [open, setOpen] = useState(false);

  const handleClick = () => {
    setOpen(!open);
    onClick?.();
  };

  return (
    <Tooltip
      title={
        <div className="citation-tooltip">
          <div className="citation-source">{source}</div>
          <div className="citation-score">
            相似度：{(score * 100).toFixed(1)}%
          </div>
        </div>
      }
      open={open}
      onOpenChange={setOpen}
    >
      <sup className="citation-mark" onClick={handleClick}>
        [{index}]
      </sup>
    </Tooltip>
  );
};
