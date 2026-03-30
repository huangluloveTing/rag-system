/**
 * 引用来源面板组件
 * 侧边面板显示来源详情
 */
import React from 'react';
import { Drawer, List, Typography, Tag } from 'antd';
import './CitationPanel.css';

const { Text, Paragraph } = Typography;

export interface CitationItem {
  index: number;
  chunkId: string;
  documentId: string;
  content: string;
  source: string;
  score: number;
}

export interface CitationPanelProps {
  open: boolean;
  onClose: () => void;
  citations: CitationItem[];
}

export const CitationPanel: React.FC<CitationPanelProps> = ({
  open,
  onClose,
  citations,
}) => {
  return (
    <Drawer
      title="引用来源"
      placement="right"
      width={400}
      open={open}
      onClose={onClose}
      className="citation-panel"
    >
      {citations.length === 0 ? (
        <div className="citation-panel-empty">
          <Text type="secondary">暂无引用来源</Text>
        </div>
      ) : (
        <List
          dataSource={citations}
          renderItem={(item) => (
            <List.Item className="citation-panel-item">
              <div className="citation-panel-header">
                <Tag color="blue">[{item.index}]</Tag>
                <Text strong className="citation-panel-source">
                  {item.source}
                </Text>
              </div>
              <div className="citation-panel-score">
                相似度：{(item.score * 100).toFixed(1)}%
              </div>
              <Paragraph
                ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}
                className="citation-panel-content"
              >
                {item.content}
              </Paragraph>
            </List.Item>
          )}
        />
      )}
    </Drawer>
  );
};
