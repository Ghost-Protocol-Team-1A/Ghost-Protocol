#!/bin/sh
# Starts the API (private, inside the container) and the website (public on $PORT).
# If either process exits, the container exits so the host restarts it.
set -eu

uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log &
API_PID=$!

# Wait up to 30 s for the API so the first page view has data.
i=0
until node -e "fetch('http://127.0.0.1:8000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then echo "API did not start" >&2; exit 1; fi
  sleep 1
done

HOSTNAME=0.0.0.0 node web/server.js &
WEB_PID=$!

trap 'kill "$API_PID" "$WEB_PID" 2>/dev/null' INT TERM
# Exit as soon as either process stops.
while kill -0 "$API_PID" 2>/dev/null && kill -0 "$WEB_PID" 2>/dev/null; do
  sleep 2
done
kill "$API_PID" "$WEB_PID" 2>/dev/null || true
exit 1
