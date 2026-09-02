import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { createAdminRouter } from './routes/admin.js';
import { requireAdminAuth } from './middleware/adminAuth.js';
import { fetchOverviewMetrics } from './analytics/overview.js';

export const createApp = () => {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());

  app.get('/health', requireAdminAuth, async (_req, res) => {
    res.json({
      ok: true,
      service: 'suprhire-admin-backend',
      status: 'healthy',
      adminProtected: true,
      readOnlySupabase: Boolean(env.supabaseUrl && env.supabaseAnonKey),
      supabaseMode: 'read-only',
      requiresAdminAuth: true,
    });
  });

  app.get('/api/metrics/overview', requireAdminAuth, async (_req, res) => {
    const metrics = await fetchOverviewMetrics();
    res.json(metrics);
  });

  app.use('/api/admin', createAdminRouter());

  return app;
};

const app = createApp();

if (process.env.NODE_ENV !== 'test') {
  app.listen(env.port, () => {
    console.log(`Suprhire admin backend running on port ${env.port}`);
  });
}

export default app;
