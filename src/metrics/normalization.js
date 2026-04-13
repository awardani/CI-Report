const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const VALID_RATING_VALUES = new Set([1, 2, 3, 4, 5]);

const RAW_FIELDS = {
  conversationId: 'Conversation ID',
  conversationStartedAt: 'Conversation started at (America/New_York)',
  conversationRatedAt: 'Updated at (America/New_York)',
  conversationRatingRemark: 'Conversation rating remark',
  startedBy: 'Started by',
  conversationSource: 'Conversation source',
  currentState: 'Current conversation state',
  teamName: 'Team currently assigned',
  teammateName: 'Teammate currently assigned',
  ratedTeammateName: 'Last teammate rated',
  agentRatedType: 'Agent rated type',
  conversationRating: 'Conversation rating',
  finInvolved: 'Fin AI Agent involved',
  finDeflected: 'Fin AI Agent deflected',
  finResolutionState: 'Fin AI Agent resolution state',
  topic: 'AI Topic',
  fallbackTopic: 'Topics',
  subtopic: 'AI Subtopic',
  channel: 'Channel',
  ticketType: 'Ticket type',
  firstResponseSeconds: 'First response time (seconds)',
  userName: 'User name',
  companyName: 'Company name',
};

const normalizeText = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const normalizeInteger = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeRatingValue = (value) => {
  const parsed = normalizeInteger(value);
  return VALID_RATING_VALUES.has(parsed) ? parsed : null;
};

const normalizeBoolean = (value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
};

const normalizeTimestamp = (value) => {
  const normalized = normalizeText(value);
  return normalized && TIMESTAMP_PATTERN.test(normalized) ? normalized : null;
};

const datePart = (timestamp) => (timestamp ? timestamp.split(' ')[0] : null);

const buildDateBounds = (items, fieldName) => {
  const dates = items.map((item) => datePart(item[fieldName])).filter(Boolean);

  if (dates.length === 0) {
    return { minDate: '', maxDate: '' };
  }

  return {
    minDate: dates.reduce((min, value) => (value < min ? value : min), dates[0]),
    maxDate: dates.reduce((max, value) => (value > max ? value : max), dates[0]),
  };
};

const buildConversationRecord = (row) => ({
  conversation_id: normalizeText(row[RAW_FIELDS.conversationId]),
  started_at: normalizeTimestamp(row[RAW_FIELDS.conversationStartedAt]),
  started_by: normalizeText(row[RAW_FIELDS.startedBy]),
  conversation_source: normalizeText(row[RAW_FIELDS.conversationSource]),
  current_state: normalizeText(row[RAW_FIELDS.currentState]),
  team_name: normalizeText(row[RAW_FIELDS.teamName]),
  teammate_name: normalizeText(row[RAW_FIELDS.teammateName]),
  rated_teammate_name: normalizeText(row[RAW_FIELDS.ratedTeammateName]),
  fin_involved: normalizeBoolean(row[RAW_FIELDS.finInvolved]),
  fin_deflected: normalizeBoolean(row[RAW_FIELDS.finDeflected]),
  fin_resolution_state: normalizeText(row[RAW_FIELDS.finResolutionState]),
  topic: normalizeText(row[RAW_FIELDS.topic]) || normalizeText(row[RAW_FIELDS.fallbackTopic]),
  subtopic: normalizeText(row[RAW_FIELDS.subtopic]),
  channel: normalizeText(row[RAW_FIELDS.channel]),
  ticket_type: normalizeText(row[RAW_FIELDS.ticketType]),
  first_response_seconds: normalizeInteger(row[RAW_FIELDS.firstResponseSeconds]),
});

const buildRatingRecord = (row, sourceName, conversationsById, overrides = {}) => {
  const conversationId = normalizeText(row[RAW_FIELDS.conversationId]);
  const conversation = conversationId ? conversationsById.get(conversationId) ?? null : null;
  const ratingValue = normalizeRatingValue(row[RAW_FIELDS.conversationRating]);
  const ratedAgentType =
    overrides.rated_agent_type ??
    normalizeText(row[RAW_FIELDS.agentRatedType]) ??
    null;

  return {
    conversation_id: conversationId,
    rated_at: normalizeTimestamp(row[RAW_FIELDS.conversationRatedAt]),
    rated_agent_type: ratedAgentType,
    rating_value: ratingValue,
    rating_is_positive: ratingValue !== null ? ratingValue >= 4 : false,
    rating_remark: normalizeText(row[RAW_FIELDS.conversationRatingRemark]),
    rating_source: sourceName,
    user_name: normalizeText(row[RAW_FIELDS.userName]),
    company_name: normalizeText(row[RAW_FIELDS.companyName]),
    team_name: conversation?.team_name ?? null,
    teammate_name: conversation?.teammate_name ?? null,
    rated_teammate_name: conversation?.rated_teammate_name ?? null,
    conversation_found: Boolean(conversation),
  };
};

