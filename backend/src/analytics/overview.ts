import { supabase } from '../lib/supabase.js';
import { metricCatalog, getTimeWindowRange, getSupportedTimeWindows } from '../metrics/index.js';
import type { OverviewAnalytics, MetricValue, TimeWindowId } from '../metrics/types.js';

const getCount = async (table: string, filters: Array<{ column: string; value: unknown; op?: 'eq' | 'gte' | 'lt' }> = []) => {
  if (!supabase) {
    return 0;
  }

  let query = supabase.from(table).select('id', { count: 'exact', head: true });

  for (const filter of filters) {
    const op = filter.op ?? 'eq';
    if (op === 'eq') query = query.eq(filter.column, filter.value);
    if (op === 'gte') query = query.gte(filter.column, filter.value as string | number | boolean | Date);
    if (op === 'lt') query = query.lt(filter.column, filter.value as string | number | boolean | Date);
  }

  const { count, error } = await query;
  if (error) {
    console.error(`Read-only count failed for ${table}:`, error);
    return 0;
  }

  return count ?? 0;
};

const getCountInWindow = async (table: string, column: string, windowId: TimeWindowId) => {
  if (!supabase) {
    return 0;
  }

  const window = getTimeWindowRange(windowId);
  if (window.start === null) {
    return getCount(table);
  }

  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .gte(column, window.start.toISOString())
    .lte(column, window.end.toISOString());

  if (error) {
    console.error(`Read-only window count failed for ${table}.${column} (${windowId}):`, error);
    return 0;
  }

  return count ?? 0;
};

const getMetricGroup = async (table: string, column: string): Promise<{ total: MetricValue; today: MetricValue; yesterday: MetricValue; last7Days: MetricValue; last30Days: MetricValue; sinceInception: MetricValue; }> => {
  const [total, today, yesterday, last7Days, last30Days, sinceInception] = await Promise.all([
    getCount(table),
    getCountInWindow(table, column, 'today'),
    getCountInWindow(table, column, 'yesterday'),
    getCountInWindow(table, column, 'last_7_days'),
    getCountInWindow(table, column, 'last_30_days'),
    getCountInWindow(table, column, 'since_inception'),
  ]);

  return {
    total,
    today,
    yesterday,
    last7Days,
    last30Days,
    sinceInception,
  };
};

const metricDefinition = (name: string) => metricCatalog.find((metric) => metric.metric === name);

