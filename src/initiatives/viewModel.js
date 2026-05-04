import { buildInitiativeRecommendations } from './recommendations.js';
import { contentInventory } from '../data/contentInventory.js';

const PRIORITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2,
};

const CADENCE_ORDER = {
  this_week: 0,
  this_month: 1,
  backlog: 2,
};

const SUPPORT_STATE_ORDER = {
  full: 0,
  partial: 1,
  stubbed: 2,
};

const OWNER_AREA_ORDER = [
  'Support Quality',
  'Fin AI Optimization',
  'Help Center',
  'Education / Threecolts University',
  'Cross-functional / Product',
];

const OWNER_AREA_ORDER_MAP = Object.fromEntries(
  OWNER_AREA_ORDER.map((value, index) => [value, index])
);

const COVERAGE_LABELS = {
  intercom_help_center: 'Help Center',
  learnworlds_blog: 'LearnWorlds blog',
  learnworlds_class: 'LearnWorlds class',
  learnworlds_course: 'LearnWorlds course',
};

const COVERAGE_STATE_LABELS = {
  found: 'found',
  not_found: 'not found',
  unknown: 'unknown',
  not_applicable: 'not applicable',
  partial: 'partial',
};

const SUPPORT_STATE_LABELS = {
  full: 'Full support',
  partial: 'Partial support',
  stubbed: 'Stubbed',
};

const PRIORITY_LABELS = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const CADENCE_LABELS = {
  this_week: 'This week',
  this_month: 'This month',
  backlog: 'Backlog',
};

const ACTION_LABEL_BY_FORMAT = {
  billing_guidance_refresh: 'Add pricing FAQ / article',
  help_center_article_and_troubleshooting_class: 'Create troubleshooting guide',
  fin_ai_playbook_update: 'Update Fin AI playbook',
  class_or_onboarding_series: 'Create onboarding course',
  course_refresh: 'Refresh course content',
};

const PRODUCT_DEFINITIONS = [
  { label: 'InventoryLab', keywords: ['inventorylab', 'inventory lab', 'list', 'stratify', 'accounting'] },
  { label: 'Tactical Arbitrage', keywords: ['tactical arbitrage', 'ta ', 'wholesale finder', 'product search'] },
  { label: 'ScoutIQ', keywords: ['scoutiq', 'scout iq'] },
  { label: 'SmartRepricer', keywords: ['smartrepricer', 'smart repricer', 'repricer'] },
  { label: 'FeedbackWhiz', keywords: ['feedbackwhiz', 'feedback whiz'] },
  { label: 'SellerRunning', keywords: ['sellerrunning', 'seller running', 'drop shipping', 'dropshipping'] },
  { label: 'Seller 365', keywords: ['seller 365', 'seller365'] },
  { label: 'Amazon seller setup', keywords: ['amazon account', 'seller central', 'amazon', 'fba', 'asin', 'ungated', 'restricted'] },
];

const INTERVENTION_LABELS = {
  content: 'Content',
  onboarding: 'Onboarding',
  in_product_ux: 'In-product UX',
  messaging: 'Messaging',
  workflow: 'Workflow',
};

export const AI_HUB_TEAM_GROUPS = [
  { key: 'all', label: 'All teams' },
  { key: 'support_team', label: 'Support Team' },
  { key: 'content_team', label: 'Content Team' },
  { key: 'onboarding_education', label: 'Onboarding / Education' },
  { key: 'product_ops', label: 'Product / Ops' },
  { key: 'cross_functional', label: 'Cross-functional' },
];

const AI_HUB_TEAM_LABELS = Object.fromEntries(
  AI_HUB_TEAM_GROUPS.map((group) => [group.key, group.label])
);

const IMPROVEMENT_TARGET_LABELS = {
  articles: 'Articles',
  blogs: 'Blogs',
  courses: 'Courses',
  live_webinar: 'Live webinar (CUCO)',
  video: 'Video (YouTube)',
  workflow: 'Workflow improvement',
  onboarding: 'Onboarding improvement',
  ui_feature: 'UI/feature improvement',
  support_growth: 'Support growth',
};

const CANONICAL_TOPICS = {
  cancel: ['cancel', 'cancellation', 'unsubscribe'],
  billing: ['billing', 'payment', 'charge', 'subscription'],
  connect: ['connect', 'integration', 'link', 'account'],
  onboarding: ['onboarding', 'getting started', 'setup', 'first step'],
  migration: ['migrate', 'migration', 'switch', 'move'],
  results: ['results', 'no results', '0 results'],
};

const EXPECTED_COVERAGE = {
  cancel: ['cancel steps', 'where to cancel', 'refund policy', 'billing timing'],
  billing: ['charges explanation', 'billing cycle', 'refund policy'],
  connect: ['how to connect', 'required permissions', 'common errors'],
  onboarding: ['first steps', 'setup process', 'expected results'],
  migration: ['what changes', 'data transfer', 'tool differences'],
  results: ['why no results', 'how to adjust filters', 'expected outcomes'],
};

function normalizeWord(word = '') {
  const w = word.toLowerCase();

  if (w.startsWith('cancel')) return 'cancel';
  if (w.startsWith('bill') || w.startsWith('subscript')) return 'billing';
  if (w.startsWith('connect') || w.startsWith('integrat')) return 'connect';
  if (w.startsWith('result')) return 'results';
  if (w.startsWith('error') || w.startsWith('issue')) return 'issue';

  return w;
}

function extractKeywords(text = '') {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .map(normalizeWord);
}

function scoreContentMatch(itemKeywords = [], topicKeywords = []) {
  let score = 0;

  itemKeywords.forEach((keyword) => {
    if (topicKeywords.includes(keyword)) {
      score += 2;
    }
  });

  return score;
}

function resolveCanonicalTopic(topic = '') {
  const normalized = topic.toLowerCase();

  for (const [canonical, keywords] of Object.entries(CANONICAL_TOPICS)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return canonical;
    }
  }

  return null;
}

const matchContent = (keywords = [], canonicalTopic = null) => {
  const normalizedKeywords = [...new Set(
    keywords
      .map((keyword) => normalizeWord(String(keyword || '').trim().toLowerCase()))
      .filter(Boolean)
  )];

  if (normalizedKeywords.length === 0) {
    return [];
  }

  return contentInventory
    .map((item) => {
      const itemKeywords = [
        ...(item.keywords || []).map((keyword) =>
          normalizeWord(String(keyword || '').trim().toLowerCase())
        ),
        ...extractKeywords(item.title),
      ];
      const score = scoreContentMatch(itemKeywords, normalizedKeywords);
      const itemCanonical = resolveCanonicalTopic(item.title);

      return {
        ...item,
        matchScore: score || 0,
        canonical: itemCanonical,
      };
    })
    .filter((item) => {
      if (canonicalTopic && item.canonical === canonicalTopic) {
        return true;
      }

      return item.matchScore > 0;
    })
    .sort((left, right) => right.matchScore - left.matchScore)
    .slice(0, 2);
};

