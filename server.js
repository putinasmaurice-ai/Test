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

async function parseChatBody(req, res) {
  if (!API_KEY) {
    send(res, 500, JSON.stringify({
      error: 'DEEPSEEK_API_KEY ist nicht gesetzt. Starte mit: DEEPSEEK_API_KEY=sk-xxx node server.js'
    }), { 'Content-Type': 'application/json' });
    return null;
  }
  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    send(res, 400, JSON.stringify({ error: 'invalid JSON' }), { 'Content-Type': 'application/json' });
    return null;
  }
  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    send(res, 400, JSON.stringify({ error: 'messages required' }), { 'Content-Type': 'application/json' });
    return null;
  }
  return payload;
}

function buildUpstreamBody(payload, stream) {
  const { messages, model, temperature, response_format, max_tokens } = payload;
  return {
    model: model || DEFAULT_MODEL,
    messages,
    temperature: temperature ?? 0.7,
    max_tokens: max_tokens ?? 1024,
    stream,
    ...(response_format ? { response_format } : {})
  };
}

async function handleChat(req, res) {
  const payload = await parseChatBody(req, res);
  if (!payload) return;

  try {
    const upstream = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(buildUpstreamBody(payload, false))
    });
    const text = await upstream.text();
    res.writeHead(upstream.status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(text);
  } catch (err) {
    send(res, 502, JSON.stringify({ error: 'upstream error', detail: String(err) }), { 'Content-Type': 'application/json' });
  }
}

async function handleChatStream(req, res) {
  const payload = await parseChatBody(req, res);
  if (!payload) return;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  try {
    const upstream = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify(buildUpstreamBody(payload, true))
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => 'upstream error');
      res.write(`event: error\ndata: ${JSON.stringify({ error: errText })}\n\n`);
      return res.end();
    }

    // Pipe SSE chunks straight through to the client
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
    res.end();
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: String(err) })}\n\n`);
    res.end();
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
  if (req.method === 'POST' && req.url === '/api/chat/stream') return handleChatStream(req, res);
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
