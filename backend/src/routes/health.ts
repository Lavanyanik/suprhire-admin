import { Router } from 'express';
import { healthCheck } from '../controllers/adminController.js';
import { requireAdminAuth } from '../middleware/adminAuth.js';

export const createHealthRouter = () => {
  const router = Router();

  router.get('/', requireAdminAuth, healthCheck);

  return router;
};
