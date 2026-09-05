import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { getSupportedTimeWindows, getTimeWindowRange, metricCatalog } from './metrics/index.js';

process.env.NODE_ENV = 'test';
process.env.ADMIN_API_KEY = 'internal-admin-token';
process.env.ADMIN_DEV_TOKEN = 'local-dev-admin-token';

const { default: app } = await import('./index.js');
const { buildGrowthMetric, calculateMonthOverMonthGrowth } = await import('./analytics/growth.js');
const { composeDailySummary } = await import('./analytics/dailySummary.js');

const authHeader = 'Bearer internal-admin-token';

test('unauthenticated request rejected', async () => {
  const response = await request(app).get('/api/admin/overview');
  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'Unauthorized');
});

test('unauthorized request rejected', async () => {
  const response = await request(app)
    .get('/api/admin/overview')
    .set('Authorization', 'Bearer not-valid');

  assert.equal(response.status, 401);
  assert.equal(response.body.message, 'A valid server-side admin session is required.');
});

test('authorized admin request accepted', async () => {
  const response = await request(app)
    .get('/api/admin/overview')
    .set('Authorization', authHeader);

  assert.equal(response.status, 200);
  assert.ok(response.body.status === 'ready' || response.body.status === 'missing-config' || response.body.status === 'error');
});

test('local development cookie auth works', async () => {
  const response = await request(app)
    .get('/api/admin/overview')
    .set('Cookie', 'suprhire_admin_session=local-dev-admin-token');

  assert.equal(response.status, 200);
  assert.ok(typeof response.body.users?.totalUsers === 'number' || response.body.status === 'missing-config' || response.body.status === 'error');
});

test('health endpoint behavior', async () => {
  const response = await request(app)
    .get('/api/admin/health')
    .set('Authorization', authHeader);

  assert.equal(response.status, 200);
  assert.equal(response.body.service, 'suprhire-admin-backend');
  assert.equal(response.body.adminProtected, true);
  assert.equal(response.body.requiresAdminAuth, true);
});

test('overview endpoint behavior', async () => {
  const response = await request(app)
    .get('/api/admin/overview')
    .set('Authorization', authHeader);

  assert.equal(response.status, 200);
  assert.ok(typeof response.body.users?.totalUsers === 'number' || response.body.status === 'missing-config' || response.body.status === 'error');
  assert.ok(typeof response.body.jobs?.total === 'number' || response.body.status === 'missing-config' || response.body.status === 'error');
});

test('Supabase remains read-only by design', async () => {
  const response = await request(app)
    .get('/api/admin/health')
    .set('Authorization', authHeader);

  assert.equal(response.status, 200);
  assert.equal(response.body.supabaseMode, 'read-only');
  assert.equal(typeof response.body.readOnlySupabase, 'boolean');
});

test('time window helpers expose the required windows', () => {
  const windows = getSupportedTimeWindows();
  assert.deepEqual(
    windows.map((window) => window.id),
    ['today', 'yesterday', 'last_7_days', 'last_30_days', 'since_inception'],
  );

  const last30 = getTimeWindowRange('last_30_days', new Date('2026-09-02T12:00:00Z'));
  assert.ok(last30.start instanceof Date);
  assert.ok(last30.end instanceof Date);
  assert.equal(last30.label, 'Last 30 days');
});

test('canonical user and product metrics are defined', () => {
  const names = metricCatalog.map((metric) => metric.metric);

  assert.ok(names.includes('Total Users'));
  assert.ok(names.includes('Recently Updated Profiles'));
  assert.ok(names.includes('Total Companies'));
  assert.ok(names.includes('Jobs'));
  assert.ok(names.includes('Applications'));
  assert.ok(names.includes('Resume Imports'));
  assert.ok(names.includes('AI Agents'));
  assert.ok(names.includes('Interviews'));
  assert.ok(names.includes('Calls'));
});

test('user and company analytics endpoint exposes verified metrics', async () => {
  const response = await request(app)
    .get('/api/admin/analytics/user-company')
    .set('Authorization', authHeader);

  assert.equal(response.status, 200);
  assert.ok(response.body.userAnalytics);
  assert.ok(response.body.companyAnalytics);
  assert.ok(Array.isArray(response.body.userAnalytics.byCompany));
  assert.ok(Array.isArray(response.body.userAnalytics.byRole));
  assert.ok(Array.isArray(response.body.userAnalytics.growthTrend));
  assert.ok(Array.isArray(response.body.companyAnalytics.byCompany));
  assert.ok(Array.isArray(response.body.companyAnalytics.growthTrend));
});

