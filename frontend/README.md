# ShiftKey React frontend

The React/Vite frontend replaces the legacy browser interface while retaining the existing FastAPI API and PostgreSQL data model.

## Local preview

1. Run `cd frontend && npm install && npm run dev`.
2. Vite opens on port 5173 and proxies `/api` requests to FastAPI on `http://localhost:8000`.

## Production

The Docker build compiles the React app into `app/static/react/`. The normal ShiftKey homepage at `/` now opens the React app. The previous interface is preserved at `/static/legacy.html` as a fallback.

## React workflows

- Login, logout, role-aware navigation and mandatory/voluntary password changes
- Daily reports, employee search, department and segment filters, status filters and department grouping
- CSV/Excel exports with status, segment and department filters; administrator report deletion and source download
- Attendance correction actions (shift time, manual time, half day, absent), revert-to-machine-values, correction history and record/report activity history
- Audit timeline with category/action/user/outcome/severity filters, page-view inclusion, export, integrity verification and administrator session revocation
- User/department administration, role scope, password reset, account status and shift management
- SQL connection management, connection tests, read-only query console, schema browser
- Pull/push synchronization jobs, SQL preview and mapping suggestions, advanced options, scheduling, auto-push, manual runs and run logs

## Data strategy

No manual recurring Excel upload workflow is included. Historical attendance remains in the existing PostgreSQL database; ongoing attendance is intended to arrive through the configured Starlink biometric synchronization.

This migration does not replace the FastAPI API, database schema, PostgreSQL volume or attendance records.
