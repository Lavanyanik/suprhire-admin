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
  'Suprhire admin backend uses server-side read-only Supabase access. No service-role key is exposed from the frontend or backend API layer.';
