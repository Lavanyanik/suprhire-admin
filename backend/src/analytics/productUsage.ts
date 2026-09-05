import { supabase } from '../lib/supabase.js';
import { getTimeWindowRange } from '../metrics/index.js';
import type { MetricGroup, TimeWindowId } from '../metrics/types.js';

type UsageStatus = 'available' | 'no_data' | 'unavailable';
type UsageTrend = { period: string; count: number };
type CompanyUsage = { companyId: string; companyName: string; count: number };
type UsageMetric = {
  status: UsageStatus;
  reason?: string;
  total?: number;
  byWindow?: MetricGroup;
  trend?: UsageTrend[];
  byCompany?: CompanyUsage[];
  byAgent?: CompanyUsage[];
};

type Row = Record<string, unknown>;

const unavailable = (reason: string): UsageMetric => ({ status: 'unavailable', reason });

const getRows = async (table: string, columns: string): Promise<{ rows: Row[]; error?: string }> => {
  if (!supabase) {
    return { rows: [], error: 'Supabase read-only configuration is missing.' };
  }

  const { data, error } = await supabase.from(table).select(columns);
  if (error) {
    return { rows: [], error: error.message || `The ${table} table could not be queried.` };
  }

  return { rows: (data ?? []) as unknown as Row[] };
};

