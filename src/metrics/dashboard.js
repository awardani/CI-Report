import { applyMetricFilters } from './filtering.js';
import { calculateMetricSet, metricSpecsById, NEW_CONVERSATION_PROXY_STARTED_BY } from './specs.js';
import {
  buildPreviousPeriodRange,
  formatDateRangeLabel,
  getGranularityLabel,
  listBucketsInRange,
} from './time.js';

export const INTERCOM_SECTION_CONFIG = {
  overview: {
    label: 'Overview',
    metricIds: [
      'new_conversations',
      'overall_csat',
      'teammate_csat',
      'fin_csat',
      'fin_deflection_rate',
      'fin_resolution_rate',
    ],
  },
  satisfaction: {
    label: 'Satisfaction',
    metricIds: ['overall_csat', 'teammate_csat', 'fin_csat'],
  },
  fin: {
    label: 'Fin AI',
    metricIds: ['fin_csat', 'fin_deflection_rate', 'fin_resolution_rate'],
  },
};

const TOPIC_LIMIT = 6;

const splitTopics = (value) =>
  (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const countBy = (items, valueGetter) => {
  const counts = new Map();

  items.forEach((item) => {
    const value = valueGetter(item);

    if (!value) {
      return;
    }

    counts.set(value, (counts.get(value) || 0) + 1);
  });

  return [...counts.entries()].map(([name, value]) => ({ name, value }));
};

const sortDescending = (items) => [...items].sort((left, right) => right.value - left.value);

const buildRatingBreakdown = (items) => {
  const labels = {
    1: '1 Star',
    2: '2 Stars',
    3: '3 Stars',
    4: '4 Stars',
    5: '5 Stars',
  };

  const counts = new Map(
    Object.entries(labels).map(([rating, label]) => [Number(rating), { name: label, value: 0 }])
  );

  items.forEach((item) => {
    const entry = counts.get(item.rating_value);

    if (entry) {
      entry.value += 1;
    }
  });

  return [...counts.values()].filter((entry) => entry.value > 0);
};

const buildSentimentBreakdown = (ratings) => {
  const totals = {
    csat: 0,
    neutral: 0,
    dsat: 0,
  };

  ratings.forEach((rating) => {
    if (rating.rating_value >= 4) {
      totals.csat += 1;
      return;
    }

    if (rating.rating_value <= 2) {
      totals.dsat += 1;
      return;
    }

    if (rating.rating_value === 3) {
      totals.neutral += 1;
    }
  });

  return [
    { name: 'CSAT', value: totals.csat },
    { name: 'Neutral', value: totals.neutral },
    { name: 'DSAT', value: totals.dsat },
  ].filter((entry) => entry.value > 0);
};

const buildCsatFeed = (ratings) =>
  [...ratings]
    .sort((left, right) => (right.rated_at || '').localeCompare(left.rated_at || ''))
    .slice(0, 200);

const buildMetricSeries = (normalizedData, filters, granularity, metricIds) =>
  listBucketsInRange(filters.startDate, filters.endDate, granularity).map((bucket) => {
    const bucketFilters = {
      ...filters,
      startDate: bucket.startDate,
      endDate: bucket.endDate,
    };
    const bucketMetrics = calculateMetricSet(normalizedData, bucketFilters, metricIds);
    const row = {
      periodKey: bucket.key,
      periodLabel: bucket.label,
    };

    metricIds.forEach((metricId) => {
      row[metricId] = bucketMetrics[metricId].value;
    });

    return row;
  });

const formatSignedCount = (value) => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString()}`;
};

const formatSignedPoints = (value) => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)} pts`;
};

const buildContextText = (result) => {
  if (result.denominator === null || !result.contextLabel) {
    return null;
  }

  return `${result.numerator.toLocaleString()} out of ${result.denominator.toLocaleString()}`;
};

