import { createLearnWorldsSourcePayload } from '../../src/dataSources/learnworldsAdapterContract.js';
import { readThroughCache } from '../intercom/cache.js';
import {
  loadLearnWorldsServerEnv,
  maskLearnWorldsServerConfig,
  validateLearnWorldsServerEnv,
} from './env.js';

const MAX_RETRIES = 4;
const BASE_RETRY_DELAY_MS = 750;
const MAX_RETRY_DELAY_MS = 10000;
const MAX_CONCURRENT_REQUESTS = 2;
const USER_MEMBERSHIP_CONCURRENCY = 2;
const USER_PROGRESS_CONCURRENCY = 2;
const COURSE_ANALYTICS_CONCURRENCY = 2;
const OVERVIEW_ENROLLMENT_USER_LIMIT = 25;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeText = (value) => {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
};

const normalizeTimestamp = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const timestampMs = value > 1e12 ? value : value * 1000;
    const parsed = new Date(timestampMs);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  const normalized = normalizeText(value);

  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const stripHtmlTags = (value) =>
  typeof value === 'string' ? value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';

const decodeHtmlEntities = (value) =>
  (value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const absoluteUrlOrNull = (value, baseUrl) => {
  const normalized = normalizeText(value);

  if (!normalized) {
    return null;
  }

  try {
    return new URL(normalized, baseUrl).toString();
  } catch {
    return null;
  }
};

const uniqueBy = (items, getKey) => {
  const seen = new Set();

  return items.filter((item) => {
    const key = getKey(item);

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const buildValidationError = (validation) => {
  const parts = [];

  if (validation.missing.length > 0) {
    parts.push(`Missing LearnWorlds env: ${validation.missing.join(', ')}`);
  }

  if (validation.invalid.length > 0) {
    parts.push(`Invalid LearnWorlds env: ${validation.invalid.join(', ')}`);
  }

  return parts.join('. ');
};

const buildDatasetCacheKey = (config, loadMode) => [
  'learnworlds-datasets',
  config.apiBaseUrl,
  config.clientId || 'no-client',
  `mode:${loadMode}`,
  `pages:${config.initialPageLimit}`,
].join(':');

const normalizeLoadMode = (value) => (value === 'overview' ? 'overview' : 'full');

const createApiError = ({ path, status, bodyPreview, code }) => {
  const error = new Error(
    `LearnWorlds API request failed (${status}) for ${path}: ${bodyPreview || 'no response body'}`
  );
  error.status = status;
  error.path = path;
  error.code = code || 'learnworlds_request_failed';
  error.rateLimited = status === 429;
  error.retryable = status === 429 || status >= 500;
  return error;
};

const parseRetryDelayMs = (response) => {
  const retryAfter = response.headers.get('retry-after');

  if (retryAfter) {
    const seconds = Number.parseFloat(retryAfter);

    if (Number.isFinite(seconds)) {
      return Math.max(0, Math.round(seconds * 1000));
    }

    const parsedDate = Date.parse(retryAfter);

    if (!Number.isNaN(parsedDate)) {
      return Math.max(0, parsedDate - Date.now());
    }
  }

  const resetHeader =
    response.headers.get('x-ratelimit-reset') ||
    response.headers.get('ratelimit-reset') ||
    response.headers.get('x-rate-limit-reset');

  if (resetHeader) {
    const resetSeconds = Number.parseFloat(resetHeader);

    if (Number.isFinite(resetSeconds)) {
      const resetMs = resetSeconds > 1e12 ? resetSeconds : resetSeconds * 1000;
      return Math.max(0, Math.round(resetMs - Date.now()));
    }
  }

  return null;
};

const calculateRetryDelayMs = ({ attempt, response }) => {
  const headerDelayMs = parseRetryDelayMs(response);

  if (headerDelayMs !== null) {
    const jitterMs = Math.round(Math.random() * 250);
    return Math.min(MAX_RETRY_DELAY_MS, headerDelayMs + jitterMs);
  }

  const exponentialDelay = Math.min(
    MAX_RETRY_DELAY_MS,
    BASE_RETRY_DELAY_MS * 2 ** attempt
  );
  const jitterMs = Math.round(Math.random() * Math.max(250, exponentialDelay * 0.25));

  return Math.min(MAX_RETRY_DELAY_MS, exponentialDelay + jitterMs);
};

const createRequestScheduler = ({ requestDelayMs, maxConcurrentRequests }) => {
  const queue = [];
  let activeCount = 0;
  let nextAllowedStartAt = 0;

  const scheduleNext = () => {
    if (activeCount >= maxConcurrentRequests || queue.length === 0) {
      return;
    }

    const queued = queue.shift();
    const now = Date.now();
    const startAt = Math.max(now, nextAllowedStartAt);
    nextAllowedStartAt = startAt + requestDelayMs;
    activeCount += 1;

    setTimeout(async () => {
      try {
        queued.resolve(await queued.task());
      } catch (error) {
        queued.reject(error);
      } finally {
        activeCount -= 1;
        scheduleNext();
      }
    }, Math.max(0, startAt - now));
  };

  return {
    schedule(task) {
      return new Promise((resolve, reject) => {
        queue.push({ task, resolve, reject });
        scheduleNext();
      });
    },
  };
};

const createMetricsCollector = (config) => ({
  requestCount: 0,
  requestDurationsMs: [],
  retryCount: 0,
  rateLimitRetryCount: 0,
  retryDelayMsApplied: [],
  partialDatasetCount: 0,
  pageLimitEvents: [],
  requestDelayMs: config.requestDelayMs,
  initialPageLimit: config.initialPageLimit,
  datasetCacheTtlMs: config.datasetCacheTtlMs,
});

const fetchWithTimeout = async (fetchImpl, resource, options, timeoutMs) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(resource, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const summarizeDatasetCounts = (datasets) =>
  Object.fromEntries(
    Object.entries(datasets).map(([key, rows]) => [key, Array.isArray(rows) ? rows.length : 0])
  );

const learnWorldsRequest = async ({
  config,
  path,
  fetchImpl,
  metrics,
  scheduler,
  attempt = 0,
}) => {
  const requestStartedAt = Date.now();
  const requestUrl = new URL(path, config.apiBaseUrl);
  console.info(`[LearnWorlds API] Request ${requestUrl.toString()}`);

  let response;

  try {
    response = await scheduler.schedule(() =>
      fetchWithTimeout(
        fetchImpl,
        requestUrl,
        {
          headers: {
            'Lw-Client': config.clientId,
            Authorization: `Bearer ${config.apiKey}`,
            Accept: 'application/json',
          },
        },
        config.requestTimeoutMs
      )
    );
  } catch (error) {
    const timeoutMessage =
      error?.name === 'AbortError'
        ? `LearnWorlds API request timed out after ${config.requestTimeoutMs}ms for ${path}`
        : `LearnWorlds API network request failed for ${path}: ${error?.message || 'Unknown error'}`;
    const message = timeoutMessage;
    console.error(`[LearnWorlds API] Request error ${requestUrl.toString()}: ${message}`);
    throw new Error(message);
  }

  metrics.requestCount += 1;
  metrics.requestDurationsMs.push(Date.now() - requestStartedAt);
  console.info(`[LearnWorlds API] Response ${response.status} for ${requestUrl.toString()}`);

  if (response.ok) {
    return response.json();
  }

  const body = await response.text();
  console.error(
    `[LearnWorlds API] Request failed ${response.status} for ${requestUrl.toString()}: ${body.slice(0, 200)}`
  );
  const error = createApiError({
    path,
    status: response.status,
    bodyPreview: body.slice(0, 200),
  });

  if (error.rateLimited) {
    console.warn(
      `[LearnWorlds API] Rate limited for ${requestUrl.toString()}. Returning partial datasets without retry.`
    );
    metrics.rateLimitRetryCount += 1;
    throw error;
  }

  if (error.retryable && attempt < MAX_RETRIES) {
    const retryDelayMs = calculateRetryDelayMs({ attempt, response });
    metrics.retryCount += 1;
    metrics.retryDelayMsApplied.push(retryDelayMs);

    await delay(retryDelayMs);

    return learnWorldsRequest({
      config,
      path,
      fetchImpl,
      metrics,
      scheduler,
      attempt: attempt + 1,
    });
  }

  throw error;
};

const fetchPaginatedCollection = async ({
  config,
  path,
  fetchImpl,
  metrics,
  scheduler,
  datasetKey,
}) => {
  const items = [];
  const pageLimit = Math.max(1, config.initialPageLimit);
  let page = 1;
  let totalPages = 1;
  let error = null;
  let pageLimitApplied = false;

  while (page <= totalPages && page <= pageLimit) {
    const delimiter = path.includes('?') ? '&' : '?';

    try {
      const body = await learnWorldsRequest({
        config,
        path: `${path}${delimiter}page=${page}`,
        fetchImpl,
        metrics,
        scheduler,
      });
      const pageItems = ensureArray(body?.data);
      const meta = body?.meta || {};

      items.push(...pageItems);
      totalPages = Number(meta.totalPages || 1);
      page += 1;
    } catch (requestError) {
      error = requestError;
      break;
    }
  }

  if (!error && page <= totalPages) {
    pageLimitApplied = true;
    metrics.pageLimitEvents.push({
      datasetKey,
      path,
      pagesFetched: pageLimit,
      totalPages,
    });
  }

  return {
    items,
    error,
    pageInfo: {
      datasetKey,
      path,
      pagesFetched: Math.min(page - 1, pageLimit),
      totalPages,
      pageLimit,
      pageLimitApplied,
    },
  };
};

const mapWithConcurrency = async (items, concurrency, iteratee) => {
  const results = [];
  let index = 0;

  const worker = async () => {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await iteratee(items[currentIndex], currentIndex);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length || 1) }, () => worker())
  );

  return results;
};

const summarizeTimestampFields = (rows, fields) =>
  fields.reduce((accumulator, fieldName) => {
    accumulator[fieldName] = rows.filter((row) => !row[fieldName]).length;
    return accumulator;
  }, {});

const summarizeBaseRowValidation = (rows, config) => ({
  missingIdCount: rows.filter((row) => !row[config.idField]).length,
  missingTimestampCounts: summarizeTimestampFields(rows, config.timestampFields || []),
});

const summarizeEnrollmentValidation = (rows) => ({
  ...summarizeBaseRowValidation(rows, {
    idField: 'enrollment_id',
    timestampFields: ['enrolled_at'],
  }),
  syntheticIdCount: rows.filter((row) => row.enrollment_id_is_synthetic).length,
  missingExpiresAtCount: rows.filter((row) => !row.expires_at).length,
});

const summarizeProgressValidation = ({ progressRows, userRows, courseRows }) => {
  const userIds = new Set(userRows.map((row) => row.user_id).filter(Boolean));
  const courseIds = new Set(courseRows.map((row) => row.course_id).filter(Boolean));

  return {
    missingUserIdCount: progressRows.filter((row) => !row.user_id).length,
    missingCourseIdCount: progressRows.filter((row) => !row.course_id).length,
    invalidProgressPercentCount: progressRows.filter((row) => {
      if (row.progress_percent === null) {
        return true;
      }

      return row.progress_percent < 0 || row.progress_percent > 100;
    }).length,
    missingTimeSpentCount: progressRows.filter((row) => row.time_spent_seconds === null).length,
    missingLastActivityCount: progressRows.filter((row) => !row.last_activity_at).length,
    brokenUserJoinCount: progressRows.filter((row) => row.user_id && !userIds.has(row.user_id)).length,
    brokenCourseJoinCount: progressRows.filter((row) => row.course_id && !courseIds.has(row.course_id)).length,
  };
};

const summarizeActivityAnalyticsValidation = ({ activityAnalyticsRows, courseRows }) => {
  const courseIds = new Set(courseRows.map((row) => row.course_id).filter(Boolean));

  return {
    missingCourseIdCount: activityAnalyticsRows.filter((row) => !row.course_id).length,
    missingTimeSpentCount: activityAnalyticsRows.filter(
      (row) => row.total_study_time_seconds === null && row.avg_time_to_finish_seconds === null
    ).length,
    missingLastActivityCount: activityAnalyticsRows.filter((row) => !row.last_activity_at).length,
    brokenCourseJoinCount: activityAnalyticsRows.filter(
      (row) => row.course_id && !courseIds.has(row.course_id)
    ).length,
    missingActivityIdentityCount: activityAnalyticsRows.filter(
      (row) => !row.activity_id && !row.activity_name && !row.activity_type
    ).length,
  };
};

const buildWarnings = ({ rowCounts, validationSummary, runtimeWarnings }) => {
  const warnings = [...runtimeWarnings];

  if (validationSummary.userRows.missingIdCount > 0) {
    warnings.push(`LearnWorlds user rows missing user_id: ${validationSummary.userRows.missingIdCount}`);
  }

  if (validationSummary.courseRows.missingIdCount > 0) {
    warnings.push(`LearnWorlds course rows missing course_id: ${validationSummary.courseRows.missingIdCount}`);
  }

  if (validationSummary.enrollmentRows.missingIdCount > 0) {
    warnings.push(
      `LearnWorlds enrollment rows missing enrollment_id: ${validationSummary.enrollmentRows.missingIdCount}`
    );
  }

  if ((validationSummary.enrollmentRows.missingTimestampCounts.enrolled_at || 0) > 0) {
    warnings.push(
      `LearnWorlds enrollment rows without enrolled_at: ${validationSummary.enrollmentRows.missingTimestampCounts.enrolled_at}`
    );
  }

  if (validationSummary.enrollmentRows.syntheticIdCount > 0) {
    warnings.push(
      `LearnWorlds enrollment rows still use synthetic enrollment_id values: ${validationSummary.enrollmentRows.syntheticIdCount}`
    );
  }

  if (validationSummary.progressRows.missingUserIdCount > 0) {
    warnings.push(`LearnWorlds progress rows missing user_id: ${validationSummary.progressRows.missingUserIdCount}`);
  }

  if (validationSummary.progressRows.missingCourseIdCount > 0) {
    warnings.push(
      `LearnWorlds progress rows missing course_id: ${validationSummary.progressRows.missingCourseIdCount}`
    );
  }

  if (validationSummary.progressRows.invalidProgressPercentCount > 0) {
    warnings.push(
      `LearnWorlds progress rows with invalid progress_percent: ${validationSummary.progressRows.invalidProgressPercentCount}`
    );
  }

  if (validationSummary.progressRows.missingTimeSpentCount > 0) {
    warnings.push(
      `LearnWorlds progress rows missing time_spent_seconds: ${validationSummary.progressRows.missingTimeSpentCount}`
    );
  }

  if (validationSummary.progressRows.missingLastActivityCount > 0) {
    warnings.push(
      `LearnWorlds progress rows missing last_activity_at: ${validationSummary.progressRows.missingLastActivityCount}`
    );
  }

  if (validationSummary.progressRows.brokenUserJoinCount > 0) {
    warnings.push(
      `LearnWorlds progress rows missing user joins: ${validationSummary.progressRows.brokenUserJoinCount}`
    );
  }

  if (validationSummary.progressRows.brokenCourseJoinCount > 0) {
    warnings.push(
      `LearnWorlds progress rows missing course joins: ${validationSummary.progressRows.brokenCourseJoinCount}`
    );
  }

  if (validationSummary.activityAnalyticsRows.missingCourseIdCount > 0) {
    warnings.push(
      `LearnWorlds activity analytics rows missing course_id: ${validationSummary.activityAnalyticsRows.missingCourseIdCount}`
    );
  }

  if (validationSummary.activityAnalyticsRows.missingTimeSpentCount > 0) {
    warnings.push(
      `LearnWorlds activity analytics rows missing time-spent fields: ${validationSummary.activityAnalyticsRows.missingTimeSpentCount}`
    );
  }

  if (validationSummary.activityAnalyticsRows.missingLastActivityCount > 0) {
    warnings.push(
      `LearnWorlds activity analytics rows missing last_activity_at: ${validationSummary.activityAnalyticsRows.missingLastActivityCount}`
    );
  }

  if (validationSummary.activityAnalyticsRows.brokenCourseJoinCount > 0) {
    warnings.push(
      `LearnWorlds activity analytics rows missing course joins: ${validationSummary.activityAnalyticsRows.brokenCourseJoinCount}`
    );
  }

  if (validationSummary.activityAnalyticsRows.missingActivityIdentityCount > 0) {
    warnings.push(
      'LearnWorlds activityAnalyticsRows currently use course-level analytics without activity_id/name/type.'
    );
  }

  if (rowCounts.userRows === 0) {
    warnings.push('No LearnWorlds users were returned from the current API slice.');
  }

  if (rowCounts.courseRows === 0) {
    warnings.push('No LearnWorlds courses were returned from the current API slice.');
  }

  if (rowCounts.progressRows === 0) {
    warnings.push('No LearnWorlds progress rows were returned from the current API slice.');
  }

  if (rowCounts.activityAnalyticsRows === 0) {
    warnings.push('No LearnWorlds activity analytics rows were returned from the current API slice.');
  }

  return warnings;
};

const buildMeta = ({
  config,
  metrics,
  datasets,
  validationSummary,
  datasetStatuses,
  runtimeWarnings,
  cacheHit,
  contentCatalog,
}) => {
  const rowCounts = {
    userRows: datasets.userRows.length,
    courseRows: datasets.courseRows.length,
    enrollmentRows: datasets.enrollmentRows.length,
    progressRows: datasets.progressRows.length,
    activityAnalyticsRows: datasets.activityAnalyticsRows.length,
  };

  const datasetSupport = {
    userRows: datasetStatuses.userRows.support,
    courseRows: datasetStatuses.courseRows.support,
    enrollmentRows:
      datasetStatuses.enrollmentRows.support === 'real' &&
      validationSummary.enrollmentRows.syntheticIdCount > 0
        ? 'partial'
        : datasetStatuses.enrollmentRows.support,
    progressRows:
      datasetStatuses.progressRows.support === 'real' &&
      validationSummary.progressRows.missingLastActivityCount > 0
        ? 'partial'
        : datasetStatuses.progressRows.support,
    activityAnalyticsRows:
      datasetStatuses.activityAnalyticsRows.support === 'real' &&
      validationSummary.activityAnalyticsRows.missingActivityIdentityCount > 0
        ? 'partial'
        : datasetStatuses.activityAnalyticsRows.support,
  };
  const partialData = Object.values(datasetSupport).some((support) => support !== 'real');

  return {
    warnings: buildWarnings({
      rowCounts,
      validationSummary,
      runtimeWarnings,
    }),
    envMask: maskLearnWorldsServerConfig(config),
    partialData,
    implementedDatasets: {
      userRows: true,
      courseRows: true,
      enrollmentRows: true,
      progressRows: true,
      activityAnalyticsRows: true,
    },
    datasetSupport,
    datasetStatuses,
    rowCounts,
    validationSummary,
    cache: {
      cacheHit,
      datasetCacheTtlMs: config.datasetCacheTtlMs,
    },
    endpointSummary: {
      users: '/admin/api/v2/users',
      courses: '/admin/api/v2/courses',
      userCourses: '/admin/api/v2/users/{user_id}/courses',
      userProgress: '/admin/api/v2/users/{user_id}/progress',
      courseAnalytics: '/admin/api/v2/courses/{course_id}/analytics',
      blogCatalog: contentCatalog?.learnworlds_blog?.source || '/blog',
      classCatalog: contentCatalog?.learnworlds_class?.source || '/classes',
      requestCount: metrics.requestCount,
      avgRequestDurationMs:
        metrics.requestDurationsMs.length > 0
          ? Math.round(
              metrics.requestDurationsMs.reduce((sum, value) => sum + value, 0) /
                metrics.requestDurationsMs.length
            )
          : 0,
      retryCount: metrics.retryCount,
      rateLimitRetryCount: metrics.rateLimitRetryCount,
      requestDelayMs: metrics.requestDelayMs,
      initialPageLimit: metrics.initialPageLimit,
      pageLimitEvents: metrics.pageLimitEvents,
    },
    enrollmentTimestampStatus: {
      source: '/admin/api/v2/users/{user_id}/courses.created',
      missingEnrolledAtCount: validationSummary.enrollmentRows.missingTimestampCounts.enrolled_at || 0,
      missingExpiresAtCount: validationSummary.enrollmentRows.missingExpiresAtCount,
      usesSyntheticEnrollmentIds: validationSummary.enrollmentRows.syntheticIdCount > 0,
    },
    limitations: [
      'Initial LearnWorlds dashboard loads are intentionally capped by LEARNWORLDS_INITIAL_PAGE_LIMIT.',
      'Enrollment timestamps now come from /admin/api/v2/users/{user_id}/courses.created where available.',
      'LearnWorlds does not expose a stable enrollment id in the current user-courses response, so enrollment_id remains synthetic.',
      'Progress rows come from /admin/api/v2/users/{user_id}/progress, which does not currently expose last_activity_at consistently.',
      'activityAnalyticsRows are course-level aggregates from /admin/api/v2/courses/{course_id}/analytics, not per-activity analytics rows.',
      'LearnWorlds blog and class coverage use conservative public metadata extraction when those public indexes are available.',
    ],
    contentCatalog,
  };
};

const mapUserRow = (user) => ({
  user_id: normalizeText(user.id),
  email: normalizeText(user.email),
  username: normalizeText(user.username),
  first_name: normalizeText(user.first_name),
  last_name: normalizeText(user.last_name),
  role: normalizeText(user.role),
  is_admin: Boolean(user.is_admin),
  is_instructor: Boolean(user.is_instructor),
  is_suspended: Boolean(user.is_suspended),
  created_at: normalizeTimestamp(user.created),
  last_login_at: normalizeTimestamp(user.last_login),
  signup_approval_status: normalizeText(user.signup_approval_status),
  email_verification_status: normalizeText(user.email_verification_status),
  tags: ensureArray(user.tags),
  custom_fields: user.fields ?? {},
});

const mapCourseRow = (course) => ({
  course_id: normalizeText(course.id),
  title: normalizeText(course.title),
  label: normalizeText(course.label),
  course_url: normalizeText(
    course.url ||
      course.link ||
      course.permalink ||
      course.public_url ||
      course.identifiers?.url ||
      course.identifiers?.public_url
  ),
  description: normalizeText(course.description),
  author_name: normalizeText(course.author?.name || course.author),
  categories: ensureArray(course.categories)
    .map((category) =>
      typeof category === 'string'
        ? category
        : normalizeText(category?.title || category?.name || category?.id)
    )
    .filter(Boolean),
  access: normalizeText(course.access),
  created_at: normalizeTimestamp(course.created),
  updated_at: normalizeTimestamp(course.modified),
  expires_at: normalizeTimestamp(course.expires),
  expires_type: normalizeText(course.expiresType),
  identifiers: course.identifiers ?? {},
});

const mapEnrollmentRowsForUser = (user, memberships) =>
  memberships
    .map((membership) => {
      const courseId = normalizeText(membership?.course?.id);

      if (!courseId) {
        return null;
      }

      return {
        enrollment_id: `${courseId}:${user.user_id}`,
        enrollment_id_is_synthetic: true,
        user_id: user.user_id,
        course_id: courseId,
        user_email: user.email,
        user_role: normalizeText(user.role),
        enrolled_at: normalizeTimestamp(membership.created),
        expires_at: normalizeTimestamp(membership.expires),
        source_endpoint: 'user-courses',
      };
    })
    .filter(Boolean);

const mapProgressRowsForUser = (user, progressItems) =>
  progressItems
    .map((progress) => ({
      user_id: user.user_id,
      course_id: normalizeText(progress.course_id),
      progress_status: normalizeText(progress.status),
      progress_percent: normalizeNumber(progress.progress_rate),
      average_score_percent: normalizeNumber(progress.average_score_rate),
      time_spent_seconds: normalizeNumber(progress.time_on_course),
      total_units: normalizeNumber(progress.total_units),
      completed_units: normalizeNumber(progress.completed_units),
      progress_per_section_unit: ensureArray(progress.progress_per_section_unit),
      completed_at: normalizeTimestamp(progress.completed_at),
      last_activity_at: normalizeTimestamp(progress.last_activity_at ?? progress.last_activity),
      source_endpoint: 'user-progress',
    }))
    .filter((row) => Boolean(row.course_id));

const mapActivityAnalyticsRow = (courseId, analytics) => ({
  course_id: courseId,
  students: normalizeNumber(analytics.students),
  videos: normalizeNumber(analytics.videos),
  learning_units: normalizeNumber(analytics.learning_units),
  video_time: normalizeNumber(analytics.video_time),
  avg_score_rate: normalizeNumber(analytics.avg_score_rate),
  success_rate: normalizeNumber(analytics.success_rate),
  total_study_time_seconds: normalizeNumber(analytics.total_study_time),
  avg_time_to_finish_seconds: normalizeNumber(analytics.avg_time_to_finish),
  social_interactions: normalizeNumber(analytics.social_interactions),
  certificates_issued: normalizeNumber(analytics.certificates_issued),
  video_viewing_time: normalizeNumber(analytics.video_viewing_time),
  activity_id: null,
  activity_name: null,
  activity_type: null,
  last_activity_at: normalizeTimestamp(analytics.last_activity_at ?? analytics.last_activity),
  source_endpoint: 'course-analytics',
});

const dedupeRowsByKey = (rows, keyField) => {
  const seen = new Set();

  return rows.filter((row) => {
    const key = row[keyField];

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const createDatasetStatus = (support, extras = {}) => ({
  support,
  ...extras,
});

const formatDatasetWarning = (datasetKey, message) =>
  `LearnWorlds ${datasetKey}: ${message}`;

const isRateLimitError = (error) => error?.rateLimited || error?.status === 429;

const fetchCollectionDataset = async ({
  config,
  datasetKey,
  path,
  fetchImpl,
  metrics,
  scheduler,
  mapper,
}) => {
  const collection = await fetchPaginatedCollection({
    config,
    path,
    fetchImpl,
    metrics,
    scheduler,
    datasetKey,
  });
  const rows = collection.items.map(mapper);
  const reasons = [];

  if (collection.pageInfo.pageLimitApplied) {
    reasons.push(`initial fetch capped at ${collection.pageInfo.pageLimit} pages`);
  }

  if (collection.error) {
    reasons.push(
      isRateLimitError(collection.error)
        ? `rate-limited while loading ${path}`
        : `failed while loading ${path}`
    );
  }

  const support =
    collection.error && rows.length === 0
      ? 'unavailable'
      : reasons.length > 0
        ? 'partial'
        : 'real';

  return {
    rows,
    status: createDatasetStatus(support, {
      pageInfo: collection.pageInfo,
      errorCode: collection.error?.code || null,
      reason: reasons.join('; ') || null,
    }),
    warnings: reasons.map((reason) => formatDatasetWarning(datasetKey, reason)),
  };
};

const fetchEnrollmentRows = async ({
  config,
  userRows,
  fetchImpl,
  metrics,
  scheduler,
}) => {
  const warnings = [];
  let partial = false;

  const perUserRows = await mapWithConcurrency(
    userRows.filter((user) => Boolean(user.user_id)),
    USER_MEMBERSHIP_CONCURRENCY,
    async (user) => {
      const memberships = await fetchPaginatedCollection({
        config,
        path: `/admin/api/v2/users/${encodeURIComponent(user.user_id)}/courses`,
        fetchImpl,
        metrics,
        scheduler,
        datasetKey: 'enrollmentRows',
      });

      if (memberships.pageInfo.pageLimitApplied) {
        partial = true;
      }

      if (memberships.error) {
        partial = true;
        warnings.push(
          formatDatasetWarning(
            'enrollmentRows',
            `${isRateLimitError(memberships.error) ? 'rate-limited' : 'failed'} for user ${user.user_id}`
          )
        );
      }

      return mapEnrollmentRowsForUser(user, memberships.items);
    }
  );

  return {
    rows: dedupeRowsByKey(perUserRows.flat(), 'enrollment_id'),
    status: createDatasetStatus(partial ? 'partial' : 'real', {
      reason: partial ? 'Some user-course enrollment pages were capped or unavailable.' : null,
    }),
    warnings,
  };
};

const fetchProgressRows = async ({
  config,
  userRows,
  fetchImpl,
  metrics,
  scheduler,
}) => {
  const warnings = [];
  let partial = false;

  const perUserRows = await mapWithConcurrency(
    userRows.filter((user) => Boolean(user.user_id)),
    USER_PROGRESS_CONCURRENCY,
    async (user) => {
      const progressItems = await fetchPaginatedCollection({
        config,
        path: `/admin/api/v2/users/${encodeURIComponent(user.user_id)}/progress`,
        fetchImpl,
        metrics,
        scheduler,
        datasetKey: 'progressRows',
      });

      if (progressItems.pageInfo.pageLimitApplied) {
        partial = true;
      }

      if (progressItems.error) {
        partial = true;
        warnings.push(
          formatDatasetWarning(
            'progressRows',
            `${isRateLimitError(progressItems.error) ? 'rate-limited' : 'failed'} for user ${user.user_id}`
          )
        );
      }

      return mapProgressRowsForUser(user, progressItems.items);
    }
  );

  return {
    rows: dedupeRowsByKey(
      perUserRows.flat().map((row) => ({
        ...row,
        progress_key: `${row.user_id}:${row.course_id}`,
      })),
      'progress_key'
    ).map((row) => {
      const nextRow = { ...row };
      delete nextRow.progress_key;
      return nextRow;
    }),
    status: createDatasetStatus(partial ? 'partial' : 'real', {
      reason: partial ? 'Some user-progress pages were capped or unavailable.' : null,
    }),
    warnings,
  };
};

const fetchCourseAnalyticsRows = async ({ config, courseRows, fetchImpl, metrics, scheduler }) => {
  const warnings = [];
  let partial = false;

  const rows = await mapWithConcurrency(
    courseRows.filter((course) => Boolean(course.course_id)),
    COURSE_ANALYTICS_CONCURRENCY,
    async (course) => {
      try {
        const analytics = await learnWorldsRequest({
          config,
          path: `/admin/api/v2/courses/${encodeURIComponent(course.course_id)}/analytics`,
          fetchImpl,
          metrics,
          scheduler,
        });

        return mapActivityAnalyticsRow(course.course_id, analytics || {});
      } catch (error) {
        partial = true;
        warnings.push(
          formatDatasetWarning(
            'activityAnalyticsRows',
            `${isRateLimitError(error) ? 'rate-limited' : 'failed'} for course ${course.course_id}`
          )
        );
        return null;
      }
    }
  );

  return {
    rows: rows.filter(Boolean),
    status: createDatasetStatus(partial ? 'partial' : 'real', {
      reason: partial ? 'Some course analytics requests were unavailable.' : null,
    }),
    warnings,
  };
};

const fetchPublicText = async ({ url, fetchImpl, scheduler, metrics }) => {
  const requestStartedAt = Date.now();
  const response = await scheduler.schedule(() =>
    fetchWithTimeout(
      fetchImpl,
      url,
      {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.9,*/*;q=0.8',
        },
      },
      10000
    )
  );

  metrics.requestCount += 1;
  metrics.requestDurationsMs.push(Date.now() - requestStartedAt);

  if (!response.ok) {
    const bodyPreview = (await response.text()).slice(0, 200);
    throw createApiError({
      path: url.pathname,
      status: response.status,
      bodyPreview,
      code: 'learnworlds_public_metadata_failed',
    });
  }

  return response.text();
};

const extractJsonLdBlocks = (html) => {
  const blocks = [];
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match = pattern.exec(html);
  while (match) {
    blocks.push(match[1]);
    match = pattern.exec(html);
  }

  return blocks;
};

const collectJsonLdObjectsByTypes = (value, targetTypes, collector = []) => {
  if (!value) {
    return collector;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonLdObjectsByTypes(item, targetTypes, collector));
    return collector;
  }

  if (typeof value !== 'object') {
    return collector;
  }

  const types = (Array.isArray(value['@type']) ? value['@type'] : [value['@type']])
    .filter(Boolean)
    .map((item) => String(item).toLowerCase());

  if (types.some((type) => targetTypes.includes(type))) {
    collector.push(value);
  }

  Object.values(value).forEach((nested) => collectJsonLdObjectsByTypes(nested, targetTypes, collector));
  return collector;
};

const mapBlogPostingObject = (entry, origin) => {
  const title = normalizeText(entry.headline || entry.name || entry.title);
  const url = absoluteUrlOrNull(
    entry.url || entry.mainEntityOfPage?.['@id'] || entry.mainEntityOfPage?.url,
    origin
  );
  const categories = ensureArray(entry.articleSection)
    .map((value) => normalizeText(value))
    .filter(Boolean);
  const tags = ensureArray(entry.keywords)
    .flatMap((value) =>
      typeof value === 'string' ? value.split(',') : [value?.name || value?.title || value]
    )
    .map((value) => normalizeText(value))
    .filter(Boolean);

  if (!title || !url) {
    return null;
  }

  return {
    title,
    url,
    categories,
    tags,
    freshness:
      normalizeTimestamp(entry.dateModified) ||
      normalizeTimestamp(entry.datePublished) ||
      null,
  };
};

const mapAnchorMatches = ({ html, origin, pattern, contentType }) => {
  const matches = [];
  let match = pattern.exec(html);
  while (match) {
    const url = absoluteUrlOrNull(match[1], origin);
    const title = normalizeText(decodeHtmlEntities(stripHtmlTags(match[2])));

    if (url && title && title.length >= 4) {
      matches.push({
        title,
        url,
        categories: [],
        tags: [],
        freshness: null,
        content_type: contentType,
      });
    }

    match = pattern.exec(html);
  }

  return matches;
};

const buildCatalogItems = (items) =>
  uniqueBy(
    items
      .filter(Boolean)
      .map((item) => ({
        ...item,
        searchable_text: [item.title, ...(item.categories || []), ...(item.tags || [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
      })),
    (item) => item.url || item.title
  );

const fetchLearnWorldsPublicCatalog = async ({
  config,
  fetchImpl,
  metrics,
  scheduler,
  path,
  contentType,
  sourceLabel,
  jsonLdTypes,
  anchorPattern,
}) => {
  const origin = new URL(config.apiBaseUrl).origin;
  const pageUrl = new URL(path, origin);

  try {
    const html = await fetchPublicText({
      url: pageUrl,
      fetchImpl,
      scheduler,
      metrics,
    });

    const jsonLdItems = extractJsonLdBlocks(html)
      .flatMap((block) => {
        try {
          return collectJsonLdObjectsByTypes(JSON.parse(block), jsonLdTypes);
        } catch {
          return [];
        }
      })
      .map((entry) => {
        const mapped = mapBlogPostingObject(entry, origin);
        return mapped ? { ...mapped, content_type: contentType } : null;
      })
      .filter(Boolean);

    const items = buildCatalogItems(
      jsonLdItems.length > 0
        ? jsonLdItems
        : mapAnchorMatches({ html, origin, pattern: anchorPattern, contentType })
    );

    if (items.length === 0) {
      return {
        connected: false,
        source: pageUrl.toString(),
        explanation:
          `The LearnWorlds ${sourceLabel} path is reachable, but no conservative ${sourceLabel} metadata could be extracted from the public index.`,
        items: [],
      };
    }

    return {
      connected: true,
      source: pageUrl.toString(),
      explanation: `LearnWorlds ${sourceLabel} metadata was extracted conservatively from the public index.`,
      items,
    };
  } catch (error) {
    return {
      connected: false,
      source: pageUrl.toString(),
      explanation:
        error?.status === 404
          ? `The LearnWorlds ${sourceLabel} path is not available for this school.`
          : `The LearnWorlds public ${sourceLabel} metadata path could not be loaded in the current environment.`,
      items: [],
      error,
    };
  }
};

const fetchLearnWorldsBlogCatalog = async (args) =>
  fetchLearnWorldsPublicCatalog({
    ...args,
    path: '/blog',
    contentType: 'blog',
    sourceLabel: 'blog',
    jsonLdTypes: ['blogposting', 'article', 'newsarticle'],
    anchorPattern: /<a[^>]+href=["']([^"']*\/blog\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
  });

const fetchLearnWorldsClassCatalog = async (args) =>
  fetchLearnWorldsPublicCatalog({
    ...args,
    path: '/classes',
    contentType: 'class',
    sourceLabel: 'class',
    jsonLdTypes: ['course', 'courseinstance', 'educationevent', 'event'],
    anchorPattern: /<a[^>]+href=["']([^"']*\/class(?:es)?\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
  });

const buildPayloadFromLiveData = async ({ config, fetchImpl, loadMode }) => {
  const metrics = createMetricsCollector(config);
  const scheduler = createRequestScheduler({
    requestDelayMs: config.requestDelayMs,
    maxConcurrentRequests: MAX_CONCURRENT_REQUESTS,
  });
  const runtimeWarnings = [];

  const [userDataset, courseDataset, blogCatalog, classCatalog] = await Promise.all([
    fetchCollectionDataset({
      config,
      datasetKey: 'userRows',
      path: '/admin/api/v2/users',
      fetchImpl,
      metrics,
      scheduler,
      mapper: mapUserRow,
    }),
    fetchCollectionDataset({
      config,
      datasetKey: 'courseRows',
      path: '/admin/api/v2/courses',
      fetchImpl,
      metrics,
      scheduler,
      mapper: mapCourseRow,
    }),
    fetchLearnWorldsBlogCatalog({
      config,
      fetchImpl,
      metrics,
      scheduler,
    }),
    fetchLearnWorldsClassCatalog({
      config,
      fetchImpl,
      metrics,
      scheduler,
    }),
  ]);

  runtimeWarnings.push(...userDataset.warnings, ...courseDataset.warnings);
  if (blogCatalog.error) {
    runtimeWarnings.push(
      `LearnWorlds blog metadata: ${blogCatalog.explanation}`
    );
  }
  if (classCatalog.error) {
    runtimeWarnings.push(
      `LearnWorlds class metadata: ${classCatalog.explanation}`
    );
  }

  const userRows = userDataset.rows;
  const courseRows = courseDataset.rows;
  const overviewMode = loadMode === 'overview';

  let enrollmentDataset = {
    rows: [],
    status: createDatasetStatus('unavailable', {
      reason: 'Skipped because userRows were unavailable.',
    }),
    warnings: [formatDatasetWarning('enrollmentRows', 'skipped because userRows were unavailable')],
  };
  let progressDataset = {
    rows: [],
    status: createDatasetStatus('unavailable', {
      reason: 'Skipped because userRows were unavailable.',
    }),
    warnings: [formatDatasetWarning('progressRows', 'skipped because userRows were unavailable')],
  };
  let activityAnalyticsDataset = {
    rows: [],
    status: createDatasetStatus('unavailable', {
      reason: 'Skipped because courseRows were unavailable.',
    }),
    warnings: [
      formatDatasetWarning('activityAnalyticsRows', 'skipped because courseRows were unavailable'),
    ],
  };

  if (userRows.length > 0) {
    const enrollmentUsers = overviewMode
      ? userRows.slice(0, OVERVIEW_ENROLLMENT_USER_LIMIT)
      : userRows;

    enrollmentDataset = await fetchEnrollmentRows({
      config,
      userRows: enrollmentUsers,
      fetchImpl,
      metrics,
      scheduler,
    });

    if (overviewMode && userRows.length > enrollmentUsers.length) {
      enrollmentDataset = {
        ...enrollmentDataset,
        status: createDatasetStatus('partial', {
          ...enrollmentDataset.status,
          reason:
            'Dashboard overview mode samples recent enrollments only to keep LearnWorlds responsive.',
        }),
        warnings: [
          ...enrollmentDataset.warnings,
          formatDatasetWarning(
            'enrollmentRows',
            `overview mode sampled the ${enrollmentUsers.length} most recent users for dashboard responsiveness`
          ),
        ],
      };
    }

    if (!overviewMode) {
      progressDataset = await fetchProgressRows({
        config,
        userRows,
        fetchImpl,
        metrics,
        scheduler,
      });
    } else {
      progressDataset = {
        rows: [],
        status: createDatasetStatus('partial', {
          reason: 'Skipped in dashboard overview mode to avoid LearnWorlds rate limits.',
        }),
        warnings: [
          formatDatasetWarning(
            'progressRows',
            'skipped in dashboard overview mode to reduce LearnWorlds request volume'
          ),
        ],
      };
    }
  }

  if (courseRows.length > 0) {
    if (!overviewMode) {
      activityAnalyticsDataset = await fetchCourseAnalyticsRows({
        config,
        courseRows,
        fetchImpl,
        metrics,
        scheduler,
      });
    } else {
      activityAnalyticsDataset = {
        rows: [],
        status: createDatasetStatus('partial', {
          reason: 'Skipped in dashboard overview mode to avoid LearnWorlds rate limits.',
        }),
        warnings: [
          formatDatasetWarning(
            'activityAnalyticsRows',
            'skipped in dashboard overview mode to reduce LearnWorlds request volume'
          ),
        ],
      };
    }
  }

  runtimeWarnings.push(
    ...enrollmentDataset.warnings,
    ...progressDataset.warnings,
    ...activityAnalyticsDataset.warnings
  );

  const datasets = {
    userRows,
    enrollmentRows: enrollmentDataset.rows,
    courseRows,
    progressRows: progressDataset.rows,
    activityAnalyticsRows: activityAnalyticsDataset.rows,
  };
  const datasetStatuses = {
    userRows: userDataset.status,
    courseRows: courseDataset.status,
    enrollmentRows: enrollmentDataset.status,
    progressRows: progressDataset.status,
    activityAnalyticsRows: activityAnalyticsDataset.status,
  };
  const contentCatalog = {
    learnworlds_blog: {
      connected: blogCatalog.connected,
      content_type: 'blog',
      item_count: blogCatalog.items.length,
      source: blogCatalog.source,
      explanation: blogCatalog.explanation,
      items: blogCatalog.items,
    },
    learnworlds_class: {
      connected: classCatalog.connected,
      content_type: 'class',
      item_count: classCatalog.items.length,
      source: classCatalog.source,
      explanation: classCatalog.explanation,
      items: classCatalog.items,
    },
  };

  metrics.partialDatasetCount = Object.values(datasetStatuses).filter(
    (status) => status.support !== 'real'
  ).length;

  const validationSummary = {
    userRows: summarizeBaseRowValidation(userRows, {
      idField: 'user_id',
      timestampFields: ['created_at'],
    }),
    courseRows: summarizeBaseRowValidation(courseRows, {
      idField: 'course_id',
      timestampFields: ['created_at', 'updated_at'],
    }),
    enrollmentRows: summarizeEnrollmentValidation(datasets.enrollmentRows),
    progressRows: summarizeProgressValidation({
      progressRows: datasets.progressRows,
      userRows,
      courseRows,
    }),
    activityAnalyticsRows: summarizeActivityAnalyticsValidation({
      activityAnalyticsRows: datasets.activityAnalyticsRows,
      courseRows,
    }),
  };

  return createLearnWorldsSourcePayload({
    adapterId: 'learnworlds-api',
    sourceKind: 'api',
    datasets,
    meta: buildMeta({
      config,
      metrics,
      datasets,
      validationSummary,
      datasetStatuses,
      runtimeWarnings,
      cacheHit: false,
      contentCatalog,
      loadMode,
    }),
  });
};

export const loadLearnWorldsApiSource = async ({
  rootDir = process.cwd(),
  env = process.env,
  fetchImpl = fetch,
  loadMode = 'full',
} = {}) => {
  const config = loadLearnWorldsServerEnv({ rootDir, env });
  const normalizedLoadMode = normalizeLoadMode(loadMode);
  console.info(
    `[LearnWorlds API] Loading ${normalizedLoadMode} datasets from ${config.apiBaseUrl || '[missing base URL]'}`
  );
  const validation = validateLearnWorldsServerEnv(config);

  if (!validation.isValid) {
    console.error(
      `[LearnWorlds API] Env validation failed: ${buildValidationError(validation)}`
    );
    throw new Error(buildValidationError(validation));
  }

  if (config.dataSource !== 'api') {
    console.error('[LearnWorlds API] LEARNWORLDS_DATA_SOURCE must be set to api.');
    throw new Error('LEARNWORLDS_DATA_SOURCE must be set to api before calling the LearnWorlds API route.');
  }

  const { value, cacheHit } = await readThroughCache({
    key: buildDatasetCacheKey(config, normalizedLoadMode),
    ttlMs: config.datasetCacheTtlMs,
    loader: () => buildPayloadFromLiveData({ config, fetchImpl, loadMode: normalizedLoadMode }),
  });

  console.info(
    `[LearnWorlds API] Dataset counts ${JSON.stringify(summarizeDatasetCounts(value.datasets))}`
  );

  return {
    ...value,
    meta: {
      ...value.meta,
      cache: {
        ...(value.meta?.cache || {}),
        cacheHit,
        datasetCacheTtlMs: config.datasetCacheTtlMs,
      },
      envMask: maskLearnWorldsServerConfig(config),
      loadMode: normalizedLoadMode,
    },
  };
};

export const createLearnWorldsApiHttpHandler = (options = {}) => async () =>
  loadLearnWorldsApiSource(options);
