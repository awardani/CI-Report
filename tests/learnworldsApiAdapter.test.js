import test from 'node:test';
import assert from 'node:assert/strict';
import { createLearnWorldsSourcePayload } from '../src/dataSources/learnworldsAdapterContract.js';
import { clearCache } from '../server/intercom/cache.js';
import { loadLearnWorldsApiSource } from '../server/learnworlds/apiAdapter.js';

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });

test('LearnWorlds adapter contract requires all LearnWorlds dataset arrays', () => {
  const payload = createLearnWorldsSourcePayload({
    adapterId: 'learnworlds-api',
    sourceKind: 'api',
    datasets: {
      userRows: [],
      enrollmentRows: [],
      courseRows: [],
      progressRows: [],
      activityAnalyticsRows: [],
    },
    meta: {
      warnings: ['placeholder'],
    },
  });

  assert.equal(payload.adapterId, 'learnworlds-api');
  assert.equal(payload.sourceKind, 'api');
  assert.deepEqual(Object.keys(payload.datasets), [
    'userRows',
    'enrollmentRows',
    'courseRows',
    'progressRows',
    'activityAnalyticsRows',
  ]);
});

test('LearnWorlds API source maps users, enrollments, progress, and analytics into the dataset contract', async () => {
  clearCache();
  const fetchCalls = [];
  const fetchImpl = async (url, options) => {
    fetchCalls.push({ path: url.pathname + url.search, headers: options.headers });

    if (url.pathname === '/admin/api/v2/users' && url.searchParams.get('page') === '1') {
      return jsonResponse({
        data: [
          {
            id: 'user-1',
            email: 'ada@example.com',
            username: 'Ada',
            first_name: 'Ada',
            last_name: 'Lovelace',
            role: 'student',
            is_admin: false,
            is_instructor: false,
            is_suspended: false,
            created: '2026-01-01T00:00:00Z',
            last_login: '2026-01-10T00:00:00Z',
            signup_approval_status: 'approved',
            email_verification_status: 'verified',
            fields: { company: 'Threecolts' },
            tags: ['vip'],
          },
        ],
        meta: {
          page: 1,
          totalItems: 1,
          totalPages: 1,
          itemsPerPage: 20,
        },
      });
    }

    if (url.pathname === '/admin/api/v2/courses' && url.searchParams.get('page') === '1') {
      return jsonResponse({
        data: [
          {
            id: 'course-1',
            title: 'Seller 365',
            label: 'Seller 365',
            description: 'Intro course',
            author: { name: 'Team Learn' },
            categories: [{ title: 'Onboarding' }],
            access: 'paid',
            created: '2026-01-02T00:00:00Z',
            modified: '2026-01-08T00:00:00Z',
            expires: null,
            expiresType: 'never',
            identifiers: { sku: 'seller-365' },
          },
        ],
        meta: {
          page: 1,
          totalItems: 1,
          totalPages: 1,
          itemsPerPage: 50,
        },
      });
    }

    if (
      url.pathname === '/admin/api/v2/users/user-1/courses' &&
      url.searchParams.get('page') === '1'
    ) {
      return jsonResponse({
        data: [
          {
            created: 1767312000,
            expires: null,
            course: {
              id: 'course-1',
              title: 'Seller 365',
            },
          },
        ],
        meta: {
          page: 1,
          totalItems: 1,
          totalPages: 1,
          itemsPerPage: 20,
        },
      });
    }

    if (
      url.pathname === '/admin/api/v2/users/user-1/progress' &&
      url.searchParams.get('page') === '1'
    ) {
      return jsonResponse({
        data: [
          {
            course_id: 'course-1',
            status: 'in_progress',
            progress_rate: 19,
            average_score_rate: 83,
            time_on_course: 19658,
            total_units: 10,
            completed_units: 3,
            progress_per_section_unit: [{ section_id: 'section-1', units: [] }],
            completed_at: null,
          },
        ],
        meta: {
          page: 1,
          totalItems: 1,
          totalPages: 1,
          itemsPerPage: 20,
        },
      });
    }

    if (url.pathname === '/admin/api/v2/courses/course-1/analytics') {
      return jsonResponse({
        students: 25,
        videos: 4,
        learning_units: 8,
        video_time: 1200,
        avg_score_rate: 91,
        success_rate: 88,
        total_study_time: 64000,
        avg_time_to_finish: 4200,
        social_interactions: 5,
        certificates_issued: 2,
        video_viewing_time: 31,
      });
    }

    throw new Error(`Unexpected LearnWorlds path ${url.pathname}${url.search}`);
  };

  const payload = await loadLearnWorldsApiSource({
    rootDir: '/tmp',
    env: {
      LEARNWORLDS_DATA_SOURCE: 'api',
      LEARNWORLDS_API_BASE_URL: 'https://api.learnworlds.test',
      LEARNWORLDS_API_TOKEN: 'learnworlds-secret',
      LEARNWORLDS_CLIENT_ID: 'client-id',
    },
    fetchImpl,
  });

  assert.equal(payload.adapterId, 'learnworlds-api');
  assert.equal(payload.sourceKind, 'api');
  assert.equal(payload.datasets.userRows.length, 1);
  assert.equal(payload.datasets.courseRows.length, 1);
  assert.equal(payload.datasets.enrollmentRows.length, 1);
  assert.equal(payload.datasets.progressRows.length, 1);
  assert.equal(payload.datasets.activityAnalyticsRows.length, 1);
  assert.equal(payload.datasets.userRows[0].user_id, 'user-1');
  assert.equal(payload.datasets.courseRows[0].course_id, 'course-1');
  assert.equal(payload.datasets.enrollmentRows[0].enrollment_id, 'course-1:user-1');
  assert.equal(payload.datasets.enrollmentRows[0].enrollment_id_is_synthetic, true);
  assert.equal(payload.datasets.enrollmentRows[0].enrolled_at, '2026-01-02T00:00:00.000Z');
  assert.equal(payload.datasets.progressRows[0].course_id, 'course-1');
  assert.equal(payload.datasets.progressRows[0].progress_percent, 19);
  assert.equal(payload.datasets.activityAnalyticsRows[0].course_id, 'course-1');
  assert.equal(payload.datasets.activityAnalyticsRows[0].total_study_time_seconds, 64000);
  assert.equal(payload.meta.implementedDatasets.userRows, true);
  assert.equal(payload.meta.implementedDatasets.progressRows, true);
  assert.equal(payload.meta.implementedDatasets.activityAnalyticsRows, true);
  assert.equal(payload.meta.datasetSupport.enrollmentRows, 'partial');
  assert.equal(payload.meta.datasetSupport.progressRows, 'partial');
  assert.equal(payload.meta.datasetSupport.activityAnalyticsRows, 'partial');
  assert.equal(payload.meta.cache.cacheHit, false);
  assert.equal(payload.meta.rowCounts.enrollmentRows, 1);
  assert.equal(payload.meta.validationSummary.enrollmentRows.missingTimestampCounts.enrolled_at, 0);
  assert.equal(payload.meta.validationSummary.progressRows.missingLastActivityCount, 1);
  assert.equal(payload.meta.validationSummary.activityAnalyticsRows.missingActivityIdentityCount, 1);
  assert.equal(payload.meta.envMask.apiKeyPresent, true);
  assert.equal(payload.meta.endpointSummary.requestCount, 5);
  assert.equal(
    payload.meta.enrollmentTimestampStatus.source,
    '/admin/api/v2/users/{user_id}/courses.created'
  );
  assert.equal(fetchCalls[0].headers['Lw-Client'], 'client-id');
  assert.equal(fetchCalls[0].headers.Authorization, 'Bearer learnworlds-secret');
});

