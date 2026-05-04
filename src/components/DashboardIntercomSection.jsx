import React, { memo, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Sankey,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  buildIntercomConversationFlow,
  buildIntercomMetricCards,
  buildIntercomSatisfactionTrend,
  buildIntercomTopicExplorerData,
  getIntercomTopicAvailability,
} from '../metrics/dashboard.js';
import {
  getReportPeriodGranularityLabel,
  inferReportPeriodGranularity,
} from '../utils/reportPeriod.js';

const GRID_STROKE = '#edf2f7';
const AXIS_STROKE = '#d7e0ea';
const AXIS_TICK = { fill: '#7c8a9a', fontSize: 12, fontWeight: 500 };
const OUTCOME_SERIES = [
  { key: 'overall_csat', label: 'Overall CSAT', color: '#2563eb' },
  { key: 'teammate_csat', label: 'Teammate CSAT', color: '#0f766e' },
  { key: 'fin_csat', label: 'Fin AI Agent CSAT', color: '#d97706' },
];

const EmptyBlock = ({ message }) => (
  <div className="chart-empty-state dashboard-empty-state">{message}</div>
);

const BaseTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="chart-tooltip">
      {label && <strong>{label}</strong>}
      <div className="chart-tooltip-list">
        {payload.map((entry) => (
          <div key={entry.dataKey || entry.name} className="chart-tooltip-item">
            <span style={{ color: entry.color }}>{entry.name}</span>
            <strong>
              {typeof entry.value === 'number' ? `${entry.value.toFixed(1)}%` : entry.value}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
};

const FlowTooltip = ({ active, payload }) => {
  const item = payload?.[0]?.payload;

  if (!active || !item?.payload) {
    return null;
  }

  const details = item.payload;
  const label = details.source && details.target
    ? `${details.source.name} -> ${details.target.name}`
    : details.name;

  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      <div className="chart-tooltip-list">
        <div className="chart-tooltip-item">
          <span>Conversations</span>
          <strong>{details.value?.toLocaleString?.() ?? details.value}</strong>
        </div>
        {details.change?.label && (
          <div className="chart-tooltip-item">
            <span>Period change</span>
            <strong>{details.change.label}</strong>
          </div>
        )}
        {details.insight && (
          <div className="chart-tooltip-item">
            <span>Signal</span>
            <strong>{details.insight}</strong>
          </div>
        )}
      </div>
    </div>
  );
};

const FlowNode = ({ x, y, width, height, payload }) => {
  const color = payload.status === 'warning'
    ? '#fca5a5'
    : payload.status === 'good'
      ? '#bbf7d0'
      : payload.color || '#93c5fd';

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={8}
        fill={color}
        opacity={0.95}
      />
      <text
        x={x + width + 10}
        y={y + height / 2 - 6}
        fill="#182230"
        fontSize="12"
        fontWeight="700"
      >
        {payload.label}
      </text>
      <text
        x={x + width + 10}
        y={y + height / 2 + 12}
        fill="#6b7280"
        fontSize="12"
      >
        {payload.value.toLocaleString()} ({payload.percentage}%)
      </text>
      {payload.change?.label && (
        <text
          x={x + width + 10}
          y={y + height / 2 + 28}
          fill={payload.status === 'warning' ? '#dc2626' : '#64748b'}
          fontSize="11"
          fontWeight="700"
        >
          {payload.change.label}
        </text>
      )}
    </g>
  );
};

const FlowLink = ({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, payload }) => {
  const path = `
    M${sourceX},${sourceY}
    C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}
  `;

  return (
    <path
      d={path}
      fill="none"
      stroke={payload.stroke || 'rgba(96, 165, 250, 0.22)'}
      strokeOpacity={0.9}
      strokeWidth={Math.max(10, linkWidth)}
    />
  );
};

const normalizeSankeyData = (flowData) => {
  const nodeColors = {
    total: '#1d4ed8',
    fin_involved: '#8b5cf6',
    no_fin: '#60a5fa',
  };

  return {
    nodes: flowData.nodes.map((node) => ({
      name: node.displayLabel,
      label: node.label,
      value: node.value,
      percentage: flowData.total > 0 ? Math.round((node.value / flowData.total) * 100) : 0,
      color: nodeColors[node.id] || (node.label.includes('Fin') ? '#c4b5fd' : '#bfdbfe'),
      status: node.status,
      change: node.change,
      insight: node.insight,
    })),
    links: flowData.links.map((link) => ({
      ...link,
      stroke: link.source === 0
        ? 'rgba(59, 130, 246, 0.22)'
        : link.source === 1
          ? 'rgba(139, 92, 246, 0.18)'
          : 'rgba(59, 130, 246, 0.14)',
    })),
  };
};

