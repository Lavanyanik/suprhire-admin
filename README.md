# Suprhire Admin

An internal analytics platform designed to give the team early visibility into product health, usage trends, and operational readiness.

---

## Status

⚠️ **Development Code — Private Repository**

This project is development code intended for a **private GitHub repository**.
It is not production-ready and must not be deployed to public endpoints or production infrastructure in its current state.

---

## What Suprhire Admin Does

Suprhire Admin is an independent dashboard and daily email system that monitors the Suprhire product by reading the existing Supabase database in read-only mode.

**Core Goals:**

1. **Early Warning System** — Detect operational problems *before* customers report them.
2. **Growth Visibility** — Track user adoption, company expansion, and product feature usage.
3. **Abuse Prevention** — Spot unusual activity patterns and prevent misuse.
4. **System Health** — Monitor workflow reliability and identify bottlenecks.

---

## The Admin Experience

### 1. Admin Overview Dashboard ⭐ PLANNED

The admin home page at a glance:

| Metric | Display | Notes |
|--------|---------|-------|
| **Total Users** | 1,250 | All-time count |
| **New Users** | +45 today, +120 this week, +340 this month | Trend with time windows |
| **Total Companies** | 280 | All organizations |
| **New Companies** | +8 today, +25 this week, +65 this month | Growth indicators |
| **Jobs Created** | 1,820 | Usage intensity |
| **Applications** | 9,450 | Engagement metric |
| **Resume Imports** | 3,200 | Data quality indicator |
| **AI Agents Created** | 420 | Feature adoption |
| **Interviews** | 5,690 | Workflow engagement |
| **Calls** | 2,340 | Workflow progress |

**Currently implemented:** Basic metric counting layer. Dashboard UI is planned.

---

### 2. User Analytics

**What the admin will see:**

- **Total Users** — Cumulative user count (currently implemented)
- **New Users by Time Window** — Today, yesterday, last 7 days, last 30 days, all-time (currently implemented)
- **User Activity/Recency** — Profiles recently updated (currently implemented; labeled as a recency proxy, not true login activity)
- **Users by Company** — Distribution of users across organizations (planned; requires verified org membership model)
- **Users by Role** — Breakdown by admin/recruiter/candidate/etc. (planned; requires role field confirmation)
- **Login Activity** — Last login, login frequency, never-logged-in accounts (planned; requires persistent login history)
- **User Growth Trends** — Day-over-day, week-over-week changes (planned)

**Important caveat:** "Recently updated profiles" is NOT equivalent to active users. A profile update could mean many things (password change, email update, etc.) and does not necessarily indicate product engagement.

---

### 3. Company Analytics

**What the admin will see:**

- **Total Companies** — Cumulative organization count (currently implemented)
- **New Companies by Time Window** — Today, this week, this month, all-time (planned but infrastructure ready)
- **Company Activity** — Which companies are actively using the product (planned)
- **Jobs by Company** — Where jobs are being posted (planned)
- **Applications by Company** — Which companies are receiving applications (planned)
- **Resume Imports by Company** — Import activity per organization (planned)
- **AI Agents by Company** — Agent adoption by company (planned)
- **Interviews & Calls by Company** — Workflow engagement per company (planned)
- **Subscription/Tier Information** — By pricing tier or subscription level (planned; requires tier field in schema)
- **Company Growth Trends** — Retention, expansion, dormancy (planned)

---

### 4. Product Usage Analytics

**What the admin will see:**

- **Jobs Posted** — Total jobs, new this week, trends
- **Applications Received** — Volume, growth, time patterns
- **Resume Imports** — Batch uploads, file counts, processing status
- **Campaign Activity** — Campaign creation, engagement, effectiveness
- **AI Agent Adoption** — Agent creation, configuration, usage
- **Interview Completion** — Interviews started, completed, drop-off
- **Call Usage** — Screening calls, completion rates
- **Feature Adoption by Company** — Which features each company is using

