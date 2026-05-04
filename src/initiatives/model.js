const COVERAGE_KEYS = [
  'intercom_help_center',
  'learnworlds_blog',
  'learnworlds_class',
  'learnworlds_course',
];

export const buildExistingCoveragePlaceholder = ({
  relevantSurfaces = [],
  note = 'Coverage audit is not implemented in Phase 1.',
} = {}) => ({
  audit_state: 'unknown',
  note,
  intercom_help_center: {
    state: relevantSurfaces.includes('intercom_help_center') ? 'unknown' : 'not_applicable',
    content_type: 'help_center_article',
    connected: false,
    matches: [],
    explanation: relevantSurfaces.includes('intercom_help_center')
      ? note
      : 'Not applicable for this initiative.',
  },
  learnworlds_blog: {
    state: relevantSurfaces.includes('learnworlds_blog') ? 'unknown' : 'not_applicable',
    content_type: 'blog',
    connected: false,
    matches: [],
    explanation: relevantSurfaces.includes('learnworlds_blog')
      ? note
      : 'Not applicable for this initiative.',
  },
  learnworlds_class: {
    state: relevantSurfaces.includes('learnworlds_class') ? 'unknown' : 'not_applicable',
    content_type: 'class',
    connected: false,
    matches: [],
    explanation: relevantSurfaces.includes('learnworlds_class')
      ? note
      : 'Not applicable for this initiative.',
  },
  learnworlds_course: {
    state: relevantSurfaces.includes('learnworlds_course') ? 'unknown' : 'not_applicable',
    content_type: 'course',
    connected: false,
    matches: [],
    explanation: relevantSurfaces.includes('learnworlds_course')
      ? note
      : 'Not applicable for this initiative.',
  },
});

export const buildInitiativeRecommendation = ({
  initiative_id,
  title,
  signal_detected,
  signal_type,
  owner_area,
  suggested_action,
  suggested_format,
  existing_coverage,
  suggested_cadence,
  priority,
  why_this_surfaced,
  source_signals = [],
  support_state,
}) => ({
  initiative_id,
  title,
  signal_detected,
  signal_type,
  owner_area,
  suggested_action,
  suggested_format,
  existing_coverage:
    existing_coverage ?? buildExistingCoveragePlaceholder({ relevantSurfaces: COVERAGE_KEYS }),
  suggested_cadence,
  priority,
  why_this_surfaced,
  source_signals,
  support_state,
});

export const buildInitiativeRuleStatus = ({
  rule_id,
  category,
  support_state,
  triggered = false,
  reason,
  recommendation_id = null,
}) => ({
  rule_id,
  category,
  support_state,
  triggered,
  reason,
  recommendation_id,
});