test('product usage analytics endpoint exposes structured metric states', async () => {
  const response = await request(app)
    .get('/api/admin/analytics/product-usage')
    .set('Authorization', authHeader);

  assert.equal(response.status, 200);
  assert.ok(['ready', 'data-access-pending', 'missing-config', 'error'].includes(response.body.status));
  for (const metric of ['jobs', 'applications', 'resumeImports', 'campaigns', 'aiAgents', 'interviews', 'calls']) {
    assert.ok(response.body.metrics[metric]);
    assert.ok(['available', 'no_data', 'unavailable'].includes(response.body.metrics[metric].status));
  }
});

test('system health endpoint exposes explicit readiness states', async () => {
  const response = await request(app)
    .get('/api/admin/analytics/system-health')
    .set('Authorization', authHeader);

  assert.equal(response.status, 200);
  assert.ok(['healthy', 'warning', 'critical', 'unavailable', 'data-access-pending'].includes(response.body.status));
  assert.ok(response.body.summary);
  assert.ok(response.body.workflows);
  assert.ok(response.body.signals);
  assert.ok(response.body.workflows.resumeImports);
  assert.ok(response.body.workflows.calls);
});

test('abuse detection endpoint exposes review-only structured signals', async () => {
  const response = await request(app)
    .get('/api/admin/analytics/abuse-detection')
    .set('Authorization', authHeader);

  assert.equal(response.status, 200);
  assert.ok(['ready', 'data-access-pending', 'missing-config', 'error'].includes(response.body.status));
  assert.ok(Array.isArray(response.body.alerts));
  assert.ok(response.body.notes.thresholds);
  for (const alert of response.body.alerts) {
    assert.ok(['info', 'warning', 'high'].includes(alert.severity));
    assert.ok(['high-volume-activity', 'burst-activity', 'loophole-signal'].includes(alert.signalType));
    assert.match(alert.reason, /requiring admin review/);
    assert.ok(alert.observedActivity);
  }
});

test('growth endpoint is protected', async () => {
  const response = await request(app).get('/api/admin/analytics/growth');
  assert.equal(response.status, 401);
});

test('growth endpoint exposes all supported metric structures', async () => {
  const response = await request(app).get('/api/admin/analytics/growth').set('Authorization', authHeader);
  assert.equal(response.status, 200);
  assert.ok(['ready', 'data-access-pending', 'missing-config', 'error'].includes(response.body.status));
  for (const key of ['users', 'companies', 'jobs', 'applications', 'resumeImports', 'aiAgents', 'interviews', 'calls']) {
    const metric = response.body.metrics[key];
    assert.ok(metric);
    if (response.body.status === 'ready') {
      assert.equal(metric.status, 'available');
      assert.equal(metric.monthly.length, 12);
      assert.match(metric.monthly[0].period, /^\d{4}-\d{2}$/);
      assert.equal(typeof metric.currentMonth, 'number');
      assert.equal(typeof metric.previousMonth, 'number');
    }
  }
});

test('growth MoM calculation handles normal and zero baselines', () => {
  assert.equal(calculateMonthOverMonthGrowth(15, 10), 50);
  assert.equal(calculateMonthOverMonthGrowth(5, 0), null);
  const metric = buildGrowthMetric(
    [{ date: new Date('2026-08-05T00:00:00Z') }, { date: new Date('2026-09-05T00:00:00Z') }],
    new Date('2026-09-10T00:00:00Z'),
  );
  assert.equal(metric.currentMonth, 1);
  assert.equal(metric.previousMonth, 1);
  assert.equal(metric.monthOverMonthGrowthPercent, 0);
});

test('growth metrics remain unavailable when Supabase configuration is missing', async () => {
  const response = await request(app).get('/api/admin/analytics/growth').set('Authorization', authHeader);
  assert.ok(['ready', 'data-access-pending', 'missing-config', 'error'].includes(response.body.status));
  if (response.body.status === 'missing-config') {
    assert.equal(response.body.metrics.users.status, 'unavailable');
    assert.deepEqual(response.body.metrics.users.monthly, []);
  }
});

