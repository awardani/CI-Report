const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const VALID_RATING_VALUES = new Set(['1', '2', '3', '4', '5']);
const VALID_BOOLEAN_VALUES = new Set(['true', 'false']);
const VALID_FIN_RESOLUTION_VALUES = new Set([
  'Assumed resolved',
  'Confirmed resolved',
  'Escalated',
  'Negative feedback',
]);

const SOURCE_SCHEMAS = {
  conversationRows: {
    label: 'data.csv',
    requiredColumns: [
      'Conversation ID',
      'Conversation started at (America/New_York)',
      'Started by',
      'Conversation source',
      'Team currently assigned',
      'Teammate currently assigned',
      'Fin AI Agent involved',
      'Fin AI Agent deflected',
      'Fin AI Agent resolution state',
    ],
    allowedColumns: [
      'Conversation ID',
      'Conversation started at (America/New_York)',
      'Teammate currently assigned',
      'Team currently assigned',
      'Agent type',
      'Channel',
      'Chatbot replied',
      'Conversation tag',
      'Current conversation state',
      'Last teammate rating',
      'Last teammate rating remark',
      'Started by',
      'Ticket type',
      'Topics',
      'Conversation first closed at (America/New_York)',
      'Conversation first replied at (America/New_York)',
      'Fin AI Agent rating updated at (America/New_York)',
      'Fin AI Agent deflected',
      'Fin AI Agent involved',
      'Fin AI Agent last sent answer',
      'Fin AI Agent rating',
      'Fin AI Agent rating remark',
      'Fin AI Agent resolution state',
      'Fin content referenced',
      'Call types',
      'With calls',
      'Call participants',
      'First closed by teammate',
      'Last closed by teammate',
      'Last teammate rated',
      'Last teammate rated ID',
      'Teammate currently assigned ID',
      'Teammate first replied',
      'Teammate replied to',
      'Team currently assigned ID',
      'First response time (seconds)',
      'First response time excluding time spent in bot inbox (seconds)',
      'First response time excluding time spent in bot inbox, only within office hours (seconds)',
      'First response time, only within office hours (seconds)',
      'Number of reassignments',
      'Replies to close a conversation',
      'Handling time (seconds)',
      'Time from first assignment to close (seconds)',
      'Time from first assignment to close, within office hours (seconds)',
      'Time to close (seconds)',
      'Time to close excluding bot inbox time (seconds)',
      'Time to close excluding bot inbox time, within office hours (seconds)',
      'Time to close, within office hours (seconds)',
      'Time to first close (seconds)',
      'Time to first close excluding bot inbox time (seconds)',
      'Time to first close excluding bot inbox time, within office hours (seconds)',
      'Time to first close, within office hours (seconds)',
      'Conversation priority',
      'Conversation source',
      'CX Score explanation',
      'CX Score rating',
      'Resolved on first contact',
      'Source URL',
      'Title',
      'Conversation created at (America/New_York)',
      'Conversation last closed at (America/New_York)',
      'Conversation updated at (America/New_York)',
      'First assignment at (America/New_York)',
      'Last assignment at (America/New_York)',
      'Escalation rules applied',
      'Fin answer coverage',
      'Guidance applied',
      'Last chatbot rated',
      'Last chatbot rating',
      'Last chatbot rating remark',
      'Last closed by',
      'Last closed by ID',
      'Time to assignment before first admin reply (seconds)',
      'Time to assignment before first admin reply, within office hours (seconds)',
      'Conversation URL',
      'User participant emails',
      'User participant IDs',
      'User participant names',
      'Copilot used',
      'Customer reports',
      'Ticket category',
      'Company ID',
      'Company name',
      'Company plan',
      'Company size',
      'Company tag',
      'Continent',
      'Country',
      'User email',
      'User ID',
      'User name',
      'User pseudonym',
      'User tag',
      'User type',
      'AI Issue summary',
      'AI Subtopic',
      'AI Topic',
    ],
    timestampColumns: ['Conversation started at (America/New_York)'],
    ratingColumns: [],
    booleanColumns: ['Fin AI Agent involved', 'Fin AI Agent deflected'],
    finResolutionColumns: ['Fin AI Agent resolution state'],
  },
  satisfactionRows: {
    label: 'csat.csv',
    requiredColumns: [
      'Conversation ID',
      'Updated at (America/New_York)',
      'Conversation rating',
      'Agent rated type',
    ],
    allowedColumns: [
      'Conversation ID',
      'Updated at (America/New_York)',
      'Conversation rating remark',
      'Conversation rating',
      'User name',
      'Company name',
      'Agent rated type',
      'Last survey sent',
    ],
    timestampColumns: ['Updated at (America/New_York)'],
    ratingColumns: ['Conversation rating'],
    booleanColumns: [],
    finResolutionColumns: [],
  },
  finSatisfactionRows: {
    label: 'fin_csat.csv',
    requiredColumns: [
      'Conversation ID',
      'Updated at (America/New_York)',
      'Conversation rating',
      'Fin AI Agent involved',
    ],
    allowedColumns: [
      'Conversation ID',
      'Updated at (America/New_York)',
      'Conversation rating remark',
      'Conversation rating',
      'User name',
      'Company name',
      'Last survey sent',
      'Fin AI Agent involved',
    ],
    timestampColumns: ['Updated at (America/New_York)'],
    ratingColumns: ['Conversation rating'],
    booleanColumns: ['Fin AI Agent involved'],
    finResolutionColumns: [],
  },
  finDeflectionRows: {
    label: 'fin_deflection.csv',
    requiredColumns: [
      'Conversation ID',
      'Conversation started at (America/New_York)',
      'Fin AI Agent deflected',
    ],
    allowedColumns: [
      'Conversation ID',
      'Conversation started at (America/New_York)',
      'Fin AI Agent deflected',
      'Topics',
      'AI Subtopic',
      'AI Topic',
    ],
    timestampColumns: ['Conversation started at (America/New_York)'],
    ratingColumns: [],
    booleanColumns: ['Fin AI Agent deflected'],
    finResolutionColumns: [],
  },
  finResolutionRows: {
    label: 'fin_resolution.csv',
    requiredColumns: [
      'Conversation ID',
      'Conversation started at (America/New_York)',
      'Fin AI Agent resolution state',
    ],
    allowedColumns: [
      'Conversation ID',
      'Conversation started at (America/New_York)',
      'Fin AI Agent resolution state',
      'Fin AI Agent rating',
      'AI Subtopic',
      'AI Topic',
    ],
    timestampColumns: ['Conversation started at (America/New_York)'],
    ratingColumns: ['Fin AI Agent rating'],
    booleanColumns: [],
    finResolutionColumns: ['Fin AI Agent resolution state'],
  },
};

