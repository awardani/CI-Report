import { applyMetricFilters } from './filtering.js';
import metricSpecExports from './specs.js';
import {
  buildPreviousPeriodRange,
  formatDateRangeLabel,
  getGranularityLabel,
  listBucketsInRange,
} from './time.js';
import { inferReportPeriodGranularity } from '../utils/reportPeriod.js';

const {
  calculateMetricSet,
  metricSpecsById,
  NEW_CONVERSATION_PROXY_STARTED_BY,
} = metricSpecExports;

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
const GENERIC_TOPIC_LABELS = new Set(['customer ticket', 'support request']);
const RESOLVED_FIN_FLOW_STATES = new Set(['Confirmed resolved', 'Assumed resolved']);
const TOPIC_FALLBACK_RULES = [
  {
    label: 'Billing & cancellations',
    keywords: ['billing', 'cancel', 'cancellation', 'refund', 'subscription', 'payment', 'invoice', 'pricing'],
  },
  {
    label: 'Troubleshooting',
    keywords: ['bug', 'error', 'issue', 'login', 'password', 'access', 'broken', 'troubleshoot', 'not working', 'fail'],
  },
  {
    label: 'Amazon operations',
    keywords: ['amazon', 'asin', 'fba', 'listing', 'seller central', 'sku', 'inventory'],
  },
  {
    label: 'InventoryLab',
    keywords: ['inventorylab', 'inventory lab'],
  },
  {
    label: 'ScoutIQ',
    keywords: ['scoutiq', 'scout iq'],
  },
  {
    label: 'Tactical Arbitrage',
    keywords: ['tactical arbitrage'],
  },
  {
    label: 'SmartRepricer',
    keywords: ['smartrepricer', 'smart repricer', 'repricer'],
  },
  {
    label: 'FeedbackWhiz',
    keywords: ['feedbackwhiz', 'feedback whiz'],
  },
  {
    label: 'SellerRunning',
    keywords: ['sellerrunning', 'seller running'],
  },
  {
    label: 'Onboarding & setup',
    keywords: ['onboarding', 'setup', 'set up', 'quick start', 'getting started', 'connect', 'integration', 'install'],
  },
];

const splitTopics = (value) =>
  (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const hasTopicFields = (items) =>
  items.some((item) => Boolean(item.topic || item.subtopic));

const splitListValues = (value) =>
  (value || '')
    .split(/[,\n|]/)
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeForMatch = (value) => String(value || '').toLowerCase();

const deriveFallbackTopics = (item) => {
  const structuredCandidates = [
    ...splitListValues(item.topic),
    ...splitListValues(item.subtopic),
    ...splitListValues(item.ticket_category),
    ...splitListValues(item.conversation_tag),
    ...splitListValues(item.ticket_type),
  ]
    .filter(Boolean)
    .filter((candidate) => !GENERIC_TOPIC_LABELS.has(normalizeForMatch(candidate)));

  if (structuredCandidates.length > 0) {
    return {
      topics: [...new Set(structuredCandidates)],
      source: item.topic || item.subtopic ? 'native_topic' : 'structured_fallback',
    };
  }

  const textHaystack = normalizeForMatch(
    [item.title, item.ai_issue_summary, item.conversation_source].filter(Boolean).join(' ')
  );

  if (!textHaystack) {
    return {
      topics: [],
      source: 'none',
    };
  }

  const matchedRules = TOPIC_FALLBACK_RULES.filter((rule) =>
    rule.keywords.some((keyword) => textHaystack.includes(keyword))
  ).map((rule) => rule.label);

  return {
    topics: [...new Set(matchedRules)],
    source: matchedRules.length > 0 ? 'keyword_fallback' : 'none',
  };
};

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

const cleanSummaryText = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[.]+$/g, '')
    .trim();