const buildComparisonState = (currentResult, previousResult, previousRange, normalizedData) => {
  if (!previousResult || !previousRange) {
    return null;
  }

  const rawDelta = currentResult.value - previousResult.value;
  const delta = currentResult.valueType === 'percentage'
    ? Number(rawDelta.toFixed(1))
    : Math.round(rawDelta);
  const timestampBounds = normalizedData.dateBounds[currentResult.timestampField] ?? { minDate: '' };
  const previousOutsideLoadedData = Boolean(
    timestampBounds.minDate && previousRange.startDate < timestampBounds.minDate
  );

  return {
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
    deltaLabel: currentResult.valueType === 'percentage'
      ? formatSignedPoints(delta)
      : formatSignedCount(delta),
    periodLabel: formatDateRangeLabel(previousRange.startDate, previousRange.endDate),
    previousDisplayValue: previousResult.displayValue,
    previousOutsideLoadedData,
  };
};

const buildMetricCard = (
  metricId,
  currentResult,
  previousResult,
  previousRange,
  normalizedData,
  filters
) => {
  const spec = metricSpecsById[metricId];

  return {
    ...currentResult,
    contextText: buildContextText(currentResult),
    comparison: buildComparisonState(currentResult, previousResult, previousRange, normalizedData),
    tooltipDetails: {
      period: formatDateRangeLabel(filters.startDate, filters.endDate),
      timezone: 'Charts are in New York time (GMT-4)',
      name: spec.label,
      meaning: spec.tooltip.meaning,
      note:
        currentResult.id === 'new_conversations'
          ? 'Proxy-based.'
          : currentResult.supportLevel === 'partial'
            ? 'Partially limited.'
            : null,
    },
  };
};

const selectMetricCards = (
  metricIds,
  metricResults,
  previousMetricResults,
  previousRange,
  normalizedData,
  filters
) =>
  metricIds.map((metricId) =>
    buildMetricCard(
      metricId,
      metricResults[metricId],
      previousMetricResults?.[metricId] ?? null,
      previousRange,
      normalizedData,
      filters
    )
  );

const filterStartedAtConversations = (normalizedData, filters) =>
  applyMetricFilters(
    normalizedData.conversations.filter((conversation) =>
      NEW_CONVERSATION_PROXY_STARTED_BY.has(conversation.started_by)
    ),
    filters,
    {
      timestampField: 'started_at',
      teamField: 'team_name',
      teammateFields: ['teammate_name'],
    }
  ).items;

const filterOverallRatings = (normalizedData, filters) =>
  applyMetricFilters(
    normalizedData.ratings.filter((rating) => rating.rating_source === 'satisfaction'),
    filters,
    {
      timestampField: 'rated_at',
      teamField: 'team_name',
      teammateFields: ['teammate_name'],
    }
  ).items;

const filterFinRatings = (normalizedData, filters) =>
  applyMetricFilters(
    normalizedData.ratings.filter((rating) => rating.rating_source === 'fin_satisfaction'),
    filters,
    {
      timestampField: 'rated_at',
      teamField: 'team_name',
      teammateFields: ['teammate_name'],
    }
  ).items;

const filterFinOutcomes = (normalizedData, filters) =>
  applyMetricFilters(normalizedData.fin_outcomes, filters, {
    timestampField: 'started_at',
    teamField: 'team_name',
    teammateFields: ['teammate_name'],
  }).items;

