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
import { KeyMetrics } from './KeyMetrics.jsx';
import { LearningFilters } from './LearningFilters.jsx';
import { ChartGranularityControl } from './ChartGranularityControl.jsx';
import { buildLearnWorldsDashboardViewModel, buildLearnWorldsCombinedTrend } from '../learnworlds/dashboard.js';
import { applyLearnWorldsFilters, getLearnWorldsFilterOptions } from '../learnworlds/filtering.js';

const EMPTY_FILTERS = {
  courseIds: [],
  authors: [],
  categories: [],
  accessTypes: [],
};
const GRID_STROKE = '#edf2f7';
const AXIS_STROKE = '#d7e0ea';
const AXIS_TICK = { fill: '#7c8a9a', fontSize: 12, fontWeight: 500 };

const arraysEqual = (left, right) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const filtersMatch = (left, right) =>
  arraysEqual(left.courseIds, right.courseIds) &&
  arraysEqual(left.authors, right.authors) &&
  arraysEqual(left.categories, right.categories) &&
  arraysEqual(left.accessTypes, right.accessTypes);

const sortValues = (values) => [...values].sort((left, right) => left.localeCompare(right));

const buildPresetFilters = (presetId, presetCourseIds) => {
  if (presetId === 'all_courses') {
    return { ...EMPTY_FILTERS };
  }

  return {
    ...EMPTY_FILTERS,
    courseIds: presetCourseIds,
  };
};

const buildPresetViews = (baseViewModel) => {
  const mostEngagingCourseIds = baseViewModel.tables.mostEngagingCourses.rows
    .slice(0, 5)
    .map((row) => row.course_id)
    .filter(Boolean);
  const dropoutWatchCourseIds = baseViewModel.tables.mostDroppedOutCourses.rows
    .slice(0, 5)
    .map((row) => row.course_id)
    .filter(Boolean);
  const newLearnerActivityCourseIds = baseViewModel.tables.mostPopularCourses.rows
    .slice(0, 5)
    .map((row) => row.course_id)
    .filter(Boolean);

  return [
    {
      id: 'all_courses',
      label: 'All courses',
      description: 'Show the full university catalog.',
      filters: buildPresetFilters('all_courses', []),
    },
    {
      id: 'high_engagement',
      label: 'High engagement',
      description: 'Focus on the current top engagement courses.',
      filters: buildPresetFilters('high_engagement', sortValues(mostEngagingCourseIds)),
    },
    {
      id: 'dropout_watch',
      label: 'Dropout watch',
      description: 'Focus on courses with the strongest dropout proxy.',
      filters: buildPresetFilters('dropout_watch', sortValues(dropoutWatchCourseIds)),
    },
    {
      id: 'new_learner_activity',
      label: 'New learner activity',
      description: 'Focus on courses with recent learner enrollments.',
      filters: buildPresetFilters('new_learner_activity', sortValues(newLearnerActivityCourseIds)),
    },
  ];
};

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
          {table.note && <p className="learning-card-note">{table.note}</p>}
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

const UniversityTrendChart = memo(({ data, granularity, onGranularityChange }) => (
  <div className="chart-card glass-panel wide">
    <div className="chart-card-header">
      <h3 className="chart-title">New Registrations vs Active Users</h3>
      <ChartGranularityControl value={granularity} onChange={onGranularityChange} compact />
    </div>
    <div className="chart-wrapper">
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="periodLabel" stroke={AXIS_STROKE} tick={AXIS_TICK} tickMargin={10} minTickGap={24} />
            <YAxis stroke={AXIS_STROKE} tick={AXIS_TICK} />
            <Tooltip content={<BaseTooltip />} />
            <Line type="monotone" dataKey="lw_new_registrations" name="New registrations" stroke="#0f766e" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="lw_active_users" name="Active users" stroke="#0891b2" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <EmptyPanel title="No university trend data" message="No dated LearnWorlds activity matches the selected range." />
      )}
    </div>
  </div>
));

const UniversityContent = memo(({
  learningViewModel,
  trendData,
  trendGranularity,
  onTrendGranularityChange,
  tableState,
  onTableStateChange,
}) => (
  <div className="workspace-section">
    <KeyMetrics metrics={learningViewModel.metrics} />

    <div className="charts-container">
      <UniversityTrendChart
        data={trendData}
        granularity={trendGranularity}
        onGranularityChange={onTrendGranularityChange}
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
  const [trendGranularity, setTrendGranularity] = useState('weekly');
  const [tableState, setTableState] = useState({});

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

  return (
    <UniversityContent
      learningViewModel={learningViewModel}
      trendData={trendData}
      trendGranularity={trendGranularity}
      onTrendGranularityChange={setTrendGranularity}
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
  comparisonGranularity,
}) => {
  const [learningFilters, setLearningFilters] = useState(EMPTY_FILTERS);
  const [trendGranularity, setTrendGranularity] = useState('weekly');
  const [tableState, setTableState] = useState({});

  const filterOptions = useMemo(() => {
    if (!normalizedData) {
      return {
        courses: [],
        authors: [],
        categories: [],
        accessTypes: [],
      };
    }

    return getLearnWorldsFilterOptions(normalizedData);
  }, [normalizedData]);

  const baseViewModel = useMemo(() => {
    if (!normalizedData) {
      return null;
    }

    return buildLearnWorldsDashboardViewModel(
      normalizedData,
      sharedDateRange,
      comparisonGranularity
    );
  }, [normalizedData, sharedDateRange, comparisonGranularity]);

  const presetViews = useMemo(
    () => (baseViewModel ? buildPresetViews(baseViewModel) : []),
    [baseViewModel]
  );
  const activePreset = useMemo(() => {
    if (!presetViews.length) {
      return '';
    }

    return presetViews.find((preset) => filtersMatch(learningFilters, preset.filters))?.id ?? '';
  }, [learningFilters, presetViews]);

  const filteredData = useMemo(() => {
    if (!normalizedData) {
      return null;
    }

    return applyLearnWorldsFilters(normalizedData, learningFilters);
  }, [normalizedData, learningFilters]);

  const learningViewModel = useMemo(() => {
    if (!filteredData) {
      return null;
    }

    return buildLearnWorldsDashboardViewModel(
      filteredData,
      sharedDateRange,
      comparisonGranularity
    );
  }, [filteredData, sharedDateRange, comparisonGranularity]);

  const trendData = useMemo(() => {
    if (!filteredData) {
      return [];
    }

    return buildLearnWorldsCombinedTrend(filteredData, sharedDateRange, trendGranularity);
  }, [filteredData, sharedDateRange, trendGranularity]);

  const handleFilterChange = (updater) => {
    setLearningFilters((previous) => updater(previous));
  };

  const handlePresetChange = (presetId) => {
    const preset = presetViews.find((item) => item.id === presetId);

    if (!preset) {
      return;
    }

    setLearningFilters(preset.filters);
  };

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
      <LearningFilters
        filters={learningFilters}
        dateRange={sharedDateRange}
        filterOptions={filterOptions}
        granularity={comparisonGranularity}
        presets={presetViews}
        activePreset={activePreset}
        onFilterChange={handleFilterChange}
        onDateRangeChange={() => {}}
        onGranularityChange={() => {}}
        onPresetChange={handlePresetChange}
        showDateControls={false}
        showGranularityControl={false}
      />

      <UniversityContent
        learningViewModel={learningViewModel}
        trendData={trendData}
        trendGranularity={trendGranularity}
        onTrendGranularityChange={setTrendGranularity}
        tableState={tableState}
        onTableStateChange={handleTableStateChange}
      />
    </div>
  );
});
