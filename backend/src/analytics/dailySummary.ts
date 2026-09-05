import { fetchAbuseDetection } from './abuseDetection.js';
import { fetchGrowthAnalytics } from './growth.js';
import { fetchProductUsageAnalytics } from './productUsage.js';
import { fetchSystemHealth } from './systemHealth.js';

type AvailabilityStatus = 'ready' | 'data-access-pending' | 'missing-config' | 'error' | 'unavailable';
type Highlight = Record<string, unknown>;

const usageMetricLabels: Record<string, string> = {
  jobs: 'Jobs', applications: 'Applications', resumeImports: 'Resume Imports', campaigns: 'Campaigns',
  aiAgents: 'AI Agents', interviews: 'Interviews', calls: 'Calls',
};

const growthMetricLabels: Record<string, string> = {
  users: 'New Users', companies: 'New Companies', jobs: 'Jobs', applications: 'Applications',
  resumeImports: 'Resume Imports', aiAgents: 'AI Agents', interviews: 'Interviews', calls: 'Calls',
};

const percentage = (current: number, previous: number): number | null => previous === 0 ? null : ((current - previous) / previous) * 100;

const statusIssues = (name: string, status: AvailabilityStatus, detail: string): Highlight[] => (
  status === 'ready' ? [] : [{ source: name, status, detail }]
);

const summaryStatus = (statuses: AvailabilityStatus[]): AvailabilityStatus => {
  if (statuses.includes('missing-config')) return 'missing-config';
  if (statuses.includes('error')) return 'error';
  if (statuses.includes('data-access-pending')) return 'data-access-pending';
  if (statuses.includes('unavailable')) return 'unavailable';
  return 'ready';
};

export const composeDailySummary = (health: any, abuse: any, usage: any, growth: any, generatedAt = new Date().toISOString()) => {
  const healthHighlights: Highlight[] = [];
  for (const [workflowName, workflow] of Object.entries(health.workflows ?? {})) {
    for (const signal of Object.values(workflow as Record<string, any>)) {
      if (['critical', 'warning', 'data-access-pending', 'unavailable'].includes(signal.state)) {
        healthHighlights.push({ workflow: workflowName, title: signal.title, status: signal.state, reason: signal.reason, details: signal.details });
      }
    }
  }
  for (const signal of Object.values(health.signals ?? {}) as any[]) {
    if (['critical', 'warning', 'data-access-pending', 'unavailable'].includes(signal.state)) {
      healthHighlights.push({ title: signal.title, status: signal.state, reason: signal.reason, details: signal.details });
    }
  }

  const abuseHighlights = (abuse.alerts ?? []).map((alert: any) => ({
    severity: alert.severity, signalType: alert.signalType, companyId: alert.companyId,
    observedActivity: alert.observedActivity, evidence: alert.reason, recommendedAdminReviewAction: alert.recommendedAdminReviewAction,
  }));

  const usageHighlights: Highlight[] = [];
  for (const [key, metric] of Object.entries(usage.metrics ?? {}) as Array<[string, any]>) {
    if (metric.status !== 'available' || !metric.byWindow) continue;
    const current = metric.byWindow.today;
    const previous = metric.byWindow.yesterday;
    if (current === previous) continue;
    usageHighlights.push({ metric: usageMetricLabels[key] ?? key, currentPeriod: current, comparisonPeriod: previous, change: current - previous, percentageChange: percentage(current, previous), comparison: 'Today vs yesterday' });
  }

  const growthHighlights: Highlight[] = [];
  for (const [key, metric] of Object.entries(growth.metrics ?? {}) as Array<[string, any]>) {
    if (metric.status !== 'available' || metric.monthOverMonthGrowthPercent === null || metric.monthOverMonthGrowthPercent === 0) continue;
    growthHighlights.push({ metric: growthMetricLabels[key] ?? key, currentMonth: metric.currentMonth, previousMonth: metric.previousMonth, change: metric.currentMonth - metric.previousMonth, percentageChange: metric.monthOverMonthGrowthPercent, comparison: 'Current month vs previous month' });
  }

  const dataAccessIssues = [
    ...statusIssues('system-health', health.status, 'Health reporting is incomplete or unavailable.'),
    ...statusIssues('abuse', abuse.status, 'Review signals are unavailable.'),
    ...statusIssues('product-usage', usage.status, 'Usage comparisons are incomplete or unavailable.'),
    ...statusIssues('growth', growth.status, 'Growth comparisons are incomplete or unavailable.'),
  ];
  for (const [key, metric] of Object.entries(usage.metrics ?? {}) as Array<[string, any]>) {
    if (metric.status !== 'available') dataAccessIssues.push({ source: `product-usage.${key}`, status: metric.status, detail: metric.reason ?? 'Metric unavailable through the current read-only path.' });
  }

  const statuses = [health.status, abuse.status, usage.status, growth.status] as AvailabilityStatus[];
  const status = summaryStatus(statuses);
  const totalSignals = abuseHighlights.length;
  const highSeveritySignals = abuseHighlights.filter((alert: Highlight) => alert.severity === 'high').length;
  const headline = status === 'ready'
    ? totalSignals > 0 ? `${totalSignals} review signal${totalSignals === 1 ? '' : 's'} require admin attention.` : 'Daily admin summary is ready with no supported abuse/review signals detected.'
    : `Daily admin summary is ${status}; availability issues are listed below.`;

  return {
    status,
    generatedAt,
    health: { status: health.status, highlights: healthHighlights },
    abuse: { status: abuse.status, totalSignals, highSeveritySignals, highlights: abuseHighlights },
    usageChanges: { status: usage.status, highlights: usageHighlights },
    growthHighlights: { status: growth.status, highlights: growthHighlights },
    dataAccess: { issues: dataAccessIssues },
    summary: { headline, highlights: [...healthHighlights, ...abuseHighlights, ...usageHighlights, ...growthHighlights] },
  };
};

export const fetchDailySummary = async () => {
  const [health, abuse, usage, growth] = await Promise.all([
    fetchSystemHealth(), fetchAbuseDetection(), fetchProductUsageAnalytics(), fetchGrowthAnalytics(),
  ]);
  return composeDailySummary(health, abuse, usage, growth);
};