**Status:** Metric definitions mostly in place; full dashboard not yet built.

---

### 5. System Readiness & Health ⚠️ PLANNED

**The Goal:** Detect operational problems *before* customers notice.

**What the admin will see:**

- **Workflow Attempt vs Success Rates** — How many attempts → how many successes
- **Agent Reliability** — Agent creation success %, execution failures
- **Import Health** — Import attempts, parse successes, processing failures
- **Interview/Call Completion** — Started vs completed, drop-off rates
- **Sudden Changes** — Large drops in successful operations, unexpected failure spikes
- **Bottleneck Detection** — Which workflows are slowing down

**Important:** These metrics require persisted success/failure events in the database. If the system doesn't record failed attempts, we can't calculate these metrics. This is currently unavailable because the existing schema does not track failed attempts or operational outcomes for most workflows.

**Example:** If 100 resume imports attempt and 95 succeed, we can calculate a 95% success rate. If the database only records successful imports, we can't know the real success rate.

---

### 6. Abuse & Loophole Detection ⚠️ PLANNED

**The Goal:** Spot unusual activity that could indicate abuse, fraud, or system exploitation.

**What the admin will see:**

- **Volume Anomalies** — Unusually high application/import activity
- **Rapid Repeated Actions** — Same action repeated many times in short period
- **Automated Behavior Signals** — Patterns suggesting script/bot activity
- **Account Risk Indicators** — Accounts requiring investigation
- **Company Risk Scores** — High-risk organizations
- **Alerts** — Real-time warnings for suspicious activity

**Example:** A startup company uploads 50,000 resumes in 2 hours. This is extremely unusual and should trigger an admin alert: "⚠️ XYZ Corp: 50,000 resume imports in 2 hours — verify this is legitimate use or contact company."

**Status:** Planned. Requires baseline/threshold definition and anomaly detection algorithms.

---

### 7. Growth Analytics

**What the admin will see:**

- **New Companies This Period** — Day, week, month
- **New Users This Period** — Breakdown by company when applicable
- **Jobs Posted** — Cumulative and period-based
- **Applications** — User engagement proxy
- **Resume Imports** — Data being brought into the system
- **AI Agent Adoption** — Feature usage growth
- **Interview/Call Usage** — Workflow adoption trends
- **Retention & Expansion** — Company staying, growing, or inactive

**Status:** Planned. Infrastructure ready for most metrics.

---

### 8. Daily Admin Summary Email ⭐ PLANNED

The admin receives a daily email (or can access on-demand) summarizing what changed and what needs attention.

**Representative Example Email (PLANNED FEATURE):**

```
Subject: Suprhire Admin Summary — Sep 02, 2026

📊 TODAY AT A GLANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👥 Users
  • New: 12 (+5% from yesterday)
  • Active today: 380 (recency proxy)
  • Never logged in: 42 (1.9% of total)

🏢 Companies
  • New: 2 (Acme Corp, FastHire Inc)
  • Total: 280
  • Active today: 185

📋 Product Usage
  • Jobs posted: 18 today (+3% from yesterday)
  • Applications: 94 today (+12% from yesterday)
  • Resume imports: 14 batches
  • AI agents created: 2
  • Interviews: 38
  • Calls: 22

⚙️ System Health
  ⚠️ Resume import success rate: 94% (1 of 15 failed to parse)
  ⚠️ Interview completion: 89% (4 dropped off)

🚨 Potential Abuse
  ⚠️ FastHire Inc: 1,200 resume uploads in 4 hours (unusual)
     → Action: Review account activity or contact company

📈 Growth
  • This week: +45 new users
  • This month: +140 new users (+15% vs last month)
  • Companies active this month: 240 / 280 (86%)

✅ All operational thresholds normal
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Status:** Planned. Will consume the canonical analytics layer.

---

## Shared Analytics Foundation

Both the dashboard and daily email will consume the **same canonical analytics layer** to ensure metrics are calculated consistently.

```
Existing Supabase Database
        ↓ (READ-ONLY)
