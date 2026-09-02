import { Router } from 'express';
import { overviewMetrics } from '../controllers/adminController.js';
import { requireAdminAuth } from '../middleware/adminAuth.js';

export const createMetricsRouter = () => {
  const router = Router();

  router.get('/overview', requireAdminAuth, overviewMetrics);

  return router;
};
