import { applyMetricFilters } from '../metrics/filtering.js';
import metricSpecExports from '../metrics/specs.js';
import { buildPreviousPeriodRange, formatDateRangeLabel } from '../metrics/time.js';
import { calculateLearnWorldsMetricSet } from '../learnworlds/specs.js';
import {
  buildExistingCoveragePlaceholder,
  buildInitiativeRecommendation,
  buildInitiativeRuleStatus,
} from './model.js';
import { enrichInitiativesWithCoverage } from './audit.js';

const { calculateMetricSet, NEW_CONVERSATION_PROXY_STARTED_BY } = metricSpecExports;

const INTERCOM_RULE_METRIC_IDS = ['fin_deflection_rate', 'fin_resolution_rate'];
const LEARNWORLDS_RULE_METRIC_IDS = [
  'lw_new_registrations',
  'lw_active_users',
  'lw_most_dropped_out_courses',
];

const TOPIC_KEYWORDS = {
  support_issue: [
    'bug',
    'error',
    'issue',
    'login',
    'access',
    'password',
    'broken',
    'troubleshoot',
    'failure',
  ],
  billing_confusion: [
    'billing',
    'cancel',
    'cancellation',
    'refund',
    'subscription',
    'pricing',
    'payment',
    'invoice',
  ],
};

const PRIORITY_BY_SEVERITY = {
  high: { priority: 'high', suggested_cadence: 'this_week' },
  medium: { priority: 'medium', suggested_cadence: 'this_month' },
  low: { priority: 'low', suggested_cadence: 'backlog' },
};

const CONTENT_PLAYBOOKS = {
  support_issue: {
    suggested_format: 'help_center_article_and_troubleshooting_class',
    relevantSurfaces: ['intercom_help_center', 'learnworlds_class', 'learnworlds_blog'],
    buildTitle: ({ topTopicLabel }) =>
      `${topTopicLabel} needs clearer troubleshooting guidance before volume climbs further`,
    buildAction: ({ topTopicLabel }) =>
      `Update the Help Center troubleshooting article for ${topTopicLabel}, add a short troubleshooting class for repeat blockers, and package the recurring issue pattern for product follow-up.`,
  },
  billing_confusion: {
    suggested_format: 'billing_guidance_refresh',
    relevantSurfaces: ['intercom_help_center', 'learnworlds_blog'],
    buildTitle: ({ topTopicLabel }) =>
      `${topTopicLabel} questions need a cleaner billing decision path`,
    buildAction: ({ topTopicLabel }) =>
      `Refresh the Help Center article for ${topTopicLabel}, publish a short explainer blog or support note for the same flow, and align teammate and Fin escalation guidance to one path.`,
  },
  fin_ai: {
    suggested_format: 'fin_ai_playbook_update',
    relevantSurfaces: ['intercom_help_center'],
    buildTitle: () => 'Fin AI handling needs tighter guidance before performance slips further',
    buildAction: () =>
      'Review Fin AI handling for escalation-heavy flows, tighten escalation guidance, and refresh the linked Help Center decision path for the same customer journey.',
  },
  activation_gap: {
    suggested_format: 'class_or_onboarding_series',
    relevantSurfaces: ['learnworlds_blog', 'learnworlds_class', 'learnworlds_course'],
    buildTitle: () => 'New learners need a faster path from registration into real activity',
    buildAction: () =>
      'Add a quick-start onboarding asset that gets new learners to their first useful class or course quickly, then link support guidance to that same entry point.',
  },
  dropout_watch: {
    suggested_format: 'course_refresh',
    relevantSurfaces: ['learnworlds_blog', 'learnworlds_class', 'learnworlds_course'],
    buildTitle: ({ courseName }) => `Reduce early friction in ${courseName} before more learners stall`,
    buildAction: ({ courseName }) =>
      `Update the early lessons in ${courseName}, add a short recap class for the first stall point, and publish a companion quick-reference asset where learners commonly drop off.`,
  },
};

const normalizeTopicText = (value) => (value || '').toLowerCase();