test('growth response never reports fabricated metrics during pending access', async () => {
  const response = await request(app).get('/api/admin/analytics/growth').set('Authorization', authHeader);
  if (response.body.status === 'data-access-pending') {
    assert.equal(response.body.metrics.users.total, 0);
    assert.deepEqual(response.body.metrics.users.monthly, []);
    assert.equal(response.body.metrics.users.monthOverMonthGrowthPercent, null);
  }
});

const summaryFixture = (overrides: Record<string, unknown> = {}) => ({
  health: { status: 'healthy', workflows: {}, signals: {} },
  abuse: { status: 'ready', alerts: [] },
  usage: { status: 'ready', metrics: { jobs: { status: 'available', byWindow: { today: 4, yesterday: 0 } } } },
  growth: { status: 'ready', metrics: { users: { status: 'available', currentMonth: 2, previousMonth: 0, monthOverMonthGrowthPercent: null } } },
  ...overrides,
});

test('daily summary exposes all sections and handles no abuse signals', () => {
  const fixture = summaryFixture();
  const summary = composeDailySummary(fixture.health, fixture.abuse, fixture.usage, fixture.growth, '2026-09-04T12:00:00.000Z');
  assert.equal(summary.status, 'ready');
  assert.equal(summary.abuse.totalSignals, 0);
  assert.deepEqual(summary.abuse.highlights, []);
  assert.ok(summary.health && summary.usageChanges && summary.growthHighlights && summary.dataAccess && summary.summary);
  assert.equal(summary.usageChanges.highlights[0].percentageChange, null);
  assert.equal(summary.growthHighlights.highlights.length, 0);
});

test('daily summary endpoint requires admin authentication and returns all sections when authorized', async () => {
  const unauthorized = await request(app).get('/api/admin/analytics/daily-summary');
  assert.equal(unauthorized.status, 401);
  const authorized = await request(app).get('/api/admin/analytics/daily-summary').set('Authorization', authHeader);
  assert.equal(authorized.status, 200);
  for (const key of ['health', 'abuse', 'usageChanges', 'growthHighlights', 'dataAccess', 'summary']) assert.ok(authorized.body[key]);
});

test('daily summary propagates pending access without fabricating zero activity', () => {
  const fixture = summaryFixture({ usage: { status: 'data-access-pending', metrics: {} }, growth: { status: 'data-access-pending', metrics: {} } });
  const summary = composeDailySummary(fixture.health, fixture.abuse, fixture.usage, fixture.growth, '2026-09-04T12:00:00.000Z');
  assert.equal(summary.status, 'data-access-pending');
  assert.ok(summary.dataAccess.issues.length >= 2);
  assert.equal(summary.usageChanges.highlights.length, 0);
  assert.equal(summary.growthHighlights.highlights.length, 0);
});

test('daily summary reports high severity review evidence', () => {
  const fixture = summaryFixture({ abuse: { status: 'ready', alerts: [{ severity: 'high', signalType: 'burst-activity', companyId: 'company-1', observedActivity: { count: 20 }, reason: 'Evidence', recommendedAdminReviewAction: 'Review' }] } });
  const summary = composeDailySummary(fixture.health, fixture.abuse, fixture.usage, fixture.growth, '2026-09-04T12:00:00.000Z');
  assert.equal(summary.abuse.totalSignals, 1);
  assert.equal(summary.abuse.highSeveritySignals, 1);
  assert.equal(summary.abuse.highlights[0].companyId, 'company-1');
});

test('daily summary module contains no production write operations', async () => {
  const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('./analytics/dailySummary.ts', import.meta.url), 'utf8'));
  assert.doesNotMatch(source, /\.(insert|update|delete|upsert)\s*\(/);
});

test('unsupported metrics are explicitly marked unavailable', () => {
  const unavailable = metricCatalog.filter((metric) => !metric.available);

  assert.ok(unavailable.length >= 1);
  assert.ok(unavailable.some((metric) => metric.metric === 'Users by Role'));
  assert.ok(unavailable.some((metric) => metric.metric === 'Users by Company'));
  assert.ok(unavailable.some((metric) => metric.metric === 'Companies by Subscription/Tier'));
});
