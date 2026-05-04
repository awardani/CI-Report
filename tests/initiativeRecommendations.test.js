import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIntercomDatasets } from '../src/metrics/normalization.js';
import { normalizeLearnWorldsDatasets } from '../src/learnworlds/normalization.js';
import { buildInitiativeRecommendations } from '../src/initiatives/recommendations.js';

const createIntercomInitiativeFixture = () => ({
  conversationRows: [
    {
      'Conversation ID': 'conv-p1',
      'Conversation started at (America/New_York)': '2026-01-05 10:00:00',
      'Started by': 'Customer',
      'Conversation source': 'Inbound message',
      'Current conversation state': 'Closed',
      'Team currently assigned': 'Support',
      'Teammate currently assigned': 'Ada',
      'Last teammate rated': 'Ada',
      'Fin AI Agent involved': 'false',
      'Fin AI Agent deflected': 'false',
      'Fin AI Agent resolution state': '',
      Topics: 'Billing',
      'AI Topic': 'Billing',
      'AI Subtopic': 'Cancellation',
      Channel: 'Email',
      'Ticket type': 'Support Request',
      'First response time (seconds)': '120',
    },
    {
      'Conversation ID': 'conv-p2',
      'Conversation started at (America/New_York)': '2026-01-06 10:00:00',
      'Started by': 'Customer',
      'Conversation source': 'Inbound message',
      'Current conversation state': 'Closed',
      'Team currently assigned': 'Support',
      'Teammate currently assigned': 'Ada',
      'Last teammate rated': 'Ada',
      'Fin AI Agent involved': 'false',
      'Fin AI Agent deflected': 'false',
      'Fin AI Agent resolution state': '',
      Topics: 'Access',
      'AI Topic': 'Access',
      'AI Subtopic': 'Login issue',
      Channel: 'Chat',
      'Ticket type': 'Support Request',
      'First response time (seconds)': '180',
    },
    {
      'Conversation ID': 'conv-fin-p1',
      'Conversation started at (America/New_York)': '2026-01-10 09:00:00',
      'Started by': 'Customer',
      'Conversation source': 'Inbound message',
      'Current conversation state': 'Closed',
      'Team currently assigned': 'Fin',
      'Teammate currently assigned': 'Fin Bot',
      'Last teammate rated': '',
      'Fin AI Agent involved': 'true',
      'Fin AI Agent deflected': 'true',
      'Fin AI Agent resolution state': 'Confirmed resolved',
      Topics: 'Orders',
      'AI Topic': 'Orders',
      'AI Subtopic': 'Tracking',
      Channel: 'Chat',
      'Ticket type': 'Support Request',
      'First response time (seconds)': '60',
    },
    {
      'Conversation ID': 'conv-fin-p2',
      'Conversation started at (America/New_York)': '2026-01-11 09:00:00',
      'Started by': 'Customer',
      'Conversation source': 'Inbound message',
      'Current conversation state': 'Closed',
      'Team currently assigned': 'Fin',
      'Teammate currently assigned': 'Fin Bot',
      'Last teammate rated': '',
      'Fin AI Agent involved': 'true',
      'Fin AI Agent deflected': 'true',
      'Fin AI Agent resolution state': 'Assumed resolved',
      Topics: 'Orders',
      'AI Topic': 'Orders',
      'AI Subtopic': 'Tracking',
      Channel: 'Chat',
      'Ticket type': 'Support Request',
      'First response time (seconds)': '65',
    },
    {
      'Conversation ID': 'conv-c1',
      'Conversation started at (America/New_York)': '2026-02-05 10:00:00',
      'Started by': 'Customer',
      'Conversation source': 'Inbound message',
      'Current conversation state': 'Closed',
      'Team currently assigned': 'Support',
      'Teammate currently assigned': 'Bea',
      'Last teammate rated': 'Bea',
      'Fin AI Agent involved': 'false',
      'Fin AI Agent deflected': 'false',
      'Fin AI Agent resolution state': '',
      Topics: 'Access',
      'AI Topic': 'Access',
      'AI Subtopic': 'Password issue',
      Channel: 'Email',
      'Ticket type': 'Support Request',
      'First response time (seconds)': '200',
    },
    {
      'Conversation ID': 'conv-c2',
      'Conversation started at (America/New_York)': '2026-02-06 10:00:00',
      'Started by': 'Customer',
      'Conversation source': 'Inbound message',
      'Current conversation state': 'Closed',
      'Team currently assigned': 'Support',
      'Teammate currently assigned': 'Bea',
      'Last teammate rated': 'Bea',
      'Fin AI Agent involved': 'false',
      'Fin AI Agent deflected': 'false',
      'Fin AI Agent resolution state': '',
      Topics: 'Access',
      'AI Topic': 'Access',
      'AI Subtopic': 'Login error',
      Channel: 'Chat',
      'Ticket type': 'Support Request',
      'First response time (seconds)': '150',
    },
    {
      'Conversation ID': 'conv-c3',
      'Conversation started at (America/New_York)': '2026-02-07 10:00:00',
      'Started by': 'Customer',
      'Conversation source': 'Inbound message',
      'Current conversation state': 'Closed',
      'Team currently assigned': 'Support',
      'Teammate currently assigned': 'Bea',
      'Last teammate rated': 'Bea',
      'Fin AI Agent involved': 'false',
      'Fin AI Agent deflected': 'false',
      'Fin AI Agent resolution state': '',
      Topics: 'Troubleshooting',
      'AI Topic': 'Troubleshooting',
      'AI Subtopic': 'Bug',
      Channel: 'Email',
      'Ticket type': 'Support Request',
      'First response time (seconds)': '300',
    },
    {
      'Conversation ID': 'conv-c4',
      'Conversation started at (America/New_York)': '2026-02-08 10:00:00',
      'Started by': 'Customer',
      'Conversation source': 'Inbound message',
      'Current conversation state': 'Closed',
      'Team currently assigned': 'Support',
      'Teammate currently assigned': 'Bea',
      'Last teammate rated': 'Bea',
      'Fin AI Agent involved': 'false',
      'Fin AI Agent deflected': 'false',
      'Fin AI Agent resolution state': '',
      Topics: 'Billing',
      'AI Topic': 'Billing',
      'AI Subtopic': 'Cancellation',
      Channel: 'Email',
      'Ticket type': 'Support Request',
      'First response time (seconds)': '220',
    },
    {
      'Conversation ID': 'conv-c5',
      'Conversation started at (America/New_York)': '2026-02-09 10:00:00',
      'Started by': 'Customer',
      'Conversation source': 'Inbound message',
      'Current conversation state': 'Closed',
      'Team currently assigned': 'Support',
      'Teammate currently assigned': 'Bea',
      'Last teammate rated': 'Bea',
      'Fin AI Agent involved': 'false',
      'Fin AI Agent deflected': 'false',
      'Fin AI Agent resolution state': '',
      Topics: 'Billing',
      'AI Topic': 'Billing',
      'AI Subtopic': 'Invoice',
      Channel: 'Chat',
      'Ticket type': 'Support Request',
      'First response time (seconds)': '260',
    },
    {
      'Conversation ID': 'conv-c6',
      'Conversation started at (America/New_York)': '2026-02-10 10:00:00',
      'Started by': 'Customer',
      'Conversation source': 'Inbound message',
      'Current conversation state': 'Closed',
      'Team currently assigned': 'Support',
      'Teammate currently assigned': 'Bea',
      'Last teammate rated': 'Bea',
      'Fin AI Agent involved': 'false',
      'Fin AI Agent deflected': 'false',
      'Fin AI Agent resolution state': '',
      Topics: 'Billing',
      'AI Topic': 'Billing',
      'AI Subtopic': 'Payment confusion',
      Channel: 'Email',
      'Ticket type': 'Support Request',
      'First response time (seconds)': '275',
    },
    {
      'Conversation ID': 'conv-fin-c1',
      'Conversation started at (America/New_York)': '2026-02-12 09:00:00',
      'Started by': 'Customer',
      'Conversation source': 'Inbound message',
      'Current conversation state': 'Closed',
      'Team currently assigned': 'Fin',
      'Teammate currently assigned': 'Fin Bot',
      'Last teammate rated': '',
      'Fin AI Agent involved': 'true',
      'Fin AI Agent deflected': 'false',
      'Fin AI Agent resolution state': 'Escalated',
      Topics: 'Orders',
      'AI Topic': 'Orders',
      'AI Subtopic': 'Escalation',
      Channel: 'Chat',
      'Ticket type': 'Support Request',
      'First response time (seconds)': '80',
    },
    {
      'Conversation ID': 'conv-fin-c2',
      'Conversation started at (America/New_York)': '2026-02-13 09:00:00',
      'Started by': 'Customer',
      'Conversation source': 'Inbound message',
      'Current conversation state': 'Closed',
      'Team currently assigned': 'Fin',
      'Teammate currently assigned': 'Fin Bot',
      'Last teammate rated': '',
      'Fin AI Agent involved': 'true',
      'Fin AI Agent deflected': 'false',
      'Fin AI Agent resolution state': 'Escalated',
      Topics: 'Orders',
      'AI Topic': 'Orders',
      'AI Subtopic': 'Escalation',
      Channel: 'Chat',
      'Ticket type': 'Support Request',
      'First response time (seconds)': '90',
    },
  ],
  satisfactionRows: [],
  finSatisfactionRows: [],
  finDeflectionRows: [],
  finResolutionRows: [],
});

