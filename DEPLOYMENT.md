# Deployment Guide

This repository contains:
- `apps/collabydraw` — Next.js frontend
- `apps/ws` — WebSocket backend
- `packages/db` — Prisma database client

## What I prepared
- Fixed `docker-compose.yml` to use the existing root Dockerfiles in `docker/`
- Added container environment values for database and websocket URLs
- Verified that the websocket backend builds locally
- Noted that the frontend requires Node 18/20 for production build compatibility

## Free hosting path
The best free hosting combination for this app is:
1. **Frontend** on Vercel
2. **WebSocket backend** on Railway, Render, or Fly.io
3. **Database** on a free Postgres service (Railway, Supabase, or Render Postgres)

### Recommended configuration
#### Frontend
- Project root: `apps/collabydraw`
- Build command: `pnpm run build`
- Start command: `pnpm run start`
- Environment variables:
  - `DATABASE_URL` = your Postgres connection string
  - `JWT_SECRET` = a strong random secret
  - `NEXT_PUBLIC_WS_URL` = `wss://<your-backend-domain>`
  - `NEXT_PUBLIC_BASE_URL` = `https://<your-frontend-domain>`
  - `NEXTAUTH_URL` = `https://<your-frontend-domain>`
  - `NEXTAUTH_SECRET` = a strong random secret
  - `GEMINI_API_KEY` = optional if you use AI diagramming

#### WebSocket backend
- Service root: `apps/ws`
- Build command: `pnpm run build`
- Start command: `pnpm run start`
- Environment variables:
  - `DATABASE_URL` = same Postgres connection string
  - `JWT_SECRET` = same secret as the frontend

#### Database
- Use a free Postgres instance from one of:
  - Railway
  - Supabase
  - Render Postgres

## Local Docker test
To run locally with Docker Compose:
```bash
cd d:\CollabyDraw-main
docker compose up --build
```
Then visit:
- `http://localhost:3000` for the frontend
- `ws://localhost:8080` for the websocket backend

## Important note
I cannot complete the internet deployment from this environment because it requires:
- your hosting account credentials
- secrets configured on the host
- an external service provider account

What I have done is prepare the repo and fix the Docker Compose deployment path. From here, you can connect a free Vercel project for the frontend and a free Railway/Render/Fly.io project for the backend.
