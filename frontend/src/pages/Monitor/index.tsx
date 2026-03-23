/**
 * 监控仪表盘页面
 * 系统监控图表（Phase 3 实现）
 */
import React from 'react';
import { Card } from 'antd';

const MonitorPage: React.FC = () => {
  return (
    <div className="monitor-page">
      <Card title="监控仪表盘">
        <div style={{ padding: '40px 0', textAlign: 'center', color: '#999' }}>
          <p>监控仪表盘功能开发中...</p>
          <p>Phase 3 将实现：</p>
          <ul style={{ textAlign: 'left', display: 'inline-block', marginTop: 16 }}>
            <li>ECharts 图表</li>
            <li>API 响应时间监控</li>
            <li>问答统计</li>
            <li>文档处理状态</li>
            <li>系统资源使用率</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default MonitorPage;
