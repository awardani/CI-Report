import React from 'react';
import { MessageSquare, ThumbsUp, Clock, FileText } from 'lucide-react';

const MetricCard = ({ title, value, icon, color }) => (
  <div className="metric-card glass-panel">
    <div className="metric-icon" style={{ backgroundColor: `${color}20`, color: color }}>
      {icon}
    </div>
    <div className="metric-content">
      <h3>{title}</h3>
      <p className="metric-value">{value}</p>
    </div>
  </div>
);

export const KeyMetrics = ({ metrics }) => {
  return (
    <div className="metrics-grid">
      <MetricCard 
        title="Total Conversations" 
        value={metrics.totalConversations.toLocaleString()} 
        icon={<MessageSquare size={24} />} 
        color="#8b5cf6" 
      />
      <MetricCard 
        title="Average CSAT" 
        value={`${metrics.avgCsat} / 5`} 
        icon={<ThumbsUp size={24} />} 
        color="#10b981" 
      />
      <MetricCard 
        title="Avg. First Response" 
        value={metrics.avgFrtStr} 
        icon={<Clock size={24} />} 
        color="#3b82f6" 
      />
      <MetricCard 
        title="Rated Interactions" 
        value={metrics.totalRatings.toLocaleString()} 
        icon={<FileText size={24} />} 
        color="#f59e0b" 
      />
    </div>
  );
};