const clampSentence = (value, maxLength = 170) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();

  if (!text) {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
};

const normalizeText = (value) => String(value || '').toLowerCase();

const pickTopicMatch = (initiative) =>
  initiative.source_signals
    ?.flatMap((signal) => signal.details?.top_matches || [])
    ?.sort((left, right) => (right.count || 0) - (left.count || 0))?.[0]?.name || null;

const pickCourseMatch = (initiative) =>
  initiative.source_signals?.find((signal) => signal.details?.course_name)?.details?.course_name || null;

const inferFocusLabel = (initiative) =>
  pickCourseMatch(initiative) ||
  pickTopicMatch(initiative) ||
  initiative.title.replace(/\s+needs.*$/i, '').replace(/\s+questions.*$/i, '').trim();

const inferProductLabel = (initiative) => {
  const haystack = normalizeText(
    [
      initiative.title,
      initiative.signal_detected,
      initiative.suggested_action,
      initiative.why_this_surfaced,
      pickTopicMatch(initiative),
      pickCourseMatch(initiative),
      ...(initiative.coverageRows || []).flatMap((coverage) => coverage.matches?.map((match) => match.title) || []),
    ].join(' ')
  );

  const match = PRODUCT_DEFINITIONS.find((product) =>
    product.keywords.some((keyword) => haystack.includes(keyword))
  );

  if (match) {
    return match.label;
  }

  if (initiative.owner_area === 'Education / Threecolts University') {
    return 'Threecolts University';
  }

  if (initiative.owner_area === 'Fin AI Optimization') {
    return 'Fin AI';
  }

  return 'Cross-product';
};

const getHelpCenterMatch = (initiative) => {
  const helpCenterCoverage = initiative.coverageRows?.find((coverage) => coverage.key === 'intercom_help_center');
  const match = helpCenterCoverage?.matches?.[0] || null;

  if (!match) {
    return null;
  }

  return {
    title: match.title,
    url: match.url || null,
    exists: true,
  };
};

const deriveInterventionTypes = (initiative) => {
  const focusLabel = normalizeText(inferFocusLabel(initiative));

  if (initiative.signal_type === 'activation_gap') {
    return ['onboarding', 'in_product_ux'];
  }

  if (initiative.signal_type === 'dropout_proxy') {
    return ['workflow', 'in_product_ux'];
  }

  if (initiative.signal_type === 'metric_decline') {
    return ['workflow', 'messaging'];
  }

  if (focusLabel.includes('billing') || focusLabel.includes('pricing') || focusLabel.includes('cancel')) {
    return ['content', 'messaging'];
  }

  return ['content', 'in_product_ux'];
};

const derivePrimaryAction = (initiative) => {
  const focusLabel = inferFocusLabel(initiative);
  const productLabel = inferProductLabel(initiative);

  if (initiative.signal_type === 'activation_gap') {
    return `Add onboarding checklist step for first success in ${productLabel}`;
  }

  if (initiative.signal_type === 'dropout_proxy') {
    return `Simplify the first stalled steps in ${focusLabel}`;
  }

  if (initiative.signal_type === 'metric_decline') {
    return `Clarify Fin AI escalation workflow for ${focusLabel}`;
  }

  if (initiative.owner_area === 'Help Center') {
    return `Add inline explanation and pricing FAQ for ${focusLabel}`;
  }

  return `Add troubleshooting guidance for ${focusLabel}`;
};

const deriveSecondaryActions = (initiative) => {
  const focusLabel = inferFocusLabel(initiative);
  const productLabel = inferProductLabel(initiative);
  const helpCenterMatch = getHelpCenterMatch(initiative);
  const interventionTypes = deriveInterventionTypes(initiative);
  const actions = [];

  if (initiative.signal_type === 'activation_gap') {
    actions.push(`Add guided setup for ${productLabel}`);
  } else if (initiative.signal_type === 'dropout_proxy') {
    actions.push(`Clarify labels and reduce friction in ${focusLabel}`);
  } else if (initiative.owner_area === 'Help Center') {
    actions.push(`Add expectation-setting message for ${focusLabel}`);
  } else if (interventionTypes.includes('in_product_ux')) {
    actions.push(`Add tooltip or inline explanation for ${focusLabel}`);
  }

  if (helpCenterMatch?.title) {
    actions.push(`Update article: ${helpCenterMatch.title}`);
  } else {
    actions.push(`Create new article for: ${focusLabel}`);
  }

  return actions.slice(0, 2);
};

const deriveContentState = (initiative) => {
  const helpCenterMatch = getHelpCenterMatch(initiative);

  if (helpCenterMatch) {
    return {
      indicator: 'Existing content',
      title: helpCenterMatch.title,
      url: helpCenterMatch.url,
      exists: true,
    };
  }

  return {
    indicator: 'No existing article',
    title: null,
    url: null,
    exists: false,
  };
};

const deriveActionSummary = (initiative) => {
  const text = String(initiative.suggested_action || '').replace(/\s+/g, ' ').trim();

  if (!text) {
    return '';
  }

  const firstSentence = text.split(/(?<=[.!?])\s+/)[0] || text;
  return clampSentence(firstSentence, 150);
};

const deriveMetricSummary = (initiative) => clampSentence(initiative.why_this_surfaced, 140);

const deriveReasonSummary = (initiative) => clampSentence(initiative.signal_detected, 135);

export const matchContentToInitiative = (initiative) => {
  const canonicalTopic = resolveCanonicalTopic(initiative?.topic || initiative?.focusLabel || '');
  const keywords = [
    initiative?.productLabel,
    initiative?.focusLabel,
    initiative?.signal_detected,
    initiative?.title,
    ...(initiative?.source_signals || []).flatMap((signal) =>
      (signal?.details?.top_matches || []).map((match) => match?.name)
    ),
  ]
    .flatMap((value) => extractKeywords(String(value || '')));

  return matchContent(keywords, canonicalTopic);
};

