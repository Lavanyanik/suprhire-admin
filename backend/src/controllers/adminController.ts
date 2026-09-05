import { env } from '../config/env.js';
import { fetchOverviewMetrics } from '../analytics/overview.js';
import { fetchUserCompanyAnalytics } from '../analytics/userCompany.js';
import { fetchProductUsageAnalytics } from '../analytics/productUsage.js';
import { fetchSystemHealth } from '../analytics/systemHealth.js';
import { fetchAbuseDetection } from '../analytics/abuseDetection.js';
import { fetchGrowthAnalytics } from '../analytics/growth.js';
import { fetchDailySummary } from '../analytics/dailySummary.js';

export const healthCheck = (_req: any, res: any): void => {
  res.json({
    ok: true,
    service: 'suprhire-admin-backend',
    status: 'healthy',
    adminProtected: true,
    readOnlySupabase: Boolean(env.supabaseUrl && env.supabaseServiceKey),
    supabaseMode: 'read-only',
    requiresAdminAuth: true,
  });
};

export const overviewMetrics = async (_req: any, res: any): Promise<void> => {
  const metrics = await fetchOverviewMetrics();
  res.json(metrics);
};

export const userCompanyAnalytics = async (_req: any, res: any): Promise<void> => {
  const metrics = await fetchUserCompanyAnalytics();
  res.json(metrics);
};

export const productUsageAnalytics = async (_req: any, res: any): Promise<void> => {
  const metrics = await fetchProductUsageAnalytics();
  res.json(metrics);
};

export const systemHealthAnalytics = async (_req: any, res: any): Promise<void> => {
  const metrics = await fetchSystemHealth();
  res.json(metrics);
};

export const abuseDetectionAnalytics = async (_req: any, res: any): Promise<void> => {
  const detection = await fetchAbuseDetection();
  res.json(detection);
};

export const growthAnalytics = async (_req: any, res: any): Promise<void> => {
  const analytics = await fetchGrowthAnalytics();
  res.json(analytics);
};

export const dailySummaryAnalytics = async (_req: any, res: any): Promise<void> => {
  const summary = await fetchDailySummary();
  res.json(summary);
};
