import { createClient } from '@supabase/supabase-js';
import { env, hasSupabaseReadOnlyConfig } from '../config/env.js';

export const supabase = hasSupabaseReadOnlyConfig
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

export const readOnlyNotice =
  'Supabase access is intentionally read-only. No write, schema, or migration operations are permitted by the admin backend.';
