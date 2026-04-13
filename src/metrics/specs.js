import { applyMetricFilters } from './filtering.js';

export const NEW_CONVERSATION_PROXY_STARTED_BY = new Set([
  'Customer',
  'Reply to Workflow/Message',
]);

const POSITIVE_RATING_VALUES = new Set([4, 5]);
const RESOLVED_FIN_STATES = new Set(['Assumed resolved', 'Confirmed resolved']);

const percentage = (numerator, denominator) => {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
};

const formatCount = (value) => value.toLocaleString();
const formatPercentage = (value) => `${value.toFixed(1)}%`;

const buildMetricResult = ({
  id,
  label,
  numerator,
  denominator = null,
  timestampField,
  filterMetadata,
  supportLevel,
  assumptions = [],
  limitations = [],
  tooltip,
  valueType,
  contextLabel = null,
}) => {
  const value = denominator === null ? numerator : percentage(numerator, denominator);

  return {
    id,
    label,
    numerator,
    denominator,
    value,
    displayValue: denominator === null ? formatCount(value) : formatPercentage(value),
    timestampField,
    filterMetadata,
    supportLevel,
    assumptions,
    limitations,
    tooltip,
    valueType,
    contextLabel,
  };
};

const selectProxyEligibleConversations = (normalizedData) =>
  normalizedData.conversations.filter((conversation) =>
    NEW_CONVERSATION_PROXY_STARTED_BY.has(conversation.started_by)
  );

const filterStartedAtMetric = (items, filters) =>
  applyMetricFilters(items, filters, {
    timestampField: 'started_at',
    teamField: 'team_name',
    teammateFields: ['teammate_name'],
  });

const filterOverallCsatRatings = (items, filters) =>
  applyMetricFilters(items, filters, {
    timestampField: 'rated_at',
    teamField: 'team_name',
    teammateFields: ['teammate_name'],
  });

const filterTeammateCsatRatings = (items, filters) =>
  applyMetricFilters(items, filters, {
    timestampField: 'rated_at',
    teamField: 'team_name',
    teammateFields: ['rated_teammate_name', 'teammate_name'],
  });