test('LearnWorlds API source returns partial data when progress requests are rate-limited', async () => {
  clearCache();
  const fetchImpl = async (url, options) => {
    void options;

    if (url.pathname === '/admin/api/v2/users' && url.searchParams.get('page') === '1') {
      return jsonResponse({
        data: [
          {
            id: 'user-1',
            email: 'ada@example.com',
            role: 'student',
            created: '2026-01-01T00:00:00Z',
          },
        ],
        meta: { page: 1, totalItems: 1, totalPages: 1, itemsPerPage: 20 },
      });
    }

    if (url.pathname === '/admin/api/v2/courses' && url.searchParams.get('page') === '1') {
      return jsonResponse({
        data: [
          {
            id: 'course-1',
            title: 'Seller 365',
            created: '2026-01-02T00:00:00Z',
            modified: '2026-01-08T00:00:00Z',
          },
        ],
        meta: { page: 1, totalItems: 1, totalPages: 1, itemsPerPage: 20 },
      });
    }

    if (
      url.pathname === '/admin/api/v2/users/user-1/courses' &&
      url.searchParams.get('page') === '1'
    ) {
      return jsonResponse({
        data: [
          {
            created: 1767312000,
            course: { id: 'course-1' },
          },
        ],
        meta: { page: 1, totalItems: 1, totalPages: 1, itemsPerPage: 20 },
      });
    }

    if (
      url.pathname === '/admin/api/v2/users/user-1/progress' &&
      url.searchParams.get('page') === '1'
    ) {
      return new Response('too many requests', {
        status: 429,
        headers: {
          'retry-after': '0',
        },
      });
    }

    if (url.pathname === '/admin/api/v2/courses/course-1/analytics') {
      return jsonResponse({
        students: 5,
        learning_units: 3,
        total_study_time: 1000,
      });
    }

    throw new Error(`Unexpected LearnWorlds path ${url.pathname}${url.search}`);
  };

  const payload = await loadLearnWorldsApiSource({
    rootDir: '/tmp',
    env: {
      LEARNWORLDS_DATA_SOURCE: 'api',
      LEARNWORLDS_API_BASE_URL: 'https://api.learnworlds.test',
      LEARNWORLDS_API_TOKEN: 'learnworlds-secret',
      LEARNWORLDS_CLIENT_ID: 'client-id',
      LEARNWORLDS_REQUEST_DELAY_MS: '0',
      LEARNWORLDS_DATASET_CACHE_TTL_MS: '0',
    },
    fetchImpl,
  });

  assert.equal(payload.datasets.userRows.length, 1);
  assert.equal(payload.datasets.courseRows.length, 1);
  assert.equal(payload.datasets.enrollmentRows.length, 1);
  assert.equal(payload.datasets.progressRows.length, 0);
  assert.equal(payload.datasets.activityAnalyticsRows.length, 1);
  assert.equal(payload.meta.partialData, true);
  assert.equal(payload.meta.datasetSupport.progressRows, 'partial');
  assert.match(
    payload.meta.warnings.join('\n'),
    /LearnWorlds progressRows: rate-limited for user user-1/
  );
  assert.equal(payload.meta.endpointSummary.rateLimitRetryCount > 0, true);
});

