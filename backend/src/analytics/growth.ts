import { supabase } from '../lib/supabase.js';

export type GrowthStatus = 'ready' | 'data-access-pending' | 'missing-config' | 'error';
export type GrowthPoint = { period: string; count: number };
export type GrowthMetric = {
  status: 'available' | 'unavailable';
  total: number;
  monthly: GrowthPoint[];
  currentMonth: number;
  previousMonth: number;
  monthOverMonthGrowthPercent: number | null;
};

type Row = Record<string, unknown>;
type ActivityRow = { date: Date };

const metricKeys = ['users', 'companies', 'jobs', 'applications', 'resumeImports', 'aiAgents', 'interviews', 'calls'] as const;
export type GrowthMetricKey = (typeof metricKeys)[number];

const emptyMetric = (): GrowthMetric => ({
  status: 'unavailable',
  total: 0,
  monthly: [],
  currentMonth: 0,
  previousMonth: 0,
  monthOverMonthGrowthPercent: null,
});

export const calculateMonthOverMonthGrowth = (currentMonth: number, previousMonth: number): number | null => {
  if (previousMonth === 0) return null;
  return ((currentMonth - previousMonth) / previousMonth) * 100;
};

const parseDate = (value: unknown): Date | null => {
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const rowsWithDates = (rows: Row[], dateColumn: string): ActivityRow[] => rows.flatMap((row) => {
  const date = parseDate(row[dateColumn]);
  return date ? [{ date }] : [];
});

export const buildGrowthMetric = (rows: ActivityRow[], now = new Date()): GrowthMetric => {
  const monthly: GrowthPoint[] = [];
  for (let index = 11; index >= 0; index -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    monthly.push({
      period: start.toISOString().slice(0, 7),
      count: rows.filter((row) => row.date >= start && row.date < end).length,
    });
  }
  const currentMonth = monthly[monthly.length - 1]?.count ?? 0;
  const previousMonth = monthly[monthly.length - 2]?.count ?? 0;
  return {
    status: 'available',
    total: rows.length,
    monthly,
    currentMonth,
    previousMonth,
    monthOverMonthGrowthPercent: calculateMonthOverMonthGrowth(currentMonth, previousMonth),
  };
};

const getRows = async (table: string, columns: string): Promise<{ rows: Row[]; error?: string }> => {
  if (!supabase) return { rows: [], error: 'Supabase read-only configuration is missing.' };
  const { data, error } = await supabase.from(table).select(columns);
  if (error) return { rows: [], error: error.message || `The ${table} table could not be queried.` };
  return { rows: (data ?? []) as unknown as Row[] };
};

const pendingMetrics = (): Record<GrowthMetricKey, GrowthMetric> => Object.fromEntries(metricKeys.map((key) => [key, emptyMetric()])) as Record<GrowthMetricKey, GrowthMetric>;

export const fetchGrowthAnalytics = async () => {
  if (!supabase) return { status: 'missing-config' as GrowthStatus, metrics: pendingMetrics() };

  const results = await Promise.all([
    getRows('profiles', 'id, created_at'),
    getRows('companies', 'id, created_at'),
    getRows('jobs', 'id, posted_date'),
    getRows('applications', 'id, created_at'),
    getRows('resume_imports', 'id, created_at'),
    getRows('ai_agents', 'id, created_at'),
    getRows('interviews', 'id, created_at'),
    getRows('screening_calls', 'id, created_at'),
  ]);

  if (results.some((result) => result.error)) {
    return { status: 'error' as GrowthStatus, metrics: pendingMetrics() };
  }
  if (results.some((result) => result.rows.length === 0)) {
    return { status: 'data-access-pending' as GrowthStatus, metrics: pendingMetrics() };
  }

  const [users, companies, jobs, applications, resumeImports, aiAgents, interviews, calls] = results;
  const metrics = {
    users: buildGrowthMetric(rowsWithDates(users.rows, 'created_at')),
    companies: buildGrowthMetric(rowsWithDates(companies.rows, 'created_at')),
    jobs: buildGrowthMetric(rowsWithDates(jobs.rows, 'posted_date')),
    applications: buildGrowthMetric(rowsWithDates(applications.rows, 'created_at')),
    resumeImports: buildGrowthMetric(rowsWithDates(resumeImports.rows, 'created_at')),
    aiAgents: buildGrowthMetric(rowsWithDates(aiAgents.rows, 'created_at')),
    interviews: buildGrowthMetric(rowsWithDates(interviews.rows, 'created_at')),
    calls: buildGrowthMetric(rowsWithDates(calls.rows, 'created_at')),
  };
  return { status: 'ready' as GrowthStatus, metrics };
};