const getTopicFragments = (item) =>
  [item.topic, item.subtopic]
    .flatMap((value) => (value || '').split(','))
    .map((value) => value.trim())
    .filter(Boolean);

const matchesKeywordSet = (item, keywords) => {
  const combined = normalizeTopicText([item.topic, item.subtopic].filter(Boolean).join(' '));
  return keywords.some((keyword) => combined.includes(keyword));
};

const getComparableFilters = (filters, comparisonGranularity) => {
  const previousRange = buildPreviousPeriodRange(
    filters.startDate,
    filters.endDate,
    comparisonGranularity
  );

  return {
    current: filters,
    previous: previousRange
      ? {
          ...filters,
          startDate: previousRange.startDate,
          endDate: previousRange.endDate,
        }
      : null,
    previousRange,
  };
};

const filterIntercomConversations = (normalizedData, filters) =>
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

const getTopicSignalStats = (items, keywords) => {
  const matchingItems = items.filter((item) => matchesKeywordSet(item, keywords));
  const topicCounts = new Map();

  matchingItems.forEach((item) => {
    getTopicFragments(item).forEach((topic) => {
      const normalized = normalizeTopicText(topic);

      if (!keywords.some((keyword) => normalized.includes(keyword))) {
        return;
      }

      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
    });
  });

  return {
    totalRows: items.length,
    topicRows: items.filter((item) => Boolean(item.topic || item.subtopic)).length,
    matchedRows: matchingItems.length,
    topMatches: [...topicCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count })),
  };
};

const getTopicTrendSeverity = ({ currentValue, previousValue, profile }) => {
  const delta = currentValue - previousValue;
  const baseline = Math.max(previousValue, 1);
  const ratio = currentValue / baseline;

  if (delta <= 0 || currentValue < profile.minimumCurrent || ratio < profile.minimumRatio) {
    return null;
  }

  if (
    currentValue >= profile.high.minimumCurrent &&
    delta >= profile.high.minimumDelta &&
    ratio >= profile.high.minimumRatio
  ) {
    return 'high';
  }

  if (
    currentValue >= profile.medium.minimumCurrent &&
    delta >= profile.medium.minimumDelta &&
    ratio >= profile.medium.minimumRatio
  ) {
    return 'medium';
  }

  if (
    currentValue >= profile.low.minimumCurrent &&
    delta >= profile.low.minimumDelta &&
    ratio >= profile.low.minimumRatio
  ) {
    return 'low';
  }

  return null;
};

const getFinDeclineSeverity = ({ deflectionDelta, resolutionDelta }) => {
  const worstDelta = Math.min(deflectionDelta, resolutionDelta);
  const averageDelta = (deflectionDelta + resolutionDelta) / 2;
  const bothMeaningfullyDown = deflectionDelta <= -3 && resolutionDelta <= -3;

  if ((deflectionDelta <= -8 && resolutionDelta <= -8) || worstDelta <= -10) {
    return 'high';
  }

  if ((deflectionDelta <= -5 && resolutionDelta <= -5) || worstDelta <= -7) {
    return 'medium';
  }

  if (bothMeaningfullyDown && averageDelta <= -3.5) {
    return 'low';
  }

  return null;
};

const getActivationGapSeverity = ({
  registrationsCurrent,
  registrationsPrevious,
  activeUsersCurrent,
  activeUsersPrevious,
}) => {
  const registrationDelta = registrationsCurrent - registrationsPrevious;
  const activeDelta = activeUsersCurrent - activeUsersPrevious;
  const adoptionRatio = registrationsCurrent > 0 ? activeUsersCurrent / registrationsCurrent : 0;

  if (registrationDelta >= 7 && activeDelta <= 0 && adoptionRatio < 0.45) {
    return 'high';
  }

  if (registrationDelta >= 4 && activeDelta <= 1 && adoptionRatio < 0.55) {
    return 'medium';
  }

  if (registrationDelta >= 3 && activeDelta <= registrationDelta - 1 && adoptionRatio < 0.65) {
    return 'low';
  }

  return null;
};

