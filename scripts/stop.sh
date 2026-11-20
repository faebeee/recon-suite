#!/usr/bin/env bash
# Stops the API and web processes started by scripts/start.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT/.run"

for name in web api; do
  pid_file="$RUN_DIR/$name.pid"
  if [[ ! -f "$pid_file" ]]; then
    echo "$name: not running"
    continue
  fi
  pid="$(cat "$pid_file")"
  if kill -0 "$pid" 2>/dev/null; then
    # start.sh gives each process its own group (pgid = pid): end the whole group.
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    for _ in $(seq 1 10); do
      kill -0 "$pid" 2>/dev/null || break
      sleep 1
    done
    if kill -0 "$pid" 2>/dev/null; then
      kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
    fi
    echo "$name: stopped (pid $pid)"
  else
    echo "$name: not running (stale pid file)"
  fi
  rm -f "$pid_file"
done
