import React, { memo, useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { KeyMetrics } from './KeyMetrics';

const EmptyChartState = ({ message }) => (
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
          <div key={entry.dataKey} className="chart-tooltip-item">
            <span style={{ color: entry.color }}>{entry.name}</span>
            <strong>{entry.value?.toLocaleString?.() ?? entry.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

const LearningTable = memo(({ table, state, onStateChange }) => {
  const defaultState = useMemo(() => ({
    sortKey: table.defaultSort?.key ?? null,
    sortDirection: table.defaultSort?.direction ?? 'desc',
    visibleRows: table.initialVisibleRows ?? 5,
  }), [table.defaultSort?.direction, table.defaultSort?.key, table.initialVisibleRows]);
  const sortState = state ?? defaultState;
  const visibleRows = sortState.visibleRows ?? table.initialVisibleRows ?? 5;

  const sortedRows = useMemo(() => {
    const nextRows = [...table.rows];
    const { sortKey, sortDirection } = sortState || {};

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
        <h3 className="chart-title">{table.title}</h3>
        {table.supportState === 'partial' && <span className="learning-table-state">Partial</span>}
      </div>

      {table.rows.length > 0 ? (
        <>
          <div className="learning-table-scroll">
            <table className="learning-table">
              <thead>
                <tr>
                  {table.columns.map((column) => {
                    const isActiveSort = sortState?.sortKey === column.key;

                    return (
                      <th
                        key={column.key}
                        className={column.align === 'right' ? 'align-right' : ''}
                      >
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
                  <tr key={`${row.course_name || table.id}-${index}`}>
                    {table.columns.map((column) => (
                      <td
                        key={column.key}
                        className={column.align === 'right' ? 'align-right' : ''}
                      >
                        {column.render ? column.render(row) : row[column.key] ?? '—'}
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

      {table.note && <p className="learning-card-note">{table.note}</p>}
    </div>
  );
});

const LearningTrendCharts = memo(({ charts, granularityLabel }) => (
  <div className="charts-container">
    <div className="chart-card glass-panel wide">
      <h3 className="chart-title">{granularityLabel} New Registrations</h3>
      <div className="chart-wrapper">
        {charts.registrationsTrendData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={charts.registrationsTrendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="lwRegistrationsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0f766e" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="periodLabel" stroke="#cbd5e1" tick={{ fill: '#64748b' }} tickMargin={10} minTickGap={24} />
              <YAxis stroke="#cbd5e1" tick={{ fill: '#64748b' }} />
              <Tooltip content={<BaseTooltip />} />
              <Area
                type="monotone"
                dataKey="lw_new_registrations"
                name="New registrations"
                stroke="#0f766e"
                strokeWidth={3}
                fill="url(#lwRegistrationsFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState message="No LearnWorlds registrations match the current filters." />
        )}
      </div>
    </div>

    <div className="chart-card glass-panel wide">
      <h3 className="chart-title">{granularityLabel} Active Users</h3>
      <div className="chart-wrapper">
        {charts.activeUsersTrendData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={charts.activeUsersTrendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="periodLabel" stroke="#cbd5e1" tick={{ fill: '#64748b' }} tickMargin={10} minTickGap={24} />
              <YAxis stroke="#cbd5e1" tick={{ fill: '#64748b' }} />
              <Tooltip content={<BaseTooltip />} />
              <Line
                type="monotone"
                dataKey="lw_active_users"
                name="Active users"
                stroke="#0891b2"
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState message="Active user trends are not reliable yet because LearnWorlds progress timestamps are incomplete." />
        )}
      </div>
    </div>
  </div>
));

export const LearningPanel = memo(({ learningViewModel, tableState, onTableStateChange }) => (
  <div className="learning-panel">
    <section className="learning-section">
      <div className="dashboard-section-header learning-section-header">
        <div>
          <h3>{learningViewModel.sections.overview.title}</h3>
          <p className="learning-section-copy">{learningViewModel.sections.overview.description}</p>
          <p className="learning-section-summary">{learningViewModel.sections.overview.summary}</p>
        </div>
      </div>

      <KeyMetrics metrics={learningViewModel.metrics} />
      <LearningTrendCharts
        charts={learningViewModel.charts}
        granularityLabel={learningViewModel.granularityLabel}
      />
    </section>

    <section className="learning-section">
      <div className="dashboard-section-header learning-section-header">
        <div>
          <h3>{learningViewModel.sections.engagement.title}</h3>
          <p className="learning-section-copy">{learningViewModel.sections.engagement.description}</p>
          <p className="learning-section-summary">{learningViewModel.sections.engagement.summary}</p>
        </div>
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
      </div>
    </section>

    <section className="learning-section">
      <div className="dashboard-section-header learning-section-header">
        <div>
          <h3>{learningViewModel.sections.dropout.title}</h3>
          <p className="learning-section-copy">{learningViewModel.sections.dropout.description}</p>
          <p className="learning-section-summary">{learningViewModel.sections.dropout.summary}</p>
        </div>
      </div>

      <div className="learning-table-grid">
        <LearningTable
          table={learningViewModel.tables.mostDroppedOutCourses}
          state={tableState.mostDroppedOutCourses}
          onStateChange={(updater) => onTableStateChange('mostDroppedOutCourses', updater)}
        />
        <div className="learning-table-card glass-panel learning-unavailable-card">
          <h3 className="chart-title">{learningViewModel.availability.dropoutStageAnalytics.label}</h3>
          <p className="learning-card-note">
            {learningViewModel.availability.dropoutStageAnalytics.note}
          </p>
        </div>
      </div>
    </section>
  </div>
));