const getDropoutSeverity = (rankingRow) => {
  if (!rankingRow) {
    return null;
  }

  if (
    rankingRow.dropout_rate >= 0.6 &&
    rankingRow.dropout_candidates >= 3 &&
    rankingRow.active_progress_rows >= 4
  ) {
    return 'high';
  }

  if (
    rankingRow.dropout_rate >= 0.4 &&
    rankingRow.dropout_candidates >= 2 &&
    rankingRow.active_progress_rows >= 3
  ) {
    return 'medium';
  }

  if (
    rankingRow.dropout_rate >= 0.3 &&
    rankingRow.dropout_candidates >= 1 &&
    rankingRow.active_progress_rows >= 3
  ) {
    return 'low';
  }

  return null;
};

const buildSourceSignal = ({
  source,
  signal_key,
  label,
  current_value = null,
  previous_value = null,
  delta_value = null,
  unit = null,
  support_state = 'full',
  details = null,
}) => ({
  source,
  signal_key,
  label,
  current_value,
  previous_value,
  delta_value,
  unit,
  support_state,
  details,
});

const buildPriorityState = (severity) => PRIORITY_BY_SEVERITY[severity] ?? PRIORITY_BY_SEVERITY.low;

const createRecommendationId = (ruleId, filters) => `${ruleId}:${filters.startDate}:${filters.endDate}`;

const buildPlaybookRecommendation = (playbookKey, context) => {
  const playbook = CONTENT_PLAYBOOKS[playbookKey];

  return {
    title: playbook.buildTitle(context),
    suggested_action: playbook.buildAction(context),
    suggested_format: playbook.suggested_format,
    existing_coverage: buildExistingCoveragePlaceholder({
      relevantSurfaces: playbook.relevantSurfaces,
    }),
  };
};

const evaluateSupportIssueVolumeRule = ({
  intercomNormalizedData,
  currentFilters,
  previousFilters,
}) => {
  if (!intercomNormalizedData || !previousFilters) {
    return {
      initiative: null,
      status: buildInitiativeRuleStatus({
        rule_id: 'support_issue_volume_rising',
        category: 'Cross-functional / Product',
        support_state: 'stubbed',
        reason: 'This rule needs current and previous Intercom conversation windows to compare support-topic volume.',
      }),
    };
  }

  const currentItems = filterIntercomConversations(intercomNormalizedData, currentFilters);
  const previousItems = filterIntercomConversations(intercomNormalizedData, previousFilters);
  const currentStats = getTopicSignalStats(currentItems, TOPIC_KEYWORDS.support_issue);
  const previousStats = getTopicSignalStats(previousItems, TOPIC_KEYWORDS.support_issue);

  if (currentStats.topicRows === 0 && previousStats.topicRows === 0) {
    return {
      initiative: null,
      status: buildInitiativeRuleStatus({
        rule_id: 'support_issue_volume_rising',
        category: 'Cross-functional / Product',
        support_state: 'stubbed',
        reason: 'Topic classification is not currently available for support-issue detection on this Intercom dataset.',
      }),
    };
  }

  const severity = getTopicTrendSeverity({
    currentValue: currentStats.matchedRows,
    previousValue: previousStats.matchedRows,
    profile: {
      minimumCurrent: 3,
      minimumRatio: 1.35,
      high: { minimumCurrent: 8, minimumDelta: 4, minimumRatio: 1.8 },
      medium: { minimumCurrent: 5, minimumDelta: 3, minimumRatio: 1.5 },
      low: { minimumCurrent: 3, minimumDelta: 2, minimumRatio: 1.35 },
    },
  });

  if (!severity) {
    return {
      initiative: null,
      status: buildInitiativeRuleStatus({
        rule_id: 'support_issue_volume_rising',
        category: 'Cross-functional / Product',
        support_state: 'partial',
        reason: 'Support-issue topic volume is not rising enough in the current period to recommend a new initiative.',
      }),
    };
  }

  const priorityState = buildPriorityState(severity);
  const topTopicLabel = currentStats.topMatches[0]?.name ?? 'support issue topics';
  const recommendation = buildPlaybookRecommendation('support_issue', { topTopicLabel });

  const initiative = buildInitiativeRecommendation({
    initiative_id: createRecommendationId('support_issue_volume_rising', currentFilters),
    title: recommendation.title,
    signal_detected: `${topTopicLabel} and related support topics are rising versus the previous comparable period.`,
    signal_type: 'topic_volume_rising',
    owner_area: 'Cross-functional / Product',
    suggested_action: recommendation.suggested_action,
    suggested_format: recommendation.suggested_format,
    existing_coverage: recommendation.existing_coverage,
    suggested_cadence: priorityState.suggested_cadence,
    priority: priorityState.priority,
    why_this_surfaced: `${currentStats.matchedRows} matching support-topic conversations were found in the selected period versus ${previousStats.matchedRows} in the previous comparable period.`,
    source_signals: [
      buildSourceSignal({
        source: 'intercom_topics',
        signal_key: 'support_issue_topic_volume',
        label: 'Support-issue topic volume',
        current_value: currentStats.matchedRows,
        previous_value: previousStats.matchedRows,
        delta_value: currentStats.matchedRows - previousStats.matchedRows,
        unit: 'conversations',
        support_state: 'partial',
        details: {
          top_matches: currentStats.topMatches,
        },
      }),
    ],
    support_state: 'partial',
  });

  return {
    initiative,
    status: buildInitiativeRuleStatus({
      rule_id: 'support_issue_volume_rising',
      category: 'Cross-functional / Product',
      support_state: 'partial',
      triggered: true,
      recommendation_id: initiative.initiative_id,
      reason: 'Support-topic classification is available and shows a rising issue cluster.',
    }),
  };
};