const createLearnWorldsInitiativeFixture = () => ({
  userRows: [
    {
      user_id: 'user-1',
      created_at: '2026-01-05T00:00:00Z',
      last_login_at: null,
      email: 'user-1@example.com',
      role: 'student',
      is_admin: false,
      is_instructor: false,
      is_suspended: false,
    },
    {
      user_id: 'user-2',
      created_at: '2026-01-06T00:00:00Z',
      last_login_at: null,
      email: 'user-2@example.com',
      role: 'student',
      is_admin: false,
      is_instructor: false,
      is_suspended: false,
    },
    {
      user_id: 'user-3',
      created_at: '2026-02-03T00:00:00Z',
      last_login_at: null,
      email: 'user-3@example.com',
      role: 'student',
      is_admin: false,
      is_instructor: false,
      is_suspended: false,
    },
    {
      user_id: 'user-4',
      created_at: '2026-02-04T00:00:00Z',
      last_login_at: null,
      email: 'user-4@example.com',
      role: 'student',
      is_admin: false,
      is_instructor: false,
      is_suspended: false,
    },
    {
      user_id: 'user-5',
      created_at: '2026-02-05T00:00:00Z',
      last_login_at: null,
      email: 'user-5@example.com',
      role: 'student',
      is_admin: false,
      is_instructor: false,
      is_suspended: false,
    },
    {
      user_id: 'user-6',
      created_at: '2026-02-06T00:00:00Z',
      last_login_at: null,
      email: 'user-6@example.com',
      role: 'student',
      is_admin: false,
      is_instructor: false,
      is_suspended: false,
    },
    {
      user_id: 'user-7',
      created_at: '2026-02-07T00:00:00Z',
      last_login_at: null,
      email: 'user-7@example.com',
      role: 'student',
      is_admin: false,
      is_instructor: false,
      is_suspended: false,
    },
  ],
  courseRows: [
    {
      course_id: 'course-1',
      course_name: 'Seller 365 Kickstart',
      course_url: 'https://academy.example.com/course/seller-365-kickstart',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-02-01T00:00:00Z',
      author_name: 'Team Learn',
      categories: ['Onboarding'],
      access: 'paid',
    },
    {
      course_id: 'course-2',
      course_name: 'Billing Mastery',
      course_url: 'https://academy.example.com/course/billing-mastery',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-02-01T00:00:00Z',
      author_name: 'Team Learn',
      categories: ['Operations'],
      access: 'paid',
    },
  ],
  enrollmentRows: [
    {
      enrollment_id: 'enroll-1',
      enrollment_id_is_synthetic: false,
      user_id: 'user-1',
      course_id: 'course-1',
      enrolled_at: '2026-01-05T00:00:00Z',
      expires_at: null,
      user_role: 'student',
    },
    {
      enrollment_id: 'enroll-2',
      enrollment_id_is_synthetic: false,
      user_id: 'user-2',
      course_id: 'course-2',
      enrolled_at: '2026-01-06T00:00:00Z',
      expires_at: null,
      user_role: 'student',
    },
    {
      enrollment_id: 'enroll-3',
      enrollment_id_is_synthetic: false,
      user_id: 'user-3',
      course_id: 'course-1',
      enrolled_at: '2026-02-03T00:00:00Z',
      expires_at: null,
      user_role: 'student',
    },
    {
      enrollment_id: 'enroll-4',
      enrollment_id_is_synthetic: false,
      user_id: 'user-4',
      course_id: 'course-1',
      enrolled_at: '2026-02-05T00:00:00Z',
      expires_at: null,
      user_role: 'student',
    },
    {
      enrollment_id: 'enroll-5',
      enrollment_id_is_synthetic: false,
      user_id: 'user-5',
      course_id: 'course-1',
      enrolled_at: '2026-02-06T00:00:00Z',
      expires_at: null,
      user_role: 'student',
    },
    {
      enrollment_id: 'enroll-6',
      enrollment_id_is_synthetic: false,
      user_id: 'user-6',
      course_id: 'course-2',
      enrolled_at: '2026-02-09T00:00:00Z',
      expires_at: null,
      user_role: 'student',
    },
  ],
  progressRows: [
    {
      user_id: 'user-1',
      course_id: 'course-1',
      progress_status: 'completed',
      progress_percent: 100,
      average_score_percent: 85,
      time_spent_seconds: 5400,
      completed_units: 10,
      total_units: 10,
      completed_at: '2026-01-10T00:00:00Z',
      last_activity_at: '2026-01-10T00:00:00Z',
    },
    {
      user_id: 'user-2',
      course_id: 'course-2',
      progress_status: 'in_progress',
      progress_percent: 65,
      average_score_percent: 78,
      time_spent_seconds: 3200,
      completed_units: 6,
      total_units: 10,
      completed_at: null,
      last_activity_at: '2026-01-12T00:00:00Z',
    },
    {
      user_id: 'user-3',
      course_id: 'course-1',
      progress_status: 'in_progress',
      progress_percent: 50,
      average_score_percent: 70,
      time_spent_seconds: 2200,
      completed_units: 5,
      total_units: 10,
      completed_at: null,
      last_activity_at: '2026-02-12T00:00:00Z',
    },
    {
      user_id: 'user-4',
      course_id: 'course-1',
      progress_status: 'in_progress',
      progress_percent: 40,
      average_score_percent: 68,
      time_spent_seconds: 1800,
      completed_units: 4,
      total_units: 10,
      completed_at: null,
      last_activity_at: null,
    },
    {
      user_id: 'user-5',
      course_id: 'course-1',
      progress_status: 'in_progress',
      progress_percent: 20,
      average_score_percent: 64,
      time_spent_seconds: 900,
      completed_units: 2,
      total_units: 10,
      completed_at: null,
      last_activity_at: null,
    },
    {
      user_id: 'user-6',
      course_id: 'course-2',
      progress_status: 'not_started',
      progress_percent: 0,
      average_score_percent: null,
      time_spent_seconds: 0,
      completed_units: 0,
      total_units: 8,
      completed_at: null,
      last_activity_at: null,
    },
  ],
  activityAnalyticsRows: [
    {
      course_id: 'course-1',
      students: 12,
      learning_units: 10,
      videos: 4,
      total_study_time_seconds: 14400,
      avg_time_to_finish_seconds: 2400,
      avg_score_rate: 78,
      success_rate: 62,
      social_interactions: 3,
      certificates_issued: 1,
      video_time: 6000,
      video_viewing_time: 5800,
      last_activity_at: null,
    },
  ],
});

