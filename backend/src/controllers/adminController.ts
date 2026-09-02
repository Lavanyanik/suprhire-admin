import { env } from '../config/env.js';
import { fetchOverviewMetrics } from '../analytics/overview.js';

export const healthCheck = (_req: any, res: any): void => {
  res.json({
    ok: true,
    service: 'suprhire-admin-backend',
    status: 'healthy',
    adminProtected: true,
    readOnlySupabase: Boolean(env.supabaseUrl && env.supabaseAnonKey),
    supabaseMode: 'read-only',
    requiresAdminAuth: true,
  });
};

export const overviewMetrics = async (_req: any, res: any): Promise<void> => {
  const metrics = await fetchOverviewMetrics();
  res.json(metrics);
};