const getHeaders = (rows) => {
  if (rows.length === 0) {
    return [];
  }

  return Object.keys(rows[0]);
};

const countEmptyOrInvalidTimestamps = (rows, columnName) =>
  rows.reduce(
    (counts, row) => {
      const value = row[columnName];

      if (!value || value.trim() === '') {
        counts.empty += 1;
      } else if (!TIMESTAMP_PATTERN.test(value.trim())) {
        counts.invalid += 1;
      }

      return counts;
    },
    { empty: 0, invalid: 0 }
  );

const countInvalidValues = (rows, columnName, validValues) =>
  rows.reduce((count, row) => {
    const value = row[columnName];
    if (!value || value.trim() === '') return count;
    return validValues.has(value.trim()) ? count : count + 1;
  }, 0);

const buildSourceValidation = (rows, schema) => {
  const headers = getHeaders(rows);
  const headerSet = new Set(headers);
  const missingRequiredColumns = schema.requiredColumns.filter((column) => !headerSet.has(column));
  const unexpectedColumns = headers.filter((column) => !schema.allowedColumns.includes(column));

  const timestampIssues = schema.timestampColumns.map((columnName) => ({
    columnName,
    ...countEmptyOrInvalidTimestamps(rows, columnName),
  }));

  const invalidRatingCounts = schema.ratingColumns.map((columnName) => ({
    columnName,
    invalidCount: countInvalidValues(rows, columnName, VALID_RATING_VALUES),
  }));

  const invalidBooleanCounts = schema.booleanColumns.map((columnName) => ({
    columnName,
    invalidCount: countInvalidValues(rows, columnName, VALID_BOOLEAN_VALUES),
  }));

  const invalidFinResolutionCounts = schema.finResolutionColumns.map((columnName) => ({
    columnName,
    invalidCount: countInvalidValues(rows, columnName, VALID_FIN_RESOLUTION_VALUES),
  }));

  const warnings = [];

  if (missingRequiredColumns.length > 0) {
    warnings.push(`${schema.label}: missing required columns: ${missingRequiredColumns.join(', ')}`);
  }

  if (unexpectedColumns.length > 0) {
    warnings.push(`${schema.label}: unexpected columns detected: ${unexpectedColumns.join(', ')}`);
  }

  timestampIssues.forEach((issue) => {
    if (issue.empty > 0 || issue.invalid > 0) {
      warnings.push(
        `${schema.label}: timestamp issues in ${issue.columnName} (empty=${issue.empty}, invalid=${issue.invalid})`
      );
    }
  });

  invalidRatingCounts.forEach((issue) => {
    if (issue.invalidCount > 0) {
      warnings.push(`${schema.label}: invalid rating values in ${issue.columnName} (${issue.invalidCount})`);
    }
  });

  invalidBooleanCounts.forEach((issue) => {
    if (issue.invalidCount > 0) {
      warnings.push(`${schema.label}: invalid boolean values in ${issue.columnName} (${issue.invalidCount})`);
    }
  });

  invalidFinResolutionCounts.forEach((issue) => {
    if (issue.invalidCount > 0) {
      warnings.push(
        `${schema.label}: invalid Fin resolution values in ${issue.columnName} (${issue.invalidCount})`
      );
    }
  });

  return {
    label: schema.label,
    rowCount: rows.length,
    headers,
    missingRequiredColumns,
    unexpectedColumns,
    timestampIssues,
    invalidRatingCounts,
    invalidBooleanCounts,
    invalidFinResolutionCounts,
    warnings,
  };
};

