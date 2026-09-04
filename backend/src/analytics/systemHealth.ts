import { supabase } from '../lib/supabase.js';

type HealthState = 'healthy' | 'warning' | 'critical' | 'unavailable' | 'data-access-pending';
type Row = Record<string, unknown>;

type HealthSignal = {
  state: HealthState;
  title: string;
  reason?: string;
  details?: Record<string, number | string>;
};

type WorkflowHealth = {
  reliability: HealthSignal;
  readiness: HealthSignal;
  bottleneck: HealthSignal;
};

const pending = (title: string): HealthSignal => ({
  state: 'data-access-pending',
  title,
  reason: 'The read-only Supabase path returned no rows. This may be caused by current RLS visibility, so no health conclusion is reported.',
});

const unavailable = (title: string, reason: string): HealthSignal => ({
  state: 'unavailable',
  title,
  reason,
});

const healthy = (title: string, details?: Record<string, number | string>): HealthSignal => ({ state: 'healthy', title, details });
const warning = (title: string, details?: Record<string, number | string>): HealthSignal => ({ state: 'warning', title, details });
const critical = (title: string, details?: Record<string, number | string>): HealthSignal => ({ state: 'critical', title, details });

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

const text = (row: Row, key: string): string => String(row[key] ?? '').trim().toLowerCase();
const date = (row: Row, key: string): Date | null => {
  const value = row[key];
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const successValues = new Set(['success', 'succeeded', 'successful', 'completed', 'complete', 'parsed', 'finished']);
const failureValues = new Set(['failed', 'failure', 'error', 'errored', 'cancelled', 'canceled']);
const activeValues = new Set(['pending', 'queued', 'processing', 'in_progress', 'in-progress', 'started', 'running', 'not_started']);

const outcomeFor = (row: Row, statusKey: string, errorKey?: string): 'success' | 'failure' | 'active' | 'unknown' => {
  const status = text(row, statusKey);
  const error = errorKey ? text(row, errorKey) : '';
  if (failureValues.has(status) || error) return 'failure';
  if (successValues.has(status)) return 'success';
  if (activeValues.has(status)) return 'active';
  return 'unknown';
};

const reliability = (title: string, rows: Row[], statusKey: string, errorKey?: string): HealthSignal => {
  if (rows.length === 0) return pending(title);
  const outcomes = rows.map((row) => outcomeFor(row, statusKey, errorKey));
  const successes = outcomes.filter((outcome) => outcome === 'success').length;
  const failures = outcomes.filter((outcome) => outcome === 'failure').length;
  if (successes === 0 && failures === 0) {
    return unavailable(title, `No recognized success/failure values were found in ${statusKey}.`);
  }
  const total = successes + failures;
  const failureRate = failures / total;
  const details = { successes, failures, failureRate: `${Math.round(failureRate * 10000) / 100}%` };
  if (failureRate >= 0.2) return critical(title, details);
  if (failures > 0) return warning(title, details);
  return healthy(title, details);
};

const readiness = (title: string, rows: Row[], statusKey: string, dateKey: string): HealthSignal => {
  if (rows.length === 0) return pending(title);
  const now = Date.now();
  const stalled = rows.filter((row) => activeValues.has(text(row, statusKey)) && (now - (date(row, dateKey)?.getTime() ?? now)) > 24 * 60 * 60 * 1000).length;
  if (stalled > 0) return warning(title, { stalled });
  return healthy(title, { stalled: 0 });
};

const bottleneck = (title: string, rows: Row[], startKey: string, endKey: string): HealthSignal => {
  if (rows.length === 0) return pending(title);
  const durations = rows.flatMap((row) => {
    const start = date(row, startKey);
    const end = date(row, endKey);
    return start && end && end >= start ? [end.getTime() - start.getTime()] : [];
  });
  if (durations.length === 0) return unavailable(title, `Both ${startKey} and ${endKey} were not populated on readable rows.`);
  const averageMinutes = durations.reduce((sum, duration) => sum + duration, 0) / durations.length / 60000;
  if (averageMinutes >= 60) return warning(title, { measuredRows: durations.length, averageMinutes: Math.round(averageMinutes * 100) / 100 });
  return healthy(title, { measuredRows: durations.length, averageMinutes: Math.round(averageMinutes * 100) / 100 });
};

const workflow = (title: string, rows: Row[], error: string | undefined, statusKey: string, dateKey: string, durationKeys?: [string, string]): WorkflowHealth => {
  if (error) {
    const signal = unavailable(title, error);
    return { reliability: signal, readiness: signal, bottleneck: signal };
  }
  return {
    reliability: reliability(`${title} reliability`, rows, statusKey, statusKey === 'parse_status' ? 'error_message' : statusKey === 'status' ? 'error' : undefined),
    readiness: readiness(`${title} readiness`, rows, statusKey, dateKey),
    bottleneck: durationKeys ? bottleneck(`${title} processing time`, rows, durationKeys[0], durationKeys[1]) : unavailable(`${title} bottleneck`, 'No verified start and completion timestamp pair is available.'),
  };
};

const overallStatus = (workflows: Record<string, WorkflowHealth>, accessPending: boolean): HealthState => {
  if (accessPending) return 'data-access-pending';
  const states = Object.values(workflows).flatMap((item) => Object.values(item).map((signal) => signal.state));
  if (states.includes('critical')) return 'critical';
  if (states.includes('warning')) return 'warning';
  if (states.includes('healthy')) return 'healthy';
  return 'unavailable';
};

export const fetchSystemHealth = async () => {
  if (!supabase) {
    return {
      status: 'unavailable' as HealthState,
      summary: unavailable('System health unavailable', 'Supabase read-only configuration is missing.'),
      signals: { dataAccess: unavailable('Supabase data access', 'Supabase read-only configuration is missing.') },
      workflows: {},
    };
  }

  const results = await Promise.all([
    getRows('applications', 'id,status,parse_status,processing_completed_at,error_message,created_at,updated_at'),
    getRows('resume_imports', 'id,parse_status,error_message,created_at,updated_at'),
    getRows('ai_agents', 'id,status,created_at,updated_at'),
    getRows('interviews', 'id,status,created_at,updated_at'),
    getRows('screening_calls', 'id,status,error,started_at,ended_at,created_at,updated_at'),
    getRows('jobs', 'id,status,posted_date,updated_at'),
    getRows('campaigns', 'id,status,created_at,updated_at'),
  ]);

  const [applications, resumeImports, aiAgents, interviews, calls, jobs, campaigns] = results;
  const workflows = {
    applications: workflow('Applications', applications.rows, applications.error, 'status', 'updated_at', ['created_at', 'processing_completed_at']),
    resumeImports: workflow('Resume imports', resumeImports.rows, resumeImports.error, 'parse_status', 'updated_at'),
    aiAgents: workflow('AI agents', aiAgents.rows, aiAgents.error, 'status', 'updated_at'),
    interviews: workflow('Interviews', interviews.rows, interviews.error, 'status', 'updated_at'),
    calls: workflow('Calls', calls.rows, calls.error, 'status', 'updated_at', ['started_at', 'ended_at']),
    jobs: workflow('Jobs', jobs.rows, jobs.error, 'status', 'updated_at'),
    campaigns: workflow('Campaigns', campaigns.rows, campaigns.error, 'status', 'updated_at'),
  };
  const accessPending = results.some((result) => !result.error && result.rows.length === 0);
  const status = overallStatus(workflows, accessPending);

  return {
    status,
    summary: status === 'data-access-pending'
      ? pending('System health requires readable workflow rows')
      : status === 'healthy'
        ? healthy('No supported health warnings detected')
        : warning('One or more health signals require review'),
    signals: {
      dataAccess: accessPending
        ? pending('Supabase workflow data access')
        : healthy('Supabase workflow data access'),
      failureDetection: unavailable('Failure detection coverage', 'Failure rates are only reported when recognized persisted success/failure values are readable.'),
      readiness: accessPending
        ? pending('Workflow readiness')
        : healthy('Workflow readiness'),
    },
    workflows,
  };
};
