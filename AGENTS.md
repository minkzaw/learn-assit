# AGENTS.md — learn-assist

## Project Overview

A Docker Compose demo app: Python FastAPI backend + PostgreSQL + React frontend, served through nginx. Designed to run with **nerdctl** (not Docker).

## Tech Stack

| Layer    | Tech                              |
|----------|-----------------------------------|
| Backend  | Python 3.12, FastAPI, SQLAlchemy (async), asyncpg, uvicorn |
| Database | PostgreSQL 16 (alpine)            |
| Frontend | React (Vite), nginx 1.27 (alpine) |
| Runtime  | nerdctl compose (rootless)        |

## Architecture

```
Browser :3000 -> nginx (fe-frontend)
                   /api/*    -> backend:8000
                   /health   -> backend:8000
                   /*        -> static SPA (index.html)

Backend :8000 -> FastAPI (uvicorn --reload)
                   /health        -> DB connectivity check
                   /api/greet     -> simple greeting
                   /api/notes     -> CRUD on PostgreSQL

Postgres :5432 (host) <- backend:8000 (internal container network)
```

All three services share the `app-net` bridge network. The backend reaches Postgres via hostname `db` on internal port `5432`.

## Container Runtime Compatibility

This project is designed to work with **nerdctl** (rootless container runtime) but is also compatible with **Docker**.

| Feature | nerdctl | Docker |
|---------|---------|--------|
| `depends_on` with conditions | Silently ignored | Fully supported |
| Healthcheck CMD exec form | Not supported (use CMD-SHELL) | Fully supported |
| Compose file syntax | Compatible | Compatible |
| Volume mounts | Compatible | Compatible |
| Network configuration | Compatible | Compatible |

**Key differences:**

- **nerdctl** ignores `depends_on` conditions, so services start in arbitrary order. The backend includes retry logic in `init_db()` to wait for Postgres. All services use `restart: unless-stopped` for resilience.
- **nerdctl** requires `CMD-SHELL` form for healthchecks (not `CMD` exec form).
- **nerdctl** may need `--force-recreate` when an image changes but the container config hash doesn't.
- **Docker** users can rely on `depends_on: condition: service_healthy` for ordered startup, but the retry logic in the backend doesn't hurt.

The compose file and application code work identically on both runtimes.

## Running

```bash
# Start all services (builds images)
nerdctl compose up --build -d

# Force recreate a specific service after config change
nerdctl compose up --build -d --force-recreate <service-name>

# View logs
nerdctl logs -f py-backend
nerdctl logs -f learn-assist-db

# Tear down
nerdctl compose down

# Rebuild a single service
nerdctl compose build frontend && nerdctl compose up -d --force-recreate frontend
```

## Key Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Service definitions, networking, volumes, healthchecks |
| `.env` | Host port mappings and DB credentials |
| `backend/main.py` | FastAPI app, SQLAlchemy models, DB init with retry logic |
| `backend/Containerfile` | Python image build |
| `backend/requirements.txt` | Python dependencies |
| `frontend/src/App.jsx` | React SPA (health check, greeting, notes CRUD) |
| `frontend/nginx.conf` | Reverse proxy rules — **must include a location block for every backend route the frontend calls** |
| `frontend/Containerfile` | Multi-stage build: Vite build -> nginx serve |

## nerdctl Gotchas (IMPORTANT)

nerdctl compose is **not** fully compatible with Docker Compose. Known issues in this project:

1. **`depends_on` with `condition` is silently ignored.** Services start in arbitrary order. The backend has retry logic in `init_db()` (up to 15 attempts, 2s apart) to wait for Postgres. All services use `restart: unless-stopped` for resilience.

2. **Healthcheck `CMD` exec form is not supported.** Always use `CMD-SHELL` string form:
   ```yaml
   # CORRECT
   test: ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"]
   # WRONG — will produce a warning and may not work
   test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
   ```

3. **`--force-recreate` is needed** when an image changes but the container config hash doesn't. `nerdctl compose up -d` alone may skip recreation.

4. **Volume mounts override COPY.** The backend mounts `./backend:/app` for hot-reload. Code changes are picked up by uvicorn `--reload` without rebuilding. The frontend does NOT have a volume mount — nginx.conf is baked into the image and requires a rebuild + force-recreate.

## Adding a New Backend Route Called by the Frontend

1. Add the route in `backend/main.py`.
2. Add a matching `location` block in `frontend/nginx.conf` that proxies to `http://backend:8000/...`.
3. Rebuild the frontend image: `nerdctl compose up --build -d --force-recreate frontend`.

Without step 2, nginx will serve the SPA's `index.html` for that path, and the frontend JS will fail to parse the response as JSON.

## Conventions

- Environment variables use `UPPER_SNAKE_CASE`; pydantic-settings maps them to `lower_snake_case` fields automatically.
- DB credentials live in `.env` with defaults in `docker-compose.yml` via `${VAR:-default}` syntax.
- The `Settings` class in `main.py` reads env vars and `.env` file. The `database_url` property builds the async connection string.
- All datetime values stored in Postgres are **naive UTC** (the `created_at` default strips timezone info).
- No comments in code unless explaining a non-obvious "why".
