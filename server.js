import { isAbsolute, relative, resolve, sep } from "node:path";
import { stat } from "node:fs/promises";

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const configuredBaseUrl =
  process.env.BASE_URL ??
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${port}`);
const baseUrl = new URL(configuredBaseUrl).origin.replace(/\/+$/, "");
const publicDir = process.env.PUBLIC_DIR
  ? resolve(process.env.PUBLIC_DIR)
  : null;
const links = new Map();
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return Response.json(data, { status, headers: corsHeaders });
}

function createCode() {
  const alphabet =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const maxByte = 256 - (256 % alphabet.length);
  let code = "";
  do {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte < maxByte) code += alphabet[byte % alphabet.length];
      if (code.length === 6) break;
    }
    if (links.has(code)) code = "";
  } while (code.length !== 6);
  return code;
}

async function staticFile(pathname) {
  if (!publicDir) return null;

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const requestPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const filePath = resolve(publicDir, `.${requestPath}`);
  const fileRelativePath = relative(publicDir, filePath);
  if (
    fileRelativePath === ".." ||
    fileRelativePath.startsWith(`..${sep}`) ||
    isAbsolute(fileRelativePath)
  ) {
    return null;
  }

  try {
    if (!(await stat(filePath)).isFile()) return null;
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return null;
    throw error;
  }

  return new Response(Bun.file(filePath), { headers: corsHeaders });
}

Bun.serve({
  hostname: "0.0.0.0",
  port,
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === "POST" && url.pathname === "/api/links") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Request body must be valid JSON" }, 400);
      }

      if (typeof body?.url !== "string") {
        return json({ error: "url must be a valid HTTP(S) URL" }, 400);
      }

      let parsedUrl;
      try {
        parsedUrl = new URL(body.url);
      } catch {
        return json({ error: "url must be a valid HTTP(S) URL" }, 400);
      }
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return json({ error: "url must be a valid HTTP(S) URL" }, 400);
      }

      const code = createCode();
      const link = {
        code,
        url: body.url,
        shortUrl: `${baseUrl}/${code}`,
        hits: 0,
        createdAt: new Date().toISOString(),
      };
      links.set(code, link);
      return json(link, 201);
    }

    if (request.method === "GET" && url.pathname === "/api/links") {
      return json(Array.from(links.values()));
    }

    if (request.method === "GET" || request.method === "HEAD") {
      const file = await staticFile(url.pathname);
      if (file) return file;
    }

    if (request.method === "GET" && /^\/[A-Za-z0-9]{6}$/.test(url.pathname)) {
      const code = url.pathname.slice(1);
      const link = links.get(code);
      if (link) {
        link.hits += 1;
        return new Response(null, {
          status: 302,
          headers: { ...corsHeaders, Location: link.url },
        });
      }
    }

    return json({ error: "Not found" }, 404);
  },
});

console.log(`Snip backend listening on http://localhost:${port}`);