const evaluateBillingConfusionRule = ({
  intercomNormalizedData,
  currentFilters,
  previousFilters,
}) => {
  if (!intercomNormalizedData || !previousFilters) {
    return {
      initiative: null,
      status: buildInitiativeRuleStatus({
        rule_id: 'billing_confusion_rising',
        category: 'Help Center',
        support_state: 'stubbed',
        reason: 'This rule needs current and previous Intercom conversation windows to compare billing-topic volume.',
      }),
    };
  }

  const currentItems = filterIntercomConversations(intercomNormalizedData, currentFilters);
  const previousItems = filterIntercomConversations(intercomNormalizedData, previousFilters);
  const currentStats = getTopicSignalStats(currentItems, TOPIC_KEYWORDS.billing_confusion);
  const previousStats = getTopicSignalStats(previousItems, TOPIC_KEYWORDS.billing_confusion);

  if (currentStats.topicRows === 0 && previousStats.topicRows === 0) {
    return {
      initiative: null,
      status: buildInitiativeRuleStatus({
        rule_id: 'billing_confusion_rising',
        category: 'Help Center',
        support_state: 'stubbed',
        reason: 'Topic classification is not currently available for billing or cancellation detection on this Intercom dataset.',
      }),
    };
  }

  const severity = getTopicTrendSeverity({
    currentValue: currentStats.matchedRows,
    previousValue: previousStats.matchedRows,
    profile: {
      minimumCurrent: 3,
      minimumRatio: 1.2,
      high: { minimumCurrent: 8, minimumDelta: 4, minimumRatio: 1.75 },
      medium: { minimumCurrent: 5, minimumDelta: 3, minimumRatio: 1.4 },
      low: { minimumCurrent: 3, minimumDelta: 2, minimumRatio: 1.2 },
    },
  });

  if (!severity) {
    return {
      initiative: null,
      status: buildInitiativeRuleStatus({
        rule_id: 'billing_confusion_rising',
        category: 'Help Center',
        support_state: 'partial',
        reason: 'Billing and cancellation topics are not rising enough in the current period to recommend a new initiative.',
      }),
    };
  }

  const priorityState = buildPriorityState(severity);
  const topTopicLabel = currentStats.topMatches[0]?.name ?? 'billing and cancellation';
  const recommendation = buildPlaybookRecommendation('billing_confusion', { topTopicLabel });
  const initiative = buildInitiativeRecommendation({
    initiative_id: createRecommendationId('billing_confusion_rising', currentFilters),
    title: recommendation.title,
    signal_detected: 'Billing, subscription, or cancellation questions are rising versus the previous comparable period.',
    signal_type: 'topic_volume_rising',
    owner_area: 'Help Center',
    suggested_action: recommendation.suggested_action,
    suggested_format: recommendation.suggested_format,
    existing_coverage: recommendation.existing_coverage,
    suggested_cadence: priorityState.suggested_cadence,
    priority: priorityState.priority,
    why_this_surfaced: `${currentStats.matchedRows} billing-themed conversations were found in the selected period versus ${previousStats.matchedRows} in the previous comparable period.`,
    source_signals: [
      buildSourceSignal({
        source: 'intercom_topics',
        signal_key: 'billing_confusion_topic_volume',
        label: 'Billing and cancellation topic volume',
        current_value: currentStats.matchedRows,
        previous_value: previousStats.matchedRows,
        delta_value: currentStats.matchedRows - previousStats.matchedRows,
        unit: 'conversations',
        support_state: 'partial',
        details: {
          top_matches: currentStats.topMatches,
        },
      }),
    ],
    support_state: 'partial',
  });

  return {
    initiative,
    status: buildInitiativeRuleStatus({
      rule_id: 'billing_confusion_rising',
      category: 'Help Center',
      support_state: 'partial',
      triggered: true,
      recommendation_id: initiative.initiative_id,
      reason: 'Billing-oriented topic classification is available and shows a rising question cluster.',
    }),
  };
};

