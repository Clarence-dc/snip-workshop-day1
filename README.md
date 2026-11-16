# Snip CLI

A zero-dependency Node.js command-line client for the Snip URL shortener. Requires
Node.js 20 or newer. Set `SNIP_API` to the backend origin; it defaults to
`http://localhost:3000`.

```sh
node cli.js add https://example.com
node cli.js ls
node cli.js open abc123
node cli.js help
```

The `snip`, `snip.cmd`, and `snip.ps1` wrappers forward their arguments to `cli.js`.
