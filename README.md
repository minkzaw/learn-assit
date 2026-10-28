# Learn Assist - Docker Compose Demo

A simple full-stack application demonstrating Docker Compose with a Python FastAPI backend, PostgreSQL database, and React frontend served through nginx.

## Container Runtime Compatibility

This project works with both **nerdctl** (rootless) and **Docker**. See [AGENTS.md](./AGENTS.md) for detailed differences.

| Command | nerdctl | Docker |
|---------|---------|--------|
| Start | `nerdctl compose up --build -d` | `docker compose up --build -d` |
| Logs | `nerdctl logs -f <container>` | `docker compose logs -f <service>` |
| Stop | `nerdctl compose down` | `docker compose down` |

**nerdctl-specific notes:**
- `depends_on` conditions are silently ignored — the backend has built-in retry logic to wait for Postgres.
- Healthchecks must use `CMD-SHELL` form (not `CMD` exec form).
- Use `--force-recreate` when an image changes but the container config hash doesn't.

## Project Structure

```
learn-assit/
├── docker-compose.yml          # Service definitions, networking, healthchecks
├── .env                        # Host port mappings and DB credentials
├── AGENTS.md                   # AI agent instructions
├── backend/
│   ├── Containerfile           # Python image build
│   ├── requirements.txt        # Python dependencies
│   └── main.py                 # FastAPI app, SQLAlchemy models, DB init
└── frontend/
    ├── Containerfile           # Multi-stage: Vite build -> nginx serve
    ├── nginx.conf              # Reverse proxy rules
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        └── App.jsx             # React SPA (health, greeting, notes CRUD)
```

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

## Quick Start

### 1. Build and start the containers

```bash
# Using nerdctl
nerdctl compose up --build -d

# Using Docker
docker compose up --build -d
```

### 2. Access the application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### 3. Test the endpoints

```bash
# Health check (includes DB connectivity)
curl http://localhost:8000/health

# Greeting API
curl "http://localhost:8000/api/greet?name=Alice"

# List notes
curl http://localhost:8000/api/notes

# Create a note
curl -X POST "http://localhost:8000/api/notes?title=Hello&content=World"

# Root endpoint
curl http://localhost:8000/
```

### 4. View logs

```bash
# All services
nerdctl compose logs -f

# Specific service
nerdctl logs -f py-backend
nerdctl logs -f learn-assist-db
nerdctl logs -f fe-frontend
```

### 5. Stop and cleanup

```bash
# Stop containers
nerdctl compose down

# Stop and remove volumes
nerdctl compose down -v
```

## Environment Variables

Edit `.env` to customize:

```env
# Backend
APP_ENV=testing
BACKEND_PORT=8000
LOG_LEVEL=debug

# Frontend
FRONTEND_PORT=3000

# Database (PostgreSQL)
DB_USER=learnassist
DB_PASSWORD=supersecret
DB_NAME=learnassist_db
DB_PORT=5432

# App secrets
SECRET_KEY=dev-secret-do-not-use-in-prod
```

> **Note:** `DB_PORT` maps to the **host** port. The internal container port is always `5432`.

## Features

- **Hot-reload**: Backend code changes are reflected immediately via volume mount + uvicorn `--reload`
- **Health checks**: All services have healthchecks; frontend waits for backend, backend retries DB connection
- **Multi-stage build**: Frontend uses Node for building, nginx for serving (small final image)
- **API proxy**: nginx proxies `/api/*` and `/health` to the backend
- **CORS enabled**: Backend accepts requests from any origin (dev mode)
- **DB retry logic**: Backend retries Postgres connection up to 15 times (handles nerdctl ignoring `depends_on`)

## Development

### Backend only (local)

```bash
cd backend
pip install -r requirements.txt
DB_HOST=localhost uvicorn main:app --reload --port 8000
```

### Frontend only (local)

```bash
cd frontend
npm install
npm run dev
```

## Troubleshooting

### Port already in use

Change ports in `.env`:

```env
BACKEND_PORT=8001
FRONTEND_PORT=3001
DB_PORT=5433
```

### Rebuild after code changes

Backend changes are picked up automatically (volume mount). Frontend/nginx changes require a rebuild:

```bash
nerdctl compose up --build -d --force-recreate frontend
```

### Check container status

```bash
nerdctl compose ps
# or
nerdctl ps -a
```

### Access container shell

```bash
nerdctl exec -it py-backend sh
nerdctl exec -it fe-frontend sh
nerdctl exec -it learn-assist-db sh
```

### Frontend shows "database: unreachable"

Make sure `frontend/nginx.conf` has a `location` block for every backend route the frontend calls. Without it, nginx serves `index.html` and the JS fails to parse the response as JSON.
