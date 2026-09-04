import { supabase } from '../lib/supabase.js';

type DetectionStatus = 'ready' | 'data-access-pending' | 'missing-config' | 'error';
type Severity = 'info' | 'warning' | 'high';
type SignalType = 'high-volume-activity' | 'burst-activity' | 'loophole-signal';
type Row = Record<string, unknown>;

type ActivityEvent = {
  kind: string;
  companyId: string;
  occurredAt: Date;
};

type AbuseAlert = {
  id: string;
  severity: Severity;
  signalType: SignalType;
  companyId: string;
  observedActivity: { actionTypes: string[]; count: number; baselineDailyAverage: number; multiplier: number };
  timeWindow: string;
  reason: string;
  recommendedAdminReviewAction: string;
};

const WINDOW_HOURS = 24;
const BASELINE_DAYS = 30;
const MINIMUM_WINDOW_EVENTS = 10;
const MINIMUM_BASELINE_EVENTS = 10;
const HIGH_VOLUME_MULTIPLIER = 3;

const getRows = async (table: string, columns: string): Promise<{ rows: Row[]; error?: string }> => {
  if (!supabase) return { rows: [], error: 'Supabase read-only configuration is missing.' };
  const { data, error } = await supabase.from(table).select(columns);
  if (error) return { rows: [], error: error.message || `The ${table} table could not be queried.` };
  return { rows: (data ?? []) as unknown as Row[] };
};

const stringValue = (row: Row, key: string): string | null => {
  const value = row[key];
  return typeof value === 'string' && value.trim() ? value : null;
};

const dateValue = (row: Row, key: string): Date | null => {
  const value = row[key];
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const activityFrom = (kind: string, rows: Row[], dateKey: string, companyKey: string): ActivityEvent[] => rows.flatMap((row) => {
  const companyId = stringValue(row, companyKey);
  const occurredAt = dateValue(row, dateKey);
  return companyId && occurredAt ? [{ kind, companyId, occurredAt }] : [];
});

const round = (value: number): number => Math.round(value * 100) / 100;

const alertForCompany = (companyId: string, companyName: string, events: ActivityEvent[], now: Date): AbuseAlert | null => {
  const currentStart = new Date(now.getTime() - WINDOW_HOURS * 60 * 60 * 1000);
  const baselineStart = new Date(now.getTime() - BASELINE_DAYS * 24 * 60 * 60 * 1000);
  const current = events.filter((event) => event.occurredAt >= currentStart && event.occurredAt <= now);
  const baseline = events.filter((event) => event.occurredAt >= baselineStart && event.occurredAt < currentStart);
  const baselineDailyAverage = baseline.length / (BASELINE_DAYS - 1);
  const multiplier = baselineDailyAverage > 0 ? current.length / baselineDailyAverage : 0;
  if (current.length < MINIMUM_WINDOW_EVENTS || baseline.length < MINIMUM_BASELINE_EVENTS || multiplier < HIGH_VOLUME_MULTIPLIER) return null;

  const actionTypes = [...new Set(current.map((event) => event.kind))];
  const severity: Severity = current.length >= MINIMUM_WINDOW_EVENTS * 3 && multiplier >= HIGH_VOLUME_MULTIPLIER * 2 ? 'high' : 'warning';
  return {
    id: `company-${companyId}-activity-burst`,
    severity,
    signalType: current.length >= MINIMUM_WINDOW_EVENTS * 2 ? 'loophole-signal' : multiplier >= HIGH_VOLUME_MULTIPLIER + 2 ? 'high-volume-activity' : 'burst-activity',
    companyId,
    observedActivity: { actionTypes, count: current.length, baselineDailyAverage: round(baselineDailyAverage), multiplier: round(multiplier) },
    timeWindow: 'Last 24 hours compared with the preceding 29 days',
    reason: `${companyName} recorded ${current.length} attributable product actions in the last 24 hours versus an observed daily average of ${round(baselineDailyAverage)}. This is a usage signal requiring admin review, not a finding of abuse or automation.`,
    recommendedAdminReviewAction: 'Review the company workspace, recent activity context, and product-limit history before taking any action.',
  };
};

export const fetchAbuseDetection = async () => {
  if (!supabase) return { status: 'missing-config' as DetectionStatus, alerts: [], notes: detectionNotes };

  const results = await Promise.all([
    getRows('companies', 'id, name'),
    getRows('jobs', 'id, posted_date, company_id'),
    getRows('applications', 'id, created_at, job_id'),
    getRows('resume_imports', 'id, created_at, company_id'),
    getRows('campaigns', 'id, created_at, company_id'),
    getRows('ai_agents', 'id, created_at, company_id'),
    getRows('interviews', 'id, created_at, job_id'),
    getRows('screening_calls', 'id, created_at, interview_id'),
  ]);
  const [companies, jobs, applications, resumeImports, campaigns, aiAgents, interviews, calls] = results;
  if (results.some((result) => result.error) || results.some((result) => result.rows.length === 0)) {
    return { status: 'data-access-pending' as DetectionStatus, alerts: [], notes: detectionNotes };
  }

  const jobsById = new Map(jobs.rows.map((row) => [String(row.id), row]));
  const interviewsById = new Map(interviews.rows.map((row) => [String(row.id), row]));
  const events = [
    ...activityFrom('jobs', jobs.rows, 'posted_date', 'company_id'),
    ...activityFrom('resume imports', resumeImports.rows, 'created_at', 'company_id'),
    ...activityFrom('campaigns', campaigns.rows, 'created_at', 'company_id'),
    ...activityFrom('AI agents', aiAgents.rows, 'created_at', 'company_id'),
    ...interviews.rows.flatMap((row) => activityFrom('interviews', [{ ...row, company_id: jobsById.get(String(row.job_id))?.company_id }], 'created_at', 'company_id')),
    ...applications.rows.flatMap((row) => activityFrom('applications', [{ ...row, company_id: jobsById.get(String(row.job_id))?.company_id }], 'created_at', 'company_id')),
    ...calls.rows.flatMap((row) => {
      const interview = interviewsById.get(String(row.interview_id));
      return activityFrom('calls', [{ ...row, company_id: jobsById.get(String(interview?.job_id))?.company_id }], 'created_at', 'company_id');
    }),
  ];
  const companyNames = new Map(companies.rows.map((row) => [String(row.id), String(row.name ?? 'Unknown company')]));
  const alerts = [...new Set(events.map((event) => event.companyId))]
    .map((companyId) => alertForCompany(companyId, companyNames.get(companyId) ?? 'Unknown company', events.filter((event) => event.companyId === companyId), new Date()))
    .filter((alert): alert is AbuseAlert => alert !== null)
    .sort((a, b) => b.observedActivity.count - a.observedActivity.count);

  return { status: 'ready' as DetectionStatus, alerts, notes: detectionNotes };
};

const detectionNotes = {
  supportedSignals: 'Company-level volume and burst/loophole signals across readable product rows with timestamps and company linkage.',
  unavailableSignals: 'User-level activity, repeated workflow attribution, login patterns, and automation claims require unapplied event, login, audit, or attribution tables.',
  thresholds: `A signal requires at least ${MINIMUM_WINDOW_EVENTS} attributable actions in 24 hours, at least ${MINIMUM_BASELINE_EVENTS} actions in the preceding ${BASELINE_DAYS - 1} days, and a current rate at least ${HIGH_VOLUME_MULTIPLIER}x that observed baseline. These minimums avoid flagging small samples and are review heuristics, not abuse determinations.`,
  attribution: 'Applications, interviews, and calls are attributed to company only through existing job/interview relationships. No user identifier is inferred.',
};