const buildTopicExplorerDataFromItems = (items, ratings, { includeFinState = false } = {}) => {
  const ratingSummaryByConversation = ratings.reduce((accumulator, rating) => {
    if (!rating.conversation_id || rating.rating_value === null) {
      return accumulator;
    }

    const current = accumulator.get(rating.conversation_id) || {
      total: 0,
      positive: 0,
    };

    current.total += 1;

    if (rating.rating_is_positive) {
      current.positive += 1;
    }

    accumulator.set(rating.conversation_id, current);
    return accumulator;
  }, new Map());

  const topicMap = new Map();

  items.forEach((item) => {
    splitTopics(item.topic).forEach((topicName) => {
      const current = topicMap.get(topicName) || {
        name: topicName,
        value: 0,
        conversationIds: new Set(),
        csatPositive: 0,
        csatTotal: 0,
        subtopics: new Map(),
        channels: new Map(),
        teams: new Map(),
        finStates: new Map(),
      };

      current.value += 1;

      if (item.conversation_id) {
        current.conversationIds.add(item.conversation_id);
        const ratingSummary = ratingSummaryByConversation.get(item.conversation_id);

        if (ratingSummary) {
          current.csatPositive += ratingSummary.positive;
          current.csatTotal += ratingSummary.total;
        }
      }

      if (item.subtopic) {
        current.subtopics.set(item.subtopic, (current.subtopics.get(item.subtopic) || 0) + 1);
      }

      if (item.channel) {
        current.channels.set(item.channel, (current.channels.get(item.channel) || 0) + 1);
      }

      if (item.team_name) {
        current.teams.set(item.team_name, (current.teams.get(item.team_name) || 0) + 1);
      }

      if (includeFinState && item.fin_resolution_state) {
        current.finStates.set(
          item.fin_resolution_state,
          (current.finStates.get(item.fin_resolution_state) || 0) + 1
        );
      }

      topicMap.set(topicName, current);
    });
  });

  return [...topicMap.values()]
    .map((entry) => ({
      name: entry.name,
      value: entry.value,
      cxScore:
        entry.csatTotal > 0
          ? Number(((entry.csatPositive / entry.csatTotal) * 100).toFixed(1))
          : null,
      subtopics: [...entry.subtopics.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count })),
      channels: [...entry.channels.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count })),
      teams: [...entry.teams.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count })),
      finStates: [...entry.finStates.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count })),
      conversationCount: entry.conversationIds.size || entry.value,
    }))
    .sort((left, right) => right.value - left.value)
    .slice(0, TOPIC_LIMIT);
};

export const buildIntercomMetricCards = (
  normalizedData,
  filters,
  comparisonGranularity = 'monthly',
  sectionId = 'overview'
) => {
  const metricIds =
    INTERCOM_SECTION_CONFIG[sectionId]?.metricIds ?? INTERCOM_SECTION_CONFIG.overview.metricIds;
  const metricResults = calculateMetricSet(normalizedData, filters, metricIds);
  const previousRange = buildPreviousPeriodRange(
    filters.startDate,
    filters.endDate,
    comparisonGranularity
  );
  const previousFilters = previousRange
    ? {
        ...filters,
        startDate: previousRange.startDate,
        endDate: previousRange.endDate,
      }
    : null;
  const previousMetricResults = previousFilters
    ? calculateMetricSet(normalizedData, previousFilters, metricIds)
    : null;

  return selectMetricCards(
    metricIds,
    metricResults,
    previousMetricResults,
    previousRange,
    normalizedData,
    filters
  );
};

export const buildIntercomConversationTrend = (normalizedData, filters, granularity) =>
  buildMetricSeries(normalizedData, filters, granularity, ['new_conversations']);

export const buildIntercomSatisfactionTrend = (normalizedData, filters, granularity) =>
  buildMetricSeries(normalizedData, filters, granularity, [
    'overall_csat',
    'teammate_csat',
    'fin_csat',
  ]);

export const buildIntercomFinOutcomeTrend = (normalizedData, filters, granularity) =>
  buildMetricSeries(normalizedData, filters, granularity, [
    'fin_deflection_rate',
    'fin_resolution_rate',
  ]);

export const buildIntercomFinCsatTrend = (normalizedData, filters, granularity) =>
  buildMetricSeries(normalizedData, filters, granularity, ['fin_csat']);