function determinePrimaryAction(initiative) {
  if (!initiative) return null;

  const topic = (initiative.topic || initiative.focusLabel || '').toLowerCase();
  const type = (initiative.type || initiative.signal_type || '').toLowerCase();

  if (type.includes('onboarding') || topic.includes('first')) {
    return 'Guide user to complete their first key step';
  }

  if (
    topic.includes('billing') ||
    topic.includes('subscription') ||
    topic.includes('cancel')
  ) {
    return 'Clarify subscription, billing, or cancellation flow';
  }

  if (
    topic.includes('connect') ||
    topic.includes('integration') ||
    topic.includes('account')
  ) {
    return 'Prompt user to connect their account or complete setup';
  }

  if (topic.includes('no results') || topic.includes('0 results')) {
    return 'Help user adjust inputs or filters to get usable results';
  }

  return 'Review this experience and improve clarity for users';
}

function detectContentGap(matchedContent = [], initiative) {
  if (!initiative) return null;

  const canonicalTopic = resolveCanonicalTopic(initiative.topic || initiative.focusLabel || '');
  const hasCanonicalMatch = matchedContent.some(
    (item) => item.canonical === canonicalTopic
  );

  if (!hasCanonicalMatch) {
    return {
      type: 'missing',
      message: 'No dedicated content found for this topic',
    };
  }

  const hasStrongMatch = matchedContent.some((item) => (item?.matchScore || 0) >= 2);

  if (!hasStrongMatch) {
    return {
      type: 'weak',
      message: 'Content exists but may not fully address this issue',
    };
  }

  return null;
}

function detectCoverageGap(matchedContent = [], canonicalTopic) {
  if (!canonicalTopic) return null;

  const expected = EXPECTED_COVERAGE[canonicalTopic] || [];

  if (expected.length === 0) return null;

  const covered = new Set();

  matchedContent.forEach((item) => {
    (item.coverage || []).forEach((coverage) => covered.add(coverage));
  });

  const missing = expected.filter((coverage) => !covered.has(coverage));

  if (missing.length === 0) return null;

  return {
    type: 'coverage',
    missing,
  };
}

function calculateImpactScore(initiative) {
  if (!initiative) return 0;

  let score = 0;
  const type = initiative.type?.toLowerCase() || initiative.signal_type?.toLowerCase() || '';

  if (type.includes('billing')) score += 3;
  if (type.includes('onboarding') || type.includes('activation')) score += 2;
  if (type.includes('error') || type.includes('dropout') || type.includes('metric_decline')) score += 2;

  if (initiative.contentGap?.type === 'missing') score += 3;
  if (initiative.contentGap?.type === 'weak') score += 1;

  if (initiative.coverageGap?.missing?.length) {
    score += Math.min(initiative.coverageGap.missing.length, 3);
  }

  return score;
}

function generateRecommendation(initiative) {
  if (!initiative) return null;

  const { contentGap, coverageGap, canonicalTopic } = initiative;

  if (contentGap?.type === 'missing') {
    return `Create a new ${canonicalTopic || 'help'} article to address this issue.`;
  }

  if (contentGap?.type === 'weak') {
    return 'Improve existing content to better address this issue.';
  }

  if (coverageGap?.missing?.length) {
    return `Update existing content to include: ${coverageGap.missing.join(', ')}.`;
  }

  return 'Monitor this area and optimize user experience if needed.';
}

function formatConfidence(matchScore = 0) {
  if (matchScore >= 4) {
    return 'High';
  }

  if (matchScore >= 2) {
    return 'Medium';
  }

  return 'Low';
}

function formatRecommendedContent(matchedContent = []) {
  const items = Array.isArray(matchedContent) ? matchedContent : [];

  const normalizeItem = (item) => ({
    ...item,
    confidence: formatConfidence(item?.matchScore || 0),
  });

  return {
    helpCenter: items
      .filter((item) => item?.type === 'article')
      .slice(0, 2)
      .map(normalizeItem),
    courses: items
      .filter((item) => item?.type === 'course')
      .slice(0, 2)
      .map(normalizeItem),
  };
}

function deriveProblem(initiative) {
  return clampSentence(
    initiative?.signal_detected ||
      initiative?.reasonSummary ||
      initiative?.title ||
      initiative?.focusLabel ||
      '',
    160
  );
}

function deriveFix(initiative) {
  return (
    initiative?.primaryAction ||
    initiative?.actionLabel ||
    initiative?.recommendation ||
    'Review this experience and improve clarity for users'
  );
}

function deriveContentDecision({ contentGap, coverageGap, formattedContent }) {
  const helpCenterCount = formattedContent?.helpCenter?.length || 0;
  const courseCount = formattedContent?.courses?.length || 0;
  const hasAnyContent = helpCenterCount > 0 || courseCount > 0;

  if (!hasAnyContent || contentGap?.type === 'missing') {
    return 'create';
  }

  if (contentGap?.type === 'weak' || coverageGap?.missing?.length) {
    return 'update';
  }

  return 'sufficient';
}

function attachUserExamples(initiative) {
  const topic = String(initiative?.topic || initiative?.focusLabel || '').toLowerCase();

  if (topic.includes('cancel')) {
    return [
      'How do I cancel my subscription?',
      'Why was I charged after canceling?',
      'Where can I cancel my plan?',
    ];
  }

  if (topic.includes('billing') || topic.includes('subscription') || topic.includes('payment')) {
    return [
      'Why was I charged?',
      'When does my subscription renew?',
      'How does billing work for my plan?',
    ];
  }

  if (
    topic.includes('onboarding') ||
    topic.includes('getting started') ||
    topic.includes('first step') ||
    topic.includes('challenge')
  ) {
    return [
      'Where do I start?',
      'What am I supposed to do first?',
      'I do not understand the next step',
    ];
  }

  if (topic.includes('connect') || topic.includes('integration') || topic.includes('account')) {
    return [
      'How do I connect my account?',
      'Why is my integration not working?',
      'What permissions do I need to finish setup?',
    ];
  }

  if (topic.includes('result')) {
    return [
      'Why am I seeing no results?',
      'What filters should I change?',
      'What should I expect to see here?',
    ];
  }

  if (topic.includes('challenge')) {
    return [
      'What am I supposed to do in this challenge?',
      'Where do I start?',
      'I don’t understand the next step',
    ];
  }

  return [];
}

function getPrimarySignal(initiative) {
  const signals = Array.isArray(initiative?.source_signals) ? initiative.source_signals : [];

  return (
    signals.find((signal) => signal?.unit === 'conversations' && Number.isFinite(signal?.current_value)) ||
    signals.find((signal) => Number.isFinite(signal?.current_value)) ||
    null
  );
}