const evaluateFinAiRule = ({ intercomMetrics, previousIntercomMetrics, currentFilters }) => {
  if (!intercomMetrics || !previousIntercomMetrics) {
    return {
      initiative: null,
      status: buildInitiativeRuleStatus({
        rule_id: 'fin_ai_performance_worsening',
        category: 'Fin AI Optimization',
        support_state: 'stubbed',
        reason: 'This rule needs current and previous Fin AI performance metrics to compare deflection and resolution changes.',
      }),
    };
  }

  const deflectionDelta =
    intercomMetrics.fin_deflection_rate.value - previousIntercomMetrics.fin_deflection_rate.value;
  const resolutionDelta =
    intercomMetrics.fin_resolution_rate.value - previousIntercomMetrics.fin_resolution_rate.value;
  const severity = getFinDeclineSeverity({ deflectionDelta, resolutionDelta });

  if (!severity) {
    return {
      initiative: null,
      status: buildInitiativeRuleStatus({
        rule_id: 'fin_ai_performance_worsening',
        category: 'Fin AI Optimization',
        support_state: 'full',
        reason: 'Fin AI deflection and resolution are not worsening enough in the current period to recommend a new initiative.',
      }),
    };
  }

  const priorityState = buildPriorityState(severity);
  const recommendation = buildPlaybookRecommendation('fin_ai', {});
  const initiative = buildInitiativeRecommendation({
    initiative_id: createRecommendationId('fin_ai_performance_worsening', currentFilters),
    title: recommendation.title,
    signal_detected: 'Fin AI deflection and resolution have both weakened versus the previous comparable period.',
    signal_type: 'metric_decline',
    owner_area: 'Fin AI Optimization',
    suggested_action: recommendation.suggested_action,
    suggested_format: recommendation.suggested_format,
    existing_coverage: recommendation.existing_coverage,
    suggested_cadence: priorityState.suggested_cadence,
    priority: priorityState.priority,
    why_this_surfaced: `Fin AI deflection moved from ${previousIntercomMetrics.fin_deflection_rate.displayValue} to ${intercomMetrics.fin_deflection_rate.displayValue}, while resolution moved from ${previousIntercomMetrics.fin_resolution_rate.displayValue} to ${intercomMetrics.fin_resolution_rate.displayValue}.`,
    source_signals: [
      buildSourceSignal({
        source: 'intercom_metrics',
        signal_key: 'fin_deflection_rate',
        label: 'Fin AI Agent Deflection Rate',
        current_value: intercomMetrics.fin_deflection_rate.value,
        previous_value: previousIntercomMetrics.fin_deflection_rate.value,
        delta_value: Number(deflectionDelta.toFixed(1)),
        unit: 'percentage_points',
        support_state: intercomMetrics.fin_deflection_rate.supportLevel,
      }),
      buildSourceSignal({
        source: 'intercom_metrics',
        signal_key: 'fin_resolution_rate',
        label: 'Fin AI Agent Resolution Rate',
        current_value: intercomMetrics.fin_resolution_rate.value,
        previous_value: previousIntercomMetrics.fin_resolution_rate.value,
        delta_value: Number(resolutionDelta.toFixed(1)),
        unit: 'percentage_points',
        support_state: intercomMetrics.fin_resolution_rate.supportLevel,
      }),
    ],
    support_state: 'full',
  });

  return {
    initiative,
    status: buildInitiativeRuleStatus({
      rule_id: 'fin_ai_performance_worsening',
      category: 'Fin AI Optimization',
      support_state: 'full',
      triggered: true,
      recommendation_id: initiative.initiative_id,
      reason: 'Fin AI denominator metrics are fully supported and show a meaningful decline.',
    }),
  };
};

