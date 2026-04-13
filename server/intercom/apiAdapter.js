import { createIntercomSourcePayload } from '../../src/dataSources/adapterContract.js';
import {
  loadIntercomServerEnv,
  maskIntercomServerConfig,
  validateIntercomServerEnv,
} from './env.js';
import { readThroughCache } from './cache.js';

const INTERCOM_VERSION = '2.14';
const MAX_PER_PAGE = 150;
const RESOLVED_FIN_STATES = new Set(['assumed_resolution', 'confirmed_resolution']);
const DEFLECTED_FIN_STATES = new Set([
  'assumed_resolution',
  'confirmed_resolution',
  'negative_feedback',
]);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nowMs = () => Date.now();

const toTimestampString = (unixSeconds) => {
  if (!Number.isFinite(unixSeconds)) {
    return '';
  }

  const iso = new Date(unixSeconds * 1000).toISOString().replace('T', ' ');
  return iso.slice(0, 19);
};

const titleCase = (value) =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const mapDeliveredAsToStartedBy = (conversation) => {
  const deliveredAs = conversation.source?.delivered_as;
  const authorType = conversation.source?.author?.type;

  if (deliveredAs === 'customer_initiated' || authorType === 'contact') {
    return 'Customer';
  }

  if (deliveredAs === 'admin_initiated' || authorType === 'admin') {
    return 'Admin';
  }

  if (
    deliveredAs === 'operator_initiated' ||
    deliveredAs === 'automated' ||
    deliveredAs === 'campaign_initiated'
  ) {
    return 'Reply to Workflow/Message';
  }

  return titleCase(deliveredAs || authorType || 'Unknown');
};

const mapDeliveredAsToConversationSource = (conversation) => {
  const deliveredAs = conversation.source?.delivered_as;
  const sourceType = conversation.source?.type;

  if (deliveredAs === 'customer_initiated') return 'Inbound message';
  if (deliveredAs === 'admin_initiated') return 'Manual message';
  if (deliveredAs === 'automated' || deliveredAs === 'campaign_initiated') return 'Auto message';
  if (deliveredAs === 'operator_initiated') return 'Bot auto message';

  return titleCase(sourceType || deliveredAs || 'Unknown');
};

const mapSourceToChannel = (conversation) => {
  const type = conversation.source?.type;

  if (type === 'conversation') return 'Chat';
  if (type === 'email') return 'Email';
  if (type === 'phone_call') return 'Phone';

  return titleCase(type || 'Unknown');
};

const mapFinResolutionState = (resolutionState) => {
  if (!resolutionState) return '';

  const mapping = {
    assumed_resolution: 'Assumed resolved',
    confirmed_resolution: 'Confirmed resolved',
    escalated: 'Escalated',
    negative_feedback: 'Negative feedback',
  };

  return mapping[resolutionState] || '';
};

const extractAiTopicSummary = (conversation) => {
  const topics = conversation.ai_topics;

  if (!topics) {
    return { topic: '', subtopic: '' };
  }

  const readLabels = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value
        .map((item) => item?.label || item?.name || item?.title || item?.value || item?.id)
        .filter(Boolean);
    }
    if (typeof value === 'string') {
      return [value];
    }
    const direct = value.label || value.name || value.title || value.value || value.id;
    return direct ? [direct] : [];
  };

  const topicLabels = [
    ...readLabels(topics.categories),
    ...readLabels(topics.topics),
    ...readLabels(topics.category),
    ...readLabels(topics.topic),
  ];

  const subtopicLabels = [
    ...readLabels(topics.subcategories),
    ...readLabels(topics.subtopics),
    ...readLabels(topics.subcategory),
    ...readLabels(topics.subtopic),
  ];

  return {
    topic: [...new Set(topicLabels)].join(', '),
    subtopic: [...new Set(subtopicLabels)].join(', '),
  };
};

const createLookupMap = (items, idField, valueField) =>
  new Map(
    (items || [])
      .map((item) => {
        const id = item?.[idField];
        const value = item?.[valueField];
        return id && value ? [String(id), value] : null;
      })
      .filter(Boolean)
  );

const getResponseBody = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
};

