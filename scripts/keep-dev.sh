#!/usr/bin/env bash
# Restart the local preview if next dev exits (crash, config reload, SIGINT).
set -u
cd "$(dirname "$0")/.."
while true; do
  echo "[keep-dev] starting npm run dev on :43147"
  npm run dev
  code=$?
  echo "[keep-dev] next exited with $code; restarting in 2s"
  sleep 2
done
