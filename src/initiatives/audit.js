import { buildExistingCoveragePlaceholder } from './model.js';

const COVERAGE_SOURCE_KEYS = [
  'intercom_help_center',
  'learnworlds_blog',
  'learnworlds_class',
  'learnworlds_course',
];

const GENERIC_TERMS = new Set([
  'about',
  'action',
  'actions',
  'agent',
  'agents',
  'audit',
  'before',
  'blog',
  'center',
  'clearer',
  'content',
  'course',
  'courses',
  'create',
  'current',
  'customer',
  'customers',
  'education',
  'entry',
  'experience',
  'help',
  'initiative',
  'learn',
  'learner',
  'learners',
  'more',
  'need',
  'needs',
  'next',
  'path',
  'period',
  'refresh',
  'review',
  'selected',
  'series',
  'should',
  'stronger',
  'student',
  'students',
  'support',
  'surface',
  'their',
  'this',
  'through',
  'university',
  'update',
  'users',
  'using',
  'with',
]);

const normalizeText = (value) =>
  (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const unique = (values) => [...new Set(values.filter(Boolean))];

const tokenize = (value) =>
  unique(
    normalizeText(value)
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length >= 4 && !GENERIC_TERMS.has(token))
  );

const collectSignalPhrases = (initiative) => {
  const phrases = [];

  initiative.source_signals.forEach((signal) => {
    const details = signal.details || {};

    (details.top_matches || []).forEach((match) => {
      if (match?.name) {
        phrases.push(match.name);
      }
    });

    if (details.course_name) {
      phrases.push(details.course_name);
    }
  });

  return unique(
    phrases
      .map(normalizeText)
      .filter((phrase) => phrase.length >= 4 && !GENERIC_TERMS.has(phrase))
  );
};

const collectCandidateTerms = (initiative) => {
  const signalPhrases = collectSignalPhrases(initiative);
  const textTokens = tokenize(
    [
      initiative.title,
      initiative.signal_detected,
      initiative.suggested_action,
      initiative.suggested_format,
      initiative.owner_area,
    ].join(' ')
  );

  return {
    phrases: signalPhrases,
    tokens: unique([...signalPhrases.flatMap(tokenize), ...textTokens]),
  };
};

const buildCoverageStateSummary = (coverage) => {
  const states = COVERAGE_SOURCE_KEYS.map((key) => coverage[key]?.state).filter(
    (state) => state && state !== 'not_applicable'
  );

  if (states.length === 0) {
    return 'not_applicable';
  }

  if (states.every((state) => state === 'found')) {
    return 'found';
  }

  if (states.some((state) => state === 'found')) {
    return 'partial';
  }

  if (states.every((state) => state === 'not_found')) {
    return 'not_found';
  }

  return 'unknown';
};

const buildLearnWorldsCourseCatalog = (learnWorldsNormalizedData) =>
  learnWorldsNormalizedData?.lw_courses?.map((course) => ({
    title: course.course_name,
    url: course.course_url || null,
    course_id: course.course_id,
    categories: course.categories || [],
    tags: [],
    searchable_text: normalizeText([course.course_name, ...(course.categories || [])].join(' ')),
    freshness: course.updated_at || course.created_at || null,
    content_type: 'course',
  })) ?? [];

const buildIntercomHelpCenterCatalog = (intercomSourceMeta) =>
  intercomSourceMeta?.contentCatalog?.intercom_help_center?.connected
    ? (intercomSourceMeta.contentCatalog.intercom_help_center.items || []).map((item) => ({
        title: item.title,
        url: item.url || null,
        categories: [item.category, item.section].filter(Boolean),
        tags: item.tags || [],
        searchable_text:
          item.searchable_text ||
          normalizeText([item.title, item.category, item.section, ...(item.tags || [])].join(' ')),
        freshness: item.freshness || null,
        content_type: 'help_center_article',
      }))
    : null;

