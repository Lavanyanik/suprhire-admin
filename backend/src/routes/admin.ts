import { Router } from 'express';
import { abuseDetectionAnalytics, growthAnalytics, healthCheck, overviewMetrics, productUsageAnalytics, systemHealthAnalytics, userCompanyAnalytics } from '../controllers/adminController.js';
import { configureDevSessionCookie, requireAdminAuth } from '../middleware/adminAuth.js';

export const createAdminRouter = () => {
  const router = Router();

  router.post('/dev-login', (_req, res) => {
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Development login is disabled in production.',
      });
      return;
    }

    const devToken = process.env.ADMIN_DEV_TOKEN ?? '';
    if (!devToken) {
      res.status(503).json({
        error: 'Development auth is not configured.',
        message: 'Set ADMIN_DEV_TOKEN on the backend to enable local admin development sessions.',
      });
      return;
    }

    configureDevSessionCookie(res, devToken);
    res.json({
      ok: true,
      message: 'Development admin session created.',
      mode: 'development-only',
      requiresProductionIdentityProvider: true,
    });
  });

  router.post('/dev-logout', (_req, res) => {
    res.clearCookie('suprhire_admin_session', { path: '/' });
    res.json({ ok: true, message: 'Development admin session cleared.' });
  });

  router.use(requireAdminAuth);
  router.get('/health', healthCheck);
  router.get('/overview', overviewMetrics);
  router.get('/analytics/user-company', userCompanyAnalytics);
  router.get('/analytics/product-usage', productUsageAnalytics);
  router.get('/analytics/system-health', systemHealthAnalytics);
  router.get('/analytics/abuse-detection', abuseDetectionAnalytics);
  router.get('/analytics/growth', growthAnalytics);
  router.get('/users', (_req, res) => {
    res.status(501).json({ error: 'Not implemented yet', path: '/api/admin/users' });
  });
  router.get('/users/:id', (_req, res) => {
    res.status(501).json({ error: 'Not implemented yet', path: '/api/admin/users/:id' });
  });
  router.get('/companies', (_req, res) => {
    res.status(501).json({ error: 'Not implemented yet', path: '/api/admin/companies' });
  });
  router.get('/companies/:id', (_req, res) => {
    res.status(501).json({ error: 'Not implemented yet', path: '/api/admin/companies/:id' });
  });
  router.get('/alerts', (_req, res) => {
    res.status(501).json({ error: 'Not implemented yet', path: '/api/admin/alerts' });
  });

  return router;
};
