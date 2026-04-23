// NEXUS dev server + DeepSeek proxy
// Usage: DEEPSEEK_API_KEY=sk-xxx node server.js
//        open http://localhost:8080

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const API_KEY = process.env.DEEPSEEK_API_KEY;
const API_BASE = process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com';
const DEFAULT_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function handleChat(req, res) {
  if (!API_KEY) {
    return send(res, 500, JSON.stringify({
      error: 'DEEPSEEK_API_KEY ist nicht gesetzt. Starte mit: DEEPSEEK_API_KEY=sk-xxx node server.js'
    }), { 'Content-Type': 'application/json' });
  }

  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    return send(res, 400, JSON.stringify({ error: 'invalid JSON' }), { 'Content-Type': 'application/json' });
  }

  const { messages, model, temperature, response_format, max_tokens } = payload;
  if (!Array.isArray(messages) || messages.length === 0) {
    return send(res, 400, JSON.stringify({ error: 'messages required' }), { 'Content-Type': 'application/json' });
  }

  try {
    const upstream = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        messages,
        temperature: temperature ?? 0.7,
        max_tokens: max_tokens ?? 1024,
        ...(response_format ? { response_format } : {})
      })
    });

    const text = await upstream.text();
    res.writeHead(upstream.status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(text);
  } catch (err) {
    send(res, 502, JSON.stringify({ error: 'upstream error', detail: String(err) }), { 'Content-Type': 'application/json' });
  }
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  // Restrict to the project directory
  const filePath = path.join(__dirname, urlPath);
  if (!filePath.startsWith(__dirname)) return send(res, 403, 'forbidden');

  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, 'not found');
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    send(res, 200, data, { 'Content-Type': type });
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/chat') return handleChat(req, res);
  if (req.method === 'GET' && req.url === '/api/status') {
    return send(res, 200, JSON.stringify({ ok: true, hasKey: !!API_KEY, model: DEFAULT_MODEL }),
      { 'Content-Type': 'application/json' });
  }
  if (req.method === 'GET') return serveStatic(req, res);
  send(res, 405, 'method not allowed');
});

server.listen(PORT, () => {
  console.log(`NEXUS läuft auf http://localhost:${PORT}`);
  console.log(`DeepSeek key: ${API_KEY ? 'gesetzt ✓' : 'FEHLT — setze DEEPSEEK_API_KEY'}`);
  console.log(`Modell: ${DEFAULT_MODEL}`);
});
