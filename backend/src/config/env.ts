import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 3001),
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY ?? '',
  adminApiKey: process.env.ADMIN_API_KEY ?? '',
  adminDevToken: process.env.ADMIN_DEV_TOKEN ?? '',
};

export const hasSupabaseReadOnlyConfig = Boolean(env.supabaseUrl && env.supabaseServiceKey);
