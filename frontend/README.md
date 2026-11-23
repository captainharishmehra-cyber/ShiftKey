# ShiftKey React frontend

This is the first migration slice of the ShiftKey frontend. It is built with React, Vite and Lucide icons and talks directly to the existing FastAPI endpoints on the same origin.

## Local development
```bash
cd frontend
npm install
npm run dev
```

The Vite dev server needs a proxy to the FastAPI server for local API calls if it runs on a different port. The production build is emitted to `app/static/react/` and is available at `/static/react/index.html`.

## Migration safety
The current production frontend remains at `/` during the staged migration. This preview currently covers authentication, report selection, report summaries, employee search/filtering and Excel export. Corrections, audit, user administration, shifts and SQL integrations must be migrated and parity-tested before the React app replaces the existing entry point. No backend or database schema changes are part of this frontend work.