const getDate = (row: Row, column: string): Date | null => {
  const value = row[column];
  if (typeof value !== 'string' && !(value instanceof Date)) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const inWindow = (date: Date | null, windowId: TimeWindowId): boolean => {
  if (!date) {
    return false;
  }
  const window = getTimeWindowRange(windowId);
  return date >= (window.start ?? new Date(0)) && date <= window.end;
};

const buildWindows = (rows: Row[], dateColumn: string): MetricGroup => ({
  total: rows.length,
  today: rows.filter((row) => inWindow(getDate(row, dateColumn), 'today')).length,
  yesterday: rows.filter((row) => inWindow(getDate(row, dateColumn), 'yesterday')).length,
  last7Days: rows.filter((row) => inWindow(getDate(row, dateColumn), 'last_7_days')).length,
  last30Days: rows.filter((row) => inWindow(getDate(row, dateColumn), 'last_30_days')).length,
  sinceInception: rows.filter((row) => inWindow(getDate(row, dateColumn), 'since_inception')).length,
});

const buildTrend = (rows: Row[], dateColumn: string): UsageTrend[] => {
  const current = new Date();
  const months = Array.from({ length: 12 }, (_, index) => {
    const start = new Date(current.getFullYear(), current.getMonth() - (11 - index), 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const period = start.toISOString().slice(0, 7);
    return { period, start, end };
  });

  return months.map(({ period, start, end }) => ({
    period,
    count: rows.filter((row) => {
      const date = getDate(row, dateColumn);
      return date !== null && date >= start && date < end;
    }).length,
  }));
};

const metricFromRows = (rows: Row[], dateColumn: string): UsageMetric => ({
  status: rows.length === 0 ? 'unavailable' : 'available',
  ...(rows.length === 0
    ? { reason: 'No rows were returned. This may be an empty table or an RLS-restricted read; the admin cannot safely report zero.' }
    : { total: rows.length, byWindow: buildWindows(rows, dateColumn), trend: buildTrend(rows, dateColumn) }),
});

const countBy = (rows: Row[], key: string): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = row[key];
    if (typeof value === 'string' && value) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return counts;
};

const companyBreakdown = (rows: Row[], key: string, companies: Row[]): CompanyUsage[] => {
  const names = new Map(companies.map((company) => [String(company.id), String(company.name ?? 'Unknown company')]));
  return [...countBy(rows, key).entries()]
    .map(([companyId, count]) => ({ companyId, companyName: names.get(companyId) ?? 'Unknown company', count }))
    .sort((a, b) => b.count - a.count);
};

const addBreakdown = (metric: UsageMetric, rows: Row[], key: string, companies: Row[]): UsageMetric => ({
  ...metric,
  ...(metric.status === 'available' ? { byCompany: companyBreakdown(rows, key, companies) } : {}),
});

const addAgentBreakdown = (metric: UsageMetric, rows: Row[]): UsageMetric => ({
  ...metric,
  ...(metric.status === 'available' ? { byAgent: companyBreakdown(rows, 'agent_id', rows.map((row) => ({ id: row.agent_id, name: row.agent_id }))) } : {}),
});

export const fetchProductUsageAnalytics = async () => {
  if (!supabase) {
    const reason = 'Supabase read-only configuration is missing.';
    return { status: 'missing-config', metrics: Object.fromEntries(['jobs', 'applications', 'resumeImports', 'campaigns', 'aiAgents', 'interviews', 'calls'].map((key) => [key, unavailable(reason)])) };
  }

  const results = await Promise.all([
    getRows('companies', 'id, name'),
    getRows('jobs', 'id, posted_date, company_id'),
    getRows('applications', 'id, created_at, job_id'),
    getRows('resume_imports', 'id, created_at, company_id'),
    getRows('campaigns', 'id, created_at, company_id, agent_id'),
    getRows('ai_agents', 'id, created_at, company_id'),
    getRows('interviews', 'id, created_at, job_id'),
    getRows('screening_calls', 'id, created_at, interview_id'),
  ]);

  const [companies, jobs, applications, resumeImports, campaigns, aiAgents, interviews, calls] = results;
  const companyRows = companies.rows;
  const byJobId = new Map(jobs.rows.map((row) => [String(row.id), row]));
  const byInterviewId = new Map(interviews.rows.map((row) => [String(row.id), row]));

  const jobsMetric = jobs.error ? unavailable(jobs.error) : addBreakdown(metricFromRows(jobs.rows, 'posted_date'), jobs.rows, 'company_id', companyRows);
  const applicationsMetric = applications.error
    ? unavailable(applications.error)
    : addBreakdown(metricFromRows(applications.rows, 'created_at'), applications.rows.map((row) => ({ ...row, company_id: byJobId.get(String(row.job_id))?.company_id })), 'company_id', companyRows);
  const resumeImportsMetric = resumeImports.error ? unavailable(resumeImports.error) : addBreakdown(metricFromRows(resumeImports.rows, 'created_at'), resumeImports.rows, 'company_id', companyRows);
  const campaignsMetric = campaigns.error ? unavailable(campaigns.error) : addAgentBreakdown(addBreakdown(metricFromRows(campaigns.rows, 'created_at'), campaigns.rows, 'company_id', companyRows), campaigns.rows);
  const aiAgentsMetric = aiAgents.error ? unavailable(aiAgents.error) : addBreakdown(metricFromRows(aiAgents.rows, 'created_at'), aiAgents.rows, 'company_id', companyRows);
  const interviewsWithCompany = interviews.rows.map((row) => ({ ...row, company_id: byJobId.get(String(row.job_id))?.company_id }));
  const interviewsMetric = interviews.error ? unavailable(interviews.error) : addBreakdown(metricFromRows(interviews.rows, 'created_at'), interviewsWithCompany, 'company_id', companyRows);
  const callsWithCompany = calls.rows.map((row) => ({ ...row, company_id: byJobId.get(String(byInterviewId.get(String(row.interview_id))?.job_id))?.company_id }));
  const callsMetric = calls.error ? unavailable(calls.error) : addBreakdown(metricFromRows(calls.rows, 'created_at'), callsWithCompany, 'company_id', companyRows);

  const metrics = { jobs: jobsMetric, applications: applicationsMetric, resumeImports: resumeImportsMetric, campaigns: campaignsMetric, aiAgents: aiAgentsMetric, interviews: interviewsMetric, calls: callsMetric };
  const hasPendingAccess = Object.values(metrics).some((metric) => metric.status === 'unavailable');
  return {
    status: hasPendingAccess ? 'data-access-pending' : 'ready',
    metrics,
    notes: {
      jobsDateField: 'posted_date',
      applicationsCompanyAttribution: 'Derived through applications.job_id -> jobs.company_id.',
      interviewsCompanyAttribution: 'Derived through interviews.job_id -> jobs.company_id.',
      callsCompanyAttribution: 'Derived through screening_calls.interview_id -> interviews.job_id -> jobs.company_id.',
      campaignAgentAttribution: 'The campaigns.agent_id field is queried only when present in the existing schema.',
    },
  };
};
