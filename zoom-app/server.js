'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const MAX_BODY = 8 * 1024 * 1024, MAX_UPSTREAM = 1024 * 1024, UPSTREAM_TIMEOUT_MS = 8000;
const PUBLIC = path.resolve(__dirname, 'public');

function secure(res, type = 'application/json; charset=utf-8') {
  res.setHeader('Content-Type', type);
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://appssdk.zoom.us; connect-src 'self'; img-src 'self' data:; media-src 'self' blob:; style-src 'self'; frame-ancestors https://zoom.us https://*.zoom.us");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=()');
}
function staticFile(url) {
  let decoded;
  try { decoded = decodeURIComponent(url.split('?')[0]); } catch (_) { return null; }
  if (decoded === '/core.js') return path.resolve(__dirname, '..', 'meeting-overlay', 'core.js');
  const resolved = path.resolve(PUBLIC, `.${decoded === '/' ? '/index.html' : decoded}`);
  return resolved.startsWith(`${PUBLIC}${path.sep}`) ? resolved : null;
}
function loopbackUrl(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname))
    throw new Error('INFERENCE_URL must be loopback HTTP');
  return parsed.toString();
}
function validSchema(data) {
  return data && typeof data.handDetected === 'boolean' &&
    (!data.handDetected || typeof (data.text || data.label) === 'string');
}
function inferencePayload(payload) {
  if (typeof payload.image !== 'string' || !/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(payload.image))
    throw new Error('image');
  const provider = payload.provider || 'static';
  if (!['static', 'ksl-experimental'].includes(provider)) throw new Error('provider');
  const result = { image: payload.image, provider };
  if (provider === 'ksl-experimental') {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(payload.sessionId || '')) throw new Error('session');
    result.sessionId = payload.sessionId;
  }
  return result;
}
function createServer(options = {}) {
  const inferenceUrl = loopbackUrl(options.inferenceUrl || process.env.INFERENCE_URL || 'http://127.0.0.1:5001/interpret');
  const fetchImpl = options.fetch || fetch, timeoutMs = options.timeoutMs || UPSTREAM_TIMEOUT_MS;
  const csrfToken = options.csrfToken || crypto.randomBytes(24).toString('base64url');
  return http.createServer((req, res) => {
    secure(res);
    if (req.method === 'GET' && req.url === '/api/config') return res.end(JSON.stringify({ csrfToken }));
    if (req.method === 'POST' && req.url === '/api/interpret') {
      const origin = req.headers.origin, expectedHost = req.headers['x-forwarded-host'] || req.headers.host;
      if (req.headers['x-csrf-token'] !== csrfToken || !origin || new URL(origin).host !== expectedHost) {
        res.statusCode = 403;
        return res.end(JSON.stringify({ error: 'Request origin or token is invalid' }));
      }
      let size = 0, body = '', ended = false, upstreamController;
      const fail = (status, error) => {
        if (ended) return;
        ended = true;
        if (upstreamController) upstreamController.abort();
        res.statusCode = status;
        res.end(JSON.stringify({ error }));
      };
      req.setEncoding('utf8');
      req.on('data', chunk => {
        if (ended) return;
        size += Buffer.byteLength(chunk);
        if (size > MAX_BODY) { fail(413, 'Frame payload is too large'); req.destroy(); } else body += chunk;
      });
      req.on('error', () => fail(400, 'Request stream failed'));
      req.on('aborted', () => { if (upstreamController) upstreamController.abort(); });
      req.on('end', async () => {
        if (ended) return;
        let payload;
        try { payload = inferencePayload(JSON.parse(body)); }
        catch (_) { return fail(400, 'A valid image, provider, and session are required'); }
        upstreamController = new AbortController();
        const timer = setTimeout(() => upstreamController.abort(), timeoutMs);
        try {
          const upstream = await fetchImpl(inferenceUrl, { method: 'POST',
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
            signal: upstreamController.signal });
          const text = await upstream.text();
          if (Buffer.byteLength(text) > MAX_UPSTREAM) throw new Error('bounds');
          let data;
          try { data = JSON.parse(text); } catch (_) { throw new Error('schema'); }
          if (!validSchema(data)) throw new Error('schema');
          if (ended) return;
          ended = true;
          res.statusCode = upstream.status;
          res.end(JSON.stringify(data));
        } catch (_) { fail(502, 'Inference service unavailable or returned an invalid response'); }
        finally { clearTimeout(timer); }
      });
      return;
    }
    if (req.method !== 'GET') { res.statusCode = 405; return res.end('Method not allowed'); }
    const file = staticFile(req.url);
    if (!file) { res.statusCode = 404; return res.end('Not found'); }
    fs.readFile(file, (error, data) => {
      if (error) { res.statusCode = 404; return res.end('Not found'); }
      secure(res, path.extname(file) === '.js' ? 'text/javascript; charset=utf-8'
        : path.extname(file) === '.css' ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8');
      res.end(data);
    });
  });
}
if (require.main === module) createServer().listen(Number(process.env.PORT || 3001), '127.0.0.1', () =>
  console.log(`Zoom App listening on http://127.0.0.1:${process.env.PORT || 3001}`));
module.exports = { createServer, MAX_BODY, MAX_UPSTREAM, UPSTREAM_TIMEOUT_MS,
  staticFile, loopbackUrl, validSchema, inferencePayload };
