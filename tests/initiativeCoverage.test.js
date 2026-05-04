import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExistingCoveragePlaceholder, buildInitiativeRecommendation } from '../src/initiatives/model.js';
import { enrichInitiativeCoverage } from '../src/initiatives/audit.js';
import { normalizeLearnWorldsDatasets } from '../src/learnworlds/normalization.js';
import { createLearnWorldsFixtureDatasets } from './fixtures/learnworldsFixtures.js';

const createInitiative = (overrides = {}) =>
  buildInitiativeRecommendation({
    initiative_id: 'initiative-1',
    title: 'Refresh onboarding content',
    signal_detected: 'New learners need a clearer onboarding path.',
    signal_type: 'activation_gap',
    owner_area: 'Education / Threecolts University',
    suggested_action: 'Create or refresh an onboarding class or course path.',
    suggested_format: 'class_or_onboarding_series',
    existing_coverage: buildExistingCoveragePlaceholder({
      relevantSurfaces: ['intercom_help_center', 'learnworlds_blog', 'learnworlds_class', 'learnworlds_course'],
    }),
    suggested_cadence: 'this_month',
    priority: 'medium',
    why_this_surfaced: 'Registrations are rising faster than active users.',
    source_signals: [],
    support_state: 'partial',
    ...overrides,
  });

const intercomSourceMeta = {
  contentCatalog: {
    intercom_help_center: {
      connected: true,
      items: [
        {
          title: 'Cancellation and refund guide',
          url: 'https://help.example.com/en/articles/cancellation-and-refund-guide',
          category: 'Billing',
          section: 'Account help',
          tags: ['refund'],
          freshness: '2026-01-08T00:00:00.000Z',
        },
      ],
    },
  },
};

const learnWorldsSourceMeta = {
  contentCatalog: {
    learnworlds_blog: {
      connected: true,
      items: [
        {
          title: 'Getting started with Seller 365',
          url: 'https://academy.example.com/blog/getting-started-with-seller-365',
          categories: ['Onboarding'],
          tags: ['seller 365'],
          freshness: '2026-01-05T00:00:00.000Z',
        },
        {
          title: 'Cancellation and refund walkthrough',
          url: 'https://academy.example.com/blog/cancellation-and-refund-walkthrough',
          categories: ['Billing'],
          tags: ['refund', 'billing'],
          freshness: '2026-01-09T00:00:00.000Z',
        },
      ],
    },
    learnworlds_class: {
      connected: true,
      items: [
        {
          title: 'Seller 365 Live Onboarding Class',
          url: 'https://academy.example.com/classes/seller-365-live-onboarding',
          categories: ['Onboarding'],
          tags: ['seller 365', 'live'],
          freshness: '2026-01-10T00:00:00.000Z',
        },
        {
          title: 'Seller 365 Kickoff Session',
          url: 'https://academy.example.com/classes/seller-365-kickoff-session',
          categories: ['Onboarding'],
          tags: ['seller 365'],
          freshness: '2025-01-10T00:00:00.000Z',
        },
      ],
    },
  },
};

