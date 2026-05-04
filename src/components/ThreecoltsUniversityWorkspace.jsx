import React, { memo, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDown, ArrowUp, ExternalLink } from 'lucide-react';
import KeyMetrics from './KeyMetrics.jsx';
import { ReportPeriodControl } from './ReportPeriodControl.jsx';
import { buildLearnWorldsDashboardViewModel, buildLearnWorldsCombinedTrend } from '../learnworlds/dashboard.js';
import {
  getReportPeriodGranularityLabel,
  inferReportPeriodGranularity,
} from '../utils/reportPeriod.js';
const GRID_STROKE = '#edf2f7';
const AXIS_STROKE = '#d7e0ea';
const AXIS_TICK = { fill: '#7c8a9a', fontSize: 12, fontWeight: 500 };
const UNIVERSITY_TREND_SERIES = [
  { key: 'lw_new_registrations', label: 'New registrations', color: '#0f766e' },
  { key: 'lw_enrollees', label: 'Enrollees', color: '#2563eb' },
  { key: 'lw_active_users', label: 'Active users', color: '#0891b2' },
];

const defaultTableState = (table) => ({
  sortKey: table.defaultSort?.key ?? null,
  sortDirection: table.defaultSort?.direction ?? 'desc',
  visibleRows: table.initialVisibleRows ?? 5,
});