const evaluateEducationActivationRule = ({
  learnWorldsMetrics,
  previousLearnWorldsMetrics,
  currentFilters,
}) => {
  if (!learnWorldsMetrics || !previousLearnWorldsMetrics) {
    return {
      initiative: null,
      status: buildInitiativeRuleStatus({
        rule_id: 'registrations_rise_active_users_lag',
        category: 'Education / Threecolts University',
        support_state: 'stubbed',
        reason: 'This rule needs current and previous LearnWorlds registration and activity metrics.',
      }),
    };
  }

  if (learnWorldsMetrics.lw_active_users.supportState === 'blocked') {
    return {
      initiative: null,
      status: buildInitiativeRuleStatus({
        rule_id: 'registrations_rise_active_users_lag',
        category: 'Education / Threecolts University',
        support_state: 'stubbed',
        reason: 'Active-user timestamps are not available enough to compare learner activation reliably yet.',
      }),
    };
  }

  const registrationsCurrent = learnWorldsMetrics.lw_new_registrations.value;
  const registrationsPrevious = previousLearnWorldsMetrics.lw_new_registrations.value;
  const activeUsersCurrent = learnWorldsMetrics.lw_active_users.value;
  const activeUsersPrevious = previousLearnWorldsMetrics.lw_active_users.value;
  const severity = getActivationGapSeverity({
    registrationsCurrent,
    registrationsPrevious,
    activeUsersCurrent,
    activeUsersPrevious,
  });

  if (!severity) {
    return {
      initiative: null,
      status: buildInitiativeRuleStatus({
        rule_id: 'registrations_rise_active_users_lag',
        category: 'Education / Threecolts University',
        support_state: learnWorldsMetrics.lw_active_users.supportState,
        reason: 'Registrations are not currently outpacing learner activity enough to recommend an onboarding initiative.',
      }),
    };
  }

  const priorityState = buildPriorityState(severity);
  const supportState =
    learnWorldsMetrics.lw_active_users.supportState === 'full' ? 'full' : 'partial';
  const recommendation = buildPlaybookRecommendation('activation_gap', {});
  const initiative = buildInitiativeRecommendation({
    initiative_id: createRecommendationId('registrations_rise_active_users_lag', currentFilters),
    title: recommendation.title,
    signal_detected: 'Registrations are rising faster than dated learner activity in Threecolts University.',
    signal_type: 'activation_gap',
    owner_area: 'Education / Threecolts University',
    suggested_action: recommendation.suggested_action,
    suggested_format: recommendation.suggested_format,
    existing_coverage: recommendation.existing_coverage,
    suggested_cadence: priorityState.suggested_cadence,
    priority: priorityState.priority,
    why_this_surfaced: `${registrationsCurrent} new registrations were recorded in the selected period versus ${registrationsPrevious} previously, while active users moved from ${activeUsersPrevious} to ${activeUsersCurrent}.`,
    source_signals: [
      buildSourceSignal({
        source: 'learnworlds_metrics',
        signal_key: 'lw_new_registrations',
        label: 'New registrations',
        current_value: registrationsCurrent,
        previous_value: registrationsPrevious,
        delta_value: registrationsCurrent - registrationsPrevious,
        unit: 'users',
        support_state: learnWorldsMetrics.lw_new_registrations.supportState,
      }),
      buildSourceSignal({
        source: 'learnworlds_metrics',
        signal_key: 'lw_active_users',
        label: 'Active users',
        current_value: activeUsersCurrent,
        previous_value: activeUsersPrevious,
        delta_value: activeUsersCurrent - activeUsersPrevious,
        unit: 'users',
        support_state: learnWorldsMetrics.lw_active_users.supportState,
      }),
    ],
    support_state: supportState,
  });

  return {
    initiative,
    status: buildInitiativeRuleStatus({
      rule_id: 'registrations_rise_active_users_lag',
      category: 'Education / Threecolts University',
      support_state: supportState,
      triggered: true,
      recommendation_id: initiative.initiative_id,
      reason: 'Registrations and activity are both available, and the onboarding gap is wide enough to action.',
    }),
  };
};