test('initiative recommendation layer returns explainable cross-source initiatives and stubbed rules', () => {
  const intercomNormalized = normalizeIntercomDatasets(createIntercomInitiativeFixture());
  const learnWorldsNormalized = normalizeLearnWorldsDatasets(createLearnWorldsInitiativeFixture());

  const result = buildInitiativeRecommendations({
    intercomNormalizedData: intercomNormalized,
    learnWorldsNormalizedData: learnWorldsNormalized,
    filters: {
      startDate: '2026-02-01',
      endDate: '2026-02-28',
      team: '',
      teammate: '',
    },
    comparisonGranularity: 'monthly',
  });

  assert.equal(result.initiatives.length, 5);
  assert.equal(result.summary.total_initiatives, 5);
  assert.equal(result.rule_statuses.length, 6);

  const byId = Object.fromEntries(
    result.initiatives.map((initiative) => [initiative.initiative_id.split(':')[0], initiative])
  );

  assert.equal(byId.support_issue_volume_rising.owner_area, 'Cross-functional / Product');
  assert.equal(byId.support_issue_volume_rising.support_state, 'partial');
  assert.match(
    byId.support_issue_volume_rising.suggested_action,
    /Help Center troubleshooting article/i
  );
  assert.equal(byId.billing_confusion_rising.owner_area, 'Help Center');
  assert.match(
    byId.billing_confusion_rising.suggested_action,
    /align teammate and Fin escalation guidance/i
  );
  assert.equal(byId.fin_ai_performance_worsening.support_state, 'full');
  assert.match(
    byId.fin_ai_performance_worsening.suggested_action,
    /tighten escalation guidance/i
  );
  assert.equal(
    byId.registrations_rise_active_users_lag.owner_area,
    'Education / Threecolts University'
  );
  assert.match(
    byId.registrations_rise_active_users_lag.suggested_action,
    /quick-start onboarding asset/i
  );
  assert.equal(byId.course_dropout_watch.suggested_format, 'course_refresh');
  assert.match(
    byId.course_dropout_watch.suggested_action,
    /short recap class/i
  );

  assert.match(
    byId.fin_ai_performance_worsening.why_this_surfaced,
    /Fin AI deflection moved from/
  );
  assert.equal(
    result.rule_statuses.find((rule) => rule.rule_id === 'support_quality_generic_response')
      .support_state,
    'stubbed'
  );
});

test('initiative model keeps placeholder coverage states explicit', () => {
  const intercomNormalized = normalizeIntercomDatasets(createIntercomInitiativeFixture());
  const learnWorldsNormalized = normalizeLearnWorldsDatasets(createLearnWorldsInitiativeFixture());

  const result = buildInitiativeRecommendations({
    intercomNormalizedData: intercomNormalized,
    learnWorldsNormalizedData: learnWorldsNormalized,
    filters: {
      startDate: '2026-02-01',
      endDate: '2026-02-28',
      team: '',
      teammate: '',
    },
  });

  const billingInitiative = result.initiatives.find((initiative) =>
    initiative.initiative_id.startsWith('billing_confusion_rising:')
  );

  assert.equal(billingInitiative.existing_coverage.audit_state, 'unknown');
  assert.equal(billingInitiative.existing_coverage.intercom_help_center.state, 'unknown');
  assert.equal(billingInitiative.existing_coverage.learnworlds_class.state, 'not_applicable');
});
