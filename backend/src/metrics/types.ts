export type TimeWindowId = 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'since_inception';

export type TimeWindow = {
  id: TimeWindowId;
  label: string;
  start: Date | null;
  end: Date;
};

export type UnsupportedMetric = {
  available: false;
  reason: string;
};

export type MetricDefinition = {
  metric: string;
  purpose: string;
  sourceTable: string;
  sourceColumn: string;
  relationships: string;
  calculation: string;
  timeWindow: string;
  userAttribution: string;
  companyAttribution: string;
  dataLimitations: string;
  reliability: 'high' | 'medium' | 'low' | 'unavailable';
  available: boolean;
  reason?: string;
};

export type MetricValue = number | 'unavailable';

export type MetricGroup = {
  total: MetricValue;
  today: MetricValue;
  yesterday: MetricValue;
  last7Days: MetricValue;
  last30Days: MetricValue;
  sinceInception: MetricValue;
};

export type OverviewAnalytics = {
  users: {
    totalUsers: MetricValue;
    newUsers: MetricGroup;
    lastLogin: MetricValue;
    neverLoggedIn: MetricValue | UnsupportedMetric;
    recentlyUpdatedProfiles: MetricGroup;
    usersByRole: MetricValue | UnsupportedMetric;
    usersByCompany: MetricValue | UnsupportedMetric;
  };
  companies: {
    totalCompanies: MetricValue;
    usersPerCompany: MetricValue | UnsupportedMetric;
    companiesBySubscriptionTier: MetricValue | UnsupportedMetric;
  };
  jobs: MetricGroup;
  applications: MetricGroup;
  imports: {
    totalImportBatches: MetricGroup;
    resumeImports: MetricGroup;
  };
  agents: MetricGroup;
  interviews: MetricGroup;
  calls: MetricGroup;
  systemHealth: {
    resumeProcessing: { available: boolean; reason?: string; attempts?: number; successes?: number; failures?: number; successRate?: number; }
    resumeImports: { available: boolean; reason?: string; attempts?: number; successes?: number; failures?: number; successRate?: number; }
    aiAgents: { available: boolean; reason?: string; attempts?: number; successes?: number; failures?: number; successRate?: number; }
    candidateImports: { available: boolean; reason?: string; attempts?: number; successes?: number; failures?: number; successRate?: number; }
    applications: { available: boolean; reason?: string; attempts?: number; successes?: number; failures?: number; successRate?: number; }
    interviews: { available: boolean; reason?: string; attempts?: number; successes?: number; failures?: number; successRate?: number; }
    calls: { available: boolean; reason?: string; attempts?: number; successes?: number; failures?: number; successRate?: number; }
  };
  status: 'ready' | 'missing-config' | 'error';
};