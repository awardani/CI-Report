import React, { memo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626'];
const PIE_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#8b5cf6'];
const TOPIC_COLORS = ['#10b981', '#059669', '#047857', '#065f46', '#064e3b'];
const FIN_TOPIC_COLORS = ['#ec4899', '#db2777', '#be185d', '#9d174d', '#831843'];

const EmptyChartState = ({ message }) => (
  <div className="chart-empty-state">{message}</div>
);

const formatTooltipValue = (entry) => {
  if (typeof entry.value !== 'number') {
    return entry.value;
  }

  if (entry.dataKey?.includes('csat') || entry.dataKey?.includes('rate')) {
    return `${entry.value.toFixed(1)}%`;
  }

  return entry.value.toLocaleString();
};

const BaseTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) {
    return null;
  }

  const heading = label ?? payload[0]?.name ?? '';

  return (
    <div className="chart-tooltip">
      {heading && <strong>{heading}</strong>}
      <div className="chart-tooltip-list">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="chart-tooltip-item">
            <span style={{ color: entry.color }}>{entry.name}</span>
            <strong>{formatTooltipValue(entry)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

const OverviewCharts = ({ charts, granularityLabel }) => (
  <div className="charts-container">
    <div className="chart-card glass-panel wide">
      <h3 className="chart-title">{granularityLabel} New Conversations</h3>
      <div className="chart-wrapper">
        {charts.overviewTrendData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={charts.overviewTrendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="overviewTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="periodLabel" stroke="#cbd5e1" tick={{ fill: '#64748b' }} tickMargin={10} minTickGap={24} />
              <YAxis stroke="#cbd5e1" tick={{ fill: '#64748b' }} />
              <Tooltip content={<BaseTooltip />} />
              <Area
                type="monotone"
                dataKey="new_conversations"
                name="New Conversations"
                stroke="#7c3aed"
                strokeWidth={3}
                fill="url(#overviewTrendFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState message="No conversations found for the selected filters." />
        )}
      </div>
    </div>

    <div className="chart-card glass-panel wide">
      <h3 className="chart-title">Top Topics</h3>
      <div className="chart-wrapper">
        {charts.topTopicsData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.topTopicsData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <XAxis type="number" stroke="#cbd5e1" tick={{ fill: '#64748b' }} />
              <YAxis dataKey="name" type="category" stroke="#cbd5e1" tick={{ fill: '#64748b', fontSize: 11 }} width={250} />
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <Tooltip content={<BaseTooltip />} />
              <Bar dataKey="value" name="Conversations" radius={[0, 4, 4, 0]}>
                {charts.topTopicsData.map((entry, index) => (
                  <Cell key={entry.name} fill={TOPIC_COLORS[index % TOPIC_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState message="No topic data is available for the selected filters." />
        )}
      </div>
    </div>

    {charts.topFinTopicsData.length > 0 && (
      <div className="chart-card glass-panel wide">
        <h3 className="chart-title">Top Fin AI Topics</h3>
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.topFinTopicsData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <XAxis type="number" stroke="#cbd5e1" tick={{ fill: '#64748b' }} />
              <YAxis dataKey="name" type="category" stroke="#cbd5e1" tick={{ fill: '#64748b', fontSize: 11 }} width={250} />
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <Tooltip content={<BaseTooltip />} />
              <Bar dataKey="value" name="Fin Conversations" radius={[0, 4, 4, 0]}>
                {charts.topFinTopicsData.map((entry, index) => (
                  <Cell key={entry.name} fill={FIN_TOPIC_COLORS[index % FIN_TOPIC_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    )}

    <div className="chart-card glass-panel">
      <h3 className="chart-title">CSAT Breakdown</h3>
      <div className="chart-wrapper">
        {charts.csatData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={charts.csatData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
              >
                {charts.csatData.map((entry, index) => (
                  <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<BaseTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState message="No ratings are available for the selected filters." />
        )}
      </div>
      <div className="pie-legend">
        {charts.csatData.map((entry, index) => (
          <div key={entry.name} className="legend-item">
            <span className="legend-color" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}></span>
            <span>{entry.name} ({entry.value})</span>
          </div>
        ))}
      </div>
    </div>

    <div className="chart-card glass-panel">
      <h3 className="chart-title">Volume by Channel</h3>
      <div className="chart-wrapper">
        {charts.channelData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.channelData.slice(0, 5)} layout="vertical" margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
              <XAxis type="number" stroke="#cbd5e1" tick={{ fill: '#64748b' }} />
              <YAxis dataKey="name" type="category" stroke="#cbd5e1" tick={{ fill: '#64748b' }} width={90} />
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <Tooltip content={<BaseTooltip />} />
              <Bar dataKey="value" name="Conversations" radius={[0, 4, 4, 0]}>
                {charts.channelData.slice(0, 5).map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState message="No channel data is available for the selected filters." />
        )}
      </div>
    </div>
  </div>
);

const SatisfactionCharts = ({ charts, granularityLabel }) => (
  <div className="charts-container">
    <div className="chart-card glass-panel wide">
      <h3 className="chart-title">{granularityLabel} Satisfaction Trends</h3>
      <div className="chart-wrapper">
        {charts.satisfactionTrendData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={charts.satisfactionTrendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="periodLabel" stroke="#cbd5e1" tick={{ fill: '#64748b' }} tickMargin={10} minTickGap={24} />
              <YAxis stroke="#cbd5e1" tick={{ fill: '#64748b' }} domain={[0, 100]} />
              <Tooltip content={<BaseTooltip />} />
              <Legend />
              <Line type="monotone" dataKey="overall_csat" name="Overall CSAT" stroke="#059669" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="teammate_csat" name="Teammate CSAT" stroke="#2563eb" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="fin_csat" name="Fin AI CSAT" stroke="#d97706" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState message="No CSAT trend data is available for the selected filters." />
        )}
      </div>
    </div>

    <div className="chart-card glass-panel">
      <h3 className="chart-title">Rating Breakdown</h3>
      <div className="chart-wrapper">
        {charts.csatData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={charts.csatData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
              >
                {charts.csatData.map((entry, index) => (
                  <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<BaseTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState message="No rating breakdown is available for the selected filters." />
        )}
      </div>
      <div className="pie-legend">
        {charts.csatData.map((entry, index) => (
          <div key={entry.name} className="legend-item">
            <span className="legend-color" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}></span>
            <span>{entry.name} ({entry.value})</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const FinCharts = ({ charts, granularityLabel }) => (
  <div className="charts-container">
    <div className="chart-card glass-panel wide">
      <h3 className="chart-title">{granularityLabel} Fin Outcome Rates</h3>
      <div className="chart-wrapper">
        {charts.finOutcomeTrendData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={charts.finOutcomeTrendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="periodLabel" stroke="#cbd5e1" tick={{ fill: '#64748b' }} tickMargin={10} minTickGap={24} />
              <YAxis stroke="#cbd5e1" tick={{ fill: '#64748b' }} domain={[0, 100]} />
              <Tooltip content={<BaseTooltip />} />
              <Legend />
              <Line type="monotone" dataKey="fin_deflection_rate" name="Fin Deflection Rate" stroke="#db2777" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="fin_resolution_rate" name="Fin Resolution Rate" stroke="#0891b2" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState message="No Fin outcome trend data is available for the selected filters." />
        )}
      </div>
    </div>

    <div className="chart-card glass-panel wide">
      <h3 className="chart-title">{granularityLabel} Fin AI CSAT</h3>
      <div className="chart-wrapper">
        {charts.finCsatTrendData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={charts.finCsatTrendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="finCsatFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d97706" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="periodLabel" stroke="#cbd5e1" tick={{ fill: '#64748b' }} tickMargin={10} minTickGap={24} />
              <YAxis stroke="#cbd5e1" tick={{ fill: '#64748b' }} domain={[0, 100]} />
              <Tooltip content={<BaseTooltip />} />
              <Area type="monotone" dataKey="fin_csat" name="Fin AI CSAT" stroke="#d97706" strokeWidth={3} fill="url(#finCsatFill)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState message="No Fin AI CSAT data is available for the selected filters." />
        )}
      </div>
    </div>

    <div className="chart-card glass-panel wide">
      <h3 className="chart-title">Top Fin AI Topics</h3>
      <div className="chart-wrapper">
        {charts.topFinTopicsData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.topFinTopicsData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <XAxis type="number" stroke="#cbd5e1" tick={{ fill: '#64748b' }} />
              <YAxis dataKey="name" type="category" stroke="#cbd5e1" tick={{ fill: '#64748b', fontSize: 11 }} width={250} />
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <Tooltip content={<BaseTooltip />} />
              <Bar dataKey="value" name="Fin Conversations" radius={[0, 4, 4, 0]}>
                {charts.topFinTopicsData.map((entry, index) => (
                  <Cell key={entry.name} fill={FIN_TOPIC_COLORS[index % FIN_TOPIC_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState message="No Fin topic data is available for the selected filters." />
        )}
      </div>
    </div>

    <div className="chart-card glass-panel">
      <h3 className="chart-title">Fin AI Rating Breakdown</h3>
      <div className="chart-wrapper">
        {charts.finCsatData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={charts.finCsatData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
              >
                {charts.finCsatData.map((entry, index) => (
                  <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<BaseTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState message="No Fin AI ratings are available for the selected filters." />
        )}
      </div>
      <div className="pie-legend">
        {charts.finCsatData.map((entry, index) => (
          <div key={entry.name} className="legend-item">
            <span className="legend-color" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}></span>
            <span>{entry.name} ({entry.value})</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const Charts = memo(({ activeTab, charts, granularityLabel }) => {
  if (activeTab === 'satisfaction') {
    return <SatisfactionCharts charts={charts} granularityLabel={granularityLabel} />;
  }

  if (activeTab === 'fin') {
    return <FinCharts charts={charts} granularityLabel={granularityLabel} />;
  }

  return <OverviewCharts charts={charts} granularityLabel={granularityLabel} />;
});