test('coverage audit finds LearnWorlds course matches from exact names and category keywords', () => {
  const learnWorldsNormalized = normalizeLearnWorldsDatasets(createLearnWorldsFixtureDatasets());

  const exactMatchInitiative = createInitiative({
    title: 'Improve Seller 365 onboarding',
    source_signals: [
      {
        source: 'learnworlds_metrics',
        signal_key: 'lw_most_dropped_out_courses',
        label: 'Most dropped out courses',
        details: {
          course_name: 'Seller 365',
        },
      },
    ],
  });

  const exactResult = enrichInitiativeCoverage({
    initiative: exactMatchInitiative,
    intercomSourceMeta,
    learnWorldsNormalizedData: learnWorldsNormalized,
    learnWorldsSourceMeta,
  });

  assert.equal(exactResult.existing_coverage.learnworlds_course.state, 'found');
  assert.equal(exactResult.existing_coverage.learnworlds_course.matches[0].title, 'Seller 365');
  assert.equal(
    exactResult.existing_coverage.learnworlds_course.matches[0].match_basis,
    'exact_title'
  );

  const categoryMatchInitiative = createInitiative();
  const categoryResult = enrichInitiativeCoverage({
    initiative: categoryMatchInitiative,
    intercomSourceMeta,
    learnWorldsNormalizedData: learnWorldsNormalized,
    learnWorldsSourceMeta,
  });

  assert.equal(categoryResult.existing_coverage.learnworlds_course.state, 'found');
  assert.equal(
    categoryResult.existing_coverage.learnworlds_course.matches[0].match_basis,
    'category_keyword'
  );
  assert.equal(categoryResult.existing_coverage.learnworlds_class.state, 'found');
  assert.equal(
    categoryResult.existing_coverage.learnworlds_class.matches[0].title,
    'Seller 365 Live Onboarding Class'
  );
  assert.equal(categoryResult.existing_coverage.learnworlds_class.matches[0].is_top_match, true);
  assert.equal(categoryResult.existing_coverage.learnworlds_class.matches[0].rank, 1);
});

test('coverage audit finds connected Help Center and blog matches conservatively', () => {
  const learnWorldsNormalized = normalizeLearnWorldsDatasets(createLearnWorldsFixtureDatasets());

  const initiative = createInitiative({
    title: 'Create cancellation billing walkthrough',
    signal_detected: 'Billing confusion is rising.',
    suggested_action: 'Publish a cancellation and refund walkthrough for billing questions.',
    suggested_format: 'help_center_article_update',
    source_signals: [
      {
        source: 'intercom_topics',
        signal_key: 'billing_confusion_topic_volume',
        label: 'Billing confusion',
        details: {
          top_matches: [{ name: 'Cancellation' }],
        },
      },
    ],
  });

  const result = enrichInitiativeCoverage({
    initiative,
    intercomSourceMeta,
    learnWorldsNormalizedData: learnWorldsNormalized,
    learnWorldsSourceMeta,
  });

  assert.equal(result.existing_coverage.intercom_help_center.state, 'found');
  assert.equal(result.existing_coverage.intercom_help_center.matches[0].title, 'Cancellation and refund guide');
  assert.equal(result.existing_coverage.learnworlds_blog.state, 'found');
  assert.equal(result.existing_coverage.learnworlds_blog.matches[0].title, 'Cancellation and refund walkthrough');
  assert.equal(result.existing_coverage.learnworlds_blog.matches[0].is_top_match, true);
  assert.equal(result.existing_coverage.learnworlds_class.state, 'not_found');
  assert.equal(result.existing_coverage.learnworlds_course.state, 'not_found');
  assert.equal(result.existing_coverage.audit_state, 'partial');
});

test('coverage audit flags stale matches that may need refresh', () => {
  const learnWorldsNormalized = normalizeLearnWorldsDatasets(createLearnWorldsFixtureDatasets());
  const staleSourceMeta = {
    contentCatalog: {
      learnworlds_blog: {
        connected: true,
        items: [
          {
            title: 'Seller 365 onboarding overview',
            url: 'https://academy.example.com/blog/seller-365-onboarding-overview',
            categories: ['Onboarding'],
            tags: ['seller 365'],
            freshness: '2024-01-01T00:00:00.000Z',
          },
        ],
      },
    },
  };

  const result = enrichInitiativeCoverage({
    initiative: createInitiative({
      title: 'Improve Seller 365 onboarding',
    }),
    learnWorldsNormalizedData: learnWorldsNormalized,
    learnWorldsSourceMeta: staleSourceMeta,
  });

  assert.equal(result.existing_coverage.learnworlds_blog.state, 'found');
  assert.equal(result.existing_coverage.learnworlds_blog.refresh_signal, 'may_need_refresh');
  assert.equal(result.existing_coverage.learnworlds_blog.matches[0].may_need_refresh, true);
});
