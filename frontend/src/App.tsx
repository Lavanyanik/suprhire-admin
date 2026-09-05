import { useEffect, useState } from 'react';
import './App.css';

type MetricValue = number | 'unavailable';
type MetricGroup = Record<'total' | 'today' | 'yesterday' | 'last7Days' | 'last30Days' | 'sinceInception', MetricValue>;
type TimeWindowId = 'today' | 'yesterday' | 'last7Days' | 'last30Days' | 'sinceInception';
type OverviewMetrics = {
  users: { totalUsers: MetricValue; newUsers: MetricGroup; recentlyUpdatedProfiles: MetricGroup };
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
    byCompany: Array<{ companyId: string; companyName: string; totalUsers: number; totalJobs: number; totalApplications: number; totalResumeImports: number; totalAiAgents: number; totalInterviews: number; totalCalls: number }>;
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
type ProductUsageKey = 'jobs' | 'applications' | 'resumeImports' | 'campaigns' | 'aiAgents' | 'interviews' | 'calls';
type ProductUsageAnalytics = { status: 'ready' | 'data-access-pending' | 'missing-config' | 'error'; metrics: Record<ProductUsageKey, ProductUsageMetric> };

type HealthSignal = { state: 'healthy' | 'warning' | 'critical' | 'unavailable' | 'data-access-pending'; title: string; reason?: string; details?: Record<string, number | string> };
type SystemHealthAnalytics = { status: HealthSignal['state']; summary: HealthSignal; signals: Record<string, HealthSignal>; workflows: Record<string, { reliability: HealthSignal; readiness: HealthSignal; bottleneck: HealthSignal }> };
type AbuseAlert = { id: string; severity: 'info' | 'warning' | 'high'; signalType: 'high-volume-activity' | 'burst-activity' | 'loophole-signal'; companyId: string; observedActivity: { actionTypes: string[]; count: number; baselineDailyAverage: number; multiplier: number }; timeWindow: string; reason: string; recommendedAdminReviewAction: string };
type AbuseDetection = { status: 'ready' | 'data-access-pending' | 'missing-config' | 'error'; alerts: AbuseAlert[]; notes: { thresholds: string; unavailableSignals: string } };
type GrowthMetric = { status: 'available' | 'unavailable'; total: number; monthly: Array<{ period: string; count: number }>; currentMonth: number; previousMonth: number; monthOverMonthGrowthPercent: number | null };
type GrowthKey = 'users' | 'companies' | 'jobs' | 'applications' | 'resumeImports' | 'aiAgents' | 'interviews' | 'calls';
type GrowthAnalytics = { status: 'ready' | 'data-access-pending' | 'missing-config' | 'error'; metrics: Record<GrowthKey, GrowthMetric> };
type DailySummary = {
  status: 'ready' | 'data-access-pending' | 'missing-config' | 'error' | 'unavailable'; generatedAt: string;
  health: { status: string; highlights: Array<Record<string, unknown>> };
  abuse: { status: string; totalSignals: number; highSeveritySignals: number; highlights: Array<Record<string, unknown>> };
  usageChanges: { status: string; highlights: Array<Record<string, unknown>> };
  growthHighlights: { status: string; highlights: Array<Record<string, unknown>> };
  dataAccess: { issues: Array<{ source: string; status: string; detail: string }> };
  summary: { headline: string; highlights: Array<Record<string, unknown>> };
};

const timeWindows: Array<{ id: TimeWindowId; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7Days', label: 'Last 7 days' },
  { id: 'last30Days', label: 'Last 30 days' },
  { id: 'sinceInception', label: 'Since inception' },
];
const navItems = [
  ['overview', 'Overview', 'OV'], ['users', 'Users & Companies', 'UC'], ['usage', 'Product Usage', 'PU'],
  ['health', 'System Health', 'SH'], ['abuse', 'Abuse & Loopholes', 'AL'], ['growth', 'Growth', 'GR'], ['summary', 'Daily Summary', 'DS'],
] as const;
const API_BASE_URL = import.meta.env.VITE_ADMIN_API_URL ?? 'http://localhost:3001';

const fetchWithDevLogin = async (url: string): Promise<Response> => {
  const response = await fetch(url, { credentials: 'include' });
  if (response.status !== 401) return response;
  const loginResponse = await fetch(`${API_BASE_URL}/api/admin/dev-login`, { method: 'POST', credentials: 'include' });
  if (!loginResponse.ok) return response;
  return fetch(url, { credentials: 'include' });
};
const endpoint = (path: string) => () => fetchWithDevLogin(`${API_BASE_URL}${path}`);
const fetchOverview = endpoint('/api/admin/overview');
const fetchUserCompanyAnalytics = endpoint('/api/admin/analytics/user-company');
const fetchProductUsageAnalytics = endpoint('/api/admin/analytics/product-usage');
const fetchSystemHealthAnalytics = endpoint('/api/admin/analytics/system-health');
const fetchAbuseDetection = endpoint('/api/admin/analytics/abuse-detection');
const fetchGrowthAnalytics = endpoint('/api/admin/analytics/growth');
const fetchDailySummary = endpoint('/api/admin/analytics/daily-summary');

const formatValue = (value: MetricValue | number | undefined) => value === 'unavailable' || value === undefined ? 'Unavailable' : value.toLocaleString();
const labelize = (value: string) => value.replaceAll('-', ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
const statusLabel = (value: string) => value === 'no_data' ? 'No data' : labelize(value);
const shortenAgentId = (value: string) => value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
const presentationStatusLabel = (status: string) => status === 'data-access-pending'
  ? 'Insufficient data'
  : status === 'unavailable'
    ? 'Data unavailable'
    : statusLabel(status);

function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <span className={`status-badge status-${status.replaceAll('_', '-')}`}><span className="status-dot" aria-hidden="true" />{label ?? presentationStatusLabel(status)}</span>;
}

function StatePanel({ type, title, children }: { type: 'loading' | 'error' | 'empty' | 'unavailable'; title: string; children: string }) {
  return <div className={`state-panel state-${type}`} role={type === 'error' ? 'alert' : undefined}>{type === 'loading' && <span className="loader" aria-hidden="true" />}<strong>{title}</strong><span>{children}</span></div>;
}

function SectionHeader({ eyebrow, title, detail }: { eyebrow: string; title: string; detail?: string }) {
  return <div className="section-header"><div><span className="section-eyebrow">{eyebrow}</span><h2>{title}</h2></div>{detail && <span className="section-detail">{detail}</span>}</div>;
}

function Sparkline({ values, accent = 'cyan' }: { values: number[]; accent?: 'cyan' | 'lime' | 'amber' }) {
  const max = Math.max(...values, 1);
  return <div className={`sparkline spark-${accent}`} aria-label="Trend visualization">{values.map((value, index) => <span key={`${index}-${value}`} style={{ height: `${Math.max(10, (value / max) * 100)}%` }} />)}</div>;
}

function MetricCard({ label, value, context, icon, accent = 'cyan' }: { label: string; value: MetricValue | number; context: string; icon: string; accent?: 'cyan' | 'lime' | 'amber' }) {
  return <article className={`metric-card accent-${accent}`}><div className="metric-card-top"><span className="metric-icon" aria-hidden="true">{icon}</span><span className="metric-context">{context}</span></div><span className="metric-label">{label}</span><strong className="metric-value">{formatValue(value)}</strong></article>;
}

function EmptyRows({ children }: { children: string }) { return <p className="empty-copy">{children}</p>; }

function App() {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [userCompanyMetrics, setUserCompanyMetrics] = useState<UserCompanyAnalytics | null>(null);
  const [productUsageMetrics, setProductUsageMetrics] = useState<ProductUsageAnalytics | null>(null);
  const [systemHealthMetrics, setSystemHealthMetrics] = useState<SystemHealthAnalytics | null>(null);
  const [abuseDetection, setAbuseDetection] = useState<AbuseDetection | null>(null);
  const [growthAnalytics, setGrowthAnalytics] = useState<GrowthAnalytics | null>(null);
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedWindow, setSelectedWindow] = useState<TimeWindowId>('last30Days');
  const [activeSection, setActiveSection] = useState('overview');
  const [showAllAgents, setShowAllAgents] = useState(false);
  const [loading, setLoading] = useState({ overview: true, users: true, usage: true, health: true, abuse: true, growth: true, summary: true });

  useEffect(() => {
    const load = async <T,>(request: () => Promise<Response>, setData: (value: T) => void, key: keyof typeof loading, showError = false) => {
      try {
        const response = await request();
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        setData((await response.json()) as T);
      } catch (loadError) {
        console.error(loadError);
        if (showError) setError('Unable to load analytics metrics from the admin API. A valid server-side admin session is required.');
      } finally {
        setLoading((current) => ({ ...current, [key]: false }));
      }
    };
    void load<OverviewMetrics>(fetchOverview, setMetrics, 'overview', true);
    void load<UserCompanyAnalytics>(fetchUserCompanyAnalytics, setUserCompanyMetrics, 'users');
    void load<ProductUsageAnalytics>(fetchProductUsageAnalytics, setProductUsageMetrics, 'usage');
    void load<SystemHealthAnalytics>(fetchSystemHealthAnalytics, setSystemHealthMetrics, 'health');
    void load<AbuseDetection>(fetchAbuseDetection, setAbuseDetection, 'abuse');
    void load<GrowthAnalytics>(fetchGrowthAnalytics, setGrowthAnalytics, 'growth');
    void load<DailySummary>(fetchDailySummary, setDailySummary, 'summary');
  }, []);

  const selectedWindowLabel = timeWindows.find((window) => window.id === selectedWindow)?.label ?? 'Last 30 days';
  const stats = metrics ? [
    ['Total Users', metrics.users.totalUsers, 'All accounts', 'US', 'cyan'], ['New Users', metrics.users.newUsers[selectedWindow], selectedWindowLabel, 'NW', 'lime'],
    ['Total Companies', metrics.companies.totalCompanies, 'All companies', 'CO', 'amber'], ['Jobs', metrics.jobs[selectedWindow], selectedWindowLabel, 'JB', 'cyan'],
    ['Applications', metrics.applications[selectedWindow], selectedWindowLabel, 'AP', 'lime'], ['Resume Imports', metrics.imports.resumeImports[selectedWindow], selectedWindowLabel, 'RI', 'amber'],
    ['AI Agents', metrics.agents[selectedWindow], selectedWindowLabel, 'AI', 'cyan'], ['Interviews', metrics.interviews[selectedWindow], selectedWindowLabel, 'IN', 'lime'], ['Calls', metrics.calls[selectedWindow], selectedWindowLabel, 'CA', 'amber'],
  ] as const : [];
  const hasMetrics = stats.some((stat) => typeof stat[1] === 'number' && stat[1] > 0);
  const navigate = (id: string) => { setActiveSection(id); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  return <div className="app-frame">
    <aside className="sidebar"><div className="brand"><span className="brand-mark">S</span><div><strong>suprhire</strong><span>admin console</span></div></div><div className="sidebar-label">Workspace</div><nav aria-label="Admin sections">{navItems.map(([id, label, icon]) => <button className={activeSection === id ? 'nav-item active' : 'nav-item'} onClick={() => navigate(id)} key={id} type="button"><span className="nav-icon">{icon}</span><span>{label}</span>{activeSection === id && <span className="nav-active" />}</button>)}</nav><div className="sidebar-footer"><span className="live-pulse" /><div><strong>Connected</strong><span>Supabase read-only</span></div></div></aside>
    <div className="main-column"><header className="topbar"><div className="topbar-title"><span className="topbar-kicker">Suprhire Admin / Analytics</span><h1>Overview</h1></div><div className="topbar-meta"><span className={`live-chip ${metrics?.status === 'ready' ? 'is-live' : ''}`}><span className="status-dot" />{metrics?.status === 'ready' ? 'Live data' : 'Awaiting API'}</span><span className="readonly-chip"><span className="lock-icon">RO</span> Read-only view</span><span className="avatar">SA</span></div></header>
      <main className="content-area">
        <section className="hero-row" id="overview"><div><span className="section-eyebrow">Command center</span><h2>Good morning, admin.</h2><p>Monitor the signals shaping Suprhire&apos;s daily momentum.</p></div><div className="period-picker"><span>Reporting period</span><div className="segmented-control" role="group" aria-label="Analytics time window">{timeWindows.map((window) => <button className={selectedWindow === window.id ? 'selected' : ''} onClick={() => setSelectedWindow(window.id)} type="button" key={window.id}>{window.label}</button>)}</div></div></section>
        {error && <StatePanel type="error" title="Analytics unavailable">{error}</StatePanel>}
        {loading.overview && <StatePanel type="loading" title="Loading overview metrics...">Connecting to the admin data layer.</StatePanel>}
        {!loading.overview && !error && metrics && !hasMetrics && <StatePanel type="empty" title="No metrics available for this window">There is no supported activity to display yet.</StatePanel>}
        {!loading.overview && !error && metrics && hasMetrics && <section className="overview-block"><SectionHeader eyebrow="At a glance" title="Key metrics" detail={selectedWindowLabel} /><div className="metric-grid">{stats.map(([label, value, context, icon, accent]) => <MetricCard key={label} label={label} value={value} context={context} icon={icon} accent={accent} />)}</div></section>}

        <section className="dashboard-section" id="users"><SectionHeader eyebrow="People and accounts" title="Users & Companies" detail={selectedWindowLabel} />{loading.users && <StatePanel type="loading" title="Loading user and company analytics...">Preparing account breakdowns.</StatePanel>}{!loading.users && (!userCompanyMetrics || userCompanyMetrics.status === 'error') && <StatePanel type="error" title="User & Company analytics unavailable">A valid admin session is required to load the user and company breakdowns.</StatePanel>}{!loading.users && userCompanyMetrics && userCompanyMetrics.status !== 'error' && <div className="analytics-layout">
          <article className="surface-card"><div className="card-heading"><div><span className="card-kicker">User analytics</span><h3>Account activity</h3></div><span className="card-index">01</span></div><div className="mini-stat-grid"><div><span>Total users</span><strong>{userCompanyMetrics.userAnalytics.totalUsers.toLocaleString()}</strong></div><div><span>New users</span><strong>{formatValue(userCompanyMetrics.userAnalytics.newUsers[selectedWindow])}</strong></div><div><span>Recently updated</span><strong>{formatValue(userCompanyMetrics.userAnalytics.recentlyUpdatedProfiles[selectedWindow])}</strong></div></div><div className="split-insight"><div><div className="subsection-title"><span>Users by company</span><span>Count</span></div>{userCompanyMetrics.userAnalytics.byCompany.length === 0 ? <EmptyRows>No company distribution available.</EmptyRows> : <div className="rank-list">{userCompanyMetrics.userAnalytics.byCompany.slice(0, 7).map((entry, index) => <div className="rank-row" key={entry.companyId}><span className="rank-number">0{index + 1}</span><span className="rank-name">{entry.companyName}</span><span className="rank-value">{entry.count.toLocaleString()}</span><span className="rank-bar"><i style={{ width: `${Math.min(100, (entry.count / Math.max(userCompanyMetrics.userAnalytics.byCompany[0]?.count ?? 1, 1)) * 100)}%` }} /></span></div>)}</div>}</div><div><div className="subsection-title"><span>Users by role</span><span>Count</span></div>{userCompanyMetrics.userAnalytics.byRole.length === 0 ? <EmptyRows>No role distribution available.</EmptyRows> : <div className="role-list">{userCompanyMetrics.userAnalytics.byRole.slice(0, 6).map((entry) => <div className="role-row" key={entry.role}><div><span>{entry.role}</span><strong>{entry.count.toLocaleString()}</strong></div><span className="role-bar"><i style={{ width: `${Math.min(100, (entry.count / Math.max(userCompanyMetrics.userAnalytics.byRole[0]?.count ?? 1, 1)) * 100)}%` }} /></span></div>)}</div>}</div></div><div className="trend-strip"><div><span className="subsection-title">User growth trend</span><Sparkline values={userCompanyMetrics.userAnalytics.growthTrend.slice(-8).map((entry) => entry.count)} /></div><div className="trend-labels">{userCompanyMetrics.userAnalytics.growthTrend.slice(-4).map((entry) => <span key={entry.period}>{entry.period}</span>)}</div></div></article>
          <article className="surface-card company-card"><div className="card-heading"><div><span className="card-kicker">Company analytics</span><h3>Company activity</h3></div><span className="card-index">02</span></div><div className="mini-stat-grid"><div><span>Total companies</span><strong>{userCompanyMetrics.companyAnalytics.totalCompanies.toLocaleString()}</strong></div><div><span>New companies</span><strong>{formatValue(userCompanyMetrics.companyAnalytics.newCompanies[selectedWindow])}</strong></div><div><span>Active records</span><strong>{userCompanyMetrics.companyAnalytics.byCompany.length.toLocaleString()}</strong></div></div>{userCompanyMetrics.companyAnalytics.byCompany.length === 0 ? <EmptyRows>No company activity rows available.</EmptyRows> : <div className="table-wrap compact-table"><table><thead><tr><th>Company</th><th>Activity</th></tr></thead><tbody>{userCompanyMetrics.companyAnalytics.byCompany.slice(0, 7).map((entry) => <tr key={entry.companyId}><td><span className="company-avatar">{entry.companyName.slice(0, 1).toUpperCase()}</span>{entry.companyName}</td><td className="number-cell">{(entry.totalUsers + entry.totalJobs + entry.totalApplications + entry.totalResumeImports + entry.totalAiAgents + entry.totalInterviews + entry.totalCalls).toLocaleString()}</td></tr>)}</tbody></table></div>}<div className="trend-strip"><div><span className="subsection-title">Company growth trend</span><Sparkline values={userCompanyMetrics.companyAnalytics.growthTrend.slice(-8).map((entry) => entry.count)} accent="lime" /></div></div></article>
          <article className="surface-card full-width"><div className="card-heading"><div><span className="card-kicker">Attribution matrix</span><h3>Company details</h3></div><span className="muted-note">Top 8 records</span></div>{userCompanyMetrics.companyAnalytics.byCompany.length === 0 ? <EmptyRows>No company-level usage available.</EmptyRows> : <div className="table-wrap"><table><thead><tr><th>Company</th><th>Users</th><th>Jobs</th><th>Applications</th><th>Imports</th><th>Agents</th><th>Interviews</th><th>Calls</th></tr></thead><tbody>{userCompanyMetrics.companyAnalytics.byCompany.slice(0, 8).map((entry) => <tr key={`${entry.companyId}-detail`}><td><span className="company-avatar">{entry.companyName.slice(0, 1).toUpperCase()}</span>{entry.companyName}</td><td>{entry.totalUsers}</td><td>{entry.totalJobs}</td><td>{entry.totalApplications}</td><td>{entry.totalResumeImports}</td><td>{entry.totalAiAgents}</td><td>{entry.totalInterviews}</td><td>{entry.totalCalls}</td></tr>)}</tbody></table></div>}</article>
        </div>}</section>

        <section className="dashboard-section" id="usage"><SectionHeader eyebrow="Product intelligence" title="Product Usage" detail={selectedWindowLabel} />{loading.usage && <StatePanel type="loading" title="Loading product usage analytics...">Preparing usage cards and attribution.</StatePanel>}{!loading.usage && (!productUsageMetrics || productUsageMetrics.status === 'error') && <StatePanel type="error" title="Product usage analytics unavailable">The admin API did not return a usable product usage response.</StatePanel>}{!loading.usage && productUsageMetrics && productUsageMetrics.status !== 'error' && <div className="usage-grid">{([['jobs', 'Jobs', 'JB'], ['applications', 'Applications', 'AP'], ['resumeImports', 'Resume Imports', 'RI'], ['campaigns', 'Campaigns', 'CA'], ['aiAgents', 'AI Agents', 'AI'], ['interviews', 'Interviews', 'IN'], ['calls', 'Calls', 'CL']] as const).map(([key, label, icon]) => { const metric = productUsageMetrics.metrics[key]; const trend = metric.trend?.slice(-8).map((point) => point.count) ?? []; return <article className="surface-card usage-card" key={key}><div className="card-heading"><div className="usage-title"><span className="metric-icon small">{icon}</span><div><span className="card-kicker">Usage signal</span><h3>{label}</h3></div></div><StatusBadge status={metric.status} /></div>{metric.status === 'available' && metric.byWindow ? <><div className="usage-numbers"><div><span>Total</span><strong>{formatValue(metric.total)}</strong></div><div><span>{selectedWindowLabel}</span><strong>{formatValue(metric.byWindow[selectedWindow])}</strong></div></div><Sparkline values={trend} accent={key === 'campaigns' ? 'amber' : 'cyan'} />{metric.byCompany && <div className="usage-breakdown"><div className="subsection-title"><span>Company breakdown</span><span>Count</span></div>{metric.byCompany.length === 0 ? <EmptyRows>No company attribution available.</EmptyRows> : metric.byCompany.slice(0, 4).map((company) => <div className="breakdown-row" key={company.companyId}><span>{company.companyName}</span><strong>{company.count.toLocaleString()}</strong></div>)}</div>}{metric.byAgent && <div className="usage-breakdown"><div className="subsection-title"><span>Campaigns by Agent ID</span><span>Count</span></div>{metric.byAgent.length === 0 ? <EmptyRows>No agent attribution available.</EmptyRows> : <>{metric.byAgent.slice(0, showAllAgents ? metric.byAgent.length : 4).map((agent) => <div className="breakdown-row" key={agent.companyId}><span>{shortenAgentId(agent.companyName)}</span><strong>{agent.count.toLocaleString()}</strong></div>)}{metric.byAgent.length > 4 && <button className="usage-view-all" onClick={() => setShowAllAgents((current) => !current)} type="button">{showAllAgents ? 'Show less' : `View all (${metric.byAgent.length})`}</button>}</>}</div>}</> : <div className="unavailable-block"><span className="empty-glyph">--</span><p>{metric.reason ?? 'The underlying data is not available through the current read-only access path.'}</p></div>}</article>; })}</div>}</section>

        <section className="dashboard-section" id="health"><SectionHeader eyebrow="Operations" title="System Health" detail="No fabricated health score" />{loading.health && <StatePanel type="loading" title="Loading system health signals...">Reading persisted workflow fields.</StatePanel>}{!loading.health && !systemHealthMetrics && <StatePanel type="error" title="System health unavailable">The admin API did not return a health response.</StatePanel>}{!loading.health && systemHealthMetrics && <><div className={`health-banner health-${systemHealthMetrics.status}`}><div className="health-banner-icon">{systemHealthMetrics.status === 'healthy' ? 'OK' : '!'}</div><div><strong>{systemHealthMetrics.summary.title}</strong><p>{systemHealthMetrics.summary.reason ?? 'Health state is based only on persisted workflow fields.'}</p></div><StatusBadge status={systemHealthMetrics.status} /></div><div className="health-signal-grid">{Object.values(systemHealthMetrics.signals).map((signal) => <article className="surface-card health-signal" key={signal.title}><div className="card-heading"><h3>{signal.title}</h3><StatusBadge status={signal.state} /></div><p>{signal.reason ?? 'Supported persisted data is available for this signal.'}</p></article>)}</div><div className="workflow-grid">{(['applications', 'resumeImports', 'aiAgents', 'interviews', 'calls', 'jobs', 'campaigns'] as const).map((workflowName) => { const workflow = systemHealthMetrics.workflows[workflowName]; return <article className="surface-card workflow-card" key={workflowName}><div className="card-heading"><h3>{labelize(workflowName)}</h3><span className="workflow-mark">WF</span></div>{workflow ? [workflow.reliability, workflow.readiness, workflow.bottleneck].map((signal) => <div className="workflow-row" key={signal.title}><span>{signal.title}</span><StatusBadge status={signal.state} />{signal.reason && <small>{signal.reason}</small>}</div>) : <div className="unavailable-block"><p>No verified workflow signal available.</p></div>}</article>; })}</div></>}</section>

        <section className="dashboard-section" id="growth"><SectionHeader eyebrow="Momentum" title="Growth Analytics" detail="Monthly trends / no growth score" />{loading.growth && <StatePanel type="loading" title="Loading growth analytics...">Calculating month-over-month trends.</StatePanel>}{!loading.growth && !growthAnalytics && <StatePanel type="error" title="Growth analytics unavailable">The admin API did not return a growth response.</StatePanel>}{!loading.growth && growthAnalytics && growthAnalytics.status !== 'ready' && <StatePanel type={growthAnalytics.status === 'error' ? 'error' : 'unavailable'} title={`Growth data ${statusLabel(growthAnalytics.status)}`}>{growthAnalytics.status === 'data-access-pending' ? 'One or more supported sources returned no readable rows. No zero-growth conclusion is reported.' : growthAnalytics.status === 'missing-config' ? 'Read-only Supabase configuration is missing. No growth metrics were generated.' : 'A supported growth source could not be read.'}</StatePanel>}{!loading.growth && growthAnalytics?.status === 'ready' && <div className="growth-grid">{([['users', 'New Users'], ['companies', 'New Companies'], ['jobs', 'Jobs'], ['applications', 'Applications'], ['resumeImports', 'Resume Imports'], ['aiAgents', 'AI Agents'], ['interviews', 'Interviews'], ['calls', 'Screening Calls']] as const).map(([key, label]) => { const metric = growthAnalytics.metrics[key]; const growth = metric.monthOverMonthGrowthPercent; return <article className="surface-card growth-card" key={key}><div className="card-heading"><div><span className="card-kicker">Monthly trend</span><h3>{label}</h3></div><StatusBadge status={metric.status} /></div>{metric.status === 'available' ? <><div className="growth-values"><div><span>Current month</span><strong>{metric.currentMonth.toLocaleString()}</strong></div><div><span>Previous month</span><strong>{metric.previousMonth.toLocaleString()}</strong></div><div className={growth === null ? 'growth-change neutral' : growth >= 0 ? 'growth-change positive' : 'growth-change negative'}><span>MoM change</span><strong>{growth === null ? 'N/C' : `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`}</strong></div></div><Sparkline values={metric.monthly.slice(-8).map((point) => point.count)} accent={growth !== null && growth >= 0 ? 'lime' : 'amber'} /><div className="trend-labels">{metric.monthly.slice(-4).map((point) => <span key={point.period}>{point.period}</span>)}</div></> : <EmptyRows>This metric is unavailable through the current read-only data path.</EmptyRows>}</article>; })}</div>}</section>

        <section className="dashboard-section" id="abuse"><SectionHeader eyebrow="Trust and safety" title="Abuse & Loophole Detection" detail="Review signals only" />{loading.abuse && <StatePanel type="loading" title="Checking supported usage signals...">Review heuristics are read-only.</StatePanel>}{!loading.abuse && !abuseDetection && <StatePanel type="error" title="Detection unavailable">The admin API did not return an abuse detection response.</StatePanel>}{!loading.abuse && abuseDetection && abuseDetection.status !== 'ready' && <StatePanel type="unavailable" title={`Data access ${statusLabel(abuseDetection.status)}`}>No alerts were generated while supported activity data was unavailable.</StatePanel>}{!loading.abuse && abuseDetection?.status === 'ready' && abuseDetection.alerts.length === 0 && <div className="empty-review"><div className="empty-glyph">OK</div><div><strong>No supported review signals detected</strong><p>Available company activity did not meet the documented review heuristic. This is not a fraud determination.</p></div><StatusBadge status="clear" /></div>}{!loading.abuse && abuseDetection?.status === 'ready' && abuseDetection.alerts.length > 0 && <><div className="review-banner"><div className="review-icon">!</div><div><strong>{abuseDetection.alerts.length} signals require admin review</strong><span>Observations are not confirmed abuse, fraud, or automation.</span></div></div><div className="abuse-grid">{abuseDetection.alerts.map((alert) => <article className="surface-card abuse-card" key={alert.id}><div className="card-heading"><div><span className="card-kicker">{labelize(alert.signalType)}</span><h3>{alert.companyId}</h3></div><StatusBadge status={alert.severity} /></div><p className="evidence">{alert.reason}</p><div className="evidence-grid"><div><span>Observed</span><strong>{alert.observedActivity.count.toLocaleString()}</strong></div><div><span>Baseline / day</span><strong>{alert.observedActivity.baselineDailyAverage.toLocaleString()}</strong></div><div><span>Rate</span><strong>{alert.observedActivity.multiplier}x</strong></div></div><span className="muted-note">{alert.timeWindow}</span><p className="review-action"><strong>Recommended review:</strong> {alert.recommendedAdminReviewAction}</p></article>)}</div><p className="method-note">{abuseDetection.notes.thresholds}</p></>}</section>

        <section className="dashboard-section" id="summary"><SectionHeader eyebrow="Executive brief" title="Daily Admin Summary" detail={dailySummary ? `Generated ${new Date(dailySummary.generatedAt).toLocaleString()}` : "Today's operating brief"} />{loading.summary && <StatePanel type="loading" title="Preparing today's summary...">Bringing the most important signals forward.</StatePanel>}{!loading.summary && !dailySummary && <StatePanel type="error" title="Daily summary unavailable">The admin API did not return a summary response.</StatePanel>}{!loading.summary && dailySummary && <><div className={`summary-hero summary-${dailySummary.status}`}><div><span className="section-eyebrow">Today's operating brief</span><h3>{dailySummary.summary.headline}</h3></div><StatusBadge status={dailySummary.status} label={dailySummary.status === 'data-access-pending' ? 'Health reporting incomplete' : undefined} /></div>{dailySummary.status !== 'ready' && <StatePanel type="unavailable" title={dailySummary.status === 'data-access-pending' ? 'Health reporting incomplete' : `Summary is ${statusLabel(dailySummary.status)}`}>Health reporting is incomplete or unavailable. Supabase data access is working; review the Health Reporting section before relying on this brief.</StatePanel>}<div className="summary-grid">{[["System Health", dailySummary.health.status, dailySummary.health.highlights, 'No critical, warning, stalled, or readiness issues reported.'], ["Abuse / Review", `${dailySummary.abuse.totalSignals} signals`, dailySummary.abuse.highlights, 'No supported abuse/review signals detected.'], ["Usage Changes", `${dailySummary.usageChanges.highlights.length} changes`, dailySummary.usageChanges.highlights, 'No meaningful usage changes available for comparison.'], ["Growth Highlights", `${dailySummary.growthHighlights.highlights.length} changes`, dailySummary.growthHighlights.highlights, 'No meaningful month-over-month growth changes available.']].map(([title, status, highlights, empty]) => <article className="surface-card summary-card" key={String(title)}><div className="card-heading"><h3>{String(title)}</h3><StatusBadge status={String(status)} /></div>{(highlights as Array<Record<string, unknown>>).length === 0 ? <EmptyRows>{String(empty)}</EmptyRows> : <ul className="summary-list">{(highlights as Array<Record<string, unknown>>).slice(0, 3).map((highlight, index) => <li key={`${String(highlight.title ?? highlight.metric ?? highlight.signalType)}-${index}`}><strong>{String(highlight.title ?? highlight.metric ?? highlight.signalType ?? 'Signal')}</strong><span>{String(highlight.reason ?? highlight.evidence ?? `${highlight.currentMonth ?? ''} current vs ${highlight.previousMonth ?? ''} previous`)}</span></li>)}</ul>}</article>)}<article className="surface-card summary-card summary-access"><div className="card-heading"><h3>Health Reporting</h3><StatusBadge status={dailySummary.dataAccess.issues.length === 0 ? 'complete' : 'data-access-pending'} label={dailySummary.dataAccess.issues.length === 0 ? 'Complete' : 'Insufficient data'} /></div>{dailySummary.dataAccess.issues.length === 0 ? <EmptyRows>Supabase data access is working and all summary source analytics reported ready.</EmptyRows> : <div className="health-reporting-copy"><strong>System health reporting</strong><p>Some system-health metrics cannot be calculated because the required workflow data is not available.</p></div>}</article></div></>}</section>
      </main>
    </div>
  </div>;
}

export default App;