export const buildIntercomTopicExplorerData = (
  normalizedData,
  filters,
  variant = 'all'
) => {
  if (variant === 'fin') {
    const outcomes = filterFinOutcomes(normalizedData, filters);
    const ratings = filterFinRatings(normalizedData, filters);
    return buildTopicExplorerDataFromItems(outcomes, ratings, { includeFinState: true });
  }

  const conversations = filterStartedAtConversations(normalizedData, filters);
  const ratings = filterOverallRatings(normalizedData, filters);
  return buildTopicExplorerDataFromItems(conversations, ratings);
};

export const buildIntercomCsatBreakdown = (
  normalizedData,
  filters,
  variant = 'all'
) => {
  const ratings = variant === 'fin'
    ? filterFinRatings(normalizedData, filters)
    : filterOverallRatings(normalizedData, filters);

  return {
    sentimentData: buildSentimentBreakdown(ratings),
    ratingBreakdownData: buildRatingBreakdown(ratings),
    feed: buildCsatFeed(ratings),
  };
};

export const buildIntercomOverviewSummary = (
  normalizedData,
  filters,
  comparisonGranularity = 'monthly'
) => ({
  metrics: buildIntercomMetricCards(normalizedData, filters, comparisonGranularity, 'overview'),
  topTopics: buildIntercomTopicExplorerData(normalizedData, filters, 'all'),
  topFinTopics: buildIntercomTopicExplorerData(normalizedData, filters, 'fin'),
  csat: buildIntercomCsatBreakdown(normalizedData, filters, 'all'),
});

export const buildDashboardViewModel = (
  normalizedData,
  filters,
  granularity = 'daily',
  activeTab = 'overview'
) => {
  if (activeTab === 'satisfaction') {
    const metrics = buildIntercomMetricCards(normalizedData, filters, granularity, 'satisfaction');

    return {
      granularity,
      granularityLabel: getGranularityLabel(granularity),
      activeTab,
      activeView: {
        metrics,
        charts: {
          satisfactionTrendData: buildIntercomSatisfactionTrend(normalizedData, filters, granularity),
          csatData: buildIntercomCsatBreakdown(normalizedData, filters, 'all').ratingBreakdownData,
        },
        feed: {
          title: 'CSAT Report Feed',
          reviews: buildIntercomCsatBreakdown(normalizedData, filters, 'all').feed,
        },
      },
    };
  }

  if (activeTab === 'fin') {
    const metrics = buildIntercomMetricCards(normalizedData, filters, granularity, 'fin');
    const finBreakdown = buildIntercomCsatBreakdown(normalizedData, filters, 'fin');

    return {
      granularity,
      granularityLabel: getGranularityLabel(granularity),
      activeTab,
      activeView: {
        metrics,
        charts: {
          finOutcomeTrendData: buildIntercomFinOutcomeTrend(normalizedData, filters, granularity),
          finCsatTrendData: buildIntercomFinCsatTrend(normalizedData, filters, granularity),
          topFinTopicsData: buildIntercomTopicExplorerData(normalizedData, filters, 'fin'),
          finCsatData: finBreakdown.ratingBreakdownData,
        },
        feed: {
          title: 'Fin AI CSAT Feed',
          reviews: finBreakdown.feed,
        },
      },
    };
  }

  const overview = buildIntercomOverviewSummary(normalizedData, filters, granularity);

  return {
    granularity,
    granularityLabel: getGranularityLabel(granularity),
    activeTab,
    activeView: {
      metrics: overview.metrics,
      charts: {
        overviewTrendData: buildIntercomConversationTrend(normalizedData, filters, granularity),
        topTopicsData: overview.topTopics,
        csatData: overview.csat.ratingBreakdownData,
        topFinTopicsData: overview.topFinTopics,
        channelData: sortDescending(
          countBy(filterStartedAtConversations(normalizedData, filters), (item) => item.channel || 'Unknown')
        ),
      },
    },
  };
};