test('LearnWorlds API source uses cached dataset payloads on repeat loads', async () => {
  clearCache();
  let requestCount = 0;
  const fetchImpl = async (url) => {
    requestCount += 1;

    if (url.pathname === '/admin/api/v2/users' && url.searchParams.get('page') === '1') {
      return jsonResponse({
        data: [],
        meta: { page: 1, totalItems: 0, totalPages: 1, itemsPerPage: 20 },
      });
    }

    if (url.pathname === '/admin/api/v2/courses' && url.searchParams.get('page') === '1') {
      return jsonResponse({
        data: [],
        meta: { page: 1, totalItems: 0, totalPages: 1, itemsPerPage: 20 },
      });
    }

    throw new Error(`Unexpected LearnWorlds path ${url.pathname}${url.search}`);
  };

  const env = {
    LEARNWORLDS_DATA_SOURCE: 'api',
    LEARNWORLDS_API_BASE_URL: 'https://api.learnworlds.test',
    LEARNWORLDS_API_TOKEN: 'learnworlds-secret',
    LEARNWORLDS_CLIENT_ID: 'client-id',
    LEARNWORLDS_REQUEST_DELAY_MS: '0',
    LEARNWORLDS_DATASET_CACHE_TTL_MS: '60000',
  };

  const firstPayload = await loadLearnWorldsApiSource({
    rootDir: '/tmp',
    env,
    fetchImpl,
  });
  const secondPayload = await loadLearnWorldsApiSource({
    rootDir: '/tmp',
    env,
    fetchImpl,
  });

  assert.equal(firstPayload.meta.cache.cacheHit, false);
  assert.equal(secondPayload.meta.cache.cacheHit, true);
  assert.equal(requestCount, 2);
});

test('LearnWorlds API source fails safely when required env is missing', async () => {
  clearCache();
  await assert.rejects(
    () =>
      loadLearnWorldsApiSource({
        rootDir: '/tmp',
        env: {
          LEARNWORLDS_DATA_SOURCE: 'api',
        },
      }),
    /Missing LearnWorlds env: LEARNWORLDS_API_BASE_URL, LEARNWORLDS_API_KEY/
  );
});

test('LearnWorlds API source requires LearnWorlds API mode before route execution', async () => {
  clearCache();
  await assert.rejects(
    () =>
      loadLearnWorldsApiSource({
        rootDir: '/tmp',
        env: {
          LEARNWORLDS_DATA_SOURCE: '',
          LEARNWORLDS_API_BASE_URL: 'https://api.learnworlds.test',
          LEARNWORLDS_API_KEY: 'secret',
          LEARNWORLDS_CLIENT_ID: 'client-id',
        },
      }),
    /LEARNWORLDS_DATA_SOURCE must be set to api/
  );
});
