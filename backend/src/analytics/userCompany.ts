import { supabase } from '../lib/supabase.js';
import { getTimeWindowRange } from '../metrics/index.js';
import type { MetricGroup, TimeWindowId } from '../metrics/types.js';

type CompanyCountMap = Record<string, number>;

type TrendPoint = {
  period: string;
  count: number;
};

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

const getMetricGroup = async (table: string, column: string): Promise<MetricGroup> => {
  const [total, today, yesterday, last7Days, last30Days, sinceInception] = await Promise.all([
    getCount(table),
    getCountInWindow(table, column, 'today'),
    getCountInWindow(table, column, 'yesterday'),
    getCountInWindow(table, column, 'last_7_days'),
    getCountInWindow(table, column, 'last_30_days'),
    getCountInWindow(table, column, 'since_inception'),
  ]);

  return { total, today, yesterday, last7Days, last30Days, sinceInception };
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
    console.error(`Range count failed for ${table}.${column} (${windowId}):`, error);
    return 0;
  }

  return count ?? 0;
};

const getMonthlyTrend = async (table: string, column: string): Promise<TrendPoint[]> => {
  if (!supabase) {
    return [];
  }

  const months: Array<{ period: string; start: Date; end: Date }> = [];
  const current = new Date();
  for (let index = 11; index >= 0; index -= 1) {
    const start = new Date(current.getFullYear(), current.getMonth() - index, 1, 0, 0, 0, 0);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1, 0, 0, 0, 0);
    months.push({
      period: start.toISOString().slice(0, 7),
      start,
      end,
    });
  }

  const client = supabase;
  const results = await Promise.all(
    months.map(async ({ period, start, end }) => {
      const { count, error } = await client
        .from(table)
        .select('id', { count: 'exact', head: true })
        .gte(column, start.toISOString())
        .lt(column, end.toISOString());

      if (error) {
        console.error(`Trend count failed for ${table}.${column} (${period}):`, error);
        return { period, count: 0 };
      }

      return { period, count: count ?? 0 };
    }),
  );

  return results;
};

const buildCountMap = async (table: string, idColumn: string): Promise<CompanyCountMap> => {
  if (!supabase) {
    return {};
  }

  const { data, error } = await supabase
    .from(table)
    .select(`${idColumn}`)
    .not(idColumn, 'is', null);

  if (error) {
    console.error(`Count map failed for ${table}.${idColumn}:`, error);
    return {};
  }

  const map: CompanyCountMap = {};
  for (const row of data ?? []) {
    const typedRow = row as unknown as Record<string, unknown>;
    const value = typedRow[idColumn] as string | null | undefined;
    if (!value) {
      continue;
    }
    map[value] = (map[value] ?? 0) + 1;
  }

  return map;
};

