import React, { memo, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from 'recharts';
import { Filters } from './Filters.jsx';
import { KeyMetrics } from './KeyMetrics.jsx';
import { ChartGranularityControl } from './ChartGranularityControl.jsx';
import { CsatReport } from './CsatReport.jsx';
import {
  buildIntercomConversationTrend,
  buildIntercomCsatBreakdown,
  buildIntercomFinCsatTrend,
  buildIntercomFinOutcomeTrend,
  buildIntercomMetricCards,
  buildIntercomSatisfactionTrend,
  buildIntercomTopicExplorerData,
} from '../metrics/dashboard.js';

const PIE_COLORS = ['#16a34a', '#f59e0b', '#dc2626'];
const GRID_STROKE = '#edf2f7';
const AXIS_STROKE = '#d7e0ea';
const AXIS_TICK = { fill: '#7c8a9a', fontSize: 12, fontWeight: 500 };

const EmptyState = ({ message }) => (
  <div className="chart-empty-state">{message}</div>
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
              {typeof entry.value === 'number'
                ? entry.dataKey?.includes('csat') || entry.dataKey?.includes('rate')
                  ? `${entry.value.toFixed(1)}%`
                  : entry.value.toLocaleString()
                : entry.value}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
};

const TopicExplorer = memo(({ title, topics, finVariant = false }) => {
  const maxValue = topics[0]?.value || 1;

  return (
    <div className="chart-card glass-panel">
      <div className="chart-card-header">
        <h3 className="chart-title">{title}</h3>
      </div>
      {topics.length > 0 ? (
        <div className="topic-explorer-grid">
          {topics.map((topic) => {
            const intensity = Math.max(0.22, topic.value / maxValue);

            return (
              <div
                key={topic.name}
                className="topic-explorer-tile"
                style={{
                  background: finVariant
                    ? `rgba(124, 58, 237, ${Math.min(0.72, intensity + 0.06)})`
                    : `rgba(91, 33, 182, ${Math.min(0.68, intensity + 0.04)})`,
                }}
              >
                <div className="topic-explorer-content">
                  <strong>{topic.name}</strong>
                  <span>{topic.value.toLocaleString()} conversations</span>
                  {topic.cxScore !== null && <span>{topic.cxScore}% CX score</span>}
                </div>
                <div className="topic-explorer-popover">
                  <h4>{topic.name}</h4>
                  <div className="topic-popover-metrics">
                    <span>{topic.value.toLocaleString()} conversations</span>
                    {topic.cxScore !== null && <span>{topic.cxScore}% CX score</span>}
                  </div>
                  <div className="topic-popover-details">
                    {topic.subtopics[0] && (
                      <p><strong>Subtopic</strong><span>{topic.subtopics[0].name}</span></p>
                    )}
                    {topic.teams[0] && (
                      <p><strong>Team</strong><span>{topic.teams[0].name}</span></p>
                    )}
                    {topic.channels[0] && (
                      <p><strong>Channel</strong><span>{topic.channels[0].name}</span></p>
                    )}
                    {finVariant && topic.finStates[0] && (
                      <p><strong>Fin outcome</strong><span>{topic.finStates[0].name}</span></p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState message="No topic data is available for the selected filters." />
      )}
    </div>
  );
});

const CsatBreakdownCard = memo(({ title, breakdown }) => (
  <div className="chart-card glass-panel">
    <div className="chart-card-header">
      <div>
        <h3 className="chart-title">{title}</h3>
        <p className="chart-support-copy">CSAT vs DSAT with recent written feedback below.</p>
      </div>
    </div>
    <div className="chart-wrapper">
      {breakdown.sentimentData.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={breakdown.sentimentData}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={92}
              paddingAngle={4}
              dataKey="value"
              stroke="none"
            >
              {breakdown.sentimentData.map((entry, index) => (
                <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<BaseTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState message="No ratings are available for the selected filters." />
      )}
    </div>
    <div className="pie-legend">
      {breakdown.sentimentData.map((entry, index) => (
        <div key={entry.name} className="legend-item">
          <span
            className="legend-color"
            style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
          ></span>
          <span>
            {entry.name} ({entry.value})
          </span>
        </div>
      ))}
    </div>
  </div>
));

const ConversationTrendChart = memo(({ data, granularity, onGranularityChange }) => (
  <div className="chart-card glass-panel wide">
    <div className="chart-card-header">
      <h3 className="chart-title">Conversation Chart</h3>
      <ChartGranularityControl value={granularity} onChange={onGranularityChange} compact />
    </div>
    <div className="chart-wrapper">
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="conversationTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="periodLabel" stroke={AXIS_STROKE} tick={AXIS_TICK} tickMargin={10} minTickGap={24} />
            <YAxis stroke={AXIS_STROKE} tick={AXIS_TICK} />
            <Tooltip content={<BaseTooltip />} />
            <Area
              type="monotone"
              dataKey="new_conversations"
              name="New Conversations"
              stroke="#7c3aed"
              strokeWidth={2.5}
              fill="url(#conversationTrendFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState message="No conversations found for the selected filters." />
      )}
    </div>
  </div>
));

const CsatComparisonChart = memo(({ data, granularity, onGranularityChange }) => (
  <div className="chart-card glass-panel wide">
    <div className="chart-card-header">
      <h3 className="chart-title">CSAT Team vs Fin AI</h3>
      <ChartGranularityControl value={granularity} onChange={onGranularityChange} compact />
    </div>
    <div className="chart-wrapper">
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="periodLabel" stroke={AXIS_STROKE} tick={AXIS_TICK} tickMargin={10} minTickGap={24} />
            <YAxis stroke={AXIS_STROKE} tick={AXIS_TICK} domain={[0, 100]} />
            <Tooltip content={<BaseTooltip />} />
            <Line type="monotone" dataKey="teammate_csat" name="Teammate CSAT" stroke="#2563eb" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="fin_csat" name="Fin AI Agent CSAT" stroke="#d97706" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState message="No CSAT trend data is available for the selected filters." />
      )}
    </div>
  </div>
));

const FinOutcomeCharts = memo(({
  rateData,
  rateGranularity,
  onRateGranularityChange,
  csatData,
  csatGranularity,
  onCsatGranularityChange,
}) => (
  <>
    <div className="chart-card glass-panel wide">
      <div className="chart-card-header">
        <h3 className="chart-title">Fin AI Outcomes</h3>
        <ChartGranularityControl value={rateGranularity} onChange={onRateGranularityChange} compact />
      </div>
      <div className="chart-wrapper">
        {rateData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rateData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="periodLabel" stroke={AXIS_STROKE} tick={AXIS_TICK} tickMargin={10} minTickGap={24} />
              <YAxis stroke={AXIS_STROKE} tick={AXIS_TICK} domain={[0, 100]} />
              <Tooltip content={<BaseTooltip />} />
              <Line type="monotone" dataKey="fin_deflection_rate" name="Deflection rate" stroke="#db2777" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="fin_resolution_rate" name="Resolution rate" stroke="#0891b2" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState message="No Fin outcome trend data is available for the selected filters." />
        )}
      </div>
    </div>

    <div className="chart-card glass-panel wide">
      <div className="chart-card-header">
        <h3 className="chart-title">Fin AI Agent CSAT</h3>
        <ChartGranularityControl value={csatGranularity} onChange={onCsatGranularityChange} compact />
      </div>
      <div className="chart-wrapper">
        {csatData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={csatData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
              <linearGradient id="finOverviewFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d97706" stopOpacity={0.16} />
                  <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="periodLabel" stroke={AXIS_STROKE} tick={AXIS_TICK} tickMargin={10} minTickGap={24} />
              <YAxis stroke={AXIS_STROKE} tick={AXIS_TICK} domain={[0, 100]} />
              <Tooltip content={<BaseTooltip />} />
              <Area type="monotone" dataKey="fin_csat" name="Fin AI Agent CSAT" stroke="#d97706" strokeWidth={2.5} fill="url(#finOverviewFill)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState message="No Fin AI CSAT data is available for the selected filters." />
        )}
      </div>
    </div>
  </>
));

const IntercomUnifiedSection = memo(({ normalizedData, filters, comparisonGranularity }) => {
  const [conversationGranularity, setConversationGranularity] = useState('weekly');
  const [csatGranularity, setCsatGranularity] = useState('weekly');
  const [rateGranularity, setRateGranularity] = useState('weekly');
  const [finCsatGranularity, setFinCsatGranularity] = useState('weekly');

  const metrics = useMemo(
    () => buildIntercomMetricCards(normalizedData, filters, comparisonGranularity, 'overview'),
    [normalizedData, filters, comparisonGranularity]
  );
  const conversationTrend = useMemo(
    () => buildIntercomConversationTrend(normalizedData, filters, conversationGranularity),
    [normalizedData, filters, conversationGranularity]
  );
  const csatTrend = useMemo(
    () => buildIntercomSatisfactionTrend(normalizedData, filters, csatGranularity),
    [normalizedData, filters, csatGranularity]
  );
  const finOutcomeTrend = useMemo(
    () => buildIntercomFinOutcomeTrend(normalizedData, filters, rateGranularity),
    [normalizedData, filters, rateGranularity]
  );
  const finCsatTrend = useMemo(
    () => buildIntercomFinCsatTrend(normalizedData, filters, finCsatGranularity),
    [normalizedData, filters, finCsatGranularity]
  );
  const topTopics = useMemo(
    () => buildIntercomTopicExplorerData(normalizedData, filters, 'all'),
    [normalizedData, filters]
  );
  const topFinTopics = useMemo(
    () => buildIntercomTopicExplorerData(normalizedData, filters, 'fin'),
    [normalizedData, filters]
  );
  const csatBreakdown = useMemo(
    () => buildIntercomCsatBreakdown(normalizedData, filters, 'all'),
    [normalizedData, filters]
  );

  return (
    <section className="workspace-section">
      <KeyMetrics metrics={metrics} />

      <div className="workspace-group">
        <div className="workspace-group-heading">
          <h3>Performance</h3>
        </div>
        <div className="charts-container">
          <ConversationTrendChart
            data={conversationTrend}
            granularity={conversationGranularity}
            onGranularityChange={setConversationGranularity}
          />
          <CsatComparisonChart
            data={csatTrend}
            granularity={csatGranularity}
            onGranularityChange={setCsatGranularity}
          />
          <FinOutcomeCharts
            rateData={finOutcomeTrend}
            rateGranularity={rateGranularity}
            onRateGranularityChange={setRateGranularity}
            csatData={finCsatTrend}
            csatGranularity={finCsatGranularity}
            onCsatGranularityChange={setFinCsatGranularity}
          />
        </div>
      </div>

      <div className="workspace-group">
        <div className="workspace-group-heading">
          <h3>Topics</h3>
        </div>
        <div className="charts-container topic-grid-section">
          <TopicExplorer title="Top Topics" topics={topTopics} />
          <TopicExplorer title="Top Fin AI Topics" topics={topFinTopics} finVariant />
        </div>
      </div>

      <div className="workspace-group">
        <div className="workspace-group-heading">
          <h3>Satisfaction</h3>
        </div>
        <div className="charts-container">
          <CsatBreakdownCard title="CSAT Breakdown" breakdown={csatBreakdown} />
        </div>
        <CsatReport title="Recent CSAT Comments" reviews={csatBreakdown.feed} />
      </div>
    </section>
  );
});

export const IntercomOverviewSection = memo(({
  normalizedData,
  filters,
  comparisonGranularity,
  showFeed = false,
  showCsatBreakdown = true,
}) => {
  const [conversationGranularity, setConversationGranularity] = useState('weekly');
  const [csatGranularity, setCsatGranularity] = useState('weekly');

  const metrics = useMemo(
    () => buildIntercomMetricCards(normalizedData, filters, comparisonGranularity, 'overview'),
    [normalizedData, filters, comparisonGranularity]
  );
  const conversationTrend = useMemo(
    () => buildIntercomConversationTrend(normalizedData, filters, conversationGranularity),
    [normalizedData, filters, conversationGranularity]
  );
  const topTopics = useMemo(
    () => buildIntercomTopicExplorerData(normalizedData, filters, 'all'),
    [normalizedData, filters]
  );
  const topFinTopics = useMemo(
    () => buildIntercomTopicExplorerData(normalizedData, filters, 'fin'),
    [normalizedData, filters]
  );
  const csatBreakdown = useMemo(
    () => buildIntercomCsatBreakdown(normalizedData, filters, 'all'),
    [normalizedData, filters]
  );
  const csatTrend = useMemo(
    () => buildIntercomSatisfactionTrend(normalizedData, filters, csatGranularity),
    [normalizedData, filters, csatGranularity]
  );

  return (
    <section className="workspace-section">
      <KeyMetrics metrics={metrics} />
      <div className="charts-container">
        <ConversationTrendChart
          data={conversationTrend}
          granularity={conversationGranularity}
          onGranularityChange={setConversationGranularity}
        />
        <CsatComparisonChart
          data={csatTrend}
          granularity={csatGranularity}
          onGranularityChange={setCsatGranularity}
        />
        <TopicExplorer title="Top Topics" topics={topTopics} />
        <TopicExplorer title="Top Fin AI Topics" topics={topFinTopics} finVariant />
        {showCsatBreakdown && (
          <CsatBreakdownCard title="CSAT Breakdown" breakdown={csatBreakdown} />
        )}
      </div>
      {showFeed && (
        <CsatReport title="Recent CSAT Comments" reviews={csatBreakdown.feed} />
      )}
    </section>
  );
});

export const IntercomWorkspace = memo(({
  normalizedData,
  availableTeams,
  availableTeammates,
  sharedFilters,
  localFilters,
  onLocalFilterChange,
  comparisonGranularity,
}) => {
  const scopedFilters = useMemo(
    () => ({
      ...sharedFilters,
      ...localFilters,
    }),
    [sharedFilters, localFilters]
  );

  return (
    <div className="workspace-panel">
      <Filters
        availableTeams={availableTeams}
        availableTeammates={availableTeammates}
        filters={scopedFilters}
        granularity={comparisonGranularity}
        onFilterChange={onLocalFilterChange}
        onGranularityChange={() => {}}
        showDateControls={false}
        showGranularityControl={false}
      />

      <IntercomUnifiedSection
        normalizedData={normalizedData}
        filters={scopedFilters}
        comparisonGranularity={comparisonGranularity}
      />
    </div>
  );
});