const intercomRequest = async ({ config, path, query = {}, fetchImpl, retries = 3 }) => {
  const url = new URL(path, config.apiBaseUrl);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetchImpl(url, {
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Intercom-Version': INTERCOM_VERSION,
        Accept: 'application/json',
      },
    });

    if (response.ok) {
      return getResponseBody(response);
    }

    if (response.status === 429 || response.status >= 500) {
      const retryAfter = Number(response.headers.get('retry-after') || '0');
      const waitMs = retryAfter > 0 ? retryAfter * 1000 : 500 * (attempt + 1);

      if (attempt < retries) {
        await delay(waitMs);
        continue;
      }
    }

    const body = await getResponseBody(response);
    throw new Error(`Intercom API request failed (${response.status}) for ${path}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }

  throw new Error(`Intercom API request failed for ${path}`);
};

const fetchPaginatedCollection = async ({
  config,
  path,
  collectionKey,
  fetchImpl,
  metrics,
  createdAtField = 'created_at',
  cutoffUnixSeconds = null,
}) => {
  const items = [];
  let cursor = '';

  while (true) {
    const requestStartedAt = nowMs();
    const body = await intercomRequest({
      config,
      path,
      fetchImpl,
      query: {
        per_page: MAX_PER_PAGE,
        starting_after: cursor || undefined,
      },
    });
    metrics.requestCount += 1;
    metrics.requestDurationsMs.push(nowMs() - requestStartedAt);

    const pageItems = Array.isArray(body?.[collectionKey]) ? body[collectionKey] : [];
    const filteredPageItems =
      cutoffUnixSeconds == null
        ? pageItems
        : pageItems.filter((item) => Number(item?.[createdAtField]) >= cutoffUnixSeconds);

    items.push(...filteredPageItems);

    const nextCursor =
      body?.pages?.next?.starting_after ||
      (pageItems.length === MAX_PER_PAGE ? pageItems.at(-1)?.id : null);

    const oldestPageTimestamp = Number(pageItems.at(-1)?.[createdAtField] || 0);
    const reachedCutoff =
      cutoffUnixSeconds != null &&
      oldestPageTimestamp > 0 &&
      oldestPageTimestamp < cutoffUnixSeconds;

    if (!nextCursor || nextCursor === cursor || reachedCutoff) {
      break;
    }

    cursor = nextCursor;
  }

  return items;
};

const mapConversationRow = (conversation, adminsById, teamsById) => {
  const aiTopics = extractAiTopicSummary(conversation);
  const finResolutionState = mapFinResolutionState(conversation.ai_agent?.resolution_state);
  const conversationRatingTeammateId = conversation.conversation_rating?.teammate?.id;

  return {
    'Conversation ID': String(conversation.id),
    'Conversation started at (America/New_York)': toTimestampString(conversation.created_at),
    'Teammate currently assigned': adminsById.get(String(conversation.admin_assignee_id || '')) || '',
    'Team currently assigned': teamsById.get(String(conversation.team_assignee_id || '')) || '',
    'Current conversation state': titleCase(conversation.state || 'Unknown'),
    'Started by': mapDeliveredAsToStartedBy(conversation),
    'Conversation source': mapDeliveredAsToConversationSource(conversation),
    'Last teammate rated': adminsById.get(String(conversationRatingTeammateId || '')) || '',
    'Fin AI Agent involved': String(Boolean(conversation.ai_agent_participated)),
    'Fin AI Agent deflected': String(
      Boolean(
        conversation.ai_agent_participated &&
          DEFLECTED_FIN_STATES.has(conversation.ai_agent?.resolution_state)
      )
    ),
    'Fin AI Agent resolution state': finResolutionState,
    'AI Topic': aiTopics.topic,
    'AI Subtopic': aiTopics.subtopic,
    Channel: mapSourceToChannel(conversation),
    'Ticket type': '',
    'First response time (seconds)': conversation.statistics?.time_to_admin_reply
      ? String(conversation.statistics.time_to_admin_reply)
      : '',
  };
};

const mapSatisfactionRows = (conversation) => {
  const rows = [];

  if (conversation.conversation_rating?.rating) {
    const teammateId = conversation.conversation_rating?.teammate?.id;
    rows.push({
      'Conversation ID': String(conversation.id),
      'Updated at (America/New_York)': toTimestampString(
        conversation.conversation_rating.created_at
      ),
      'Conversation rating remark': conversation.conversation_rating.remark || '',
      'Conversation rating': String(conversation.conversation_rating.rating),
      'User name':
        conversation.conversation_rating.contact?.name ||
        conversation.source?.author?.name ||
        '',
      'Company name': '',
      'Agent rated type':
        teammateId ? 'Teammate' : 'Chatbot',
      'Last survey sent': '',
    });
  }

  if (conversation.ai_agent?.rating) {
    rows.push({
      'Conversation ID': String(conversation.id),
      'Updated at (America/New_York)': toTimestampString(
        conversation.ai_agent.rating_remark_updated_at ||
          conversation.ai_agent.rating_updated_at ||
          conversation.updated_at
      ),
      'Conversation rating remark': conversation.ai_agent.rating_remark || '',
      'Conversation rating': String(conversation.ai_agent.rating),
      'User name': conversation.source?.author?.name || '',
      'Company name': '',
      'Agent rated type': 'Fin AI Agent',
      'Last survey sent': '',
    });
  }

  return rows;
};

const mapFinSatisfactionRow = (conversation) => {
  if (!conversation.ai_agent?.rating) {
    return null;
  }

  return {
    'Conversation ID': String(conversation.id),
    'Updated at (America/New_York)': toTimestampString(
      conversation.ai_agent.rating_remark_updated_at ||
        conversation.ai_agent.rating_updated_at ||
        conversation.updated_at
    ),
    'Conversation rating remark': conversation.ai_agent.rating_remark || '',
    'Conversation rating': String(conversation.ai_agent.rating),
    'User name': conversation.source?.author?.name || '',
    'Company name': '',
    'Last survey sent': '',
    'Fin AI Agent involved': 'true',
  };
};

const mapFinDeflectionRow = (conversation) => {
  if (
    !conversation.ai_agent_participated ||
    !DEFLECTED_FIN_STATES.has(conversation.ai_agent?.resolution_state)
  ) {
    return null;
  }

  const aiTopics = extractAiTopicSummary(conversation);

  return {
    'Conversation ID': String(conversation.id),
    'Conversation started at (America/New_York)': toTimestampString(conversation.created_at),
    'Fin AI Agent deflected': 'true',
    Topics: aiTopics.topic,
    'AI Subtopic': aiTopics.subtopic,
    'AI Topic': aiTopics.topic,
  };
};

const mapFinResolutionRow = (conversation) => {
  if (
    !conversation.ai_agent_participated ||
    !RESOLVED_FIN_STATES.has(conversation.ai_agent?.resolution_state)
  ) {
    return null;
  }

  const aiTopics = extractAiTopicSummary(conversation);

  return {
    'Conversation ID': String(conversation.id),
    'Conversation started at (America/New_York)': toTimestampString(conversation.created_at),
    'Fin AI Agent resolution state': mapFinResolutionState(conversation.ai_agent?.resolution_state),
    'Fin AI Agent rating': conversation.ai_agent?.rating ? String(conversation.ai_agent.rating) : '',
    'AI Subtopic': aiTopics.subtopic,
    'AI Topic': aiTopics.topic,
  };
};

export const mapIntercomConversationsToDatasets = ({
  conversations,
  admins = [],
  teams = [],
}) => {
  const adminsById = createLookupMap(admins, 'id', 'name');
  const teamsById = createLookupMap(teams, 'id', 'name');

  const datasets = {
    conversationRows: [],
    satisfactionRows: [],
    finSatisfactionRows: [],
    finDeflectionRows: [],
    finResolutionRows: [],
  };

  conversations.forEach((conversation) => {
    datasets.conversationRows.push(mapConversationRow(conversation, adminsById, teamsById));
    datasets.satisfactionRows.push(...mapSatisfactionRows(conversation));

    const finSatisfactionRow = mapFinSatisfactionRow(conversation);
    if (finSatisfactionRow) datasets.finSatisfactionRows.push(finSatisfactionRow);

    const finDeflectionRow = mapFinDeflectionRow(conversation);
    if (finDeflectionRow) datasets.finDeflectionRows.push(finDeflectionRow);

    const finResolutionRow = mapFinResolutionRow(conversation);
    if (finResolutionRow) datasets.finResolutionRows.push(finResolutionRow);
  });

  return datasets;
};

export const loadIntercomApiSource = async ({
  env = process.env,
  rootDir = process.cwd(),
  fetchImpl = fetch,
} = {}) => {
  const config = loadIntercomServerEnv({ rootDir, env });
  const envValidation = validateIntercomServerEnv(config);

  if (!envValidation.isValid) {
    throw new Error(`Missing Intercom API environment variables: ${envValidation.missing.join(', ')}`);
  }

  const datasetCacheKey = [
    'intercom-api-dataset',
    config.apiBaseUrl,
    config.initialBackfillDays,
  ].join(':');

  const { value, cacheHit } = await readThroughCache({
    key: datasetCacheKey,
    ttlMs: config.datasetCacheTtlMs,
    loader: async () => {
      const warnings = [];
      const metrics = {
        requestCount: 0,
        requestDurationsMs: [],
      };
      const loadStartedAt = nowMs();
      const cutoffUnixSeconds = Number.isFinite(config.initialBackfillDays)
        ? Math.floor(Date.now() / 1000) - config.initialBackfillDays * 24 * 60 * 60
        : null;

      const adminsPromise = readThroughCache({
        key: `intercom-admins:${config.apiBaseUrl}`,
        ttlMs: config.lookupCacheTtlMs,
        loader: async () => {
          metrics.requestCount += 1;
          const requestStartedAt = nowMs();
          const result = await intercomRequest({
            config,
            path: '/admins',
            fetchImpl,
          });
          metrics.requestDurationsMs.push(nowMs() - requestStartedAt);
          return result?.admins || [];
        },
      }).catch((error) => {
        warnings.push(`Intercom admins lookup failed; teammate names may be incomplete (${error.message})`);
        return { value: [], cacheHit: false };
      });

      const teamsPromise = readThroughCache({
        key: `intercom-teams:${config.apiBaseUrl}`,
        ttlMs: config.lookupCacheTtlMs,
        loader: async () => {
          metrics.requestCount += 1;
          const requestStartedAt = nowMs();
          const result = await intercomRequest({
            config,
            path: '/teams',
            fetchImpl,
          });
          metrics.requestDurationsMs.push(nowMs() - requestStartedAt);
          return result?.teams || [];
        },
      }).catch((error) => {
        warnings.push(`Intercom teams lookup failed; team names may be incomplete (${error.message})`);
        return { value: [], cacheHit: false };
      });

      const conversations = await fetchPaginatedCollection({
        config,
        path: '/conversations',
        collectionKey: 'conversations',
        fetchImpl,
        metrics,
        cutoffUnixSeconds,
      });

      const [adminsResult, teamsResult] = await Promise.all([adminsPromise, teamsPromise]);

      const datasets = mapIntercomConversationsToDatasets({
        conversations,
        admins: adminsResult.value,
        teams: teamsResult.value,
      });

      return createIntercomSourcePayload({
        adapterId: 'intercom-api',
        sourceKind: 'api',
        datasets,
        meta: {
          warnings,
          envMask: maskIntercomServerConfig(config),
          capabilities: {
            newConversationsProxyBased: true,
            overallCsatMayMissChatbotRatings: true,
            finDenominatorFromCanonicalConversationData: true,
            initialBackfillLimited: true,
          },
          apiSummary: {
            conversationsFetched: conversations.length,
            adminsFetched: adminsResult.value.length,
            teamsFetched: teamsResult.value.length,
            requestCount: metrics.requestCount,
            avgRequestDurationMs:
              metrics.requestDurationsMs.length > 0
                ? Math.round(
                    metrics.requestDurationsMs.reduce((sum, value) => sum + value, 0) /
                      metrics.requestDurationsMs.length
                  )
                : 0,
            initialBackfillDays: config.initialBackfillDays,
            initialCutoffApplied: cutoffUnixSeconds != null,
            loadDurationMs: nowMs() - loadStartedAt,
            adminCacheHit: adminsResult.cacheHit,
            teamCacheHit: teamsResult.cacheHit,
          },
        },
      });
    },
  });

  return createIntercomSourcePayload({
    ...value,
    meta: {
      ...value.meta,
      apiSummary: {
        ...value.meta.apiSummary,
        datasetCacheHit: cacheHit,
      },
    },
  });
};

export const createIntercomApiHttpHandler = (options = {}) => {
  return async () => {
    const payload = await loadIntercomApiSource(options);
    return payload;
  };
};