const ConversationFlowCard = memo(({ flowData }) => {
  const sankeyData = useMemo(() => normalizeSankeyData(flowData), [flowData]);

  return (
    <div className="chart-card glass-panel dashboard-flow-card">
      <div className="chart-card-header dashboard-flow-header">
        <div>
          <h3 className="chart-title">Conversation Flow</h3>
          <p className="chart-support-copy">{flowData.note}</p>
        </div>
      </div>
      <div className="dashboard-flow-wrapper">
        {flowData.total > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <Sankey
              data={sankeyData}
              node={<FlowNode />}
              link={<FlowLink />}
              nodePadding={28}
              nodeWidth={14}
              margin={{ top: 12, right: 160, bottom: 12, left: 20 }}
              sort={false}
            >
              <Tooltip content={<FlowTooltip />} />
            </Sankey>
          </ResponsiveContainer>
        ) : (
          <EmptyBlock message="No conversations match the selected reporting period." />
        )}
      </div>
    </div>
  );
});

const OutcomeSummary = memo(({ metrics }) => (
  <div className="dashboard-outcome-summary">
    <h4>Summary</h4>
    <div className="dashboard-outcome-summary-list">
      {metrics.map((metric) => (
        <div key={metric.id} className="dashboard-outcome-summary-item">
          <span>{metric.label}</span>
          <strong>{metric.displayValue}</strong>
          {metric.contextText && <small>{metric.contextText}</small>}
        </div>
      ))}
    </div>
  </div>
));