const buildFinOutcomeRecord = (conversation, deflectionDetailsById, resolutionDetailsById) => {
  const deflectionDetails = deflectionDetailsById.get(conversation.conversation_id) ?? null;
  const resolutionDetails = resolutionDetailsById.get(conversation.conversation_id) ?? null;

  return {
    conversation_id: conversation.conversation_id,
    started_at: conversation.started_at,
    started_by: conversation.started_by,
    conversation_source: conversation.conversation_source,
    current_state: conversation.current_state,
    team_name: conversation.team_name,
    teammate_name: conversation.teammate_name,
    fin_involved: conversation.fin_involved,
    fin_deflected: conversation.fin_deflected,
    fin_resolution_state: conversation.fin_resolution_state,
    topic: conversation.topic ?? deflectionDetails?.topic ?? resolutionDetails?.topic ?? null,
    subtopic: conversation.subtopic ?? deflectionDetails?.subtopic ?? resolutionDetails?.subtopic ?? null,
    validation: {
      has_deflection_detail: Boolean(deflectionDetails),
      has_resolution_detail: Boolean(resolutionDetails),
      detail_fin_deflected: deflectionDetails?.fin_deflected ?? null,
      detail_fin_resolution_state: resolutionDetails?.fin_resolution_state ?? null,
    },
  };
};

const buildFinDetailMap = (rows, type) =>
  new Map(
    rows
      .map((row) => {
        const conversationId = normalizeText(row[RAW_FIELDS.conversationId]);

        if (!conversationId) {
          return null;
        }

        return [
          conversationId,
          {
            topic: normalizeText(row[RAW_FIELDS.topic]) || normalizeText(row[RAW_FIELDS.fallbackTopic]),
            subtopic: normalizeText(row[RAW_FIELDS.subtopic]),
            fin_deflected: type === 'deflection' ? normalizeBoolean(row[RAW_FIELDS.finDeflected]) : null,
            fin_resolution_state:
              type === 'resolution' ? normalizeText(row[RAW_FIELDS.finResolutionState]) : null,
          },
        ];
      })
      .filter(Boolean)
  );

export const normalizeIntercomDatasets = (datasets) => {
  const conversations = datasets.conversationRows
    .map(buildConversationRecord)
    .filter((conversation) => Boolean(conversation.conversation_id));

  const conversationsById = new Map(
    conversations.map((conversation) => [conversation.conversation_id, conversation])
  );

  const ratings = [
    ...datasets.satisfactionRows.map((row) =>
      buildRatingRecord(row, 'satisfaction', conversationsById)
    ),
    ...datasets.finSatisfactionRows.map((row) =>
      buildRatingRecord(row, 'fin_satisfaction', conversationsById, {
        rated_agent_type: 'Fin AI Agent',
      })
    ),
  ].filter((rating) => Boolean(rating.conversation_id) && rating.rating_value !== null);

  const finDeflectionDetailsById = buildFinDetailMap(datasets.finDeflectionRows, 'deflection');
  const finResolutionDetailsById = buildFinDetailMap(datasets.finResolutionRows, 'resolution');

  const fin_outcomes = conversations
    .filter((conversation) => conversation.fin_involved === true)
    .map((conversation) =>
      buildFinOutcomeRecord(conversation, finDeflectionDetailsById, finResolutionDetailsById)
    );

  const availableTeams = [...new Set(conversations.map((item) => item.team_name).filter(Boolean))].sort();
  const availableTeammates = [...new Set(conversations.map((item) => item.teammate_name).filter(Boolean))].sort();

  return {
    conversations,
    ratings,
    fin_outcomes,
    indexes: {
      conversationsById,
      finDeflectionDetailsById,
      finResolutionDetailsById,
    },
    availableTeams,
    availableTeammates,
    dateBounds: {
      started_at: buildDateBounds(conversations, 'started_at'),
      rated_at: buildDateBounds(ratings, 'rated_at'),
    },
  };
};