function buildProblemModel(initiative) {
  return {
    summary: deriveProblem(initiative),
    examples: attachUserExamples(initiative).slice(0, 3),
  };
}

function buildImpactModel(initiative) {
  const primarySignal = getPrimarySignal(initiative);
  const currentValue = Number(primarySignal?.current_value ?? 0);
  const deltaValue = Number(primarySignal?.delta_value ?? 0);

  return {
    volume: currentValue,
    unit: primarySignal?.unit || 'signals',
    trend: deltaValue > 0 ? 'increasing' : deltaValue < 0 ? 'decreasing' : 'stable',
    severity: initiative?.priority || 'low',
  };
}

function buildContentModel({ formattedContent, coverageGap, baseGap }) {
  const matches = [
    ...(formattedContent?.helpCenter || []),
    ...(formattedContent?.courses || []),
  ];

  return {
    exists: matches.length > 0,
    matches,
    gaps:
      coverageGap?.missing?.length > 0
        ? coverageGap.missing
        : baseGap?.type === 'missing'
          ? [baseGap.message]
          : [],
  };
}

function buildRecommendationModel(initiative, recommendationSummary) {
  return {
    primary: deriveFix({
      ...initiative,
      primaryAction: determinePrimaryAction(initiative),
      recommendation: recommendationSummary,
    }),
    secondary: (initiative?.secondaryActions || []).slice(0, 2),
  };
}

function deriveContentStatus({ baseGap, coverageGap, formattedContent }) {
  const totalMatches =
    (formattedContent?.helpCenter?.length || 0) + (formattedContent?.courses?.length || 0);

  if (totalMatches === 0 || baseGap?.type === 'missing') {
    return 'missing';
  }

  if (baseGap?.type === 'weak' || coverageGap?.missing?.length) {
    return 'partial';
  }

  return 'covered';
}

function deriveImprovementTargets(initiative, { formattedContent, coverageGap, canonicalTopic }) {
  const targets = new Set();
  const type = String(initiative?.signal_type || '').toLowerCase();
  const suggestedFormat = String(initiative?.suggested_format || '').toLowerCase();

  if (formattedContent?.helpCenter?.length || initiative?.owner_area === 'Help Center') {
    targets.add('articles');
  }

  if (
    suggestedFormat.includes('blog') ||
    initiative?.coverageRows?.some((coverage) => coverage.key === 'learnworlds_blog')
  ) {
    targets.add('blogs');
  }

  if (
    formattedContent?.courses?.length ||
    suggestedFormat.includes('course') ||
    suggestedFormat.includes('class')
  ) {
    targets.add('courses');
  }

  if (type === 'activation_gap' || type === 'dropout_proxy') {
    targets.add('onboarding');
  }

  if (type === 'activation_gap' || coverageGap?.missing?.includes('expected results')) {
    targets.add('video');
  }

  if (type === 'dropout_proxy' || type === 'metric_decline') {
    targets.add('workflow');
  }

  if (
    initiative?.interventionTypes?.includes('in_product_ux') ||
    canonicalTopic === 'connect' ||
    canonicalTopic === 'results'
  ) {
    targets.add('ui_feature');
  }

  if (
    type === 'activation_gap' ||
    type === 'dropout_proxy' ||
    suggestedFormat.includes('class')
  ) {
    targets.add('live_webinar');
  }

  if (
    initiative?.owner_area === 'Support Quality' ||
    initiative?.owner_area === 'Fin AI Optimization' ||
    type === 'metric_decline'
  ) {
    targets.add('support_growth');
  }

  if (targets.size === 0) {
    targets.add('workflow');
  }

  return [...targets];
}

function deriveInitiativeKind(initiative, improvementTargets = []) {
  const contentTargets = ['articles', 'blogs', 'courses', 'live_webinar', 'video'];
  const workflowTargets = ['workflow', 'onboarding', 'ui_feature', 'support_growth'];
  const hasContent = improvementTargets.some((target) => contentTargets.includes(target));
  const hasWorkflow = improvementTargets.some((target) => workflowTargets.includes(target));

  if (hasContent && hasWorkflow) {
    return 'mixed';
  }

  if (hasContent) {
    return 'content';
  }

  return 'workflow';
}

function deriveTeamGroup(initiative, improvementTargets = [], initiativeKind = 'workflow') {
  if (initiative?.signal_type === 'activation_gap' || initiative?.signal_type === 'dropout_proxy') {
    return 'onboarding_education';
  }

  if (
    initiative?.owner_area === 'Help Center' &&
    initiativeKind === 'content' &&
    !improvementTargets.includes('workflow') &&
    !improvementTargets.includes('ui_feature')
  ) {
    return 'content_team';
  }

  if (
    initiative?.owner_area === 'Support Quality' ||
    improvementTargets.includes('support_growth')
  ) {
    return 'support_team';
  }

  if (
    initiative?.owner_area === 'Fin AI Optimization' ||
    improvementTargets.includes('workflow') ||
    improvementTargets.includes('ui_feature')
  ) {
    return initiativeKind === 'mixed' ? 'cross_functional' : 'product_ops';
  }

  if (initiativeKind === 'content') {
    return 'content_team';
  }

  return 'cross_functional';
}

function deriveRecommendedOwner(teamGroup, improvementTargets = []) {
  if (teamGroup === 'support_team') {
    return 'Support Team';
  }

  if (teamGroup === 'content_team') {
    return improvementTargets.includes('blogs') ? 'Content Team + Marketing' : 'Content Team';
  }

  if (teamGroup === 'onboarding_education') {
    return 'Onboarding / Education';
  }

  if (teamGroup === 'product_ops') {
    return 'Product / Ops';
  }

  return 'Cross-functional squad';
}

function deriveContentSurface(improvementTargets = []) {
  if (improvementTargets.includes('articles')) return 'Help Center';
  if (improvementTargets.includes('blogs')) return 'Blog';
  if (improvementTargets.includes('courses')) return 'Course';
  if (improvementTargets.includes('live_webinar')) return 'Live webinar (CUCO)';
  if (improvementTargets.includes('video')) return 'Video (YouTube)';
  if (improvementTargets.includes('onboarding')) return 'Onboarding flow';
  if (improvementTargets.includes('ui_feature')) return 'UI / feature';
  if (improvementTargets.includes('support_growth')) return 'Support workflow';
  return 'Workflow';
}

function buildImpactSummary(impact = {}) {
  const volume = Number(impact.volume || 0).toLocaleString();
  const unit = impact.unit === 'conversations' ? 'conversations' : impact.unit || 'signals';
  return `${volume} ${unit} · ${impact.trend || 'stable'} · ${impact.severity || 'low'}`;
}

