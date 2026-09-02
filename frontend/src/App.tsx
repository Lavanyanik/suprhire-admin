import { useEffect, useState } from 'react';
import './App.css';

type OverviewMetrics = {
  totalUsers: number;
  activeUsers: number;
  activeUsersLabel?: string;
  neverLoggedInUsers: number | 'unavailable';
  totalCompanies: number;
  jobs: number;
  applications: number;
  resumeImports: number;
  campaigns: number;
  aiAgents: number;
  interviews: number;
  calls: number;
  status: 'ready' | 'missing-config' | 'error';
};

const API_BASE_URL = import.meta.env.VITE_ADMIN_API_URL ?? 'http://localhost:3001';

function App() {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/overview`, {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const nextMetrics = (await response.json()) as OverviewMetrics;
        setMetrics(nextMetrics);
      } catch (loadError) {
        console.error(loadError);
        setError('Unable to load analytics metrics from the admin API. A valid server-side admin session is required.');
      }
    };

    void loadMetrics();
  }, []);

  const stats = [
    { label: 'Total Users', value: metrics?.totalUsers ?? 0 },
    {
      label: metrics?.activeUsersLabel ?? 'Active Users (profile recency proxy)',
      value: metrics?.activeUsers ?? 0,
    },
    { label: 'Never Logged In', value: metrics?.neverLoggedInUsers === 'unavailable' ? 'Unavailable' : metrics?.neverLoggedInUsers ?? 0 },
    { label: 'Companies', value: metrics?.totalCompanies ?? 0 },
    { label: 'Jobs', value: metrics?.jobs ?? 0 },
    { label: 'Applications', value: metrics?.applications ?? 0 },
    { label: 'Resume Imports', value: metrics?.resumeImports ?? 0 },
    { label: 'AI Agents', value: metrics?.aiAgents ?? 0 },
    { label: 'Interviews', value: metrics?.interviews ?? 0 },
    { label: 'Calls', value: metrics?.calls ?? 0 },
  ];

  return (
    <div className="admin-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">SUPRHIRE ADMIN</p>
          <h1>Product intelligence overview</h1>
        </div>
        <span className={`status-badge ${metrics?.status ?? 'missing-config'}`}>
          {metrics?.status === 'ready' ? 'Read-only analytics ready' : metrics?.status === 'error' ? 'Read error' : 'Awaiting API'}
        </span>
      </header>

      {error && <div className="alert-box">{error}</div>}

      <section className="stats-grid">
        {stats.map((stat) => (
          <article key={stat.label} className="stat-card">
            <div className="stat-label">{stat.label}</div>
            <div className="stat-value">{String(stat.value)}</div>
          </article>
        ))}
      </section>
    </div>
  );
}

export default App;
