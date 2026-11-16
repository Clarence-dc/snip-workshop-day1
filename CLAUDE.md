# Snip repository rules

This repository keeps the Snip app layers on independent orphan branches and
mounts them as pinned submodules on `main`.

| Path | Branch | Stack and notes |
|---|---|---|
| `backend/` | `backend` | Bun API, zero dependencies, in-memory storage |
| `frontend/` | `frontend` | Angular 20; project `snip-frontend`; output `dist/snip-frontend/browser` |
| `cli/` | `cli` | Node.js CommonJS; zero dependencies |
| `bundle/` | `bundle` | Generated release; do not hand-edit generated files |
| `scripts/build-bundle.mjs` | `main` | Cross-platform, idempotent release builder |

## Shared API contract

Keep the API consistent across backend, clients, bundle, and documentation:

- `POST /api/links` with `{ "url": "https://..." }`: `201` with
  `{ code, url, shortUrl, hits, createdAt }`; invalid JSON or a non-HTTP(S) URL
  returns `400` with `{ error }`.
- `GET /api/links`: `200` with the array of links.
- `GET /:code`: `302` redirect and incremented `hits`, or `404` if unknown.

Storage is an in-memory `Map` and resets on restart by design.

## Workflow

Clone with `git clone --recurse-submodules`, or run
`git submodule update --init --recursive`. Edit and push changes inside a
component submodule, then update and commit its gitlink on `main`. Build a
release with `node scripts/build-bundle.mjs`; use `--push` to publish the
bundle and bump the `main` pointer.

## Do and don't

- Keep backend and CLI dependency-free.
- Keep CLI CommonJS: never add `"type": "module"` to its package or the bundle
  package.
- Keep the Angular project name and output path unchanged; the bundle build
  requires `frontend/dist/snip-frontend/browser/index.html`.
- Never hand-edit generated bundle files; regenerate them with the build script.
- Keep the bundle build idempotent and cross-platform.
- The bundle workflow is schedule/manual only; a push workflow on `main` cannot
  rebuild in response to pushes on component branches.
- Docker CI's `paths: [bundle]` filter watches the submodule gitlink; do not
  change it to `bundle/**`.
- Grant each workflow only the permissions it needs; never commit secrets.
- Keep this file and `.github/copilot-instructions.md` in sync.
