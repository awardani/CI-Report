import React, { memo } from 'react';
import {
  BookOpen,
  Bot,
  CheckCircle,
  Clock3,
  CircleHelp,
  GraduationCap,
  MessageSquare,
  Minus,
  UserPlus,
  Users,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  User,
  Workflow,
  Activity,
} from 'lucide-react';

const CARD_META = {
  new_conversations: {
    icon: <MessageSquare size={18} />,
    color: '#7c3aed',
  },
  overall_csat: {
    icon: <ThumbsUp size={18} />,
    color: '#059669',
  },
  teammate_csat: {
    icon: <User size={18} />,
    color: '#2563eb',
  },
  fin_csat: {
    icon: <Bot size={18} />,
    color: '#d97706',
  },
  fin_deflection_rate: {
    icon: <Workflow size={18} />,
    color: '#db2777',
  },
  fin_resolution_rate: {
    icon: <CheckCircle size={18} />,
    color: '#0891b2',
  },
  lw_new_registrations: {
    icon: <UserPlus size={18} />,
    color: '#0f766e',
  },
  lw_enrollees: {
    icon: <GraduationCap size={18} />,
    color: '#2563eb',
  },
  lw_active_users: {
    icon: <Users size={18} />,
    color: '#0891b2',
  },
  lw_average_time_spent_in_courses: {
    icon: <Clock3 size={18} />,
    color: '#9333ea',
  },
  lw_most_popular_courses: {
    icon: <BookOpen size={18} />,
    color: '#16a34a',
  },
  lw_most_engaging_courses: {
    icon: <Activity size={18} />,
    color: '#ea580c',
  },
  lw_most_dropped_out_courses: {
    icon: <Workflow size={18} />,
    color: '#dc2626',
  },
};

const ComparisonIcon = ({ direction }) => {
  if (direction === 'up') {
    return <TrendingUp size={14} />;
  }

  if (direction === 'down') {
    return <TrendingDown size={14} />;
  }

  return <Minus size={14} />;
};

const MetricTooltip = memo(({ title, tooltipDetails }) => (
  <div className="metric-tooltip">
    <div className="metric-tooltip-header">{title}</div>
    <p>Reporting period {tooltipDetails.period}</p>
    {tooltipDetails.timezone && <p>{tooltipDetails.timezone}</p>}
    <p>Name: {tooltipDetails.name}</p>
    <p>{tooltipDetails.meaning}</p>
    {tooltipDetails.note && <p>{tooltipDetails.note}</p>}
  </div>
));

const ComparisonTooltip = memo(({ comparison }) => (
  <div className="metric-tooltip comparison-tooltip">
    <div className="metric-tooltip-header">Previous Period</div>
    <p>Compared to {comparison.periodLabel}</p>
    <p>Previous: {comparison.previousDisplayValue}</p>
    {comparison.previousOutsideLoadedData && <p>Limited by loaded history.</p>}
  </div>
));

const MetricCard = memo(({ metric }) => {
  const meta = CARD_META[metric.id] ?? {
    icon: <CircleHelp size={18} />,
    color: '#64748b',
  };
  const comparison = metric.comparison;

  return (
    <div className="metric-card glass-panel">
      <div className="metric-title-row">
        <div className="metric-title-main">
          <div className="metric-title-icon" style={{ color: meta.color }}>
            {meta.icon}
          </div>
          <h3>{metric.label}</h3>
        </div>
        <div className="metric-tooltip-trigger" tabIndex={0}>
          <CircleHelp size={15} />
          <MetricTooltip title={metric.label} tooltipDetails={metric.tooltipDetails} />
        </div>
      </div>

      <div className="metric-content">
        <p className="metric-value">{metric.displayValue}</p>
        {metric.contextText && <p className="metric-context">{metric.contextText}</p>}
      </div>

      {comparison && (
        <div className="metric-comparison-row">
          <div className="metric-comparison-trigger" tabIndex={0}>
            <div className={`metric-comparison-chip ${comparison.direction}`}>
              <ComparisonIcon direction={comparison.direction} />
              <span>{comparison.deltaLabel}</span>
            </div>
            <ComparisonTooltip comparison={comparison} />
          </div>
        </div>
      )}
    </div>
  );
});

export const KeyMetrics = memo(({ metrics }) => (
  <div className="metrics-grid">
    {metrics.map((metric) => (
      <MetricCard key={metric.id} metric={metric} />
    ))}
  </div>
));
