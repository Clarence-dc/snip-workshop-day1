# Snip backend

A dependency-free Bun server for the Snip URL shortener. Links are stored in
memory and are cleared when the server restarts.

Run with `bun start`. Set `PORT` to change the port, `BASE_URL` to set the
origin used in short links, or `RAILWAY_PUBLIC_DOMAIN` to use a Railway host
when `BASE_URL` is unset. `PUBLIC_DIR` optionally serves static files from a
directory, including `index.html` at `/`.

The API provides `POST /api/links`, `GET /api/links`, and `GET /:code`.