const OutcomeFlowCard = memo(({ trendData, metrics, granularityLabel, visibleSeries, onToggleSeries }) => {
  const hasVisibleSeries = OUTCOME_SERIES.some((series) => visibleSeries[series.key]);

  return (
    <div className="chart-card glass-panel dashboard-outcome-card">
      <div className="chart-card-header">
        <div>
          <h3 className="chart-title">Customer Satisfaction</h3>
          <p className="chart-support-copy">
            Track the three CSAT signals together. Time buckets are grouped automatically by {granularityLabel}.
          </p>
        </div>
      </div>

      <div className="dashboard-outcome-layout">
        <div className="dashboard-outcome-chart-zone">
          <div className="dashboard-outcome-chart">
            {trendData.length > 0 && hasVisibleSeries ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                  <XAxis dataKey="periodLabel" stroke={AXIS_STROKE} tick={AXIS_TICK} tickMargin={10} minTickGap={24} />
                  <YAxis stroke={AXIS_STROKE} tick={AXIS_TICK} domain={[0, 100]} />
                  <Tooltip content={<BaseTooltip />} />
                  {OUTCOME_SERIES.filter((series) => visibleSeries[series.key]).map((series) => (
                    <Line
                      key={series.key}
                      type="monotone"
                      dataKey={series.key}
                      name={series.label}
                      stroke={series.color}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : hasVisibleSeries ? (
              <EmptyBlock message="No CSAT trend data is available for the selected filters." />
            ) : (
              <EmptyBlock message="Select at least one CSAT series to display the trend." />
            )}
          </div>

          <div className="dashboard-series-toggles">
            {OUTCOME_SERIES.map((series) => (
              <button
                key={series.key}
                type="button"
                className={`dashboard-series-toggle ${visibleSeries[series.key] ? 'active' : ''}`}
                onClick={() => onToggleSeries(series.key)}
              >
                <span className="dashboard-series-dot" style={{ backgroundColor: series.color }}></span>
                <span>{series.label}</span>
              </button>
            ))}
          </div>
        </div>

        <OutcomeSummary metrics={metrics} />
      </div>
    </div>
  );
});

const TopicBarsCard = memo(({ title, topics, emptyMessage, finVariant = false }) => {
  const maxValue = topics[0]?.value || 1;

  return (
    <div className="chart-card glass-panel dashboard-topic-card">
      <div className="chart-card-header">
        <h3 className="chart-title">{title}</h3>
      </div>

      {topics.length > 0 ? (
        <div className="dashboard-topic-list">
          {topics.map((topic) => (
            <div key={topic.name} className="dashboard-topic-row">
              <div className="dashboard-topic-row-top">
                <strong>{topic.name}</strong>
                <span>{topic.value.toLocaleString()}</span>
              </div>
              <div className="dashboard-topic-bar-track">
                <div
                  className={`dashboard-topic-bar-fill ${finVariant ? 'fin' : ''}`}
                  style={{ width: `${Math.max(16, (topic.value / maxValue) * 100)}%` }}
                ></div>
              </div>
              <div className="dashboard-topic-row-meta">
                <span>{topic.cxScore !== null ? `${topic.cxScore}% CX` : 'CX unavailable'}</span>
              </div>
              <div className="dashboard-topic-popover">
                <h4>{topic.name}</h4>
                <div className="dashboard-topic-popover-metrics">
                  <span>{topic.value.toLocaleString()} conversations</span>
                  {topic.cxScore !== null && <span>{topic.cxScore}% CX score</span>}
                </div>
                {topic.issueSummary && (
                  <p className="dashboard-topic-popover-summary">{topic.issueSummary}</p>
                )}
                <div className="dashboard-topic-popover-details">
                  {topic.subtopics[0] && <p><strong>Subtopic</strong><span>{topic.subtopics[0].name}</span></p>}
                  {topic.teams[0] && <p><strong>Team</strong><span>{topic.teams[0].name}</span></p>}
                  {topic.channels[0] && <p><strong>Channel</strong><span>{topic.channels[0].name}</span></p>}
                  {finVariant && topic.finStates[0] && <p><strong>Fin outcome</strong><span>{topic.finStates[0].name}</span></p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyBlock message={emptyMessage} />
      )}
    </div>
  );
});

const DashboardIntercomSection = memo(({
  normalizedData,
  filters,
}) => {
  const [visibleSeries, setVisibleSeries] = useState({
    overall_csat: true,
    teammate_csat: true,
    fin_csat: true,
  });
  const outcomeGranularity = useMemo(
    () => inferReportPeriodGranularity(filters),
    [filters]
  );
  const outcomeGranularityLabel = getReportPeriodGranularityLabel(outcomeGranularity);

  const flowData = useMemo(
    () => buildIntercomConversationFlow(normalizedData, filters),
    [normalizedData, filters]
  );
  const outcomeMetrics = useMemo(
    () => buildIntercomMetricCards(normalizedData, filters, outcomeGranularity, 'satisfaction'),
    [normalizedData, filters, outcomeGranularity]
  );
  const outcomeTrend = useMemo(
    () => buildIntercomSatisfactionTrend(normalizedData, filters, outcomeGranularity),
    [normalizedData, filters, outcomeGranularity]
  );
  const topTopics = useMemo(
    () => buildIntercomTopicExplorerData(normalizedData, filters, 'all'),
    [normalizedData, filters]
  );
  const topTopicsAvailability = useMemo(
    () => getIntercomTopicAvailability(normalizedData, filters, 'all'),
    [normalizedData, filters]
  );
  const topFinTopics = useMemo(
    () => buildIntercomTopicExplorerData(normalizedData, filters, 'fin'),
    [normalizedData, filters]
  );
  const topFinTopicsAvailability = useMemo(
    () => getIntercomTopicAvailability(normalizedData, filters, 'fin'),
    [normalizedData, filters]
  );

  const toggleSeries = (key) => {
    setVisibleSeries((previous) => ({
      ...previous,
      [key]:
        previous[key] && Object.values(previous).filter(Boolean).length === 1
          ? true
          : !previous[key],
    }));
  };

  return (
    <section className="workspace-section dashboard-intercom-section">
      <ConversationFlowCard flowData={flowData} />

      <OutcomeFlowCard
        trendData={outcomeTrend}
        metrics={outcomeMetrics}
        granularityLabel={outcomeGranularityLabel}
        visibleSeries={visibleSeries}
        onToggleSeries={toggleSeries}
      />

      <div className="dashboard-topics-grid">
        <TopicBarsCard
          title="Top Topics"
          topics={topTopics}
          emptyMessage={
            topTopicsAvailability.hasRows && !topTopicsAvailability.hasTopicData
              ? 'Topic data is not currently available from the Intercom API for this dataset.'
              : 'No topic data is available for the selected filters.'
          }
        />
        <TopicBarsCard
          title="Top Fin AI Topics"
          topics={topFinTopics}
          finVariant
          emptyMessage={
            topFinTopicsAvailability.hasRows && !topFinTopicsAvailability.hasTopicData
              ? 'Topic data is not currently available from the Intercom API for this dataset.'
              : 'No topic data is available for the selected filters.'
          }
        />
      </div>
    </section>
  );
});

export default DashboardIntercomSection;