const evaluateDropoutRule = ({ learnWorldsMetrics, currentFilters }) => {
  if (!learnWorldsMetrics) {
    return {
      initiative: null,
      status: buildInitiativeRuleStatus({
        rule_id: 'course_dropout_watch',
        category: 'Education / Threecolts University',
        support_state: 'stubbed',
        reason: 'This rule needs the LearnWorlds dropout ranking metric.',
      }),
    };
  }

  const dropoutMetric = learnWorldsMetrics.lw_most_dropped_out_courses;

  if (dropoutMetric.supportState === 'blocked' || dropoutMetric.ranking.length === 0) {
    return {
      initiative: null,
      status: buildInitiativeRuleStatus({
        rule_id: 'course_dropout_watch',
        category: 'Education / Threecolts University',
        support_state: 'stubbed',
        reason:
          dropoutMetric.limitations[0] ||
          'Current LearnWorlds data does not provide enough enrollment-progress overlap to rank dropout candidates yet.',
      }),
    };
  }

  const topCourse = dropoutMetric.ranking[0];
  const severity = getDropoutSeverity(topCourse);

  if (!severity) {
    return {
      initiative: null,
      status: buildInitiativeRuleStatus({
        rule_id: 'course_dropout_watch',
        category: 'Education / Threecolts University',
        support_state: dropoutMetric.supportState,
        reason: 'Dropout proxy signals are available, but the current course cohort does not cross the action threshold.',
      }),
    };
  }

  const priorityState = buildPriorityState(severity);
  const recommendation = buildPlaybookRecommendation('dropout_watch', {
    courseName: topCourse.course_name,
  });
  const initiative = buildInitiativeRecommendation({
    initiative_id: createRecommendationId('course_dropout_watch', currentFilters),
    title: recommendation.title,
    signal_detected: `${topCourse.course_name} is leading the current dropout watchlist.`,
    signal_type: 'dropout_proxy',
    owner_area: 'Education / Threecolts University',
    suggested_action: recommendation.suggested_action,
    suggested_format: recommendation.suggested_format,
    existing_coverage: recommendation.existing_coverage,
    suggested_cadence: priorityState.suggested_cadence,
    priority: priorityState.priority,
    why_this_surfaced: `${topCourse.course_name} currently shows a ${Math.round(topCourse.dropout_rate * 100)}% dropout proxy rate across ${topCourse.active_progress_rows} matched progress rows in the selected enrollment cohort.`,
    source_signals: [
      buildSourceSignal({
        source: 'learnworlds_metrics',
        signal_key: 'lw_most_dropped_out_courses',
        label: 'Most dropped out courses',
        current_value: topCourse.dropout_rate,
        previous_value: null,
        delta_value: null,
        unit: 'rate',
        support_state: dropoutMetric.supportState,
        details: {
          course_id: topCourse.course_id,
          course_name: topCourse.course_name,
          dropout_candidates: topCourse.dropout_candidates,
          active_progress_rows: topCourse.active_progress_rows,
        },
      }),
    ],
    support_state: 'partial',
  });

  return {
    initiative,
    status: buildInitiativeRuleStatus({
      rule_id: 'course_dropout_watch',
      category: 'Education / Threecolts University',
      support_state: 'partial',
      triggered: true,
      recommendation_id: initiative.initiative_id,
      reason: 'The dropout proxy is available and the leading course crosses the current action threshold.',
    }),
  };
};