const EmptyPanel = ({ title, message }) => (
  <div className="learning-empty-panel glass-panel">
    <h3>{title}</h3>
    <p>{message}</p>
  </div>
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
          <div key={entry.dataKey} className="chart-tooltip-item">
            <span style={{ color: entry.color }}>{entry.name}</span>
            <strong>{entry.value?.toLocaleString?.() ?? entry.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

const renderCourseLink = (row) => {
  if (!row.course_url) {
    return <span>{row.course_name}</span>;
  }

  return (
    <a
      href={row.course_url}
      target="_blank"
      rel="noreferrer"
      className="course-link"
    >
      <span>{row.course_name}</span>
      <ExternalLink size={14} />
    </a>
  );
};

const LearningTable = memo(({ table, state, onStateChange }) => {
  const sortState = state ?? defaultTableState(table);
  const visibleRows = sortState.visibleRows ?? table.initialVisibleRows ?? 5;

  const sortedRows = useMemo(() => {
    const nextRows = [...table.rows];
    const { sortKey, sortDirection } = sortState;

    if (!sortKey) {
      return nextRows;
    }

    nextRows.sort((left, right) => {
      const leftValue = left[sortKey];
      const rightValue = right[sortKey];

      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        return sortDirection === 'asc' ? leftValue - rightValue : rightValue - leftValue;
      }

      const leftText = String(leftValue ?? '');
      const rightText = String(rightValue ?? '');
      return sortDirection === 'asc'
        ? leftText.localeCompare(rightText)
        : rightText.localeCompare(leftText);
    });

    return nextRows;
  }, [table.rows, sortState]);

  const displayedRows = useMemo(
    () => sortedRows.slice(0, visibleRows),
    [sortedRows, visibleRows]
  );

  const toggleSort = (column) => {
    if (!column.sortable) {
      return;
    }

    onStateChange((current) => {
      if (current?.sortKey === column.key) {
        return {
          ...current,
          sortKey: column.key,
          sortDirection: current.sortDirection === 'asc' ? 'desc' : 'asc',
        };
      }

      return {
        ...current,
        sortKey: column.key,
        sortDirection: 'desc',
      };
    });
  };

  return (
    <div className="learning-table-card glass-panel">
      <div className="learning-table-header">
        <div>
          <h3 className="chart-title">{table.title}</h3>
        </div>
        {table.supportState === 'partial' && <span className="learning-table-state">Partial</span>}
      </div>

      {table.rows.length > 0 ? (
        <>
          <div className="learning-table-scroll">
            <table className="learning-table">
              <thead>
                <tr>
                  {table.columns.map((column) => {
                    const isActiveSort = sortState.sortKey === column.key;

                    return (
                      <th key={column.key} className={column.align === 'right' ? 'align-right' : ''}>
                        {column.sortable ? (
                          <button
                            type="button"
                            className={`learning-sort-button ${isActiveSort ? 'active' : ''}`}
                            onClick={() => toggleSort(column)}
                          >
                            <span>{column.label}</span>
                            {isActiveSort && sortState.sortDirection === 'asc' ? (
                              <ArrowUp size={14} />
                            ) : (
                              <ArrowDown size={14} />
                            )}
                          </button>
                        ) : (
                          column.label
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((row, index) => (
                  <tr key={`${row.course_id || row.course_name}-${index}`}>
                    {table.columns.map((column) => (
                      <td key={column.key} className={column.align === 'right' ? 'align-right' : ''}>
                        {column.render
                          ? column.render(row)
                          : column.key === 'course_name'
                            ? renderCourseLink(row)
                            : row[column.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sortedRows.length > visibleRows && (
            <button
              type="button"
              className="learning-show-more"
              onClick={() =>
                onStateChange((current) => ({
                  ...current,
                  visibleRows: (current?.visibleRows ?? table.initialVisibleRows ?? 5) + (table.initialVisibleRows ?? 5),
                }))
              }
            >
              Show more
            </button>
          )}

          {sortedRows.length <= visibleRows && sortedRows.length > (table.initialVisibleRows ?? 5) && (
            <button
              type="button"
              className="learning-show-more"
              onClick={() =>
                onStateChange((current) => ({
                  ...current,
                  visibleRows: table.initialVisibleRows ?? 5,
                }))
              }
            >
              Show less
            </button>
          )}
        </>
      ) : (
        <div className="learning-empty-state">{table.emptyMessage}</div>
      )}
    </div>
  );
});

const UniversityTrendChart = memo(({ data, granularityLabel, visibleSeries, onToggleSeries }) => {
  const hasVisibleSeries = UNIVERSITY_TREND_SERIES.some((series) => visibleSeries[series.key]);

  return (
    <div className="chart-card glass-panel wide">
      <div className="chart-card-header">
        <div>
          <h3 className="chart-title">New Registrations, Enrollees, and Active Users</h3>
          <p className="chart-support-copy">Time buckets are grouped automatically by {granularityLabel}.</p>
        </div>
      </div>
      <div className="chart-wrapper">
        {data.length > 0 && hasVisibleSeries ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="periodLabel" stroke={AXIS_STROKE} tick={AXIS_TICK} tickMargin={10} minTickGap={24} />
              <YAxis stroke={AXIS_STROKE} tick={AXIS_TICK} />
              <Tooltip content={<BaseTooltip />} />
              {UNIVERSITY_TREND_SERIES.filter((series) => visibleSeries[series.key]).map((series) => (
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
          <EmptyPanel title="No university trend data" message="No dated LearnWorlds activity matches the selected range." />
        ) : (
          <EmptyPanel title="No university trend data" message="Select at least one series to display the trend." />
        )}
      </div>
      <div className="dashboard-series-toggles">
        {UNIVERSITY_TREND_SERIES.map((series) => (
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
  );
});

const UniversityTopControls = memo(({
  dateRange,
  onDateRangeChange,
  anchorDate,
}) => (
  <div className="workspace-controls-row">
    <div className="workspace-controls-group">
      <div className="workspace-control-field">
        <span>Report period</span>
        <ReportPeriodControl
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
          anchorDate={anchorDate}
        />
      </div>
    </div>
  </div>
));

const UniversityContent = memo(({
  learningViewModel,
  trendData,
  trendGranularityLabel,
  visibleSeries,
  onToggleSeries,
  tableState,
  onTableStateChange,
}) => (
  <div className="workspace-section">
    <KeyMetrics metrics={learningViewModel.metrics} />

    <div className="charts-container">
      <UniversityTrendChart
        data={trendData}
        granularityLabel={trendGranularityLabel}
        visibleSeries={visibleSeries}
        onToggleSeries={onToggleSeries}
      />
    </div>

    <div className="learning-table-grid">
      <LearningTable
        table={learningViewModel.tables.mostPopularCourses}
        state={tableState.mostPopularCourses}
        onStateChange={(updater) => onTableStateChange('mostPopularCourses', updater)}
      />
      <LearningTable
        table={learningViewModel.tables.mostEngagingCourses}
        state={tableState.mostEngagingCourses}
        onStateChange={(updater) => onTableStateChange('mostEngagingCourses', updater)}
      />
      <LearningTable
        table={learningViewModel.tables.mostDroppedOutCourses}
        state={tableState.mostDroppedOutCourses}
        onStateChange={(updater) => onTableStateChange('mostDroppedOutCourses', updater)}
      />
    </div>
  </div>
));

export const ThreecoltsUniversitySummarySection = memo(({
  normalizedData,
  sharedDateRange,
  comparisonGranularity,
}) => {
  const [tableState, setTableState] = useState({});
  const [visibleSeries, setVisibleSeries] = useState({
    lw_new_registrations: true,
    lw_enrollees: true,
    lw_active_users: true,
  });
  const trendGranularity = useMemo(
    () => inferReportPeriodGranularity(sharedDateRange),
    [sharedDateRange]
  );
  const trendGranularityLabel = useMemo(
    () => getReportPeriodGranularityLabel(trendGranularity),
    [trendGranularity]
  );

  const learningViewModel = useMemo(
    () => buildLearnWorldsDashboardViewModel(normalizedData, sharedDateRange, comparisonGranularity),
    [normalizedData, sharedDateRange, comparisonGranularity]
  );
  const trendData = useMemo(
    () => buildLearnWorldsCombinedTrend(normalizedData, sharedDateRange, trendGranularity),
    [normalizedData, sharedDateRange, trendGranularity]
  );

  const handleTableStateChange = (tableId, updater) => {
    setTableState((previous) => ({
      ...previous,
      [tableId]: updater(previous[tableId] ?? {}),
    }));
  };

  const handleToggleSeries = (key) => {
    setVisibleSeries((previous) => ({
      ...previous,
      [key]:
        previous[key] && Object.values(previous).filter(Boolean).length === 1
          ? true
          : !previous[key],
    }));
  };

  return (
    <UniversityContent
      learningViewModel={learningViewModel}
      trendData={trendData}
      trendGranularityLabel={trendGranularityLabel}
      visibleSeries={visibleSeries}
      onToggleSeries={handleToggleSeries}
      tableState={tableState}
      onTableStateChange={handleTableStateChange}
    />
  );
});

export const ThreecoltsUniversityWorkspace = memo(({
  normalizedData,
  loading,
  error,
  sharedDateRange,
  onSharedDateRangeChange,
  comparisonGranularity,
}) => {
  const [tableState, setTableState] = useState({});
  const trendGranularity = useMemo(
    () => inferReportPeriodGranularity(sharedDateRange),
    [sharedDateRange]
  );
  const trendGranularityLabel = useMemo(
    () => getReportPeriodGranularityLabel(trendGranularity),
    [trendGranularity]
  );

  const learningViewModel = useMemo(() => {
    if (!normalizedData) {
      return null;
    }

    return buildLearnWorldsDashboardViewModel(
      normalizedData,
      sharedDateRange,
      comparisonGranularity
    );
  }, [normalizedData, sharedDateRange, comparisonGranularity]);

  const trendData = useMemo(() => {
    if (!normalizedData) {
      return [];
    }

    return buildLearnWorldsCombinedTrend(normalizedData, sharedDateRange, trendGranularity);
  }, [normalizedData, sharedDateRange, trendGranularity]);

  const handleTableStateChange = (tableId, updater) => {
    setTableState((previous) => ({
      ...previous,
      [tableId]: updater(previous[tableId] ?? {}),
    }));
  };

  if (loading && !normalizedData) {
    return <EmptyPanel title="Loading Threecolts University" message="Fetching LearnWorlds metrics..." />;
  }

  if (error && !normalizedData) {
    return <EmptyPanel title="Threecolts University unavailable" message={error} />;
  }

  if (!learningViewModel) {
    return <EmptyPanel title="Preparing Threecolts University" message="Building LearnWorlds views..." />;
  }

  return (
    <div className="workspace-panel">
      <UniversityTopControls
        dateRange={sharedDateRange}
        onDateRangeChange={onSharedDateRangeChange}
        anchorDate={
          normalizedData?.dateBounds?.progress_activity_at?.maxDate ||
          normalizedData?.dateBounds?.enrollment_created_at?.maxDate ||
          normalizedData?.dateBounds?.user_created_at?.maxDate
        }
      />

      <UniversityContent
        learningViewModel={learningViewModel}
        trendData={trendData}
        trendGranularityLabel={trendGranularityLabel}
        tableState={tableState}
        onTableStateChange={handleTableStateChange}
      />
    </div>
  );
});
