import React from 'react';
import { MessageSquare, ThumbsUp, Clock, FileText, Bot, CheckCircle } from 'lucide-react';

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

export const KeyMetrics = ({ metrics, finMetrics }) => {
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
      {finMetrics && (
        <>
          <MetricCard 
            title="AI Deflections" 
            value={finMetrics.deflectionCount.toLocaleString()} 
            icon={<Bot size={24} />} 
            color="#ec4899" 
          />
          <MetricCard 
            title="Fin AI Resolution Rate" 
            value={`${finMetrics.agentResolutionRate}%`} 
            icon={<CheckCircle size={24} />} 
            color="#06b6d4" 
          />
        </>
      )}
    </div>
  );
};