function deriveEvidenceSummary(initiative) {
  return clampSentence(
    initiative?.why_this_surfaced || initiative?.signal_detected || initiative?.reasonSummary || '',
    170
  );
}

function deriveHubActionSummary(initiative, recommendationModel, improvementTargets = []) {
  const targetLabel =
    IMPROVEMENT_TARGET_LABELS[improvementTargets[0]] || deriveContentSurface(improvementTargets);
  return clampSentence(
    recommendationModel?.primary
      ? `${recommendationModel.primary} via ${targetLabel}.`
      : initiative?.suggested_action || '',
    165
  );
}

function deriveSourceSummary(initiative) {
  const signals = Array.isArray(initiative?.source_signals) ? initiative.source_signals : [];
  const hasIntercom = signals.some((signal) => String(signal?.source || '').startsWith('intercom'));
  const hasLearnWorlds = signals.some((signal) =>
    String(signal?.source || '').startsWith('learnworlds')
  );
  const hasLearnWorldsCoverage = (initiative?.coverageRows || []).some((coverage) =>
    ['learnworlds_blog', 'learnworlds_class', 'learnworlds_course'].includes(coverage?.key)
  );

  if (hasIntercom && (hasLearnWorlds || hasLearnWorldsCoverage)) {
    return 'Intercom + LearnWorlds';
  }

  if (hasLearnWorlds || hasLearnWorldsCoverage) {
    return 'LearnWorlds';
  }

  if (hasIntercom) {
    return 'Intercom';
  }

  return 'Cross-source';
}

const IMPROVEMENT_TYPE_LABELS = {
  article: 'Article',
  course: 'Course',
  video: 'Video',
  webinar: 'Webinar / CUCO',
  blog: 'Blog',
  workflow: 'Workflow',
  onboarding: 'Onboarding',
  ui_feature: 'UI / feature',
  support_enablement: 'Support enablement',
};

const OWNER_TEAM_LABELS = {
  support: 'Support',
  content: 'Content',
  education: 'Education',
  product_ops: 'Product / Ops',
};

const COVERAGE_STATUS_LABELS = {
  missing: 'no coverage',
  partial: 'partial coverage',
  covered: 'coverage exists',
};

const canonicalTopicKeywords = (canonicalTopic) => CANONICAL_TOPICS[canonicalTopic] || [];

const getDateValue = (timestamp) => {
  if (!timestamp) {
    return '';
  }

  if (typeof timestamp === 'string' && timestamp.includes(' ')) {
    return timestamp.split(' ')[0];
  }

  return String(timestamp).slice(0, 10);
};

const isWithinDateRange = (timestamp, filters) => {
  const value = getDateValue(timestamp);

  if (!value) {
    return false;
  }

  if (filters?.startDate && value < filters.startDate) {
    return false;
  }

  if (filters?.endDate && value > filters.endDate) {
    return false;
  }

  return true;
};

function deriveImprovementType(initiative, improvementTargets = []) {
  const type = String(initiative?.signal_type || '').toLowerCase();

  if (type === 'metric_decline' || improvementTargets.includes('support_growth')) {
    return 'support_enablement';
  }

  if (type === 'activation_gap' || (improvementTargets.includes('onboarding') && !improvementTargets.includes('courses'))) {
    return 'onboarding';
  }

  if (type === 'dropout_proxy' && improvementTargets.includes('courses')) {
    return 'course';
  }

  if (improvementTargets.includes('articles')) return 'article';
  if (improvementTargets.includes('courses')) return 'course';
  if (improvementTargets.includes('video')) return 'video';
  if (improvementTargets.includes('live_webinar')) return 'webinar';
  if (improvementTargets.includes('blogs')) return 'blog';
  if (improvementTargets.includes('workflow')) return 'workflow';
  if (improvementTargets.includes('onboarding')) return 'onboarding';
  if (improvementTargets.includes('ui_feature')) return 'ui_feature';

  return 'workflow';
}

function deriveOwnerTeam(initiative, improvementType) {
  if (initiative?.signal_type === 'activation_gap' || initiative?.signal_type === 'dropout_proxy') {
    return 'education';
  }

  if (improvementType === 'article' || improvementType === 'blog' || improvementType === 'video') {
    return 'content';
  }

  if (improvementType === 'course' || improvementType === 'webinar' || improvementType === 'onboarding') {
    return 'education';
  }

  if (improvementType === 'support_enablement') {
    return 'support';
  }

  return 'product_ops';
}

function formatTrendLabel(trendDirection = 'stable', trendDelta = 0) {
  if (trendDirection === 'increasing') {
    return `up ${Math.abs(trendDelta)} vs prior period`;
  }

  if (trendDirection === 'decreasing') {
    return `down ${Math.abs(trendDelta)} vs prior period`;
  }

  return 'flat vs prior period';
}

function deriveEstimatedDeflection(initiative, contentStatus, improvementType, trendDirection) {
  const volume = Number(initiative?.impact?.volume || 0);
  const coverageFactor = {
    missing: 0.58,
    partial: 0.34,
    covered: 0.16,
  }[contentStatus] ?? 0.2;
  const improvementFactor = {
    article: 0.92,
    course: 0.86,
    video: 0.64,
    webinar: 0.52,
    blog: 0.48,
    workflow: 0.74,
    onboarding: 0.82,
    ui_feature: 0.68,
    support_enablement: 0.56,
  }[improvementType] ?? 0.5;
  const trendFactor =
    trendDirection === 'increasing' ? 1.1 : trendDirection === 'decreasing' ? 0.9 : 1;

  return Math.max(0, Math.round(volume * coverageFactor * improvementFactor * trendFactor));
}

