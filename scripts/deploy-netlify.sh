#!/usr/bin/env bash
# Deploys the three Netlify sites (public demo):
#   API  → latif-kids-api.netlify.app  (Nest in one Function, Netlify Database, Netlify Blobs)
#   Web  → latif-kids.netlify.app      (Next.js runtime; BFF calls the API site)
#   App  → latif-kids-app.netlify.app  (Expo web export of the mobile app)
# Needs: netlify-cli, NETLIFY_AUTH_TOKEN, and site env vars set in Netlify (see README → Netlify).
set -euo pipefail
cd "$(dirname "$0")/.."
API_SITE=${API_SITE:-latif-kids-api}
WEB_SITE_ID=${WEB_SITE_ID:?set WEB_SITE_ID (Netlify site id of the web site)}
APP_SITE=${APP_SITE:-latif-kids-app}
API_ORIGIN=${API_ORIGIN:-https://latif-kids-api.netlify.app}

pnpm --filter @latif/shared build

# 1) API: compile, bundle into one function file (migrations embedded), deploy.
( cd apps/api && pnpm build && pnpm build:netlify &&
  netlify deploy --prod --no-build --site "$API_SITE" \
    --dir "$PWD/netlify/public" --functions "$PWD/netlify/functions" )

# 2) Web: build with the Next.js runtime (netlify.toml at the repo root), then deploy that build.
mkdir -p .netlify && printf '{"siteId":"%s"}' "$WEB_SITE_ID" > .netlify/state.json
API_URL="$API_ORIGIN/api/v1" netlify build --offline --context production --filter @latif/web
netlify deploy --prod --no-build --filter @latif/web --dir "$PWD/apps/web/.netlify/static"

# 3) Mobile app (web build) as a single-page app.
OUT=$(mktemp -d)
( cd apps/mobile && EXPO_PUBLIC_API_URL="$API_ORIGIN" pnpm exec expo export -p web --output-dir "$OUT" )
echo "/*  /index.html  200" > "$OUT/_redirects"
netlify deploy --prod --no-build --site "$APP_SITE" --dir "$OUT"