const buildLearnWorldsBlogCatalog = (learnWorldsSourceMeta) =>
  learnWorldsSourceMeta?.contentCatalog?.learnworlds_blog?.connected
    ? (learnWorldsSourceMeta.contentCatalog.learnworlds_blog.items || []).map((item) => ({
        title: item.title,
        url: item.url || null,
        categories: item.categories || [],
        tags: item.tags || [],
        searchable_text:
          item.searchable_text ||
          normalizeText([item.title, ...(item.categories || []), ...(item.tags || [])].join(' ')),
        freshness: item.freshness || null,
        content_type: 'blog',
      }))
    : null;

const buildLearnWorldsClassCatalog = (learnWorldsSourceMeta) =>
  learnWorldsSourceMeta?.contentCatalog?.learnworlds_class?.connected
    ? (learnWorldsSourceMeta.contentCatalog.learnworlds_class.items || []).map((item) => ({
        title: item.title,
        url: item.url || null,
        categories: item.categories || [],
        tags: item.tags || [],
        searchable_text:
          item.searchable_text ||
          normalizeText([item.title, ...(item.categories || []), ...(item.tags || [])].join(' ')),
        freshness: item.freshness || null,
        content_type: 'class',
      }))
    : null;

const buildUnknownConnectedSource = (explanation) => ({
  state: 'unknown',
  matches: [],
  explanation,
  connected: true,
});

const getFreshnessDays = (timestamp) => {
  if (!timestamp) {
    return null;
  }

  const parsed = Date.parse(timestamp);

  if (Number.isNaN(parsed)) {
    return null;
  }

  return Math.max(0, Math.floor((Date.now() - parsed) / (1000 * 60 * 60 * 24)));
};

const getFreshnessWeight = (timestamp) => {
  const freshnessDays = getFreshnessDays(timestamp);

  if (freshnessDays === null) {
    return 0;
  }

  if (freshnessDays <= 30) return 16;
  if (freshnessDays <= 90) return 12;
  if (freshnessDays <= 180) return 8;
  if (freshnessDays <= 365) return 4;
  return 1;
};

const getFreshnessLabel = (timestamp) => {
  const freshnessDays = getFreshnessDays(timestamp);

  if (freshnessDays === null) {
    return 'Freshness unknown';
  }

  if (freshnessDays <= 30) {
    return 'Recently updated';
  }

  if (freshnessDays <= 180) {
    return 'Updated this year';
  }

  return 'Older content';
};

const getStaleThresholdDays = (contentType) => {
  if (contentType === 'help_center_article') return 180;
  if (contentType === 'blog') return 270;
  if (contentType === 'class') return 365;
  if (contentType === 'course') return 365;
  return 270;
};

const getFreshnessState = (timestamp, contentType) => {
  const freshnessDays = getFreshnessDays(timestamp);

  if (freshnessDays === null) {
    return 'unknown';
  }

  return freshnessDays > getStaleThresholdDays(contentType) ? 'stale' : 'recent';
};

const getContentTypePreferenceWeight = (initiative, contentType) => {
  const format = initiative.suggested_format || '';

  if (format.includes('help_center') && contentType === 'help_center_article') return 8;
  if (format.includes('blog') && contentType === 'blog') return 6;
  if (format.includes('class') && contentType === 'class') return 8;
  if (format.includes('course') && contentType === 'course') return 6;
  return 0;
};

