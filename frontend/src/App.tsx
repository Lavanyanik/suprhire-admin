import { useEffect, useState } from 'react';
import './App.css';

type MetricValue = number | 'unavailable';
type MetricGroup = Record<'total' | 'today' | 'yesterday' | 'last7Days' | 'last30Days' | 'sinceInception', MetricValue>;
type TimeWindowId = 'today' | 'yesterday' | 'last7Days' | 'last30Days' | 'sinceInception';
type OverviewMetrics = {
  users: {
    totalUsers: MetricValue;
    newUsers: MetricGroup;
    recentlyUpdatedProfiles: MetricGroup;
  };
  companies: { totalCompanies: MetricValue };
  jobs: MetricGroup;
  applications: MetricGroup;
  imports: { resumeImports: MetricGroup };
  agents: MetricGroup;
  interviews: MetricGroup;
  calls: MetricGroup;
  status: 'ready' | 'missing-config' | 'error';
};

type UserCompanyAnalytics = {
  status: 'ready' | 'missing-config' | 'error';
  userAnalytics: {
    totalUsers: number;
    newUsers: MetricGroup;
    recentlyUpdatedProfiles: MetricGroup;
    byCompany: Array<{ companyId: string; companyName: string; count: number }>;
    byRole: Array<{ role: string; count: number }>;
    growthTrend: Array<{ period: string; count: number }>;
  };
  companyAnalytics: {
    totalCompanies: number;
    newCompanies: MetricGroup;
    byCompany: Array<{ companyId: string; companyName: string; totalUsers: number; totalJobs: number; totalApplications: number; totalResumeImports: number; totalAiAgents: number; totalInterviews: number; totalCalls: number; }>;
    growthTrend: Array<{ period: string; count: number }>;
  };
};

type ProductUsageMetric = {
  status: 'available' | 'no_data' | 'unavailable';
  reason?: string;
  total?: number;
  byWindow?: MetricGroup;
  trend?: Array<{ period: string; count: number }>;
  byCompany?: Array<{ companyId: string; companyName: string; count: number }>;
  byAgent?: Array<{ companyId: string; companyName: string; count: number }>;
};

type ProductUsageAnalytics = {
  status: 'ready' | 'data-access-pending' | 'missing-config' | 'error';
  metrics: Record<'jobs' | 'applications' | 'resumeImports' | 'campaigns' | 'aiAgents' | 'interviews' | 'calls', ProductUsageMetric>;
};

type HealthSignal = {
  state: 'healthy' | 'warning' | 'critical' | 'unavailable' | 'data-access-pending';
  title: string;
  reason?: string;
  details?: Record<string, number | string>;
};

type SystemHealthAnalytics = {
  status: HealthSignal['state'];
  summary: HealthSignal;
  signals: Record<string, HealthSignal>;
  workflows: Record<string, { reliability: HealthSignal; readiness: HealthSignal; bottleneck: HealthSignal }>;
};

type AbuseAlert = {
  id: string;
  severity: 'info' | 'warning' | 'high';
  signalType: 'high-volume-activity' | 'burst-activity' | 'loophole-signal';
  companyId: string;
  observedActivity: { actionTypes: string[]; count: number; baselineDailyAverage: number; multiplier: number };
  timeWindow: string;
  reason: string;
  recommendedAdminReviewAction: string;
};

type AbuseDetection = {
  status: 'ready' | 'data-access-pending' | 'missing-config' | 'error';
  alerts: AbuseAlert[];
  notes: { thresholds: string; unavailableSignals: string };
};

const timeWindows: Array<{ id: TimeWindowId; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7Days', label: 'Last 7 Days' },
  { id: 'last30Days', label: 'Last 30 Days' },
  { id: 'sinceInception', label: 'Since Inception' },
];

const API_BASE_URL = import.meta.env.VITE_ADMIN_API_URL ?? 'http://localhost:3001';

const fetchWithDevLogin = async (url: string): Promise<Response> => {
  const response = await fetch(url, {
    credentials: 'include',
  });

  if (response.status !== 401) {
    return response;
  }

  const loginResponse = await fetch(`${API_BASE_URL}/api/admin/dev-login`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!loginResponse.ok) {
    return response;
  }

  return fetch(url, {
    credentials: 'include',
  });
};