Canonical Analytics Layer
   ↙                    ↘
Admin Dashboard      Daily Email
(Interactive)        (Automated)
```

This architecture prevents the dashboard and email from calculating the same metric differently, which would create confusion and errors.

---

## Current Implementation Status

### ✅ Phase 1: Canonical Analytics Foundation (Complete)

The backend has a working analytics layer that calculates metrics from the existing Supabase schema.

**Backend:**
- Express server with protected admin API
- Read-only access to existing Suprhire Supabase
- Canonical metric definitions (typed)
- Shared time-window helpers (today, yesterday, last 7/30 days, since inception)
- Overview endpoint: `GET /api/admin/overview`

**Frontend:**
- React + Vite dashboard shell
- Calls the admin backend API
- Displays overview metrics

**Tests:**
- 10 tests passing (auth, time windows, metric definitions, unsupported metrics)
- Backend build: ✅ passing
- Frontend build: ✅ passing

**Metrics Implemented:**
- Total users
- New users by time window
- Recently updated profiles (recency proxy)
- Total companies
- Jobs, applications, resume imports, AI agents, interviews, calls

**Metrics Unavailable (Schema Limitations):**
- Login activity / never-logged-in users (no login history table)
- Users by role (no role field confirmed)
- Users by company (no org membership model)
- Companies by tier (no subscription tier field)
- Success/failure rates (no persisted workflow outcomes)
- System health metrics (failures not recorded)

### 📋 Phase 2: Admin Dashboard (Planned)

Build the interactive dashboard UI consuming the canonical analytics API.

**Features:**
- Overview cards with key metrics
- User analytics section
- Company analytics section
- Product usage section
- Trend charts and time-based filtering
- Drill-down into individual metrics

### 📊 Phase 3: Activity & Event Tracking (Planned)

Enhance the Supabase schema with tracking tables to enable currently-unavailable metrics.

**Planned tables:**
- `activity_events` — Product feature usage
- `user_login_history` — Explicit login/auth events
- `workflow_failures` — Failed workflow steps
- `audit_events` — Complete audit trail
- `user_action_attribution` — Event-level user/company linkage

**Important:** Migration files exist as planning/documentation. They are NOT applied automatically to production.

### 🚨 Phase 4: Abuse & Anomaly Detection (Planned)

Implement algorithms to spot unusual activity.

**Features:**
- Baseline threshold definition
- Volume anomaly detection
- Behavioral anomaly detection
- Risk scoring
- Real-time alerting

### ⚙️ Phase 5: System Health & Readiness (Planned)

Monitor workflow reliability when persisted outcome data becomes available.

**Features:**
- Success/failure rate calculations
- Workflow bottleneck detection
- Health trend analysis
- Auto-alerting on degradation

### 📧 Phase 6: Daily Admin Email (Planned)

Automated daily summary consuming the canonical analytics layer.

**Features:**
- Daily changes summary
- System health warnings
- Abuse/anomaly alerts
- Growth indicators
- Action items

---

## Architecture & Security

### How It Works

Suprhire Admin is a **completely independent project** that does NOT depend on or modify the existing Suprhire frontend/backend.

```
Existing Suprhire Product Ecosystem
  Frontend → Backend → Supabase

Suprhire Admin (Independent)
                ↑
            (READ-ONLY)
  Admin Frontend → Admin Backend → Supabase
