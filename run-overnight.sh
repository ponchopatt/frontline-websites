#!/bin/bash
cd "$(dirname "$0")"
mkdir -p logs
caffeinate -dimsu &
CAF=$!
tries=0
while grep -q ',todo,' QUEUE.csv; do
  before=$(grep -c ',todo,' QUEUE.csv)
  claude -p "$(cat NIGHT_RUN.md)" --max-turns 300 >> "logs/night-$(date +%F).log" 2>&1
  after=$(grep -c ',todo,' QUEUE.csv)
  if [ "$after" -ge "$before" ]; then tries=$((tries+1)); else tries=0; fi
  if [ "$tries" -ge 2 ]; then echo "STOPPED: queue not moving" >> MORNING_REPORT.md; break; fi
done
kill $CAF
