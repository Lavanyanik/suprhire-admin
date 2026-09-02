import type { TimeWindow, TimeWindowId } from './types.js';

export const supportedTimeWindows: Array<{ id: TimeWindowId; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last_7_days', label: 'Last 7 days' },
  { id: 'last_30_days', label: 'Last 30 days' },
  { id: 'since_inception', label: 'Since inception' },
];

export const getSupportedTimeWindows = () => supportedTimeWindows;

export const getTimeWindowRange = (id: TimeWindowId, referenceDate: Date = new Date()): TimeWindow => {
  const end = new Date(referenceDate);
  const start = new Date(referenceDate);

  switch (id) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { id, label: 'Today', start, end };
    case 'yesterday': {
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      return { id, label: 'Yesterday', start, end };
    }
    case 'last_7_days':
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return { id, label: 'Last 7 days', start, end };
    case 'last_30_days':
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      return { id, label: 'Last 30 days', start, end };
    case 'since_inception':
      return { id, label: 'Since inception', start: null, end };
    default:
      return { id: 'since_inception', label: 'Since inception', start: null, end };
  }
};