function deriveSourceSignals(initiative) {
  const derived = [];
  const pushUnique = (entry) => {
    if (!entry?.id) {
      return;
    }

    if (!derived.some((item) => item.id === entry.id)) {
      derived.push(entry);
    }
  };

  (initiative?.source_signals || []).forEach((signal) => {
    const source = String(signal?.source || '');

    if (source.startsWith('intercom')) {
      const topMatch = signal?.details?.top_matches?.[0]?.name;

      pushUnique({
        id: topMatch ? `intercom-topic:${topMatch}` : `intercom:${signal.signal_key}`,
        type: 'intercom',
        label: topMatch ? `Intercom · ${topMatch}` : `Intercom · ${signal.label}`,
        source,
      });
    }

    if (source.startsWith('learnworlds')) {
      const courseId = signal?.details?.course_id;
      const courseName = signal?.details?.course_name || signal?.label;

      pushUnique({
        id: courseId ? `learnworlds-course-id:${courseId}` : `learnworlds:${signal.signal_key}`,
        type: courseId ? 'learnworlds-course-id' : 'learnworlds',
        label: courseName ? `LearnWorlds · ${courseName}` : 'LearnWorlds',
        source,
      });
    }
  });

  (initiative?.coverageRows || []).forEach((coverage) => {
    const match = coverage?.matches?.[0];

    if (!match?.title) {
      return;
    }

    if (coverage.key === 'intercom_help_center') {
      pushUnique({
        id: match.url ? `helpcenter-article-id:${match.url}` : `helpcenter-article-id:${match.title}`,
        type: 'helpcenter-article-id',
        label: `Help Center · ${match.title}`,
        source: 'coverage',
      });
    }

    if (coverage.key === 'learnworlds_blog') {
      pushUnique({
        id: match.url ? `blog-post-id:${match.url}` : `blog-post-id:${match.title}`,
        type: 'blog-post-id',
        label: `Blog · ${match.title}`,
        source: 'coverage',
      });
    }

    if (coverage.key === 'learnworlds_course' || coverage.key === 'learnworlds_class') {
      pushUnique({
        id: match.url ? `learnworlds-course-id:${match.url}` : `learnworlds-course-id:${match.title}`,
        type: 'learnworlds-course-id',
        label: `LearnWorlds · ${match.title}`,
        source: 'coverage',
      });
    }
  });

  return derived;
}

function deriveSourceSurfaces(sourceSignals = []) {
  return sourceSignals.map((signal) => ({
    key: signal.id,
    label: signal.label,
  }));
}

function findLearnWorldsCourse(initiative, learnWorldsNormalizedData) {
  if (!learnWorldsNormalizedData) {
    return null;
  }

  const courseSignal = (initiative?.source_signals || []).find(
    (signal) => signal?.details?.course_id || signal?.details?.course_name
  );
  const courseId = courseSignal?.details?.course_id || null;
  const courseName = courseSignal?.details?.course_name || pickCourseMatch(initiative) || null;

  if (courseId) {
    const direct = learnWorldsNormalizedData.indexes?.coursesById?.get(courseId);

    if (direct) {
      return direct;
    }
  }

  const coverageCourseTitle =
    (initiative?.coverageRows || [])
      .find((coverage) => coverage?.key === 'learnworlds_course' || coverage?.key === 'learnworlds_class')
      ?.matches?.[0]?.title || null;
  const target = normalizeText(courseName || coverageCourseTitle || initiative?.focusLabel || '');

  if (!target) {
    return null;
  }

  return (
    learnWorldsNormalizedData.lw_courses.find((course) =>
      normalizeText(course.course_name || '').includes(target)
    ) || null
  );
}

function buildIntercomEvidence(initiative, intercomNormalizedData, filters) {
  const sourceSignals = Array.isArray(initiative?.source_signals) ? initiative.source_signals : [];
  const hasIntercomSignal = sourceSignals.some((signal) =>
    String(signal?.source || '').startsWith('intercom')
  );

  if (!intercomNormalizedData || !hasIntercomSignal) {
    return {
      hasSignal: false,
      title: 'Intercom signal',
    };
  }

  const topicCandidates = [
    ...(sourceSignals.flatMap((signal) => signal?.details?.top_matches?.map((match) => match?.name) || [])),
    initiative?.focusLabel,
    initiative?.canonicalTopic,
    ...canonicalTopicKeywords(initiative?.canonicalTopic),
  ]
    .map((value) => normalizeText(value || ''))
    .filter(Boolean);

  const matchedConversations = intercomNormalizedData.conversations.filter((conversation) => {
    if (!isWithinDateRange(conversation.started_at, filters)) {
      return false;
    }

    const haystack = normalizeText(
      [
        conversation.topic,
        conversation.subtopic,
        conversation.ai_issue_summary,
        conversation.title,
      ].join(' ')
    );

    return topicCandidates.some((keyword) => haystack.includes(keyword));
  });

  const conversationIds = new Set(matchedConversations.map((conversation) => conversation.conversation_id));
  const ratings = intercomNormalizedData.ratings.filter((rating) => conversationIds.has(rating.conversation_id));
  const csatPercent =
    ratings.length > 0
      ? Number(
          (
            (ratings.filter((rating) => rating.rating_is_positive).length / ratings.length) *
            100
          ).toFixed(1)
        )
      : null;
  const phrases = [...new Set(
    matchedConversations
      .flatMap((conversation) => [conversation.ai_issue_summary, conversation.title])
      .filter(Boolean)
      .map((value) => clampSentence(value, 120))
  )].slice(0, 3);

  return {
    hasSignal: matchedConversations.length > 0 || initiative?.sourceSummary?.includes('Intercom'),
    title: 'Intercom signal',
    volume: matchedConversations.length || (initiative?.impact?.unit === 'conversations' ? initiative?.impact?.volume : 0),
    trendDirection: initiative?.trendDirection || initiative?.impact?.trend || 'stable',
    trendDelta: initiative?.trendDelta ?? 0,
    csatPercent,
    averageHandleTimeMinutes: null,
    note:
      matchedConversations.length > 0
        ? `${matchedConversations.length.toLocaleString()} matched conversations in the selected period.`
        : 'No direct Intercom conversation cluster was matched for this recommendation.',
    userPhrasing: phrases,
  };
}

