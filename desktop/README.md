# Latif Kids — desktop app

The live platform (https://latif-kids.vercel.app) in its own window, installable on Windows (`.exe`) and Mac (`.dmg`).
Not part of the pnpm workspace; nothing in `apps/` changes.

- Build: GitHub Actions → **Desktop app** (runs on pushes to `desktop/**`), installers attached to a `desktop-N` release.
- Local: `cd desktop && npm install && npm start`.
- Needs internet (same data as the website and phones); shows a retry screen when offline.
