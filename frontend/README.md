# ShiftKey React frontend

The React/Vite frontend is being migrated in stages while the current FastAPI backend and PostgreSQL data remain unchanged.

## Preview locally

1. Run `cd frontend && npm install && npm run dev`.
2. Vite opens on port 5173 and proxies `/api` requests to FastAPI on `http://localhost:8000`.

## Production preview

The Docker build compiles the React app into `app/static/react/`. After deploying the image, open `/static/react/index.html`.

The current production frontend at `/` remains unchanged until parity and acceptance checks are complete.

## Migrated workflows

- Login, session handling, role-aware navigation and mandatory password changes
- Daily attendance reports, employee search, department/status filters and CSV/Excel exports
- Attendance corrections, revert-to-machine-values and per-record history
- Correction history and audit trail, audit integrity verification and export
- User and department administration, shifts and active-session revocation
- SQL connections, synchronization job configuration, scheduling and run history

The React frontend intentionally does not add a manual recurring Excel upload workflow. Historical attendance remains in the existing database; ongoing attendance should use the configured Starlink biometric synchronization.

No backend route, database schema, PostgreSQL volume or attendance record is replaced by this frontend migration.
