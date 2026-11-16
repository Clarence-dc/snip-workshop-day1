#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');
const os = require('node:os');

const DEFAULT_API = 'http://localhost:3000';
const REQUEST_TIMEOUT_MS = 10000;

function usage() {
  return [
    'Usage:',
    '  snip add <url>    Create a short link',
    '  snip ls           List links and hit counts',
    '  snip open <code>  Open a short link in the browser',
    '  snip help         Show this help',
  ].join('\n');
}

function apiBaseUrl() {
  const raw = process.env.SNIP_API || DEFAULT_API;
  const parsed = new URL(raw);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('SNIP_API must use http or https');
  }
  return parsed.href.replace(/\/+$/, '');
}

function validHttpUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      ...options,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error.name === 'TimeoutError') {
      throw new Error('API request timed out');
    }
    throw new Error(`Could not reach the Snip API: ${error.message}`);
  }
  return response;
}

async function responseError(response) {
  let detail = '';
  try {
    const body = await response.json();
    if (body && typeof body.error === 'string') detail = `: ${body.error}`;
  } catch {
    // Error responses are not required to have a JSON body.
  }
  return new Error(`API returned ${response.status}${detail}`);
}

async function readJson(response) {
  if (!response.ok) throw await responseError(response);
  try {
    return await response.json();
  } catch {
    throw new Error('API returned invalid JSON');
  }
}

function formatLinks(links) {
  if (links.length === 0) return 'No links yet.';

  const rows = links.map((link) => ({
    code: String(link.code),
    hits: String(link.hits),
    url: String(link.url),
  }));
  const codeWidth = Math.max(4, ...rows.map((row) => row.code.length));
  const hitsWidth = Math.max(4, ...rows.map((row) => row.hits.length));
  const header = `${'CODE'.padEnd(codeWidth)}  ${'HITS'.padStart(hitsWidth)}  URL`;
  const divider = `${'-'.repeat(codeWidth)}  ${'-'.repeat(hitsWidth)}  ${'-'.repeat(3)}`;
  return [
    header,
    divider,
    ...rows.map((row) => `${row.code.padEnd(codeWidth)}  ${row.hits.padStart(hitsWidth)}  ${row.url}`),
  ].join('\n');
}

function openInBrowser(target) {
  const platform = os.platform();
  let command;
  let args;
  if (platform === 'win32') {
    command = 'cmd.exe';
    args = ['/d', '/s', '/c', 'start', '""', `"${target.replace(/"/g, '""')}"`];
  } else if (platform === 'darwin') {
    command = 'open';
    args = [target];
  } else {
    command = 'xdg-open';
    args = [target];
  }

  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  child.once('error', (error) => {
    process.stderr.write(`Could not launch the browser: ${error.message}\n`);
    process.exitCode = 1;
  });
  child.unref();
}

async function run(args) {
  const [command, ...rest] = args;
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    if (rest.length > 0) throw new Error('Help does not accept additional arguments');
    process.stdout.write(`${usage()}\n`);
    return;
  }

  if (command === 'add') {
    if (rest.length !== 1 || !validHttpUrl(rest[0])) {
      throw new Error('Usage: snip add <http-or-https-url>');
    }
    const response = await request('/api/links', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: rest[0] }),
    });
    const link = await readJson(response);
    if (typeof link.shortUrl !== 'string') {
      throw new Error('API response is missing shortUrl');
    }
    process.stdout.write(`${link.shortUrl}\n`);
    return;
  }

  if (command === 'ls') {
    if (rest.length !== 0) throw new Error('Usage: snip ls');
    const links = await readJson(await request('/api/links'));
    if (!Array.isArray(links)) throw new Error('API response is not a links array');
    process.stdout.write(`${formatLinks(links)}\n`);
    return;
  }

  if (command === 'open') {
    if (rest.length !== 1 || !/^[A-Za-z0-9]{6}$/.test(rest[0])) {
      throw new Error('Usage: snip open <six-character-code>');
    }
    const response = await request(`/${encodeURIComponent(rest[0])}`, { redirect: 'manual' });
    if (response.status === 404) throw new Error(`Unknown short code: ${rest[0]}`);
    if (response.status !== 302) throw await responseError(response);
    const location = response.headers.get('location');
    if (!location) throw new Error('API redirect did not include a Location');
    let target;
    try {
      target = new URL(location, `${apiBaseUrl()}/`);
    } catch {
      throw new Error('API redirect did not include a valid Location');
    }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      throw new Error('API redirect target must use http or https');
    }
    openInBrowser(target.href);
    return;
  }

  throw new Error(`Unknown command: ${command}\n${usage()}`);
}

run(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