function buildLearnWorldsEvidence(initiative, learnWorldsNormalizedData) {
  const hasLearnWorldsSignal = (initiative?.source_signals || []).some((signal) =>
    String(signal?.source || '').startsWith('learnworlds')
  );
  const course = findLearnWorldsCourse(initiative, learnWorldsNormalizedData);

  if (!learnWorldsNormalizedData || (!hasLearnWorldsSignal && !course)) {
    return {
      hasSignal: false,
      title: 'LearnWorlds signal',
    };
  }

  if (!course) {
    const registrationsSignal = (initiative?.source_signals || []).find(
      (signal) => signal?.signal_key === 'lw_new_registrations'
    );
    const activeSignal = (initiative?.source_signals || []).find(
      (signal) => signal?.signal_key === 'lw_active_users'
    );
    const registrationCount = Number(registrationsSignal?.current_value || 0);
    const activeCount = Number(activeSignal?.current_value || 0);

    return {
      hasSignal: true,
      title: 'LearnWorlds signal',
      surfaceLabel: 'Threecolts University',
      completionPercent:
        registrationCount > 0 ? Number(((activeCount / registrationCount) * 100).toFixed(1)) : null,
      quizFailRate: null,
      relatedVideoPerformance: null,
      note: 'Matched to overall LearnWorlds activation and activity signals, not a single course.',
    };
  }

  const progressRows = learnWorldsNormalizedData.lw_course_progress.filter(
    (row) => row.course_id === course.course_id
  );
  const activity = learnWorldsNormalizedData.indexes?.activityAnalyticsByCourseId?.get(course.course_id) || null;
  const completedRows = progressRows.filter((row) => row.is_completed).length;
  const completionPercent =
    progressRows.length > 0 ? Number(((completedRows / progressRows.length) * 100).toFixed(1)) : null;
  const quizFailRate =
    activity?.success_rate !== null && activity?.success_rate !== undefined
      ? Number((100 - activity.success_rate).toFixed(1))
      : activity?.avg_score_rate !== null && activity?.avg_score_rate !== undefined
        ? Number((100 - activity.avg_score_rate).toFixed(1))
        : null;
  const relatedVideoPerformance =
    activity?.video_viewing_time ?? activity?.video_time ?? null;

  return {
    hasSignal: true,
    title: 'LearnWorlds signal',
    surfaceLabel: course.course_name,
    completionPercent,
    quizFailRate,
    relatedVideoPerformance,
    learners: activity?.students ?? progressRows.length,
    note: activity
      ? 'Course analytics and progress rows point to a matching learning surface.'
      : 'Matched through course progress rows only.',
  };
}

function buildRankedActions(initiative, improvementType, estimatedDeflection) {
  const primary = initiative?.recommendation?.primary;
  const secondary = initiative?.recommendation?.secondary || [];

  return [
    primary
      ? {
          rank: 'Primary',
          text: primary,
          estimatedDeflection,
        }
      : null,
    ...secondary.map((text, index) => ({
      rank: 'Secondary',
      text,
      estimatedDeflection: Math.max(0, Math.round(estimatedDeflection * (index === 0 ? 0.45 : 0.28))),
    })),
  ].filter(Boolean);
}

function deriveUserPhrasing(problem, intercomEvidence) {
  if (intercomEvidence?.userPhrasing?.length) {
    return intercomEvidence.userPhrasing;
  }

  return problem?.examples || [];
}

const toCoverageRows = (existingCoverage) =>
  Object.entries(COVERAGE_LABELS).map(([key, label]) => ({
    key,
    label,
    state: existingCoverage?.[key]?.state ?? 'unknown',
    stateLabel: COVERAGE_STATE_LABELS[existingCoverage?.[key]?.state] ?? 'unknown',
    refresh_signal: existingCoverage?.[key]?.refresh_signal ?? 'unknown',
    explanation: existingCoverage?.[key]?.explanation ?? '',
    matches: existingCoverage?.[key]?.matches ?? [],
  }));

const sortInitiatives = (initiatives) =>
  [...initiatives].sort((left, right) => {
    const byPriority =
      (PRIORITY_ORDER[left.priority] ?? 99) - (PRIORITY_ORDER[right.priority] ?? 99);

    if (byPriority !== 0) {
      return byPriority;
    }

    const byCadence =
      (CADENCE_ORDER[left.suggested_cadence] ?? 99) -
      (CADENCE_ORDER[right.suggested_cadence] ?? 99);

    if (byCadence !== 0) {
      return byCadence;
    }

    const byOwnerArea =
      (OWNER_AREA_ORDER_MAP[left.owner_area] ?? 99) -
      (OWNER_AREA_ORDER_MAP[right.owner_area] ?? 99);

    if (byOwnerArea !== 0) {
      return byOwnerArea;
    }

    return left.title.localeCompare(right.title);
  });

const sortRuleStatuses = (ruleStatuses) =>
  [...ruleStatuses].sort((left, right) => {
    const bySupportState =
      (SUPPORT_STATE_ORDER[left.support_state] ?? 99) -
      (SUPPORT_STATE_ORDER[right.support_state] ?? 99);

    if (bySupportState !== 0) {
      return bySupportState;
    }

    return left.category.localeCompare(right.category);
  });

const groupInitiatives = (initiatives) =>
  OWNER_AREA_ORDER.map((ownerArea) => ({
    owner_area: ownerArea,
    items: initiatives.filter((initiative) => initiative.owner_area === ownerArea),
  })).filter((group) => group.items.length > 0);