const fetchOverview = async (): Promise<Response> => fetchWithDevLogin(`${API_BASE_URL}/api/admin/overview`);
const fetchUserCompanyAnalytics = async (): Promise<Response> => fetchWithDevLogin(`${API_BASE_URL}/api/admin/analytics/user-company`);
const fetchProductUsageAnalytics = async (): Promise<Response> => fetchWithDevLogin(`${API_BASE_URL}/api/admin/analytics/product-usage`);
const fetchSystemHealthAnalytics = async (): Promise<Response> => fetchWithDevLogin(`${API_BASE_URL}/api/admin/analytics/system-health`);
const fetchAbuseDetection = async (): Promise<Response> => fetchWithDevLogin(`${API_BASE_URL}/api/admin/analytics/abuse-detection`);

function App() {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [userCompanyMetrics, setUserCompanyMetrics] = useState<UserCompanyAnalytics | null>(null);
  const [productUsageMetrics, setProductUsageMetrics] = useState<ProductUsageAnalytics | null>(null);
  const [systemHealthMetrics, setSystemHealthMetrics] = useState<SystemHealthAnalytics | null>(null);
  const [abuseDetection, setAbuseDetection] = useState<AbuseDetection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedWindow, setSelectedWindow] = useState<TimeWindowId>('last30Days');
  const [isLoading, setIsLoading] = useState(true);
  const [isUserCompanyLoading, setIsUserCompanyLoading] = useState(true);
  const [isProductUsageLoading, setIsProductUsageLoading] = useState(true);
  const [isSystemHealthLoading, setIsSystemHealthLoading] = useState(true);
  const [isAbuseDetectionLoading, setIsAbuseDetectionLoading] = useState(true);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const response = await fetchOverview();
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const nextMetrics = (await response.json()) as OverviewMetrics;
        setMetrics(nextMetrics);
      } catch (loadError) {
        console.error(loadError);
        setError('Unable to load analytics metrics from the admin API. A valid server-side admin session is required.');
      } finally {
        setIsLoading(false);
      }
    };

    const loadUserCompanyMetrics = async () => {
      try {
        const response = await fetchUserCompanyAnalytics();
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const nextMetrics = (await response.json()) as UserCompanyAnalytics;
        setUserCompanyMetrics(nextMetrics);
      } catch (loadError) {
        console.error(loadError);
      } finally {
        setIsUserCompanyLoading(false);
      }
    };

    const loadProductUsageMetrics = async () => {
      try {
        const response = await fetchProductUsageAnalytics();
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const nextMetrics = (await response.json()) as ProductUsageAnalytics;
        setProductUsageMetrics(nextMetrics);
      } catch (loadError) {
        console.error(loadError);
      } finally {
        setIsProductUsageLoading(false);
      }
    };

    const loadSystemHealthMetrics = async () => {
      try {
        const response = await fetchSystemHealthAnalytics();
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const nextMetrics = (await response.json()) as SystemHealthAnalytics;
        setSystemHealthMetrics(nextMetrics);
      } catch (loadError) {
        console.error(loadError);
      } finally {
        setIsSystemHealthLoading(false);
      }
    };

    const loadAbuseDetection = async () => {
      try {
        const response = await fetchAbuseDetection();
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        setAbuseDetection((await response.json()) as AbuseDetection);
      } catch (loadError) {
        console.error(loadError);
      } finally {
        setIsAbuseDetectionLoading(false);
      }
    };

    void loadMetrics();
    void loadUserCompanyMetrics();
    void loadProductUsageMetrics();
    void loadSystemHealthMetrics();
    void loadAbuseDetection();
  }, []);

  const selectedWindowLabel = timeWindows.find((window) => window.id === selectedWindow)?.label;
  const selectedWindowValue = selectedWindow === 'today' ? 'today' : selectedWindow === 'yesterday' ? 'yesterday' : selectedWindow === 'last7Days' ? 'last7Days' : selectedWindow === 'last30Days' ? 'last30Days' : 'sinceInception';
  const stats = metrics ? [
    { label: 'Total Users', value: metrics.users.totalUsers, total: true },
    { label: 'New Users', value: metrics.users.newUsers[selectedWindow] },
    { label: 'Recently Updated Profiles', value: metrics.users.recentlyUpdatedProfiles[selectedWindow] },
    { label: 'Total Companies', value: metrics.companies.totalCompanies, total: true },
    { label: 'Jobs', value: metrics.jobs[selectedWindow] },
    { label: 'Applications', value: metrics.applications[selectedWindow] },
    { label: 'Resume Imports', value: metrics.imports.resumeImports[selectedWindow] },
    { label: 'AI Agents', value: metrics.agents[selectedWindow] },
    { label: 'Interviews', value: metrics.interviews[selectedWindow] },
    { label: 'Calls', value: metrics.calls[selectedWindow] },
  ] : [];

  const hasMetrics = stats.some((stat) => typeof stat.value === 'number' && stat.value > 0);

  return (
    <div className="admin-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">S</div>
          <div>
          <p className="eyebrow">SUPRHIRE ADMIN</p>
            <h1>Overview</h1>
          </div>
        </div>
        <div className="topbar-meta">
          <span className={`status-badge ${metrics?.status ?? 'missing-config'}`}>
            <span className="status-dot" aria-hidden="true" />
            {metrics?.status === 'ready' ? 'Live data' : metrics?.status === 'error' ? 'Read error' : 'Awaiting API'}
          </span>
          <span className="read-only-note">Read-only view</span>
        </div>
      </header>

      <main>
        <section className="intro-row">
          <div>
            <p className="section-kicker">Command center</p>
            <h2>Product intelligence at a glance</h2>
            <p className="intro-copy">Monitor the signals that shape Suprhire&apos;s daily momentum.</p>
          </div>
          <div className="window-control" aria-label="Analytics time window">
            <span className="control-label">Viewing</span>
            <div className="window-options" role="group">
              {timeWindows.map((window) => (
                <button
                  key={window.id}
                  className={selectedWindow === window.id ? 'window-button selected' : 'window-button'}
                  onClick={() => setSelectedWindow(window.id)}
                  type="button"
                >
                  {window.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {error && (
          <div className="state-panel error-state" role="alert">
            <strong>Analytics unavailable</strong>
            <span>{error}</span>
          </div>
        )}

        {isLoading && (
          <div className="state-panel loading-state" aria-live="polite">
            <span className="loader" aria-hidden="true" />
            <span>Loading overview metrics...</span>
          </div>
        )}

        {!isLoading && !error && metrics && !hasMetrics && (
          <div className="state-panel empty-state">
            <strong>No metrics available for this window</strong>
            <span>There is no supported activity to display yet.</span>
          </div>
        )}

        {!isLoading && !error && metrics && hasMetrics && (
          <>
            <div className="metric-heading">
              <h3>Key metrics</h3>
              <span>{selectedWindowLabel}</span>
            </div>
            <section className="stats-grid" aria-label={`${selectedWindowLabel} metrics`}>
              {stats.map((stat, index) => (
                <article key={stat.label} className={`stat-card card-tone-${index % 4}`}>
                  <div className="stat-topline">
                    <span className="stat-icon" aria-hidden="true">{['U', '↗', '◌', 'C', 'J', 'A', 'R', 'AI', 'I', '☎'][index]}</span>
                    <span className="stat-period">{stat.total ? 'All time' : selectedWindowLabel}</span>
                  </div>
                  <div className="stat-label">{stat.label}</div>
                  <div className="stat-value">{stat.value === 'unavailable' ? 'Unavailable' : stat.value.toLocaleString()}</div>
                </article>
              ))}
            </section>
          </>
        )}

        <section className="analytics-section" aria-live="polite">
          <div className="metric-heading">
            <h3>User &amp; Company Analytics</h3>
            <span>{selectedWindowLabel}</span>
          </div>

          {isUserCompanyLoading && (
            <div className="state-panel loading-state" aria-live="polite">
              <span className="loader" aria-hidden="true" />
              <span>Loading user and company analytics...</span>
            </div>
          )}

          {!isUserCompanyLoading && (!userCompanyMetrics || userCompanyMetrics.status === 'error') && (
            <div className="state-panel error-state" role="alert">
              <strong>User &amp; Company analytics unavailable</strong>
              <span>A valid admin session is required to load the user and company breakdowns.</span>
            </div>
          )}

          {!isUserCompanyLoading && userCompanyMetrics && userCompanyMetrics.status !== 'error' && (
            <div className="analytics-grid">
              <article className="analytics-panel">
                <h4>User analytics</h4>
                <div className="mini-grid">
                  <div className="mini-tile">
                    <span>Total users</span>
                    <strong>{userCompanyMetrics.userAnalytics.totalUsers.toLocaleString()}</strong>
                  </div>
                  <div className="mini-tile">
                    <span>New users</span>
                    <strong>{userCompanyMetrics.userAnalytics.newUsers[selectedWindowValue].toLocaleString()}</strong>
                  </div>
                  <div className="mini-tile">
                    <span>Recently updated</span>
                    <strong>{userCompanyMetrics.userAnalytics.recentlyUpdatedProfiles[selectedWindowValue].toLocaleString()}</strong>
                  </div>
                </div>

                <div className="breakdown-block">
                  <h5>Users by company</h5>
                  {userCompanyMetrics.userAnalytics.byCompany.length === 0 ? (
                    <p>No company distribution available.</p>
                  ) : (
                    <ul>{userCompanyMetrics.userAnalytics.byCompany.slice(0, 8).map((entry) => (
                      <li key={entry.companyId}><span>{entry.companyName}</span><strong>{entry.count}</strong></li>
                    ))}</ul>
                  )}
                </div>

                <div className="breakdown-block">
                  <h5>Users by role</h5>
                  {userCompanyMetrics.userAnalytics.byRole.length === 0 ? (
                    <p>No role distribution available.</p>
                  ) : (
                    <ul>{userCompanyMetrics.userAnalytics.byRole.slice(0, 8).map((entry) => (
                      <li key={entry.role}><span>{entry.role}</span><strong>{entry.count}</strong></li>
                    ))}</ul>
                  )}
                </div>

                <div className="breakdown-block">
                  <h5>Growth trend</h5>
                  {userCompanyMetrics.userAnalytics.growthTrend.length === 0 ? (
                    <p>No growth trend data.</p>
                  ) : (
                    <ul>{userCompanyMetrics.userAnalytics.growthTrend.slice(-6).map((entry) => (
                      <li key={entry.period}><span>{entry.period}</span><strong>{entry.count}</strong></li>
                    ))}</ul>
                  )}
                </div>
              </article>

              <article className="analytics-panel">
                <h4>Company analytics</h4>
                <div className="mini-grid">
                  <div className="mini-tile">
                    <span>Total companies</span>
                    <strong>{userCompanyMetrics.companyAnalytics.totalCompanies.toLocaleString()}</strong>
                  </div>
                  <div className="mini-tile">
                    <span>New companies</span>
                    <strong>{userCompanyMetrics.companyAnalytics.newCompanies[selectedWindowValue].toLocaleString()}</strong>
                  </div>
                  <div className="mini-tile">
                    <span>Active company records</span>
                    <strong>{userCompanyMetrics.companyAnalytics.byCompany.length.toLocaleString()}</strong>
                  </div>
                </div>

                <div className="breakdown-block">
                  <h5>Company activity</h5>
                  {userCompanyMetrics.companyAnalytics.byCompany.length === 0 ? (
                    <p>No company activity rows available.</p>
                  ) : (
                    <ul>{userCompanyMetrics.companyAnalytics.byCompany.slice(0, 8).map((entry) => (
                      <li key={entry.companyId}><span>{entry.companyName}</span><strong>{entry.totalUsers + entry.totalJobs + entry.totalApplications + entry.totalResumeImports + entry.totalAiAgents + entry.totalInterviews + entry.totalCalls}</strong></li>
                    ))}</ul>
                  )}
                </div>

                <div className="breakdown-block">
                  <h5>By company detail</h5>
                  {userCompanyMetrics.companyAnalytics.byCompany.length === 0 ? (
                    <p>No company-level usage available.</p>
                  ) : (
                    <ul>{userCompanyMetrics.companyAnalytics.byCompany.slice(0, 8).map((entry) => (
                      <li key={`${entry.companyId}-detail`} className="detail-list-item">
                        <span>{entry.companyName}</span>
                        <small>Users {entry.totalUsers} · Jobs {entry.totalJobs} · Apps {entry.totalApplications} · Imports {entry.totalResumeImports} · Agents {entry.totalAiAgents} · Interviews {entry.totalInterviews} · Calls {entry.totalCalls}</small>
                      </li>
                    ))}</ul>
                  )}
                </div>

                <div className="breakdown-block">
                  <h5>Company growth trend</h5>
                  {userCompanyMetrics.companyAnalytics.growthTrend.length === 0 ? (
                    <p>No company growth trend data.</p>
                  ) : (
                    <ul>{userCompanyMetrics.companyAnalytics.growthTrend.slice(-6).map((entry) => (
                      <li key={entry.period}><span>{entry.period}</span><strong>{entry.count}</strong></li>
                    ))}</ul>
                  )}
                </div>
              </article>
            </div>
          )}
        </section>

        <section className="analytics-section" aria-live="polite">
          <div className="metric-heading">
            <h3>Product Usage Analytics</h3>
            <span>{selectedWindowLabel}</span>
          </div>

          {isProductUsageLoading && (
            <div className="state-panel loading-state" aria-live="polite">
              <span className="loader" aria-hidden="true" />
              <span>Loading product usage analytics...</span>
            </div>
          )}

          {!isProductUsageLoading && (!productUsageMetrics || productUsageMetrics.status === 'error') && (
            <div className="state-panel error-state" role="alert">
              <strong>Product usage analytics unavailable</strong>
              <span>The admin API did not return a usable product usage response.</span>
            </div>
          )}

          {!isProductUsageLoading && productUsageMetrics && productUsageMetrics.status !== 'error' && (
            <div className="usage-grid">
              {([
                ['jobs', 'Jobs'],
                ['applications', 'Applications'],
                ['resumeImports', 'Resume Imports'],
                ['campaigns', 'Campaigns'],
                ['aiAgents', 'AI Agents'],
                ['interviews', 'Interviews'],
                ['calls', 'Calls'],
              ] as const).map(([key, label]) => {
                const metric = productUsageMetrics.metrics[key];
                return (
                  <article className="usage-panel" key={key}>
                    <div className="usage-panel-heading">
                      <h4>{label}</h4>
                      <span className={`usage-status ${metric.status}`}>{metric.status === 'available' ? 'Available' : metric.status === 'no_data' ? 'No data' : 'Unavailable'}</span>
                    </div>
                    {metric.status === 'available' && metric.byWindow && (
                      <div className="mini-grid">
                        <div className="mini-tile"><span>Total</span><strong>{metric.total?.toLocaleString()}</strong></div>
                        <div className="mini-tile"><span>{selectedWindowLabel}</span><strong>{metric.byWindow[selectedWindowValue].toLocaleString()}</strong></div>
                      </div>
                    )}
                    {metric.status === 'available' && metric.trend && (
                      <div className="breakdown-block">
                        <h5>Creation trend</h5>
                        <ul>{metric.trend.slice(-6).map((point) => <li key={point.period}><span>{point.period}</span><strong>{point.count}</strong></li>)}</ul>
                      </div>
                    )}
                    {metric.status === 'available' && metric.byCompany && (
                      <div className="breakdown-block">
                        <h5>By company</h5>
                        {metric.byCompany.length === 0 ? <p>No company attribution available.</p> : <ul>{metric.byCompany.slice(0, 6).map((company) => <li key={company.companyId}><span>{company.companyName}</span><strong>{company.count}</strong></li>)}</ul>}
                      </div>
                    )}
                    {metric.status === 'available' && metric.byAgent && (
                      <div className="breakdown-block">
                        <h5>Campaigns by agent</h5>
                        {metric.byAgent.length === 0 ? <p>No agent attribution available.</p> : <ul>{metric.byAgent.slice(0, 6).map((agent) => <li key={agent.companyId}><span>{agent.companyName}</span><strong>{agent.count}</strong></li>)}</ul>}
                      </div>
                    )}
                    {metric.status !== 'available' && <p className="unavailable-copy">{metric.reason ?? 'The underlying data is not available through the current read-only access path.'}</p>}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="analytics-section" aria-live="polite">
          <div className="metric-heading">
            <h3>System Health &amp; Readiness</h3>
            <span>No fabricated health score</span>
          </div>

          {isSystemHealthLoading && (
            <div className="state-panel loading-state" aria-live="polite">
              <span className="loader" aria-hidden="true" />
              <span>Loading system health signals...</span>
            </div>
          )}

          {!isSystemHealthLoading && !systemHealthMetrics && (
            <div className="state-panel error-state" role="alert">
              <strong>System health unavailable</strong>
              <span>The admin API did not return a health response.</span>
            </div>
          )}

          {!isSystemHealthLoading && systemHealthMetrics && (
            <>
              <div className={`health-summary ${systemHealthMetrics.status}`}>
                <strong>{systemHealthMetrics.summary.title}</strong>
                <span>{systemHealthMetrics.summary.reason ?? 'Health state is based only on persisted workflow fields.'}</span>
              </div>
              <div className="health-signal-grid">
                {Object.values(systemHealthMetrics.signals).map((signal) => (
                  <article className="health-signal" key={signal.title}>
                    <div className="usage-panel-heading">
                      <h4>{signal.title}</h4>
                      <span className={`usage-status ${signal.state}`}>{signal.state.replaceAll('-', ' ')}</span>
                    </div>
                    <p>{signal.reason ?? 'Supported persisted data is available for this signal.'}</p>
                  </article>
                ))}
              </div>
              <div className="health-workflow-grid">
                {Object.entries(systemHealthMetrics.workflows).map(([workflowName, workflow]) => (
                  <article className="usage-panel" key={workflowName}>
                    <h4>{workflowName.replace(/([A-Z])/g, ' $1')}</h4>
                    {[workflow.reliability, workflow.readiness, workflow.bottleneck].map((signal) => (
                      <div className="health-row" key={signal.title}>
                        <span>{signal.title}</span>
                        <strong className={`usage-status ${signal.state}`}>{signal.state.replaceAll('-', ' ')}</strong>
                        {signal.reason && <small>{signal.reason}</small>}
                      </div>
                    ))}
                  </article>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="analytics-section abuse-section" aria-live="polite">
          <div className="metric-heading">
            <h3>Abuse &amp; Loophole Detection</h3>
            <span>Review signals only</span>
          </div>

          {isAbuseDetectionLoading && (
            <div className="state-panel loading-state" aria-live="polite">
              <span className="loader" aria-hidden="true" />
              <span>Checking supported usage signals...</span>
            </div>
          )}

          {!isAbuseDetectionLoading && !abuseDetection && (
            <div className="state-panel error-state" role="alert">
              <strong>Detection unavailable</strong>
              <span>The admin API did not return an abuse detection response.</span>
            </div>
          )}

          {!isAbuseDetectionLoading && abuseDetection?.status === 'missing-config' && (
            <div className="state-panel unavailable-state">
              <strong>Data access unavailable</strong>
              <span>Read-only Supabase configuration is missing. No signals were generated.</span>
            </div>
          )}

          {!isAbuseDetectionLoading && abuseDetection?.status === 'data-access-pending' && (
            <div className="state-panel unavailable-state">
              <strong>Data access pending</strong>
              <span>Readable rows were not available across the supported activity sources, possibly because of RLS visibility. No alerts were generated from zero rows.</span>
            </div>
          )}

          {!isAbuseDetectionLoading && abuseDetection?.status === 'ready' && abuseDetection.alerts.length === 0 && (
            <div className="state-panel empty-state">
              <strong>No supported review signals detected</strong>
              <span>Available company activity did not meet the documented review heuristic. This is not a fraud determination.</span>
            </div>
          )}

          {!isAbuseDetectionLoading && abuseDetection?.status === 'ready' && abuseDetection.alerts.length > 0 && (
            <>
              <div className="abuse-review-banner"><strong>Signals require admin review.</strong><span>These observations are not confirmed abuse, fraud, or automation.</span></div>
              <div className="abuse-grid">
                {abuseDetection.alerts.map((alert) => (
                  <article className="abuse-card" key={alert.id}>
                    <div className="usage-panel-heading">
                      <h4>{alert.signalType.replaceAll('-', ' ')}</h4>
                      <span className={`usage-status ${alert.severity}`}>{alert.severity}</span>
                    </div>
                    <p className="abuse-evidence">{alert.reason}</p>
                    <div className="abuse-facts">
                      <span>Observed <strong>{alert.observedActivity.count.toLocaleString()}</strong> actions</span>
                      <span>Baseline <strong>{alert.observedActivity.baselineDailyAverage.toLocaleString()}</strong>/day</span>
                      <span>Rate <strong>{alert.observedActivity.multiplier}x</strong></span>
                    </div>
                    <small>{alert.timeWindow}</small>
                    <p className="abuse-action"><strong>Review action:</strong> {alert.recommendedAdminReviewAction}</p>
                  </article>
                ))}
              </div>
              <p className="abuse-method">{abuseDetection.notes.thresholds}</p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
