import { calculateLearnWorldsMetricSet, learnWorldsMetricSpecsById } from './specs.js';
import {
  buildPreviousPeriodRange,
  formatDateRangeLabel,
  getGranularityLabel,
  listBucketsInRange,
} from '../metrics/time.js';

const LEARNING_METRIC_IDS = [
  'lw_new_registrations',
  'lw_enrollees',
  'lw_active_users',
  'lw_average_time_spent_in_courses',
];

const LEARNING_TABLE_METRIC_IDS = [
  'lw_most_popular_courses',
  'lw_most_engaging_courses',
  'lw_most_dropped_out_courses',
];

const LEARNING_COMPARISON_METRIC_IDS = new Set([
  'lw_new_registrations',
  'lw_active_users',
]);

const formatDuration = (seconds) => {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) {
    return 'Unavailable';
  }

  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
};

const formatPercentage = (value) => `${(value * 100).toFixed(1)}%`;

const formatPreviousValue = (metric) => {
  if (metric.kind === 'duration') {
    return formatDuration(metric.value);
  }

  return metric.displayValue;
};

const buildComparisonState = (currentMetric, previousMetric, previousRange) => {
  if (!previousMetric || !previousRange) {
    return null;
  }

  if (
    currentMetric.kind === 'ranking' ||
    currentMetric.kind === 'blocked' ||
    currentMetric.timestampField === 'course analytics snapshot' ||
    !LEARNING_COMPARISON_METRIC_IDS.has(currentMetric.id)
  ) {
    return null;
  }

  const delta = currentMetric.value - previousMetric.value;
  const roundedDelta = currentMetric.kind === 'duration' ? Math.round(delta) : Math.round(delta);
  const direction = roundedDelta > 0 ? 'up' : roundedDelta < 0 ? 'down' : 'flat';
  const deltaLabel = currentMetric.kind === 'duration'
    ? `${roundedDelta > 0 ? '+' : ''}${formatDuration(Math.abs(roundedDelta))}`
    : `${roundedDelta > 0 ? '+' : ''}${roundedDelta.toLocaleString()}`;

  return {
    direction,
    deltaLabel,
    periodLabel: formatDateRangeLabel(previousRange.startDate, previousRange.endDate),
    previousDisplayValue: formatPreviousValue(previousMetric),
    previousOutsideLoadedData: false,
  };
};

const buildMetricTooltipDetails = (metric, filters) => {
  const spec = learnWorldsMetricSpecsById[metric.id];
  const note = metric.supportState === 'partial'
    ? 'Partially limited by the current LearnWorlds data.'
    : metric.supportState === 'blocked'
      ? 'Not fully available with the current LearnWorlds data.'
      : null;

  return {
    period: formatDateRangeLabel(filters.startDate, filters.endDate),
    timezone: 'LearnWorlds metrics use available API timestamps and analytics snapshots.',
    name: spec.label,
    meaning: spec.tooltip.meaning,
    note,
  };
};

const buildLearningMetricCard = (
  metricId,
  currentMetric,
  previousMetric,
  previousRange,
  filters
) => ({
  ...currentMetric,
  label: currentMetric.label,
  contextText:
    currentMetric.kind === 'duration' && currentMetric.denominator !== null
      ? `${currentMetric.denominator.toLocaleString()} learners`
      : currentMetric.denominator !== null
        ? `${currentMetric.numerator.toLocaleString()} out of ${currentMetric.denominator.toLocaleString()}`
        : null,
  comparison: buildComparisonState(currentMetric, previousMetric, previousRange),
  tooltipDetails: buildMetricTooltipDetails(currentMetric, filters),
});

const buildMetricSeries = (normalizedData, filters, granularity, metricIds) =>
  listBucketsInRange(filters.startDate, filters.endDate, granularity).map((bucket) => {
    const bucketFilters = {
      ...filters,
      startDate: bucket.startDate,
      endDate: bucket.endDate,
    };
    const metrics = calculateLearnWorldsMetricSet(normalizedData, bucketFilters, metricIds);
    const row = {
      periodKey: bucket.key,
      periodLabel: bucket.label,
    };

    metricIds.forEach((metricId) => {
      row[metricId] = metrics[metricId]?.kind === 'blocked' ? null : metrics[metricId]?.value ?? null;
    });

    return row;
  });

export const buildLearnWorldsCombinedTrend = (
  normalizedData,
  filters,
  granularity = 'daily'
) => buildMetricSeries(normalizedData, filters, granularity, [
  'lw_new_registrations',
  'lw_active_users',
]);

const buildLearningTable = (metric, formatter) => ({
  id: metric.id,
  title: metric.label,
  supportState: metric.supportState,
  emptyMessage:
    metric.kind === 'blocked'
      ? metric.limitations[0] || 'This LearnWorlds metric is not available yet.'
      : 'No LearnWorlds data is available for this table.',
  columns: formatter.columns,
  rows: metric.kind === 'ranking' ? metric.ranking.map(formatter.mapRow) : [],
  defaultSort: formatter.defaultSort,
  initialVisibleRows: formatter.initialVisibleRows ?? 5,
  note:
    formatter.note ||
    (metric.supportState === 'partial'
      ? metric.limitations[0] || 'Partially limited by the current LearnWorlds data.'
      : null),
});