export const buildInitiativesViewModel = ({
  intercomNormalizedData = null,
  intercomSourceMeta = null,
  learnWorldsNormalizedData = null,
  learnWorldsSourceMeta = null,
  filters,
  comparisonGranularity = 'monthly',
}) => {
  const engineResult = buildInitiativeRecommendations({
    intercomNormalizedData,
    intercomSourceMeta,
    learnWorldsNormalizedData,
    learnWorldsSourceMeta,
    filters,
    comparisonGranularity,
  });

  const sortedInitiatives = sortInitiatives(engineResult.initiatives).map((initiative) => ({
    ...initiative,
    priorityLabel: PRIORITY_LABELS[initiative.priority] ?? initiative.priority,
    cadenceLabel: CADENCE_LABELS[initiative.suggested_cadence] ?? initiative.suggested_cadence,
    supportStateLabel: SUPPORT_STATE_LABELS[initiative.support_state] ?? initiative.support_state,
    coverageRows: toCoverageRows(initiative.existing_coverage),
    actionLabel: derivePrimaryAction(initiative),
    actionSummary: deriveActionSummary(initiative),
    reasonSummary: deriveReasonSummary(initiative),
    metricSummary: deriveMetricSummary(initiative),
    productLabel: inferProductLabel(initiative),
    focusLabel: inferFocusLabel(initiative),
    primaryAction: derivePrimaryAction(initiative),
    secondaryActions: deriveSecondaryActions(initiative),
    interventionTypes: deriveInterventionTypes(initiative),
    interventionTypeLabels: deriveInterventionTypes(initiative).map(
      (type) => INTERVENTION_LABELS[type] ?? type
    ),
    contentState: deriveContentState(initiative),
  }));

  const enrichedInitiatives = sortedInitiatives.map((initiative) => {
    const canonicalTopic = resolveCanonicalTopic(initiative.topic || initiative.focusLabel || '');
    const recommendedContent = matchContentToInitiative(initiative);
    const formattedContent = formatRecommendedContent(recommendedContent);
    const baseGap = detectContentGap(recommendedContent, initiative);
    const coverageGap = detectCoverageGap(recommendedContent, canonicalTopic);
    const impactScore = calculateImpactScore({
      ...initiative,
      contentGap: baseGap,
      coverageGap,
    });
    const recommendation = generateRecommendation({
      ...initiative,
      contentGap: baseGap,
      coverageGap,
      canonicalTopic,
    });
    const problem = buildProblemModel(initiative);
    const impact = buildImpactModel(initiative);
    const content = buildContentModel({
      formattedContent,
      coverageGap,
      baseGap,
    });
    const recommendationModel = buildRecommendationModel(initiative, recommendation);
    const contentStatus = deriveContentStatus({
      baseGap,
      coverageGap,
      formattedContent,
    });
    const improvementTargets = deriveImprovementTargets(initiative, {
      formattedContent,
      coverageGap,
      canonicalTopic,
    });
    const initiativeKind = deriveInitiativeKind(initiative, improvementTargets);
    const teamGroup = deriveTeamGroup(initiative, improvementTargets, initiativeKind);
    const teamGroupLabel = AI_HUB_TEAM_LABELS[teamGroup] ?? AI_HUB_TEAM_LABELS.cross_functional;
    const recommendedOwner = deriveRecommendedOwner(teamGroup, improvementTargets);
    const contentSurface = deriveContentSurface(improvementTargets);
    const impactSummary = buildImpactSummary(impact);
    const evidenceSummary = deriveEvidenceSummary(initiative);
    const actionSummary = deriveHubActionSummary(
      initiative,
      recommendationModel,
      improvementTargets
    );
    const sourceSummary = deriveSourceSummary(initiative);
    const improvementType = deriveImprovementType(initiative, improvementTargets);
    const ownerTeam = deriveOwnerTeam(initiative, improvementType);
    const primarySignal = getPrimarySignal(initiative);
    const trendDelta = Number(primarySignal?.delta_value ?? 0);
    const trendDirection = trendDelta > 0 ? 'increasing' : trendDelta < 0 ? 'decreasing' : 'stable';
    const estimatedDeflection = deriveEstimatedDeflection(
      { ...initiative, impact },
      contentStatus,
      improvementType,
      trendDirection
    );
    const sourceSignals = deriveSourceSignals(initiative);
    const sourceSurfaces = deriveSourceSurfaces(sourceSignals);
    const intercomEvidence = buildIntercomEvidence(
      { ...initiative, canonicalTopic, impact, trendDirection, trendDelta, sourceSummary },
      intercomNormalizedData,
      filters
    );
    const learnWorldsEvidence = buildLearnWorldsEvidence(
      { ...initiative, canonicalTopic, recommendedContent, sourceSummary },
      learnWorldsNormalizedData
    );
    const userPhrasing = deriveUserPhrasing(problem, intercomEvidence);
    const rankedActions = buildRankedActions(
      { ...initiative, recommendation: recommendationModel },
      improvementType,
      estimatedDeflection
    );
    const coverageGapPercent = contentStatus === 'missing' ? 100 : contentStatus === 'partial' ? 50 : 0;
    const impactLine = `${Number(impact.volume || 0).toLocaleString()} ${
      impact.unit === 'conversations' ? 'conversations' : impact.unit || 'signals'
    } · ${trendDirection === 'increasing' ? '↑' : trendDirection === 'decreasing' ? '↓' : '→'} ${
      Math.abs(trendDelta)
    } · ${COVERAGE_STATUS_LABELS[contentStatus] || contentStatus}`;

    return {
      ...initiative,
      recommendedContent: formattedContent,
      primaryAction: determinePrimaryAction(initiative),
      contentGap: baseGap,
      coverageGap,
      impactScore,
      canonicalTopic,
      problem,
      impact,
      content,
      recommendation: recommendationModel,
      fix: recommendationModel.primary,
      contentDecision: deriveContentDecision({
        contentGap: baseGap,
        coverageGap,
        formattedContent,
      }),
      examples: problem.examples,
      teamGroup,
      teamGroupLabel,
      initiativeKind,
      contentSurface,
      recommendedOwner,
      impactSummary,
      issueSummary: problem.summary,
      evidenceSummary,
      actionSummary,
      contentStatus,
      sourceSummary,
      improvementTargets,
      improvementTargetLabels: improvementTargets.map(
        (target) => IMPROVEMENT_TARGET_LABELS[target] ?? target
      ),
      improvementType,
      improvementTypeLabel: IMPROVEMENT_TYPE_LABELS[improvementType] ?? improvementType,
      ownerTeam,
      ownerTeamLabel: OWNER_TEAM_LABELS[ownerTeam] ?? ownerTeam,
      sourceSignals,
      sourceSurfaces,
      estimatedDeflection,
      trendDirection,
      trendDelta,
      intercomEvidence,
      learnWorldsEvidence,
      userPhrasing,
      rankedActions,
      coverageGapPercent,
      impactLine,
    };
  }).sort((left, right) => right.impactScore - left.impactScore);

  const sortedRuleStatuses = sortRuleStatuses(engineResult.rule_statuses).map((ruleStatus) => ({
    ...ruleStatus,
    supportStateLabel:
      SUPPORT_STATE_LABELS[ruleStatus.support_state] ?? ruleStatus.support_state,
  }));

  const groupedInitiatives = groupInitiatives(enrichedInitiatives);

  return {
    ...engineResult,
    initiatives: enrichedInitiatives,
    groupedInitiatives,
    rule_statuses: sortedRuleStatuses,
    summaryCard: {
      totalInitiatives: enrichedInitiatives.length,
      topInitiatives: enrichedInitiatives.slice(0, 2),
      priorityBreakdown: {
        high: engineResult.summary.priorities.high ?? 0,
        medium: engineResult.summary.priorities.medium ?? 0,
        low: engineResult.summary.priorities.low ?? 0,
      },
      cadenceBreakdown: {
        this_week: enrichedInitiatives.filter(
          (initiative) => initiative.suggested_cadence === 'this_week'
        ).length,
        this_month: enrichedInitiatives.filter(
          (initiative) => initiative.suggested_cadence === 'this_month'
        ).length,
        backlog: enrichedInitiatives.filter(
          (initiative) => initiative.suggested_cadence === 'backlog'
        ).length,
      },
      ownerAreaBreakdown: Object.entries(engineResult.summary.owner_areas)
        .sort(
          ([leftArea, leftCount], [rightArea, rightCount]) =>
            rightCount - leftCount ||
            (OWNER_AREA_ORDER_MAP[leftArea] ?? 99) - (OWNER_AREA_ORDER_MAP[rightArea] ?? 99)
        )
        .slice(0, 3)
        .map(([ownerArea, count]) => ({ ownerArea, count })),
    },
  };
};
