export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface AdminHealthResponse {
  ok: boolean;
  service: string;
  status: HealthStatus;
  adminProtected: boolean;
  readOnlySupabase: boolean;
  supabaseMode: 'read-only';
  requiresAdminAuth: boolean;
}
