# Snip Frontend

The Angular 20 client for Snip. It validates HTTP(S) URLs, creates short links,
and lists link hit counts from the shared backend API.

## Run locally

Start the backend on port 3000, then run:

```sh
npm install
npx ng serve
```

The Angular dev server proxies `/api` requests to `http://localhost:3000`.
The app uses relative API paths so the bundled UI can call the backend on its
own origin. Build output is `dist/snip-frontend/browser`.

## API

- `POST /api/links` with `{ "url": "https://…" }` returns a short-link object.
- `GET /api/links` returns all short-link objects.