const summarizeNormalizedData = (normalizedData) => {
  const ratings = normalizedData.ratings;
  const finOutcomes = normalizedData.fin_outcomes;

  const joinStats = {
    unmatchedRatings: ratings.filter((rating) => !rating.conversation_found).length,
    unmatchedSatisfactionRatings: ratings.filter(
      (rating) => rating.rating_source === 'satisfaction' && !rating.conversation_found
    ).length,
    unmatchedFinRatings: ratings.filter(
      (rating) => rating.rating_source === 'fin_satisfaction' && !rating.conversation_found
    ).length,
  };

  const metadataStats = {
    ratingsMissingTeamMetadata: ratings.filter((rating) => !rating.team_name).length,
    ratingsMissingTeammateMetadata: ratings.filter((rating) => !rating.teammate_name).length,
    teammateRatingsMissingRatedTeammateMetadata: ratings.filter(
      (rating) => rating.rated_agent_type === 'Teammate' && !rating.rated_teammate_name
    ).length,
    finOutcomesMissingTeamMetadata: finOutcomes.filter((item) => !item.team_name).length,
    finOutcomesMissingTeammateMetadata: finOutcomes.filter((item) => !item.teammate_name).length,
  };

  const warnings = [];

  if (joinStats.unmatchedRatings > 0) {
    warnings.push(
      `ratings join: ${joinStats.unmatchedRatings} rating rows could not be matched to conversations by Conversation ID`
    );
  }

  if (metadataStats.ratingsMissingTeamMetadata > 0) {
    warnings.push(
      `ratings metadata: ${metadataStats.ratingsMissingTeamMetadata} rating rows are missing team metadata after join`
    );
  }

  if (metadataStats.ratingsMissingTeammateMetadata > 0) {
    warnings.push(
      `ratings metadata: ${metadataStats.ratingsMissingTeammateMetadata} rating rows are missing teammate metadata after join`
    );
  }

  if (metadataStats.teammateRatingsMissingRatedTeammateMetadata > 0) {
    warnings.push(
      `ratings metadata: ${metadataStats.teammateRatingsMissingRatedTeammateMetadata} teammate rating rows are missing rated teammate metadata`
    );
  }

  return {
    rowCounts: {
      conversations: normalizedData.conversations.length,
      ratings: ratings.length,
      fin_outcomes: finOutcomes.length,
    },
    joinStats,
    metadataStats,
    warnings,
  };
};

export const validateIntercomData = (datasets, normalizedData) => {
  const sourceValidations = Object.fromEntries(
    Object.entries(SOURCE_SCHEMAS).map(([datasetKey, schema]) => [
      datasetKey,
      buildSourceValidation(datasets[datasetKey] ?? [], schema),
    ])
  );

  const normalizedSummary = summarizeNormalizedData(normalizedData);

  return {
    sourceValidations,
    normalizedSummary,
    warnings: [
      ...Object.values(sourceValidations).flatMap((validation) => validation.warnings),
      ...normalizedSummary.warnings,
    ],
  };
};