const formatClusterSummary = (issueSummaries = [], subtopics = []) => {
  const topSummaries = issueSummaries
    .map((entry) => cleanSummaryText(entry.name))
    .filter(Boolean)
    .slice(0, 3);

  if (topSummaries.length > 1) {
    const joined = topSummaries.join('; ');
    return `Most tickets in this topic mention: ${joined}.`;
  }

  if (topSummaries.length === 1) {
    return `Most tickets in this topic mention: ${topSummaries[0]}.`;
  }

  const topSubtopics = subtopics
    .map((entry) => cleanSummaryText(entry.name))
    .filter(Boolean)
    .slice(0, 3);

  if (topSubtopics.length > 0) {
    return `This topic mainly covers ${topSubtopics.join(', ')}.`;
  }

  return null;
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

const filterAllConversations = (normalizedData, filters) =>
  applyMetricFilters(normalizedData.conversations, filters, {
    timestampField: 'started_at',
    teamField: 'team_name',
    teammateFields: ['teammate_name'],
  }).items;

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
    const derived = deriveFallbackTopics(item);

    derived.topics.forEach((topicName) => {
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
        sources: new Map(),
        issueSummaries: new Map(),
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

      if (item.ai_issue_summary) {
        current.issueSummaries.set(
          item.ai_issue_summary,
          (current.issueSummaries.get(item.ai_issue_summary) || 0) + 1
        );
      } else if (item.title) {
        current.issueSummaries.set(item.title, (current.issueSummaries.get(item.title) || 0) + 1);
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

      current.sources.set(derived.source, (current.sources.get(derived.source) || 0) + 1);

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
      topicSources: [...entry.sources.entries()]
        .sort((left, right) => right[1] - left[1])
        .map(([name, count]) => ({ name, count })),
      issueSummaries: [...entry.issueSummaries.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count })),
    }))
    .map((entry) => ({
      ...entry,
      issueSummary: formatClusterSummary(entry.issueSummaries, entry.subtopics),
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

export const getIntercomTopicAvailability = (
  normalizedData,
  filters,
  variant = 'all'
) => {
  const items =
    variant === 'fin'
      ? filterFinOutcomes(normalizedData, filters)
      : filterStartedAtConversations(normalizedData, filters);

  return {
    hasRows: items.length > 0,
    hasTopicData: items.some((item) => deriveFallbackTopics(item).topics.length > 0),
  };
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

const bucketConversationState = (value) => {
  const normalized = String(value || '').trim().toLowerCase();

  if (!normalized) {
    return 'Open / in progress';
  }

  if (normalized.includes('closed')) {
    return 'Closed';
  }

  if (normalized.includes('pending') || normalized.includes('snooz')) {
    return 'Pending';
  }

  if (normalized.includes('open')) {
    return 'Open / in progress';
  }

  return 'Open / in progress';
};

const buildFlowNodeLabel = (label, value, total) => {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  return `${label} • ${value.toLocaleString()} (${percentage}%)`;
};

const buildFlowNodeChange = (currentValue, previousValue) => {
  if (!Number.isFinite(previousValue) || previousValue <= 0) {
    return null;
  }

  const deltaPercent = ((currentValue - previousValue) / previousValue) * 100;
  const rounded = Math.round(deltaPercent);
  const sign = rounded > 0 ? '+' : '';

  return {
    deltaPercent,
    label: `${sign}${rounded}% vs prev`,
  };
};

const categorizeConversationFlow = (conversations) => {
  const finInvolvedItems = conversations.filter((item) => item.fin_involved);
  const noFinItems = conversations.filter((item) => !item.fin_involved);
  const finResolvedItems = finInvolvedItems.filter((item) => RESOLVED_FIN_FLOW_STATES.has(item.fin_resolution_state));
  const finEscalatedItems = finInvolvedItems.filter((item) => item.fin_resolution_state === 'Escalated');
  const finOpenItems = finInvolvedItems.filter(
    (item) => !RESOLVED_FIN_FLOW_STATES.has(item.fin_resolution_state) && item.fin_resolution_state !== 'Escalated'
  );
  const closedItems = noFinItems.filter((item) => bucketConversationState(item.current_state) === 'Closed');
  const pendingItems = noFinItems.filter((item) => bucketConversationState(item.current_state) === 'Pending');
  const openItems = noFinItems.filter((item) => bucketConversationState(item.current_state) === 'Open / in progress');

  return {
    total: conversations.length,
    finInvolvedItems,
    noFinItems,
    finResolvedItems,
    finEscalatedItems,
    finOpenItems,
    closedItems,
    pendingItems,
    openItems,
  };
};

export const inferIntercomTrendGranularity = (filters) => {
  return inferReportPeriodGranularity(filters);
};

export const buildIntercomConversationFlow = (normalizedData, filters) => {
  const conversations = filterAllConversations(normalizedData, filters);
  const grouped = categorizeConversationFlow(conversations);
  const total = grouped.total;
  const flowGranularity = inferIntercomTrendGranularity(filters);

  const previousRange = buildPreviousPeriodRange(
    filters.startDate,
    filters.endDate,
    flowGranularity
  );
  const previousFilters = previousRange
    ? {
        ...filters,
        startDate: previousRange.startDate,
        endDate: previousRange.endDate,
      }
    : null;
  const previousGrouped = previousFilters
    ? categorizeConversationFlow(filterAllConversations(normalizedData, previousFilters))
    : null;

  if (total === 0) {
    return {
      total: 0,
      nodes: [],
      links: [],
      note: 'No conversations match the selected reporting period.',
      stagesUsed: [],
    };
  }

  const nodes = [
    {
      id: 'total',
      label: 'Total conversations',
      value: total,
      displayLabel: buildFlowNodeLabel('Total conversations', total, total),
      stage: 0,
    },
    {
      id: 'fin_involved',
      label: 'Fin AI involved',
      value: grouped.finInvolvedItems.length,
      displayLabel: buildFlowNodeLabel('Fin AI involved', grouped.finInvolvedItems.length, total),
      stage: 1,
    },
    {
      id: 'no_fin',
      label: 'No Fin AI',
      value: grouped.noFinItems.length,
      displayLabel: buildFlowNodeLabel('No Fin AI', grouped.noFinItems.length, total),
      stage: 1,
    },
  ];

  const links = [
    { source: 0, target: 1, value: grouped.finInvolvedItems.length },
    { source: 0, target: 2, value: grouped.noFinItems.length },
  ];

  const appendNode = (parentIndex, nodeId, label, items, previousValue, meta = {}) => {
    if (!items.length) {
      return;
    }

    const change = buildFlowNodeChange(items.length, previousValue);
    const nodeIndex = nodes.length;
    nodes.push({
      id: nodeId,
      label,
      value: items.length,
      displayLabel: buildFlowNodeLabel(label, items.length, total),
      stage: 2,
      change,
      status: meta.status || 'neutral',
      insight: meta.insight || '',
    });
    links.push({
      source: parentIndex,
      target: nodeIndex,
      value: items.length,
    });
  };

  const finResolvedShare = grouped.finInvolvedItems.length > 0
    ? grouped.finResolvedItems.length / grouped.finInvolvedItems.length
    : 0;
  const finEscalatedShare = grouped.finInvolvedItems.length > 0
    ? grouped.finEscalatedItems.length / grouped.finInvolvedItems.length
    : 0;
  const openShare = grouped.noFinItems.length > 0
    ? grouped.openItems.length / grouped.noFinItems.length
    : 0;
  const pendingShare = grouped.noFinItems.length > 0
    ? grouped.pendingItems.length / grouped.noFinItems.length
    : 0;
  const finOpenShare = grouped.finInvolvedItems.length > 0
    ? grouped.finOpenItems.length / grouped.finInvolvedItems.length
    : 0;

  appendNode(
    1,
    'fin_resolved',
    'Fin resolved',
    grouped.finResolvedItems,
    previousGrouped?.finResolvedItems.length ?? 0,
    {
      status: finResolvedShare < 0.55 ? 'warning' : 'good',
      insight: finResolvedShare < 0.55 ? 'Low resolution share' : 'Healthy resolution share',
    }
  );
  appendNode(
    1,
    'fin_escalated',
    'Fin escalated',
    grouped.finEscalatedItems,
    previousGrouped?.finEscalatedItems.length ?? 0,
    {
      status: finEscalatedShare >= 0.35 ? 'warning' : 'neutral',
      insight: finEscalatedShare >= 0.35 ? 'High escalation share' : '',
    }
  );
  appendNode(
    1,
    'fin_open',
    'Fin still open',
    grouped.finOpenItems,
    previousGrouped?.finOpenItems.length ?? 0,
    {
      status: finOpenShare >= 0.25 ? 'warning' : 'neutral',
      insight: finOpenShare >= 0.25 ? 'High unresolved Fin volume' : '',
    }
  );

  appendNode(
    2,
    'non_fin_closed',
    'Closed',
    grouped.closedItems,
    previousGrouped?.closedItems.length ?? 0,
    { status: 'good' }
  );
  appendNode(
    2,
    'non_fin_open',
    'Open / in progress',
    grouped.openItems,
    previousGrouped?.openItems.length ?? 0,
    {
      status: openShare >= 0.22 ? 'warning' : 'neutral',
      insight: openShare >= 0.22 ? 'High open volume' : '',
    }
  );
  appendNode(
    2,
    'non_fin_pending',
    'Pending',
    grouped.pendingItems,
    previousGrouped?.pendingItems.length ?? 0,
    {
      status: pendingShare >= 0.18 ? 'warning' : 'neutral',
      insight: pendingShare >= 0.18 ? 'High pending volume' : '',
    }
  );

  return {
    total,
    nodes,
    links,
      note:
      'Flow uses supported states only: Fin AI involvement, Fin resolution state, and current conversation state.',
    stagesUsed: [
      'Total conversations',
      'Fin AI involved / No Fin AI',
      'Fin resolved / escalated / still open or conversation state',
    ],
  };
};

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