export const fetchOverviewMetrics = async (): Promise<OverviewAnalytics> => {
  if (!supabase) {
    return {
      users: {
        totalUsers: 0,
        newUsers: { total: 0, today: 0, yesterday: 0, last7Days: 0, last30Days: 0, sinceInception: 0 },
        lastLogin: 'unavailable',
        neverLoggedIn: { available: false, reason: 'No reliable auth login history currently available in the inspected schema.' },
        recentlyUpdatedProfiles: { total: 0, today: 0, yesterday: 0, last7Days: 0, last30Days: 0, sinceInception: 0 },
        usersByRole: { available: false, reason: 'Role breakdown was not confirmed in the inspected schema.' },
        usersByCompany: { available: false, reason: 'A reliable user-to-company aggregate is not confirmed in the inspected schema.' },
      },
      companies: {
        totalCompanies: 0,
        usersPerCompany: { available: false, reason: 'A verified aggregate of users-per-company is not available yet.' },
        companiesBySubscriptionTier: { available: false, reason: 'No confirmed subscription tier column was found in the inspected schema.' },
      },
      jobs: { total: 0, today: 0, yesterday: 0, last7Days: 0, last30Days: 0, sinceInception: 0 },
      applications: { total: 0, today: 0, yesterday: 0, last7Days: 0, last30Days: 0, sinceInception: 0 },
      imports: {
        totalImportBatches: { total: 0, today: 0, yesterday: 0, last7Days: 0, last30Days: 0, sinceInception: 0 },
        resumeImports: { total: 0, today: 0, yesterday: 0, last7Days: 0, last30Days: 0, sinceInception: 0 },
      },
      agents: { total: 0, today: 0, yesterday: 0, last7Days: 0, last30Days: 0, sinceInception: 0 },
      interviews: { total: 0, today: 0, yesterday: 0, last7Days: 0, last30Days: 0, sinceInception: 0 },
      calls: { total: 0, today: 0, yesterday: 0, last7Days: 0, last30Days: 0, sinceInception: 0 },
      systemHealth: {
        resumeProcessing: { available: false, reason: 'No persisted success/failure history was found for resume processing.' },
        resumeImports: { available: false, reason: 'No persisted success/failure history was found for resume imports.' },
        aiAgents: { available: false, reason: 'No persisted operational outcome history was found for AI agents.' },
        candidateImports: { available: false, reason: 'No persisted import outcome history was found for candidate imports.' },
        applications: { available: false, reason: 'No persisted application outcome history was found for applications.' },
        interviews: { available: false, reason: 'No persisted interview outcome history was found for interviews.' },
        calls: { available: false, reason: 'No persisted call outcome history was found for calls.' },
      },
      status: 'missing-config',
    };
  }

  try {
    const [userTotal, newUsers, recentlyUpdatedProfiles, totalCompanies, jobs, applications, resumeImports, aiAgents, interviews, calls] = await Promise.all([
      getCount('profiles'),
      getMetricGroup('profiles', 'created_at'),
      getMetricGroup('profiles', 'updated_at'),
      getCount('companies'),
      getMetricGroup('jobs', 'created_at'),
      getMetricGroup('applications', 'created_at'),
      getMetricGroup('resume_imports', 'created_at'),
      getMetricGroup('ai_agents', 'created_at'),
      getMetricGroup('interviews', 'created_at'),
      getMetricGroup('screening_calls', 'created_at'),
    ]);

    const overview: OverviewAnalytics = {
      users: {
        totalUsers: userTotal,
        newUsers,
        lastLogin: 'unavailable',
        neverLoggedIn: { available: false, reason: 'No reliable auth login history table is currently available in the inspected schema.' },
        recentlyUpdatedProfiles,
        usersByRole: { available: false, reason: 'Role breakdown was not confirmed in the inspected schema.' },
        usersByCompany: { available: false, reason: 'A reliable user-to-company aggregate is not confirmed in the inspected schema.' },
      },
      companies: {
        totalCompanies,
        usersPerCompany: { available: false, reason: 'Users-per-company aggregate is not yet supported without a verified org-membership model.' },
        companiesBySubscriptionTier: { available: false, reason: 'No confirmed subscription tier column exists in the inspected schema.' },
      },
      jobs,
      applications,
      imports: {
        totalImportBatches: { total: 0, today: 0, yesterday: 0, last7Days: 0, last30Days: 0, sinceInception: 0 },
        resumeImports,
      },
      agents: aiAgents,
      interviews,
      calls,
      systemHealth: {
        resumeProcessing: { available: false, reason: 'No persisted success/failure history was found for resume processing.' },
        resumeImports: { available: false, reason: 'No persisted success/failure history was found for resume imports.' },
        aiAgents: { available: false, reason: 'No persisted operational outcome history was found for AI agents.' },
        candidateImports: { available: false, reason: 'No persisted import outcome history was found for candidate imports.' },
        applications: { available: false, reason: 'No persisted application outcome history was found for applications.' },
        interviews: { available: false, reason: 'No persisted interview outcome history was found for interviews.' },
        calls: { available: false, reason: 'No persisted call outcome history was found for calls.' },
      },
      status: 'ready',
    };

    if (metricDefinition('Total Users')?.available === true) {
      overview.users.totalUsers = userTotal;
    }

    return overview;
  } catch (error) {
    console.error('Failure while loading canonical analytics overview:', error);
    return {
      users: {
        totalUsers: 0,
        newUsers: { total: 0, today: 0, yesterday: 0, last7Days: 0, last30Days: 0, sinceInception: 0 },
        lastLogin: 'unavailable',
        neverLoggedIn: { available: false, reason: 'Unable to assess login history due to an analytics error.' },
        recentlyUpdatedProfiles: { total: 0, today: 0, yesterday: 0, last7Days: 0, last30Days: 0, sinceInception: 0 },
        usersByRole: { available: false, reason: 'Unable to assess role breakdown due to an analytics error.' },
        usersByCompany: { available: false, reason: 'Unable to assess company distribution due to an analytics error.' },
      },
      companies: {
        totalCompanies: 0,
        usersPerCompany: { available: false, reason: 'Unable to assess users-per-company due to an analytics error.' },
        companiesBySubscriptionTier: { available: false, reason: 'Unable to assess subscription tier distribution due to an analytics error.' },
      },
      jobs: { total: 0, today: 0, yesterday: 0, last7Days: 0, last30Days: 0, sinceInception: 0 },
      applications: { total: 0, today: 0, yesterday: 0, last7Days: 0, last30Days: 0, sinceInception: 0 },
      imports: {
        totalImportBatches: { total: 0, today: 0, yesterday: 0, last7Days: 0, last30Days: 0, sinceInception: 0 },
        resumeImports: { total: 0, today: 0, yesterday: 0, last7Days: 0, last30Days: 0, sinceInception: 0 },
      },
      agents: { total: 0, today: 0, yesterday: 0, last7Days: 0, last30Days: 0, sinceInception: 0 },
      interviews: { total: 0, today: 0, yesterday: 0, last7Days: 0, last30Days: 0, sinceInception: 0 },
      calls: { total: 0, today: 0, yesterday: 0, last7Days: 0, last30Days: 0, sinceInception: 0 },
      systemHealth: {
        resumeProcessing: { available: false, reason: 'Analytics failed while checking system health.' },
        resumeImports: { available: false, reason: 'Analytics failed while checking resume import health.' },
        aiAgents: { available: false, reason: 'Analytics failed while checking AI agent health.' },
        candidateImports: { available: false, reason: 'Analytics failed while checking candidate import health.' },
        applications: { available: false, reason: 'Analytics failed while checking application health.' },
        interviews: { available: false, reason: 'Analytics failed while checking interview health.' },
        calls: { available: false, reason: 'Analytics failed while checking call health.' },
      },
      status: 'error',
    };
  }
};

export const getAdminOverview = async () => fetchOverviewMetrics();
export const getSupportedOverviewWindows = () => getSupportedTimeWindows();
