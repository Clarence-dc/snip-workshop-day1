# Snip: URL shortener with a Git submodule architecture

Snip has one backend and two clients: an Angular web app and a Node.js CLI. The
`main` branch mounts each source layer as a submodule, pinning an exact commit.
Each layer keeps its files at the root of its own branch.

| Layer | Branch | Stack |
|---|---|---|
| Backend | `backend` | Bun 1.x, zero dependencies, in-memory `Map` |
| Frontend | `frontend` | Angular 20, standalone component, signals, HttpClient |
| CLI | `cli` | Node.js, CommonJS, zero dependencies |
| Release | `bundle` | Generated API, web app, CLI, and Dockerfile |

## Shared API

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/api/links` | `{"url":"https://example.com"}` | `201` `{code,url,shortUrl,hits,createdAt}`; `400` `{error}` for invalid input |
| `GET` | `/api/links` | — | `200` array of link objects |
| `GET` | `/:code` | — | `302` redirect and incremented hit count; `404` if unknown |

Links are held in memory and are cleared when the backend restarts.

## Clone and run

Clone with the submodules populated:

```sh
git clone --recurse-submodules https://github.com/Clarence-dc/snip-workshop-day1.git
cd snip-workshop-day1
```

Or populate them after a regular clone:

```sh
git submodule update --init --recursive
```

Run the backend, frontend, and CLI in separate terminals:

```sh
cd backend && bun start
cd frontend && npm install && npx ng serve
cd cli && node cli.js add https://example.com
```

The backend listens on port `3000`; the Angular development server listens on
port `4200`. The CLI accepts `SNIP_API` to override its default
`http://localhost:3000` backend URL.

## Bundle and container

The `bundle` branch is generated from the source submodules. From the `main`
checkout:

```sh
node scripts/build-bundle.mjs
node scripts/build-bundle.mjs --push
```

The builder updates source submodules to their branch tips, installs their locked
dependencies, runs frontend tests and security audits, builds, and commits the
bundle locally. The second command also pushes the generated branch and updates
the `main` gitlink. The bundle serves the web UI and API from one Bun process.
The image workflow publishes to `ghcr.io/clarence-dc/snip-workshop-day1` only
after its checks pass.

## Updating a layer

Commit and push changes from inside that layer's submodule, then update the
superproject pointer:

```sh
cd backend
git add -A && git commit -m "Describe backend change" && git push
cd ..
git submodule update --remote backend
git add backend && git commit -m "Bump backend submodule" && git push
node scripts/build-bundle.mjs --push
```

Repeat with `frontend` or `cli` as appropriate.