```

### Key Design Principles

1. **Read-Only Access** — Admin backend reads Supabase only; never writes.
2. **Server-Side Secrets** — Admin API key and dev tokens stored server-side only.
3. **No Frontend Secrets** — React dashboard never contains admin credentials.
4. **Independent Stack** — Separate frontend, backend, and authentication.
5. **Shared Canonical Layer** — Dashboard and email use same metric definitions.

### Security

- Admin API requires server-side token validation
- Supabase accessed with read-only anonymous key (not service-role key)
- All database access is query-only (SELECT)
- Production data is never modified
- Timing-safe comparison prevents timing attacks
- Future production auth requires external identity provider (e.g., Okta, Auth0)

---

## What This Project Does NOT Do

- ❌ Modify the existing Suprhire frontend
- ❌ Modify the existing Suprhire backend
- ❌ Write directly to production Supabase
- ❌ Apply schema migrations automatically
- ❌ Expose Supabase credentials to the browser
- ❌ Fabricate unavailable metrics
- ❌ Replace the existing product
- ❌ Invent relationships not supported by the schema

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Access to the existing Suprhire Supabase instance (read-only)

### Setup

1. **Backend**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Set SUPABASE_URL and SUPABASE_ANON_KEY to existing Suprhire Supabase
   # Set ADMIN_API_KEY for production or ADMIN_DEV_TOKEN for development
   npm run dev
   ```

2. **Frontend**
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

3. **Access**
   - Frontend: `http://localhost:5173`
   - Backend: `http://localhost:3001`

### Development

**Backend Development:**
```bash
cd backend
npm run dev      # Watch mode with tsx
npm test         # Run tests
npm run build    # TypeScript build
```

**Frontend Development:**
```bash
cd frontend
npm run dev      # Vite dev server
npm run build    # Production build
```

---

## Environment Variables

### Backend (.env)

```env
# Supabase (existing product instance)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Admin Authentication (server-side only)
ADMIN_API_KEY=your-internal-admin-token   # Production
ADMIN_DEV_TOKEN=local-dev-token           # Development only

# Server
PORT=3001
NODE_ENV=development
```

### Frontend (.env)

```env
VITE_ADMIN_API_URL=http://localhost:3001
```

---

## Troubleshooting

### Backend fails to connect to Supabase

- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set and correct.
- Confirm the Supabase instance is the existing Suprhire database.
- Check that the read-only key is being used (not service-role key).

### Frontend shows "unauthorized" or empty metrics

- Verify the backend is running on the correct port.
- Check `VITE_ADMIN_API_URL` in the frontend.
- Ensure the backend is started with a valid `ADMIN_DEV_TOKEN` for local development.
- In dev mode, visit `http://localhost:3001/api/admin/dev-login` to set the session cookie.

### Tests fail

- Ensure all dependencies are installed: `npm install`
- Clear cache: `rm -rf node_modules dist && npm install`
- Run a clean test: `npm test`

---

## FAQ

**Q: Will this impact the existing Suprhire product?**
A: No. Suprhire Admin is independent and reads Supabase in read-only mode only.

**Q: Why is system health not available yet?**
A: The existing schema doesn't persistently record failed attempts or workflow outcomes. Until those tracking tables exist, success/failure rates cannot be calculated.

**Q: Can I run the migrations?**
A: Migrations in `supabase/migrations/` are documentation/planning. Do not apply them without explicit approval. Production schema is not our responsibility.

**Q: What's the timeline for features X, Y, Z?**
A: This is a planned product roadmap. Phases 2-6 depend on business priorities and schema improvements.

**Q: Is this production-ready for authentication?**
A: No. Current dev-token auth is development-only. Production requires an external identity provider.

---

## Next Steps

1. Build the admin dashboard UI (Phase 2)
2. Determine priorities for system health tracking (Phase 3)
3. Define abuse detection thresholds (Phase 4)
4. Plan daily email implementation (Phase 6)

---

## Contributing

All changes should:
- Maintain read-only Supabase access
- Follow canonical analytics layer principles
- Update tests for new functionality
- Avoid modifying the existing Suprhire frontend/backend
- Keep migrations as documentation unless explicitly approved

---

## License

Internal to Suprhire.