const buildProfileCompanyCounts = async () => {
  if (!supabase) {
    return [] as Array<{ companyId: string; companyName: string; count: number }>;
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('company_id')
    .not('company_id', 'is', null);

  if (profilesError) {
    console.error('Profile company distribution failed:', profilesError);
    return [];
  }

  const { data: companies, error: companiesError } = await supabase
    .from('companies')
    .select('id, name');

  if (companiesError) {
    console.error('Company names failed:', companiesError);
    return [];
  }

  const companyMap = new Map((companies ?? []).map((company) => [company.id, company.name]));
  const counts = new Map<string, number>();

  for (const profile of profiles ?? []) {
    const companyId = profile.company_id as string | null;
    if (!companyId) {
      continue;
    }
    counts.set(companyId, (counts.get(companyId) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([companyId, count]) => ({
      companyId,
      companyName: companyMap.get(companyId) ?? 'Unknown company',
      count,
    }))
    .sort((a, b) => b.count - a.count);
};

const buildRoleDistribution = async () => {
  if (!supabase) {
    return [] as Array<{ role: string; count: number }>;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .not('role', 'is', null);

  if (error) {
    console.error('Role distribution failed:', error);
    return [];
  }

  const counts = new Map<string, number>();
  for (const profile of data ?? []) {
    const role = String(profile.role ?? '').trim();
    if (!role) {
      continue;
    }
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => b.count - a.count);
};

const buildCompanyUsage = async () => {
  if (!supabase) {
    return [] as Array<{ companyId: string; companyName: string; totalUsers: number; totalJobs: number; totalApplications: number; totalResumeImports: number; totalAiAgents: number; totalInterviews: number; totalCalls: number; }>;
  }

  const [{ data: companies, error: companiesError }, { data: jobs, error: jobsError }, { data: applications, error: applicationsError }, { data: resumeImports, error: resumeImportsError }, { data: aiAgents, error: aiAgentsError }, { data: interviews, error: interviewsError }, { data: screeningCalls, error: screeningCallsError }] = await Promise.all([
    supabase.from('companies').select('id, name'),
    supabase.from('jobs').select('id, company_id'),
    supabase.from('applications').select('id, job_id'),
    supabase.from('resume_imports').select('id, company_id'),
    supabase.from('ai_agents').select('id, company_id'),
    supabase.from('interviews').select('id, job_id'),
    supabase.from('screening_calls').select('id, interview_id'),
  ]);

  if (companiesError || jobsError || applicationsError || resumeImportsError || aiAgentsError || interviewsError || screeningCallsError) {
    console.error('Company usage aggregation failed:', { companiesError, jobsError, applicationsError, resumeImportsError, aiAgentsError, interviewsError, screeningCallsError });
    return [];
  }

  const companyNameMap = new Map((companies ?? []).map((company) => [company.id, company.name]));
  const jobsByCompany: CompanyCountMap = {};
  for (const job of jobs ?? []) {
    const companyId = job.company_id as string | null;
    if (!companyId) {
      continue;
    }
    jobsByCompany[companyId] = (jobsByCompany[companyId] ?? 0) + 1;
  }

  const applicationsByCompany: CompanyCountMap = {};
  const jobsById = new Map((jobs ?? []).map((job) => [job.id, job.company_id]));
  for (const application of applications ?? []) {
    const companyId = jobsById.get(application.job_id as string);
    if (!companyId) {
      continue;
    }
    applicationsByCompany[companyId as string] = (applicationsByCompany[companyId as string] ?? 0) + 1;
  }

  const resumeImportsByCompany: CompanyCountMap = {};
  for (const importRow of resumeImports ?? []) {
    const companyId = importRow.company_id as string | null;
    if (!companyId) {
      continue;
    }
    resumeImportsByCompany[companyId] = (resumeImportsByCompany[companyId] ?? 0) + 1;
  }

  const aiAgentsByCompany: CompanyCountMap = {};
  for (const agent of aiAgents ?? []) {
    const companyId = agent.company_id as string | null;
    if (!companyId) {
      continue;
    }
    aiAgentsByCompany[companyId] = (aiAgentsByCompany[companyId] ?? 0) + 1;
  }

  const interviewsByCompany: CompanyCountMap = {};
  const interviewJobMap = new Map((interviews ?? []).map((interview) => [interview.id, interview.job_id]));
  for (const interview of interviews ?? []) {
    const companyId = jobsById.get(interview.job_id as string);
    if (!companyId) {
      continue;
    }
    interviewsByCompany[companyId as string] = (interviewsByCompany[companyId as string] ?? 0) + 1;
  }

  const callsByCompany: CompanyCountMap = {};
  const interviewsById = new Map((interviews ?? []).map((interview) => [interview.id, interview.job_id]));
  for (const call of screeningCalls ?? []) {
    const interviewId = call.interview_id as string | null;
    if (!interviewId) {
      continue;
    }
    const jobId = interviewsById.get(interviewId);
    const companyId = jobId ? jobsById.get(jobId) : null;
    if (!companyId) {
      continue;
    }
    callsByCompany[companyId as string] = (callsByCompany[companyId as string] ?? 0) + 1;
  }

  const userCountMap = await buildProfileCompanyCounts();
  const userCountByCompany: CompanyCountMap = {};
  for (const item of userCountMap) {
    userCountByCompany[item.companyId] = item.count;
  }

  const companyUsage = [...companyNameMap.entries()]
    .map(([companyId, companyName]) => ({
      companyId,
      companyName,
      totalUsers: userCountByCompany[companyId] ?? 0,
      totalJobs: jobsByCompany[companyId] ?? 0,
      totalApplications: applicationsByCompany[companyId] ?? 0,
      totalResumeImports: resumeImportsByCompany[companyId] ?? 0,
      totalAiAgents: aiAgentsByCompany[companyId] ?? 0,
      totalInterviews: interviewsByCompany[companyId] ?? 0,
      totalCalls: callsByCompany[companyId] ?? 0,
    }))
    .filter((entry) => entry.totalUsers > 0 || entry.totalJobs > 0 || entry.totalApplications > 0 || entry.totalResumeImports > 0 || entry.totalAiAgents > 0 || entry.totalInterviews > 0 || entry.totalCalls > 0)
    .sort((a, b) => (
      b.totalUsers + b.totalJobs + b.totalApplications + b.totalResumeImports + b.totalAiAgents + b.totalInterviews + b.totalCalls
      - (a.totalUsers + a.totalJobs + a.totalApplications + a.totalResumeImports + a.totalAiAgents + a.totalInterviews + a.totalCalls)
    ));

  return companyUsage;
};

export const fetchUserCompanyAnalytics = async () => {
  if (!supabase) {
    return {
      status: 'missing-config',
      userAnalytics: {
        totalUsers: 0,
        newUsers: { total: 0, today: 0, yesterday: 0, last7Days: 0, last30Days: 0, sinceInception: 0 },
        recentlyUpdatedProfiles: { total: 0, today: 0, yesterday: 0, last7Days: 0, last30Days: 0, sinceInception: 0 },
        byCompany: [],
        byRole: [],
        growthTrend: [],
      },
      companyAnalytics: {
        totalCompanies: 0,
        newCompanies: { total: 0, today: 0, yesterday: 0, last7Days: 0, last30Days: 0, sinceInception: 0 },
        byCompany: [],
        growthTrend: [],
      },
    };
  }

  try {
    const [totalUsers, newUsers, recentlyUpdatedProfiles, totalCompanies, newCompanies, byCompany, byRole, userGrowthTrend, companyGrowthTrend, companyUsage] = await Promise.all([
      getCount('profiles'),
      getMetricGroup('profiles', 'created_at'),
      getMetricGroup('profiles', 'updated_at'),
      getCount('companies'),
      getMetricGroup('companies', 'created_at'),
      buildProfileCompanyCounts(),
      buildRoleDistribution(),
      getMonthlyTrend('profiles', 'created_at'),
      getMonthlyTrend('companies', 'created_at'),
      buildCompanyUsage(),
    ]);

    return {
      status: 'ready',
      userAnalytics: {
        totalUsers,
        newUsers,
        recentlyUpdatedProfiles,
        byCompany,
        byRole,
        growthTrend: userGrowthTrend,
      },
      companyAnalytics: {
        totalCompanies,
        newCompanies,
        byCompany: companyUsage,
        growthTrend: companyGrowthTrend,
      },
    };
  } catch (error) {
    console.error('User/company analytics failed:', error);
    return {
      status: 'error',
      userAnalytics: {
        totalUsers: 0,
        newUsers: { total: 0, today: 0, yesterday: 0, last7Days: 0, last30Days: 0, sinceInception: 0 },
        recentlyUpdatedProfiles: { total: 0, today: 0, yesterday: 0, last7Days: 0, last30Days: 0, sinceInception: 0 },
        byCompany: [],
        byRole: [],
        growthTrend: [],
      },
      companyAnalytics: {
        totalCompanies: 0,
        newCompanies: { total: 0, today: 0, yesterday: 0, last7Days: 0, last30Days: 0, sinceInception: 0 },
        byCompany: [],
        growthTrend: [],
      },
    };
  }
};