const evaluateSupportQualityStubRule = () => ({
  initiative: null,
  status: buildInitiativeRuleStatus({
    rule_id: 'support_quality_generic_response',
    category: 'Support Quality',
    support_state: 'stubbed',
    reason:
      'Current datasets do not yet expose complaint taxonomy, QA tagging, or generic-response flags strongly enough to trigger a support-quality initiative reliably.',
  }),
});

const buildSummary = (initiatives, ruleStatuses) => ({
  total_initiatives: initiatives.length,
  priorities: initiatives.reduce((accumulator, initiative) => {
    accumulator[initiative.priority] = (accumulator[initiative.priority] || 0) + 1;
    return accumulator;
  }, {}),
  owner_areas: initiatives.reduce((accumulator, initiative) => {
    accumulator[initiative.owner_area] = (accumulator[initiative.owner_area] || 0) + 1;
    return accumulator;
  }, {}),
  supported_rules: ruleStatuses.filter((rule) => rule.support_state !== 'stubbed').length,
  stubbed_rules: ruleStatuses.filter((rule) => rule.support_state === 'stubbed').length,
});

export const buildInitiativeRecommendations = ({
  intercomNormalizedData = null,
  intercomSourceMeta = null,
  learnWorldsNormalizedData = null,
  learnWorldsSourceMeta = null,
  filters,
  comparisonGranularity = 'monthly',
}) => {
  const { current, previous, previousRange } = getComparableFilters(filters, comparisonGranularity);

  const intercomMetrics = intercomNormalizedData
    ? calculateMetricSet(intercomNormalizedData, current, INTERCOM_RULE_METRIC_IDS)
    : null;
  const previousIntercomMetrics =
    intercomNormalizedData && previous
      ? calculateMetricSet(intercomNormalizedData, previous, INTERCOM_RULE_METRIC_IDS)
      : null;

  const learnWorldsMetrics = learnWorldsNormalizedData
    ? calculateLearnWorldsMetricSet(learnWorldsNormalizedData, current, LEARNWORLDS_RULE_METRIC_IDS)
    : null;
  const previousLearnWorldsMetrics =
    learnWorldsNormalizedData && previous
      ? calculateLearnWorldsMetricSet(
          learnWorldsNormalizedData,
          previous,
          LEARNWORLDS_RULE_METRIC_IDS
        )
      : null;

  const ruleResults = [
    evaluateSupportIssueVolumeRule({
      intercomNormalizedData,
      currentFilters: current,
      previousFilters: previous,
    }),
    evaluateBillingConfusionRule({
      intercomNormalizedData,
      currentFilters: current,
      previousFilters: previous,
    }),
    evaluateFinAiRule({
      intercomMetrics,
      previousIntercomMetrics,
      currentFilters: current,
    }),
    evaluateEducationActivationRule({
      learnWorldsMetrics,
      previousLearnWorldsMetrics,
      currentFilters: current,
    }),
    evaluateDropoutRule({
      learnWorldsMetrics,
      currentFilters: current,
    }),
    evaluateSupportQualityStubRule(),
  ];

  const initiatives = enrichInitiativesWithCoverage({
    initiatives: ruleResults.map((result) => result.initiative).filter(Boolean),
    intercomSourceMeta,
    learnWorldsNormalizedData,
    learnWorldsSourceMeta,
  });
  const ruleStatuses = ruleResults.map((result) => result.status);

  return {
    generated_at: new Date().toISOString(),
    comparison_period:
      previousRange && previous
        ? {
            current: formatDateRangeLabel(current.startDate, current.endDate),
            previous: formatDateRangeLabel(previous.startDate, previous.endDate),
            granularity: comparisonGranularity,
          }
        : null,
    initiatives,
    rule_statuses: ruleStatuses,
    summary: buildSummary(initiatives, ruleStatuses),
  };
};
