import { supabase } from '../lib/supabase.js';
import type { TimeWindowId } from '../metrics/types.js';

export type Filter = { column: string; value: unknown; op?: 'eq' | 'gte' | 'lt' };

/**
 * Query the database for an exact count with optional filters.
 * Returns 0 if Supabase is not configured or query fails.
 */
export const getCount = async (table: string, filters: Array<Filter> = []): Promise<number> => {
  if (!supabase) {
    return 0;
  }

  let query = supabase.from(table).select('id', { count: 'exact', head: true });

  for (const filter of filters) {
    const op = filter.op ?? 'eq';
    if (op === 'eq') query = query.eq(filter.column, filter.value);
    if (op === 'gte') query = query.gte(filter.column, filter.value as string | number | boolean | Date);
    if (op === 'lt') query = query.lt(filter.column, filter.value as string | number | boolean | Date);
  }

  const { count, error } = await query;
  if (error) {
    console.error(`Read-only count failed for ${table}:`, error);
    return 0;
  }

  return count ?? 0;
};

/**
 * Query the database for a count within a time window.
 * Returns 0 if Supabase is not configured or query fails.
 */
export const getCountInWindow = async (table: string, column: string, windowId: TimeWindowId): Promise<number> => {
  if (!supabase) {
    return 0;
  }

  const { getTimeWindowRange } = await import('../metrics/index.js');
  const window = getTimeWindowRange(windowId);
  if (window.start === null) {
    return getCount(table);
  }

  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .gte(column, window.start.toISOString())
    .lte(column, window.end.toISOString());

  if (error) {
    console.error(`Read-only window count failed for ${table}.${column} (${windowId}):`, error);
    return 0;
  }

  return count ?? 0;
};
