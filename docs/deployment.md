# Deployment

The judges' demo runs as **one Docker web service on Render**, kept awake by an **UptimeRobot**
monitor.

| | |
| --- | --- |
| Live URL | https://ghost-protocol-demo.onrender.com |
| Health | https://ghost-protocol-demo.onrender.com/healthz |
| Render | workspace *Ghost Protocol*, service `ghost-protocol-demo` (free plan), deploys `main`. Auto-deploy has not fired on merges, so after a merge trigger **Manual Deploy → Deploy latest commit** in Render |
| UptimeRobot | keyword monitor *Ghost Protocol demo* on `/healthz` for `"status":"ok"`, every 5 minutes, email alert to the lead |

## How it is put together

```
            internet
               │  HTTPS
     ┌─────────▼──────────────────────── container ──┐
     │  Next.js website   (0.0.0.0:$PORT, public)     │
     │        │ server-side fetch                     │
     │        ▼                                       │
     │  FastAPI engine    (127.0.0.1:8000, private)   │
     └────────────────────────────────────────────────┘
```

- `Dockerfile` builds the website (Next.js standalone output) and installs the API, then runs
  both from `deploy/start.sh` as a non-root user. If either process stops, the container exits
  and Render restarts it.
- The **API is never exposed**: pages, server actions, report downloads
  (`/cases/{id}/report/download`) and the health check all call it from inside the container.
- `GET /healthz` returns `200 {"status":"ok"}` only when the website can reach the API, and `503`
  otherwise. Render uses it as the health check; UptimeRobot pings it every 5 minutes, which also
  stops the free instance from sleeping.

## Environment

Set in the Dockerfile; nothing secret is needed.

| Variable | Value | Purpose |
| --- | --- | --- |
| `PORT` | set by Render (default 10000) | Public port for the website |
| `API_URL` | `http://127.0.0.1:8000` | Where the website reaches the API |
| `GP_STORAGE_DIR` | `/app/data/evidence` | Uploaded files (ephemeral on the free plan) |

## Run the same container locally

```bash
docker build -t ghost-protocol .
docker run --rm -p 10000:10000 ghost-protocol
```

Then open http://localhost:10000/dashboard and check http://localhost:10000/healthz.

## Before a demo

1. Open `/healthz`. If the instance was asleep, the first request can take up to a minute.
2. Press **Reset demo** on the dashboard (the API is private, so the button is the way to reset).
3. Follow [demo-script.md](demo-script.md).

## Limits of the demo deployment

- **State is in memory.** A restart or redeploy returns the case to its seeded state; uploaded
  files are lost on restart (the free plan has no persistent disk).
- **No login.** Anyone with the link can use the demo, including Reset. Do not upload real
  evidence. See [security.md](security.md).
- Free-plan instances are small; one judge at a time is the intended load.
