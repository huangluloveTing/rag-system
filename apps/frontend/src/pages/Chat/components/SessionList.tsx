/**
 * SessionList Component
 * Left-side session list with create, select, and delete operations
 */
import React from 'react';
import { List, Button, Popconfirm, Spin, Empty } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { SessionListProps, Session } from '../types/chat';

const SessionList: React.FC<SessionListProps> = ({
  sessions,
  currentSessionId,
  loading = false,
  onSelect,
  onCreate,
  onDelete,
}) => {
  console.log(sessions)
  return (
    <div
      style={{
        width: '280px',
        backgroundColor: '#fff',
        borderRight: '1px solid #e0e0e0',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* New session button */}
      <div style={{ padding: '16px', borderBottom: '1px solid #e0e0e0' }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={onCreate}
          block
        >
          新建对话
        </Button>
      </div>

      {/* Session list */}
      <div style={{ padding: '12px', flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin />
          </div>
        ) : sessions.length === 0 ? (
          <Empty description="暂无会话" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            dataSource={sessions}
            renderItem={(session: Session) => (
              <List.Item
                style={{
                  padding: '12px',
                  backgroundColor:
                    session.id === currentSessionId ? '#e3f2fd' : '#fff',
                  border:
                    session.id === currentSessionId
                      ? '1px solid #1890ff'
                      : '1px solid #e0e0e0',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  cursor: 'pointer',
                }}
                onClick={() => onSelect(session.id)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: '14px' }}>
                    {session.title}
                  </div>
                  <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
                    {new Date(session.updatedAt).toLocaleDateString('zh-CN')}
                  </div>
                </div>
                <Popconfirm
                  title="确定删除此会话？"
                  onConfirm={(e) => {
                    e?.stopPropagation();
                    onDelete(session.id);
                  }}
                  onCancel={(e) => e?.stopPropagation()}
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    danger
                    onClick={(e) => e.stopPropagation()}
                  />
                </Popconfirm>
              </List.Item>
            )}
          />
        )}
      </div>
    </div>
  );
};

export default SessionList;