const buildLearningCharts = (normalizedData, filters, granularity, metricResults) => ({
  registrationsTrendData: buildMetricSeries(normalizedData, filters, granularity, ['lw_new_registrations']),
  activeUsersTrendData:
    metricResults.lw_active_users.supportState === 'blocked'
      ? []
      : buildMetricSeries(normalizedData, filters, granularity, ['lw_active_users']),
});

export const buildLearnWorldsDashboardViewModel = (
  normalizedData,
  filters,
  granularity = 'daily'
) => {
  const metricResults = calculateLearnWorldsMetricSet(normalizedData, filters, [
    ...LEARNING_METRIC_IDS,
    ...LEARNING_TABLE_METRIC_IDS,
  ]);

  const previousRange = buildPreviousPeriodRange(filters.startDate, filters.endDate, granularity);
  const previousFilters = previousRange
    ? {
        ...filters,
        startDate: previousRange.startDate,
        endDate: previousRange.endDate,
      }
    : null;
  const previousMetricResults = previousFilters
    ? calculateLearnWorldsMetricSet(normalizedData, previousFilters, LEARNING_METRIC_IDS)
    : null;

  return {
    granularity,
    granularityLabel: getGranularityLabel(granularity),
    metrics: LEARNING_METRIC_IDS.map((metricId) =>
      buildLearningMetricCard(
        metricId,
        metricResults[metricId],
        previousMetricResults?.[metricId] ?? null,
        previousRange,
        filters
      )
    ),
    charts: buildLearningCharts(normalizedData, filters, granularity, metricResults),
    sections: {
      overview: {
        title: 'Overview',
        description: 'Registration and enrollment activity based on dated LearnWorlds records.',
        summary: `${metricResults.lw_new_registrations.displayValue} registrations and ${metricResults.lw_enrollees.displayValue} enrollees in the selected period.`,
      },
      engagement: {
        title: 'Engagement',
        description: 'Engagement rankings use the current LearnWorlds analytics snapshot.',
        summary: `${metricResults.lw_average_time_spent_in_courses.displayValue} average study time per learner across the current analytics snapshot.`,
      },
      dropout: {
        title: 'Dropout',
        description: 'Dropout is a conservative proxy built from incomplete progress states.',
        summary: 'Use this section as a watchlist rather than a final dropout report.',
      },
    },
    tables: {
      mostPopularCourses: buildLearningTable(metricResults.lw_most_popular_courses, {
        columns: [
          { key: 'course_name', label: 'Course', sortable: true },
          { key: 'enrollment_count', label: 'Enrollments', sortable: true, align: 'right' },
        ],
        defaultSort: {
          key: 'enrollment_count',
          direction: 'desc',
        },
        mapRow: (row) => ({
          course_name: row.course_name,
          course_url: row.course_url ?? null,
          enrollment_count: row.enrollment_count,
        }),
        note: 'Ranked from enrollments whose enrolled_at falls inside the selected reporting period.',
      }),
      mostEngagingCourses: buildLearningTable(metricResults.lw_most_engaging_courses, {
        columns: [
          { key: 'course_name', label: 'Course', sortable: true },
          {
            key: 'average_time_spent_seconds',
            label: 'Avg. time spent',
            sortable: true,
            render: (row) => formatDuration(row.average_time_spent_seconds),
          },
          { key: 'students', label: 'Learners', sortable: true, align: 'right' },
        ],
        defaultSort: {
          key: 'average_time_spent_seconds',
          direction: 'desc',
        },
        mapRow: (row) => ({
          course_name: row.course_name,
          course_url: row.course_url ?? null,
          average_time_spent_seconds: row.average_time_spent_seconds,
          students: row.students,
        }),
        note: 'Uses the current LearnWorlds analytics snapshot and is not scoped to the selected reporting period.',
      }),
      mostDroppedOutCourses: buildLearningTable(metricResults.lw_most_dropped_out_courses, {
        columns: [
          { key: 'course_name', label: 'Course', sortable: true },
          {
            key: 'dropout_rate',
            label: 'Dropout proxy',
            sortable: true,
            render: (row) => formatPercentage(row.dropout_rate),
          },
          { key: 'dropout_candidates', label: 'Candidates', sortable: true, align: 'right' },
          { key: 'active_progress_rows', label: 'Progress rows', sortable: true, align: 'right' },
        ],
        defaultSort: {
          key: 'dropout_rate',
          direction: 'desc',
        },
        mapRow: (row) => ({
          course_name: row.course_name,
          course_url: row.course_url ?? null,
          dropout_rate: row.dropout_rate,
          dropout_candidates: row.dropout_candidates,
          active_progress_rows: row.active_progress_rows,
        }),
        note: 'Ranked from the selected enrollment cohort using enrolled_at, then matched to available progress rows.',
      }),
    },
    availability: {
      dropoutStageAnalytics: {
        label: 'Dropout stage analytics',
        note: 'Not available yet. LearnWorlds does not yet expose activity-level progression history for stage-level dropout reporting.',
      },
    },
  };
};
