#!/usr/bin/env bash
# Deploys to Vercel (free Hobby) + Neon (free Postgres):
#   API → latif-kids-api.vercel.app (Nest in one function, region fra1, files in Postgres)
#   Web → latif-kids.vercel.app      (Next.js, built by Vercel from the repo, root apps/web)
#   App → latif-kids-app.vercel.app  (Expo web export, static SPA)
# Needs: vercel CLI, VERCEL_TOKEN, and project env vars set in Vercel (see README → Vercel).
set -euo pipefail
cd "$(dirname "$0")/.."
API_ORIGIN=${API_ORIGIN:-https://latif-kids-api.vercel.app}
: "${VERCEL_TOKEN:?set VERCEL_TOKEN}"
: "${VERCEL_ORG_ID:?set VERCEL_ORG_ID}"

pnpm --filter @latif/shared build

# 1) API: compile + bundle (migrations embedded), deploy the function folder.
( cd apps/api && pnpm build && pnpm build:netlify &&
  cp netlify/functions/api/server.cjs vercel/api/_server.cjs &&
  cd vercel && VERCEL_PROJECT_ID=${API_PROJECT_ID:?} vercel deploy --prod --yes --token "$VERCEL_TOKEN" )

# 2) Web: Vercel builds it (project root directory = apps/web).
VERCEL_PROJECT_ID=${WEB_PROJECT_ID:?} vercel deploy --prod --yes --token "$VERCEL_TOKEN"

# 3) Mobile web build.
OUT=$(mktemp -d)
( cd apps/mobile && EXPO_PUBLIC_API_URL="$API_ORIGIN" pnpm exec expo export -p web --output-dir "$OUT" )
echo '{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}' > "$OUT/vercel.json"
( cd "$OUT" && VERCEL_PROJECT_ID=${APP_PROJECT_ID:?} vercel deploy --prod --yes --token "$VERCEL_TOKEN" )