export const metricSpecs = [
  {
    id: 'new_conversations',
    label: 'New Conversations',
    valueType: 'count',
    tooltip: {
      meaning: 'Number of new inbound and outbound conversations.',
      formula: 'Uses the current proxy rule based on conversation start.',
      caveat: 'Proxy-based.',
    },
    calculate(normalizedData, filters) {
      const { items, metadata } = filterStartedAtMetric(
        selectProxyEligibleConversations(normalizedData),
        filters
      );

      return buildMetricResult({
        id: this.id,
        label: this.label,
        numerator: items.length,
        timestampField: 'started_at',
        filterMetadata: metadata,
        supportLevel: 'partial',
        assumptions: [
          'Proxy rule: treat Conversation started at as the best available timestamp for first customer message received.',
          'Proxy rule: include conversations started by Customer or Reply to Workflow/Message.',
        ],
        limitations: [
          'This metric is still proxy-based because the exports do not expose an explicit first customer message timestamp.',
        ],
        tooltip: this.tooltip,
        valueType: this.valueType,
      });
    },
  },
  {
    id: 'overall_csat',
    label: 'Overall CSAT',
    valueType: 'percentage',
    contextLabel: 'positive ratings',
    tooltip: {
      meaning: 'Positive ratings out of all ratings across agents.',
      formula: 'Positive ratings divided by all valid ratings.',
      caveat: 'Partially limited by Conversation ID joins.',
    },
    calculate(normalizedData, filters) {
      const canonicalRatings = normalizedData.ratings.filter(
        (rating) => rating.rating_source === 'satisfaction'
      );
      const { items, metadata } = filterOverallCsatRatings(canonicalRatings, filters);

      return buildMetricResult({
        id: this.id,
        label: this.label,
        numerator: items.filter((item) => POSITIVE_RATING_VALUES.has(item.rating_value)).length,
        denominator: items.length,
        timestampField: 'rated_at',
        filterMetadata: metadata,
        supportLevel: 'partial',
        assumptions: [
          'Uses csat.csv as the canonical all-agent CSAT feed.',
          'Uses Updated at as the best available proxy for conversation rated at.',
          'Team and teammate filters come from joined conversation metadata when available.',
        ],
        limitations: [
          'Rows without a matching conversation remain included unless a team or teammate filter is applied.',
        ],
        tooltip: this.tooltip,
        valueType: this.valueType,
        contextLabel: this.contextLabel,
      });
    },
  },
  {
    id: 'teammate_csat',
    label: 'Teammate CSAT',
    valueType: 'percentage',
    contextLabel: 'positive teammate ratings',
    tooltip: {
      meaning: 'Positive teammate ratings out of all teammate ratings.',
      formula: 'Positive teammate ratings divided by all valid teammate ratings.',
      caveat: 'Partially limited by joined teammate metadata.',
    },
    calculate(normalizedData, filters) {
      const teammateRatings = normalizedData.ratings.filter(
        (rating) =>
          rating.rating_source === 'satisfaction' && rating.rated_agent_type === 'Teammate'
      );
      const { items, metadata } = filterTeammateCsatRatings(teammateRatings, filters);

      return buildMetricResult({
        id: this.id,
        label: this.label,
        numerator: items.filter((item) => POSITIVE_RATING_VALUES.has(item.rating_value)).length,
        denominator: items.length,
        timestampField: 'rated_at',
        filterMetadata: metadata,
        supportLevel: 'partial',
        assumptions: [
          'Uses csat.csv and Agent rated type = Teammate as the canonical teammate-rating feed.',
          'Teammate filtering prefers joined rated_teammate_name and falls back to current teammate_name when rated teammate is unavailable.',
        ],
        limitations: [
          'csat.csv does not include teammate identity directly, so teammate filtering depends on joined conversation metadata.',
        ],
        tooltip: this.tooltip,
        valueType: this.valueType,
        contextLabel: this.contextLabel,
      });
    },
  },
  {
    id: 'fin_csat',
    label: 'Fin AI Agent CSAT',
    valueType: 'percentage',
    contextLabel: 'positive Fin AI ratings',
    tooltip: {
      meaning: 'Positive Fin AI ratings out of all Fin AI ratings.',
      formula: 'Positive Fin AI ratings divided by all valid Fin AI ratings.',
      caveat: 'Partially limited by Conversation ID joins.',
    },
    calculate(normalizedData, filters) {
      const finRatings = normalizedData.ratings.filter(
        (rating) => rating.rating_source === 'fin_satisfaction'
      );
      const { items, metadata } = filterOverallCsatRatings(finRatings, filters);

      return buildMetricResult({
        id: this.id,
        label: this.label,
        numerator: items.filter((item) => POSITIVE_RATING_VALUES.has(item.rating_value)).length,
        denominator: items.length,
        timestampField: 'rated_at',
        filterMetadata: metadata,
        supportLevel: 'partial',
        assumptions: [
          'Uses fin_csat.csv as the canonical Fin AI Agent rating feed.',
          'Uses Updated at as the best available proxy for conversation rated at.',
          'Team and teammate filters use joined conversation metadata when available.',
        ],
        limitations: [
          'Rows without a conversation join are excluded only when a team or teammate filter is active.',
        ],
        tooltip: this.tooltip,
        valueType: this.valueType,
        contextLabel: this.contextLabel,
      });
    },
  },
  {
    id: 'fin_deflection_rate',
    label: 'Fin AI Agent Deflection Rate',
    valueType: 'percentage',
    contextLabel: 'deflected Fin conversations',
    tooltip: {
      meaning: 'Deflected Fin conversations out of all Fin-involved conversations.',
      formula: 'Deflected Fin conversations divided by all Fin-involved conversations.',
      caveat: 'Uses canonical Fin conversation data.',
    },
    calculate(normalizedData, filters) {
      const { items, metadata } = filterStartedAtMetric(normalizedData.fin_outcomes, filters);

      return buildMetricResult({
        id: this.id,
        label: this.label,
        numerator: items.filter((item) => item.fin_deflected === true).length,
        denominator: items.length,
        timestampField: 'started_at',
        filterMetadata: metadata,
        supportLevel: 'full',
        assumptions: [
          'Uses data.csv as the canonical denominator source for Fin-involved conversations.',
          'Uses Fin AI Agent deflected from data.csv for the numerator.',
        ],
        limitations: [
          'Deflection subtype details are not exposed separately in the current CSV schema.',
        ],
        tooltip: this.tooltip,
        valueType: this.valueType,
        contextLabel: this.contextLabel,
      });
    },
  },
  {
    id: 'fin_resolution_rate',
    label: 'Fin AI Agent Resolution Rate',
    valueType: 'percentage',
    contextLabel: 'resolved Fin conversations',
    tooltip: {
      meaning: 'Resolved Fin conversations out of all Fin-involved conversations.',
      formula: 'Resolved Fin conversations divided by all Fin-involved conversations.',
      caveat: 'Uses canonical Fin conversation data.',
    },
    calculate(normalizedData, filters) {
      const { items, metadata } = filterStartedAtMetric(normalizedData.fin_outcomes, filters);

      return buildMetricResult({
        id: this.id,
        label: this.label,
        numerator: items.filter((item) => RESOLVED_FIN_STATES.has(item.fin_resolution_state)).length,
        denominator: items.length,
        timestampField: 'started_at',
        filterMetadata: metadata,
        supportLevel: 'full',
        assumptions: [
          'Uses data.csv as the canonical denominator source for Fin-involved conversations.',
          'Treats Confirmed resolved and Assumed resolved as resolved states.',
        ],
        limitations: [
          'The underlying customer-feedback and asked-for-human events are not available in the current exports.',
        ],
        tooltip: this.tooltip,
        valueType: this.valueType,
        contextLabel: this.contextLabel,
      });
    },
  },
];

export const metricSpecsById = Object.fromEntries(
  metricSpecs.map((spec) => [spec.id, spec])
);

export const calculateMetricSet = (normalizedData, filters, metricIds = null) => {
  const selectedSpecs = metricIds
    ? metricIds.map((metricId) => metricSpecsById[metricId]).filter(Boolean)
    : metricSpecs;

  return selectedSpecs.reduce((accumulator, spec) => {
    accumulator[spec.id] = spec.calculate(normalizedData, filters);
    return accumulator;
  }, {});
};
