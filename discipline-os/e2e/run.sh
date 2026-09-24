#!/usr/bin/env bash
# Runs the end-to-end suite against local Supabase. Start it first: npx supabase start
set -euo pipefail
cd "$(dirname "$0")/.."
eval "$(npx supabase status -o env | sed -n 's/^\(API_URL\|ANON_KEY\|SERVICE_ROLE_KEY\)=/SB_\1=/p')"
export NEXT_PUBLIC_SUPABASE_URL="$SB_API_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$SB_ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SB_SERVICE_ROLE_KEY"
exec npx playwright test "$@"
