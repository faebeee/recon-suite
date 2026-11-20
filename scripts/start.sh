#!/usr/bin/env bash
# Builds the monorepo, then runs the API and the web app natively on this machine.
# The SQLite database lives in the API process (apps/api/data/recon.db).
#
#   API  http://localhost:${API_PORT:-4000}   (node apps/api/dist/main.js)
#   Web  http://localhost:${WEB_PORT:-4173}   (vite preview of apps/web/dist, proxies /api)
#
# The web app listens on BIND_ADDRESS (default 0.0.0.0: the LAN; 127.0.0.1 = this machine only).
# The API always listens on every interface. Add the URLs other devices use to PUBLIC_ORIGINS.
#
# PIDs and logs go to .run/. Stop everything with scripts/stop.sh (npm stop).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT/.run"
API_PORT="${API_PORT:-4000}"
WEB_PORT="${WEB_PORT:-4173}"
BIND_ADDRESS="${BIND_ADDRESS:-0.0.0.0}"
WEB_ORIGINS="http://localhost:$WEB_PORT,http://127.0.0.1:$WEB_PORT"

mkdir -p "$RUN_DIR"

is_running() {
  local pid_file="$RUN_DIR/$1.pid"
  [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null
}

port_in_use() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

for name in api web; do
  if is_running "$name"; then
    echo "$name is already running (pid $(cat "$RUN_DIR/$name.pid")). Run scripts/stop.sh first." >&2
    exit 1
  fi
done
for port in "$API_PORT" "$WEB_PORT"; do
  if port_in_use "$port"; then
    echo "Port $port is already in use (is npm run dev still running?)." >&2
    exit 1
  fi
done

echo "==> Building"
(cd "$ROOT" && npm run build)

# Each background job gets its own process group, so stop.sh can end it with its children.
set -m

echo "==> Starting API on :$API_PORT"
(
  cd "$ROOT/apps/api"
  PORT="$API_PORT" CORS_ORIGIN="${CORS_ORIGIN:-$WEB_ORIGINS}${PUBLIC_ORIGINS:+,$PUBLIC_ORIGINS}" \
    exec node dist/main.js
) >"$RUN_DIR/api.log" 2>&1 &
echo $! >"$RUN_DIR/api.pid"

echo "==> Starting web on :$WEB_PORT"
(
  cd "$ROOT/apps/web"
  API_PROXY_TARGET="http://localhost:$API_PORT" \
    exec npm exec -- vite preview --host "$BIND_ADDRESS" --port "$WEB_PORT" --strictPort
) >"$RUN_DIR/web.log" 2>&1 &
echo $! >"$RUN_DIR/web.pid"

# Wait until both answer, or report the log of the one that died.
for _ in $(seq 1 30); do
  for name in api web; do
    if ! is_running "$name"; then
      echo "$name exited during startup. Last log lines:" >&2
      tail -n 20 "$RUN_DIR/$name.log" >&2
      "$ROOT/scripts/stop.sh" >/dev/null 2>&1 || true
      exit 1
    fi
  done
  if port_in_use "$API_PORT" && port_in_use "$WEB_PORT"; then
    echo "==> Running: http://localhost:$WEB_PORT (logs in .run/, stop with npm stop)"
    exit 0
  fi
  sleep 1
done

echo "Timed out waiting for the API and web ports. Logs are in .run/." >&2
exit 1