const matchMetadataCatalog = ({
  initiative,
  catalog,
  sourceLabel,
  entryLabel,
  contentType,
  unavailableExplanation,
}) => {
  const { phrases, tokens } = collectCandidateTerms(initiative);

  if (!catalog) {
    return {
      state: 'unknown',
      matches: [],
      explanation: unavailableExplanation,
      connected: false,
    };
  }

  if (catalog.length === 0) {
    return buildUnknownConnectedSource(
      `${sourceLabel} is connected, but no ${entryLabel} metadata was available in the current dataset.`
    );
  }

  if (phrases.length === 0 && tokens.length === 0) {
    return buildUnknownConnectedSource(
      `The current initiative does not have specific enough ${entryLabel} terms to audit conservatively.`
    );
  }

  const matches = catalog
    .map((entry) => {
      const searchableText = entry.searchable_text || '';
      const exactPhrase = phrases.find(
        (phrase) => phrase === normalizeText(entry.title) || searchableText.includes(phrase)
      );
      const taxonomyTerms = [...(entry.categories || []), ...(entry.tags || [])].map(normalizeText);
      const taxonomyMatch = tokens.find((token) => taxonomyTerms.includes(token));
      const overlappingTokens = tokens.filter((token) => searchableText.includes(token));

      if (!exactPhrase && !taxonomyMatch && overlappingTokens.length < 2) {
        return null;
      }

      let matchBasis = 'title_keyword';
      let baseScore = 74;
      let explanation = `Matched "${entry.title}" from ${sourceLabel}.`;

      if (exactPhrase && exactPhrase === normalizeText(entry.title)) {
        matchBasis = 'exact_title';
        baseScore = 100;
        explanation = `Matched the title "${entry.title}" exactly.`;
      } else if (taxonomyMatch) {
        matchBasis = 'category_keyword';
        baseScore = 64;
        explanation = `Matched the category/tag keyword "${taxonomyMatch}".`;
      } else if (overlappingTokens.length >= 2) {
        matchBasis = 'multi_keyword_overlap';
        baseScore = 68 + Math.min(overlappingTokens.length, 4) * 4;
        explanation = `Matched multiple metadata keywords: ${overlappingTokens
          .slice(0, 3)
          .join(', ')}.`;
      } else if (exactPhrase) {
        explanation = `Matched the title or taxonomy text with "${exactPhrase}".`;
      }

      const freshnessState = getFreshnessState(entry.freshness, entry.content_type || contentType);
      const freshnessWeight = getFreshnessWeight(entry.freshness);
      const contentTypePreferenceWeight = getContentTypePreferenceWeight(
        initiative,
        entry.content_type || contentType
      );
      const score = baseScore + freshnessWeight + contentTypePreferenceWeight;

      return {
        title: entry.title,
        content_type: entry.content_type || contentType,
        url: entry.url || null,
        match_basis: matchBasis,
        freshness: entry.freshness || null,
        freshness_label: getFreshnessLabel(entry.freshness),
        freshness_state: freshnessState,
        may_need_refresh: freshnessState === 'stale',
        match_score: score,
        explanation:
          freshnessState === 'stale'
            ? `${explanation} Coverage exists, but the latest matching content looks older and may need refresh.`
            : freshnessWeight > 0
              ? `${explanation} ${getFreshnessLabel(entry.freshness)}.`
              : explanation,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if ((right.match_score || 0) !== (left.match_score || 0)) {
        return (right.match_score || 0) - (left.match_score || 0);
      }

      const leftFreshness = getFreshnessDays(left.freshness);
      const rightFreshness = getFreshnessDays(right.freshness);

      if (leftFreshness !== null && rightFreshness !== null && leftFreshness !== rightFreshness) {
        return leftFreshness - rightFreshness;
      }

      return left.title.localeCompare(right.title);
    })
    .map((match, index) => ({
      ...match,
      rank: index + 1,
      is_top_match: index === 0,
    }))
    .slice(0, 3);

  if (matches.length === 0) {
    return {
      state: 'not_found',
      matches: [],
      explanation: `${sourceLabel} is connected, but no ${entryLabel} titles, categories, or tags matched the current initiative terms.`,
      connected: true,
    };
  }

  const topMatch = matches[0];
  const allMatchesStale = matches.every((match) => match.may_need_refresh);

  return {
    state: 'found',
    matches,
    refresh_signal:
      topMatch?.may_need_refresh || allMatchesStale
        ? 'may_need_refresh'
        : topMatch?.freshness_state === 'recent'
          ? 'current'
          : 'unknown',
    explanation:
      topMatch?.may_need_refresh || allMatchesStale
        ? `Found ${matches.length} ${entryLabel} match${matches.length === 1 ? '' : 'es'} from ${sourceLabel}, but the strongest evidence may need refresh.`
        : `Found ${matches.length} ${entryLabel} match${matches.length === 1 ? '' : 'es'} from ${sourceLabel}.`,
    connected: true,
  };
};

const enrichCoverageSource = ({
  key,
  baseSource,
  initiative,
  intercomSourceMeta,
  learnWorldsNormalizedData,
  learnWorldsSourceMeta,
}) => {
  if (baseSource.state === 'not_applicable') {
    return baseSource;
  }

  if (key === 'intercom_help_center') {
    return {
      ...baseSource,
      ...matchMetadataCatalog({
        initiative,
        catalog: buildIntercomHelpCenterCatalog(intercomSourceMeta),
        sourceLabel: 'Intercom Help Center metadata',
        entryLabel: 'Help Center article',
        contentType: 'help_center_article',
        unavailableExplanation:
          'Intercom Help Center article metadata is not connected in the current project yet.',
      }),
    };
  }

  if (key === 'learnworlds_blog') {
    return {
      ...baseSource,
      ...matchMetadataCatalog({
        initiative,
        catalog: buildLearnWorldsBlogCatalog(learnWorldsSourceMeta),
        sourceLabel: 'LearnWorlds blog metadata',
        entryLabel: 'blog post',
        contentType: 'blog',
        unavailableExplanation:
          'LearnWorlds blog metadata is not connected in the current project yet.',
      }),
    };
  }

  if (key === 'learnworlds_class') {
    return {
      ...baseSource,
      ...matchMetadataCatalog({
        initiative,
        catalog: buildLearnWorldsClassCatalog(learnWorldsSourceMeta),
        sourceLabel: 'LearnWorlds class metadata',
        entryLabel: 'class',
        contentType: 'class',
        unavailableExplanation:
          'LearnWorlds class metadata is not connected in the current project yet.',
      }),
    };
  }

  if (key === 'learnworlds_course') {
    return {
      ...baseSource,
      ...matchMetadataCatalog({
        initiative,
        catalog: buildLearnWorldsCourseCatalog(learnWorldsNormalizedData),
        sourceLabel: 'LearnWorlds course metadata',
        entryLabel: 'course',
        contentType: 'course',
        unavailableExplanation:
          'LearnWorlds course metadata is not currently connected in this dataset.',
      }),
    };
  }

  return baseSource;
};

export const enrichInitiativeCoverage = ({
  initiative,
  intercomSourceMeta = null,
  learnWorldsNormalizedData = null,
  learnWorldsSourceMeta = null,
}) => {
  const baseCoverage =
    initiative.existing_coverage ?? buildExistingCoveragePlaceholder({ relevantSurfaces: [] });

  const coverage = {
    ...baseCoverage,
    intercom_help_center: enrichCoverageSource({
      key: 'intercom_help_center',
      baseSource: baseCoverage.intercom_help_center,
      intercomSourceMeta,
      learnWorldsNormalizedData,
      learnWorldsSourceMeta,
      initiative,
    }),
    learnworlds_blog: enrichCoverageSource({
      key: 'learnworlds_blog',
      baseSource: baseCoverage.learnworlds_blog,
      intercomSourceMeta,
      learnWorldsNormalizedData,
      learnWorldsSourceMeta,
      initiative,
    }),
    learnworlds_class: enrichCoverageSource({
      key: 'learnworlds_class',
      baseSource: baseCoverage.learnworlds_class,
      intercomSourceMeta,
      learnWorldsNormalizedData,
      learnWorldsSourceMeta,
      initiative,
    }),
    learnworlds_course: enrichCoverageSource({
      key: 'learnworlds_course',
      baseSource: baseCoverage.learnworlds_course,
      intercomSourceMeta,
      learnWorldsNormalizedData,
      learnWorldsSourceMeta,
      initiative,
    }),
  };

  return {
    ...initiative,
    existing_coverage: {
      ...coverage,
      audit_state: buildCoverageStateSummary(coverage),
      note: 'Coverage audit uses conservative metadata, freshness, and keyword ranking in Phase 6.',
    },
  };
};

export const enrichInitiativesWithCoverage = ({
  initiatives,
  intercomSourceMeta = null,
  learnWorldsNormalizedData = null,
  learnWorldsSourceMeta = null,
}) =>
  initiatives.map((initiative) =>
    enrichInitiativeCoverage({
      initiative,
      intercomSourceMeta,
      learnWorldsNormalizedData,
      learnWorldsSourceMeta,
    })
  );
