import test from 'node:test';
import assert from 'node:assert/strict';
import { loadIntercomApiSource, mapIntercomConversationsToDatasets } from '../server/intercom/apiAdapter.js';
import { clearCache } from '../server/intercom/cache.js';
import {
  loadIntercomServerEnv,
  maskIntercomServerConfig,
  validateIntercomServerEnv,
} from '../server/intercom/env.js';

test('Intercom API mapper produces dataset contract rows', () => {
  const datasets = mapIntercomConversationsToDatasets({
    admins: [{ id: 'admin-1', name: 'Melanie' }],
    teams: [{ id: 'team-1', name: 'Support' }],
    conversations: [
      {
        id: 'conv-1',
        created_at: 1760000000,
        updated_at: 1760003600,
        state: 'closed',
        admin_assignee_id: 'admin-1',
        team_assignee_id: 'team-1',
        ai_agent_participated: true,
        ai_agent: {
          resolution_state: 'confirmed_resolution',
          rating: 5,
          rating_remark: 'Solved it',
          rating_updated_at: 1760003500,
        },
        statistics: {
          time_to_admin_reply: 120,
        },
        conversation_rating: {
          rating: 4,
          remark: 'Helpful',
          created_at: 1760003200,
          teammate: { id: 'admin-1' },
          contact: { name: 'Alicia' },
        },
        source: {
          type: 'conversation',
          delivered_as: 'customer_initiated',
          author: { type: 'contact', name: 'Alicia' },
        },
        ai_topics: {
          categories: [{ label: 'Billing' }],
          subcategories: [{ label: 'Refunds' }],
        },
      },
    ],
  });

  assert.equal(datasets.conversationRows.length, 1);
  assert.equal(datasets.satisfactionRows.length, 2);
  assert.equal(datasets.finSatisfactionRows.length, 1);
  assert.equal(datasets.finDeflectionRows.length, 1);
  assert.equal(datasets.finResolutionRows.length, 1);

  assert.equal(datasets.conversationRows[0]['Teammate currently assigned'], 'Melanie');
  assert.equal(datasets.conversationRows[0]['Team currently assigned'], 'Support');
  assert.equal(datasets.conversationRows[0]['Fin AI Agent deflected'], 'true');
  assert.equal(datasets.satisfactionRows[0]['Agent rated type'], 'Teammate');
  assert.equal(datasets.satisfactionRows[1]['Agent rated type'], 'Fin AI Agent');
});

test('server env loader reads provided values and masks them safely', () => {
  const config = loadIntercomServerEnv({
    env: {
      INTERCOM_CLIENT_ID: 'client-id',
      INTERCOM_CLIENT_SECRET: 'client-secret',
      INTERCOM_ACCESS_TOKEN: 'token-value',
      INTERCOM_API_BASE_URL: 'https://api.intercom.io',
    },
  });

  const validation = validateIntercomServerEnv(config);
  const masked = maskIntercomServerConfig(config);

  assert.equal(validation.isValid, true);
  assert.equal(masked.clientIdPresent, true);
  assert.equal(masked.clientSecretPresent, true);
  assert.equal(masked.accessTokenPresent, true);
  assert.equal(masked.apiBaseUrlHost, 'api.intercom.io');
});

test('API source uses bounded initial backfill and cache for repeat loads', async () => {
  clearCache();

  const nowUnix = Math.floor(Date.now() / 1000);
  let fetchCalls = 0;
  const fetchImpl = async (url) => {
    fetchCalls += 1;
    const pathname = url.pathname;

    if (pathname === '/admins') {
      return new Response(JSON.stringify({ admins: [{ id: 'admin-1', name: 'Melanie' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (pathname === '/teams') {
      return new Response(JSON.stringify({ teams: [{ id: 'team-1', name: 'Support' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (pathname === '/conversations') {
      const startingAfter = url.searchParams.get('starting_after');
      const pageOne = {
        conversations: [
          {
            id: 'conv-new',
            created_at: nowUnix,
            updated_at: nowUnix,
            state: 'closed',
            admin_assignee_id: 'admin-1',
            team_assignee_id: 'team-1',
            ai_agent_participated: false,
            source: { type: 'conversation', delivered_as: 'customer_initiated', author: { type: 'contact' } },
            statistics: {},
            conversation_rating: null,
          },
          {
            id: 'conv-old',
            created_at: nowUnix - 200 * 24 * 60 * 60,
            updated_at: nowUnix,
            state: 'closed',
            admin_assignee_id: 'admin-1',
            team_assignee_id: 'team-1',
            ai_agent_participated: false,
            source: { type: 'conversation', delivered_as: 'customer_initiated', author: { type: 'contact' } },
            statistics: {},
            conversation_rating: null,
          },
        ],
        pages: startingAfter ? {} : { next: { starting_after: 'page-2' } },
      };

      const pageTwo = {
        conversations: [
          {
            id: 'conv-older',
            created_at: nowUnix - 220 * 24 * 60 * 60,
            updated_at: nowUnix,
            state: 'closed',
            admin_assignee_id: 'admin-1',
            team_assignee_id: 'team-1',
            ai_agent_participated: false,
            source: { type: 'conversation', delivered_as: 'customer_initiated', author: { type: 'contact' } },
            statistics: {},
            conversation_rating: null,
          },
        ],
        pages: {},
      };

      return new Response(JSON.stringify(startingAfter ? pageTwo : pageOne), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unexpected path ${pathname}`);
  };

  const configEnv = {
    INTERCOM_ACCESS_TOKEN: 'token',
    INTERCOM_INITIAL_BACKFILL_DAYS: '120',
    INTERCOM_LOOKUP_CACHE_TTL_MS: '60000',
    INTERCOM_DATASET_CACHE_TTL_MS: '60000',
    INTERCOM_API_BASE_URL: 'https://api.intercom.io',
  };

  const first = await loadIntercomApiSource({ env: configEnv, fetchImpl });
  const second = await loadIntercomApiSource({ env: configEnv, fetchImpl });

  assert.equal(first.datasets.conversationRows.length, 1);
  assert.equal(first.meta.apiSummary.initialBackfillDays, 120);
  assert.equal(first.meta.apiSummary.datasetCacheHit, false);
  assert.equal(second.meta.apiSummary.datasetCacheHit, true);
  assert.equal(fetchCalls, 3);
});
