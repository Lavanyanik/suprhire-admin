# Suprhire Admin — Implemented Features

## 1. Admin Overview Dashboard

The current dashboard is implemented and working in the admin frontend. It displays:

- Users: total users, new users, and recently updated profiles
- Companies: total companies
- Jobs: total counts by selected time window
- Applications: total counts by selected time window
- Resume Imports: totals by selected time window
- AI Agents: totals by selected time window
- Interviews: totals by selected time window
- Calls: totals by selected time window
- Available time windows: Today, Yesterday, Last 7 Days, Last 30 Days, and Since Inception
- Loading state: spinner while analytics are being fetched
- Error state: admin API unavailable / auth-required message
- Empty state: no metrics available for the selected window

## 2. Analytics Foundation

The analytics layer already implemented includes:

- Supported metrics: total users, new users, recently updated profiles, total companies, jobs, applications, resume imports, AI agents, interviews, and calls
- Time-window calculations: today, yesterday, last 7 days, last 30 days, and since inception
- Canonical metric definitions: source table/column, calculation intent, time windows, and availability metadata in the metric catalog
- Overview API: a read-only admin overview response that aggregates counts for the supported metrics and returns a status of ready, missing-config, or error

## 3. Admin Backend

The backend currently implements:

- Admin overview endpoint: returns the dashboard metrics payload
- Health endpoint: returns service health and authorization/read-only configuration metadata
- Admin authentication: accepts server-side bearer auth and a local development session cookie
- Read-only Supabase access: initializes a Supabase client with the anonymous key only and keeps the admin layer in read-only mode
- Protection of admin routes: the admin and metrics routes require authenticated admin access before responding

## 4. Frontend

The frontend currently implements:

- Dashboard UI: overview shell, header, metric cards, and read-only status badge
- API integration: fetches the admin overview endpoint and automatically retries through the dev-login route on unauthorized access
- Time-window selection: buttons to switch between the supported windows
- Error/loading handling: visible loading, error, and empty states
- Read-only presentation: explicit read-only labeling and no write actions in the admin UI

## 5. Security & Data Access

The repository currently enforces:

- Existing Supabase is read-only
- No production database writes are implemented in the admin backend
- Admin secrets remain server-side and are not exposed to the frontend
- The existing Suprhire application is not modified in this workspace; the admin project is separate and read-only

## 6. Validation

The following checks currently pass in this workspace:

- Backend tests: 10 passing, 0 failing (`npm test` in the backend)
- Backend build: successful TypeScript compilation (`npm run build` in the backend)
- Frontend build: successful TypeScript + Vite production build (`npm run build` in the frontend)

This document intentionally reflects only the code paths that are implemented and verified in the current project state.
