// =====================================================
// NEXUS — Unified Intelligence App
// =====================================================

// ---------- Clock ----------
function tickClock() {
  const c = document.getElementById('clock');
  const d = new Date();
  c.textContent = d.toTimeString().slice(0, 5);
}
tickClock();
setInterval(tickClock, 30000);

// ---------- Greeting ----------
(() => {
  const h = new Date().getHours();
  const greet = document.getElementById('greet');
  if (h < 5) greet.textContent = 'Gute Nacht,';
  else if (h < 12) greet.textContent = 'Guten Morgen,';
  else if (h < 18) greet.textContent = 'Guten Tag,';
  else greet.textContent = 'Guten Abend,';
})();

// ---------- Navigation ----------
const navBtns = document.querySelectorAll('.nav-btn');
const screens = document.querySelectorAll('.screen');
navBtns.forEach(b => {
  b.addEventListener('click', () => {
    const target = b.dataset.target;
    navBtns.forEach(x => x.classList.toggle('active', x === b));
    screens.forEach(s => s.classList.toggle('active', s.dataset.screen === target));
    if (target === 'signal') animateRings();
    if (target === 'signal') drawWaveform();
  });
});

// ---------- LifeOS Agent ----------
const agentSuggestions = [
  {
    icon: '✈️',
    title: 'Flug LH441 ist 90 Min verspätet',
    body: 'Soll ich das Hotel auf späten Check-In umbuchen und dem Meeting-Host Bescheid geben?',
    primary: 'Ja, übernimm das',
    ghost: 'Später'
  },
  {
    icon: '🎂',
    title: 'Mama hat Sonntag Geburtstag',
    body: 'Sie liebt den Wein, den dir Tom 2024 empfohlen hat. Ich kann ihn mit Karte bis Samstag liefern lassen.',
    primary: 'Bestellen (€42)',
    ghost: 'Anders'
  },
  {
    icon: '⚡',
    title: 'Stromtarif 23% günstiger verfügbar',
    body: 'Habe deine letzten 12 Monate analysiert. Wechsel spart €312/Jahr. Kündige ich für dich.',
    primary: 'Wechseln',
    ghost: 'Details'
  },
  {
    icon: '🩺',
    title: 'Hautarzt-Termin verfügbar',
    body: 'Lens hat letzte Woche eine Auffälligkeit erkannt. Termin am Do 10:30 frei — passt in deinen Kalender.',
    primary: 'Buchen',
    ghost: 'Verschieben'
  }
];
const acEl = document.getElementById('agent-cards');
agentSuggestions.forEach((s, i) => {
  const card = document.createElement('div');
  card.className = 'agent-card';
  card.style.animationDelay = `${i * 80}ms`;
  card.innerHTML = `
    <span class="ac-icon">${s.icon}</span>
    <h3>${s.title}</h3>
    <p>${s.body}</p>
    <div class="ac-actions">
      <button class="ac-btn primary">${s.primary}</button>
      <button class="ac-btn ghost">${s.ghost}</button>
    </div>`;
  card.querySelector('.primary').addEventListener('click', e => {
    e.stopPropagation();
    card.style.transition = 'opacity .3s, transform .3s';
    card.style.opacity = '0';
    card.style.transform = 'translateX(40px)';
    setTimeout(() => card.remove(), 300);
  });
  card.querySelector('.ghost').addEventListener('click', e => {
    e.stopPropagation();
    card.style.opacity = '0.4';
  });
  // Tap card body → open chat seeded with this suggestion as context
  card.addEventListener('click', () => {
    chatReset();
    chatOpen(`${s.icon} ${s.title}\n\n${s.body}`);
  });
  acEl.appendChild(card);
});

const activities = [
  '06:42 — Steuer-Belege aus Mails extrahiert und in DATEV abgelegt',
  '07:15 — Lieferung umgeleitet an Nachbar (du bist nicht zuhause)',
  '07:48 — Reklamation bei Vodafone abgeschlossen, €37 erstattet',
  '08:20 — 4 Spam-Anrufe für dich beantwortet und blockiert',
  '08:55 — Konferenzraum für 14:00 Meeting umgebucht (zu klein)'
];
const al = document.getElementById('activity-log');
activities.forEach(a => {
  const li = document.createElement('li');
  li.innerHTML = `<span class="check">✓</span><span>${a}</span>`;
  al.appendChild(li);
});

// ---------- DeepSeek API helpers ----------
async function callDeepSeek({ messages, jsonSchema = null, temperature = 0.7, maxTokens = 1024 }) {
  const body = { messages, temperature, max_tokens: maxTokens };
  if (jsonSchema) body.response_format = { type: 'json_object' };
  const r = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'API-Fehler');
  const content = data?.choices?.[0]?.message?.content ?? '';
  return jsonSchema ? JSON.parse(content) : content;
}

// Streaming via SSE. onDelta receives each token chunk; resolves to full text.
async function streamDeepSeek({ messages, temperature = 0.7, maxTokens = 1024, onDelta, signal }) {
  const r = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, temperature, max_tokens: maxTokens }),
    signal
  });
  if (!r.ok || !r.body) {
    let detail = 'Streaming nicht verfügbar';
    try { detail = (await r.json()).error || detail; } catch {}
    throw new Error(detail);
  }
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const event = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of event.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          const delta = json?.choices?.[0]?.delta?.content || '';
          if (delta) {
            full += delta;
            onDelta && onDelta(delta, full);
          }
        } catch { /* ignore non-JSON heartbeat */ }
      }
    }
  }
  return full;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ---------- Chat overlay (multi-turn, streaming) ----------
const AGENT_SYSTEM = `Du bist NEXUS, ein hochintelligenter persönlicher KI-Agent in einer modernen mobilen Life-OS App.
Du sprichst Deutsch, bist proaktiv, präzise und warm.
Antworten sind kompakt für ein Handy: kurze Absätze, idealerweise unter 4 Sätzen.
Wenn eine Aktion sinnvoll wäre, beschreibe konkret, was du autonom übernehmen würdest, und biete eine Bestätigungs-Frage an.
Du erinnerst dich an die laufende Konversation und beziehst dich auf vorher Gesagtes.`;

const chat = {
  overlay: document.getElementById('chat-overlay'),
  thread: document.getElementById('chat-thread'),
  input: document.getElementById('chat-input'),
  send: document.getElementById('chat-send'),
  state: document.getElementById('chat-state'),
  messages: [],
  busy: false,
  abortCtrl: null
};

function chatOpen(seed) {
  chat.overlay.classList.add('open');
  chat.overlay.setAttribute('aria-hidden', 'false');
  if (seed && chat.messages.length === 0) {
    addBubble('assistant', seed);
    chat.messages.push({ role: 'assistant', content: seed });
  }
  setTimeout(() => chat.input.focus(), 350);
}

function chatClose() {
  chat.overlay.classList.remove('open');
  chat.overlay.setAttribute('aria-hidden', 'true');
  if (chat.abortCtrl) chat.abortCtrl.abort();
}

function chatReset() {
  chat.messages = [];
  chat.thread.innerHTML = '';
  chat.input.value = '';
  chat.state.textContent = 'online · denkt mit';
}

function addBubble(role, text) {
  const el = document.createElement('div');
  el.className = `bubble ${role}`;
  el.textContent = text;
  chat.thread.appendChild(el);
  chat.thread.scrollTop = chat.thread.scrollHeight;
  return el;
}

async function sendChat(userText) {
  const text = (userText ?? chat.input.value).trim();
  if (!text || chat.busy) return;
  chat.input.value = '';
  chat.busy = true;
  chat.send.disabled = true;
  chat.state.textContent = 'tippt …';

  addBubble('user', text);
  chat.messages.push({ role: 'user', content: text });

  const bubble = addBubble('assistant', '');
  bubble.innerHTML = '<span class="cursor"></span>';

  chat.abortCtrl = new AbortController();

  try {
    const messages = [{ role: 'system', content: AGENT_SYSTEM }, ...chat.messages];
    let assembled = '';
    await streamDeepSeek({
      messages,
      temperature: 0.7,
      maxTokens: 600,
      signal: chat.abortCtrl.signal,
      onDelta: (_delta, full) => {
        assembled = full;
        bubble.innerHTML = escapeHtml(full).replace(/\n/g, '<br>') + '<span class="cursor"></span>';
        chat.thread.scrollTop = chat.thread.scrollHeight;
      }
    });
    bubble.innerHTML = escapeHtml(assembled).replace(/\n/g, '<br>');
    chat.messages.push({ role: 'assistant', content: assembled });
  } catch (err) {
    bubble.innerHTML = `<span style="color:var(--danger)">Fehler: ${escapeHtml(err.message)}</span>`;
  } finally {
    chat.busy = false;
    chat.send.disabled = false;
    chat.state.innerHTML = '<span class="pulse"></span><span>online · denkt mit</span>';
  }
}

document.getElementById('chat-close').addEventListener('click', chatClose);
document.getElementById('chat-reset').addEventListener('click', chatReset);
chat.send.addEventListener('click', () => sendChat());
chat.input.addEventListener('keydown', e => {
  if (e.key === 'Enter') sendChat();
});

// Prompt bar on home → opens chat with that question
function submitPrompt() {
  const inp = document.getElementById('prompt-input');
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  chatReset();
  chatOpen();
  sendChat(text);
}
document.getElementById('prompt-send').addEventListener('click', submitPrompt);
document.getElementById('prompt-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') submitPrompt();
});

// ---------- Lens ----------
const lensData = {
  product: {
    targets: [
      { x: 30, y: 25, label: 'Müsli' },
      { x: 65, y: 50, label: 'Joghurt' }
    ],
    hint: 'Tippe ein Produkt zum Scannen',
    result: () => `
      <h3>Bio Hafer-Müsli · Marke X</h3>
      <div class="tag-row">
        <span class="tag warn">Palmöl</span>
        <span class="tag info">Nutri-Score B</span>
        <span class="tag ok">Bio</span>
      </div>
      <p style="color:var(--text-dim);font-size:13px;margin:8px 0">
        Günstigere Alternative ohne Palmöl: <strong style="color:var(--text)">Marke Y · €3.49</strong> (2 Regale weiter, Gang 7).
      </p>
      <ul>
        <li>14g Zucker / 100g — über deinem Tagesbudget</li>
        <li>Allergen: Soja, Spuren von Nüssen</li>
        <li>CO₂-Footprint: 1.2 kg/kg (Mittelfeld)</li>
      </ul>`
  },
  contract: {
    targets: [{ x: 50, y: 40, label: 'Vertrag' }],
    hint: 'Tippe um Vertrag zu analysieren',
    result: () => `
      <h3>Mietvertrag · 12 Seiten</h3>
      <div class="tag-row">
        <span class="tag danger">2 Risiko-Klauseln</span>
        <span class="tag warn">1 ungewöhnlich</span>
      </div>
      <ul>
        <li><strong style="color:var(--danger)">§7.3</strong> Kaution-Rückzahlung "nach Ermessen" — unwirksam laut BGH-Urteil 2019</li>
        <li><strong style="color:var(--danger)">§12</strong> Schönheitsreparaturen pauschal — nicht zulässig</li>
        <li><strong style="color:var(--warn)">§9</strong> Mieterhöhung-Frequenz höher als ortsüblich</li>
      </ul>
      <p style="color:var(--text-dim);font-size:13px;margin-top:10px">
        Soll ich Gegenvorschlag formulieren und an Vermieter senden?
      </p>`
  },
  health: {
    targets: [{ x: 45, y: 50, label: 'Hautstelle' }],
    hint: 'Auffällige Stelle scannen',
    result: () => `
      <h3>Pigmentveränderung · linker Unterarm</h3>
      <div class="tag-row">
        <span class="tag warn">Beobachten</span>
        <span class="tag info">ABCDE-Score 3.2</span>
      </div>
      <p style="color:var(--text-dim);font-size:13px;margin:8px 0">
        Asymmetrie und Randstruktur leicht auffällig. Wahrscheinlichkeit benigne: 87%.
        Empfehlung: Dermatologen-Check innerhalb 4 Wochen.
      </p>
      <ul>
        <li>Vergleich zu deinem Foto vor 6 Mon: +2.1 mm Durchmesser</li>
        <li>Termin-Vorschlag: Dr. Weber, Do 10:30</li>
      </ul>`
  },
  translate: {
    targets: [{ x: 35, y: 35, label: 'Schild' }, { x: 70, y: 60, label: 'Menü' }],
    hint: 'Text antippen für Live-Übersetzung',
    result: () => `
      <h3>"Bacalhau à Brás"</h3>
      <p style="font-size:14px">→ Stockfisch mit Kartoffelstroh, Eiern und Oliven · portugiesisches Nationalgericht</p>
      <div class="tag-row">
        <span class="tag info">Enthält Fisch</span>
        <span class="tag warn">Glutenfrei: ja</span>
        <span class="tag ok">Lokaltyp</span>
      </div>
      <p style="color:var(--text-dim);font-size:12px;margin-top:8px">
        Kulturhinweis: Wird traditionell mit Vinho Verde getrunken. Im Restaurant für €14 ein guter Preis (Ortsdurchschnitt €16).
      </p>`
  }
};

let currentMode = 'product';
function renderTargets() {
  const t = document.getElementById('targets');
  const hintEl = document.querySelector('.lens-hint');
  t.innerHTML = '';
  const data = lensData[currentMode];
  hintEl.textContent = data.hint;
  data.targets.forEach(p => {
    const el = document.createElement('div');
    el.className = 'target';
    el.style.left = `${p.x}%`;
    el.style.top = `${p.y}%`;
    el.dataset.label = p.label;
    el.addEventListener('click', () => {
      document.getElementById('lens-result').innerHTML = data.result();
    });
    t.appendChild(el);
  });
  document.getElementById('lens-result').innerHTML = '<div class="empty">Bereit zum Scannen.</div>';
}
document.querySelectorAll('.mode-btn').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    currentMode = b.dataset.mode;
    renderTargets();
  });
});
renderTargets();

// ---------- Twin (DeepSeek-powered) ----------
const TWIN_SYSTEM = `Du bist "Decision Twin" — ein digitaler Entscheidungs-Zwilling in einer modernen Life-OS App.
Du analysierst Lebensentscheidungen wie ein scharfsinniger, ehrlicher Mentor mit Daten-Mindset.
Du musst IMMER mit gültigem JSON antworten, exakt nach diesem Schema:

{
  "score": <Zahl 0-100, wie sehr du diese Entscheidung empfiehlst>,
  "label": "<kurzes Verdict in Großbuchstaben, max 6 Wörter, z.B. 'EHER JA — mit Bedingungen'>",
  "text": "<2-3 Sätze auf Deutsch mit konkreter Begründung>",
  "factors": [
    { "name": "<Faktor-Name>", "value": <0-100>, "note": "<kurzer Wert, z.B. '+€94k', 'mittel', '-22%'>" }
  ],
  "monteCarlo": "<1 Satz auf Deutsch mit Monte-Carlo-Aussage zur Wahrscheinlichkeit>"
}

Liefere genau 5 Faktoren. Sei spezifisch und nutze realistische Zahlen.`;

function renderTwinResult(data) {
  const el = document.getElementById('twin-result');
  const factors = (data.factors || []).slice(0, 5);
  el.innerHTML = `
    <div class="twin-card twin-verdict">
      <h3>Verdict des Twins</h3>
      <div class="verdict-score">${data.score ?? '–'}</div>
      <div class="verdict-label">${escapeHtml(data.label || '')}</div>
      <p class="verdict-text">${escapeHtml(data.text || '')}</p>
    </div>
    <div class="twin-card">
      <h3>Faktoren-Analyse</h3>
      ${factors.map(f => `
        <div class="factor-row">
          <span style="flex:0 0 40%;font-size:13px">${escapeHtml(f.name)}</span>
          <div class="factor-bar"><span style="width:${Math.max(0, Math.min(100, f.value))}%"></span></div>
          <span class="factor-val">${escapeHtml(f.note ?? '')}</span>
        </div>
      `).join('')}
    </div>
    <div class="twin-card">
      <h3>Monte-Carlo · 10.000 Simulationen</h3>
      <p style="font-size:13px;color:var(--text-dim);line-height:1.6;margin:0">
        ${escapeHtml(data.monteCarlo || '')}
      </p>
    </div>`;
}

function renderTwinLoading(question) {
  document.getElementById('twin-result').innerHTML = `
    <div class="twin-card">
      <h3>Twin simuliert …</h3>
      <p style="font-size:13px;color:var(--text-dim);margin:0">
        <span class="pulse" style="display:inline-block;margin-right:8px"></span>
        Analysiere "${escapeHtml(question)}" gegen dein Profil und 10.000 mögliche Lebensverläufe.
      </p>
    </div>`;
}

function renderTwinError(msg) {
  document.getElementById('twin-result').innerHTML = `
    <div class="twin-card">
      <h3>Fehler</h3>
      <p style="font-size:13px;color:var(--danger);margin:0">${escapeHtml(msg)}</p>
    </div>`;
}

async function runTwin(question) {
  const q = (question || '').trim();
  if (!q) return;
  renderTwinLoading(q);
  try {
    const data = await callDeepSeek({
      messages: [
        { role: 'system', content: TWIN_SYSTEM },
        { role: 'user', content: q }
      ],
      jsonSchema: true,
      temperature: 0.6,
      maxTokens: 800
    });
    renderTwinResult(data);
  } catch (err) {
    renderTwinError(err.message);
  }
}

document.getElementById('twin-run').addEventListener('click', () => {
  runTwin(document.getElementById('twin-input').value);
});
document.querySelectorAll('.twin-suggestions .chip').forEach(c => {
  c.addEventListener('click', () => {
    document.getElementById('twin-input').value = c.dataset.q;
    runTwin(c.dataset.q);
  });
});

// ---------- Signal ----------
function animateRings() {
  const circumference = 2 * Math.PI * 42;
  document.querySelectorAll('.ring').forEach(r => {
    const pct = parseInt(r.dataset.pct, 10);
    const fg = r.querySelector('.fg');
    if (!fg) return;
    const offset = circumference - (pct / 100) * circumference;
    fg.style.strokeDasharray = circumference;
    fg.style.strokeDashoffset = circumference;
    requestAnimationFrame(() => {
      setTimeout(() => { fg.style.strokeDashoffset = offset; }, 100);
    });
    if (r.querySelector('span')) {
      r.querySelector('span').textContent = pct;
    }
  });
  // Color tweaks
  const energy = document.getElementById('ring-energy');
  const stress = document.getElementById('ring-stress');
  const sleep = document.getElementById('ring-sleep');
  if (energy) energy.style.stroke = '#00e0ff';
  if (stress) stress.style.stroke = '#ffb547';
  if (sleep) sleep.style.stroke = '#4ade80';
}

function drawWaveform() {
  const canvas = document.getElementById('voice-wave');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Build smooth wave
  const points = 80;
  const pts = [];
  for (let i = 0; i < points; i++) {
    const x = (i / (points - 1)) * w;
    const y = h / 2 + Math.sin(i * 0.4) * 20 * Math.sin(i * 0.07) + (Math.random() - 0.5) * 8;
    pts.push([x, y]);
  }

  // Fill area
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(0, 224, 255, 0.5)');
  grad.addColorStop(1, 'rgba(0, 224, 255, 0)');
  ctx.beginPath();
  ctx.moveTo(0, h);
  pts.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Stroke
  ctx.beginPath();
  pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.strokeStyle = '#00e0ff';
  ctx.lineWidth = 2;
  ctx.shadowBlur = 8;
  ctx.shadowColor = '#00e0ff';
  ctx.stroke();
  ctx.shadowBlur = 0;
}

// Initial draw
animateRings();
drawWaveform();

// ---------- Chrono ----------
const memories = [
  {
    date: 'Heute · 14:32', tag: 'Meeting',
    title: 'Standup mit Produkt-Team',
    text: 'Anna präsentiert das neue Onboarding. Dein Punkt zu Push-Notifications wurde aufgenommen. <mark>3 To-Dos extrahiert.</mark>'
  },
  {
    date: 'Gestern · 19:48', tag: 'Gespräch',
    title: 'Abendessen mit Anna',
    text: '"Ich überlege ein <mark>Startup</mark> im Bereich Mental Health zu gründen." Anna sucht aktuell nach einem Co-Founder mit Tech-Hintergrund.'
  },
  {
    date: 'Mo · 11:20', tag: 'Idee',
    title: 'Spaziergang-Gedanke',
    text: 'Idee für SaaS: KI-gesteuerte Verhandlung mit Hotline-Mitarbeitern. Markt: ~80M EU-Nutzer mit Telefon-Frust.'
  },
  {
    date: '12.04 · 20:10', tag: 'Empfehlung',
    title: 'Tom über <mark>Wein</mark>',
    text: 'Tom empfiehlt: "Quinta do Crasto Reserva 2019" — perfekt für Mama. Bei Jacques\' Wein-Depot für €32 verfügbar.'
  },
  {
    date: '08.04 · 16:45', tag: 'Termin',
    title: '<mark>Arzt</mark>besuch Dr. Weber',
    text: 'Routine-Check ok. Empfehlung: Vitamin D testen lassen. Nächster Termin in 6 Monaten. Rezept ePA hinterlegt.'
  },
  {
    date: '02.04 · 09:15', tag: 'Lernen',
    title: 'Podcast: Hidden Brain',
    text: 'Studie zu "Decision Fatigue" — Menschen treffen pro Tag ~35.000 Entscheidungen. Relevanz für deine NEXUS-Idee.'
  }
];

function renderTimeline(filter = '') {
  const tl = document.getElementById('timeline');
  const f = filter.toLowerCase().trim();
  const filtered = f
    ? memories.filter(m => (m.title + m.text + m.tag).toLowerCase().includes(f))
    : memories;
  tl.innerHTML = filtered.length
    ? filtered.map(m => `
      <div class="memory">
        <div class="memory-head">
          <span class="memory-meta">${m.date}</span>
          <span class="memory-tag">${m.tag}</span>
        </div>
        <h4>${m.title}</h4>
        <p>${m.text}</p>
      </div>
    `).join('')
    : '<p style="color:var(--text-dim);text-align:center;padding:30px 0">Keine Erinnerungen gefunden.</p>';
}
renderTimeline();
document.getElementById('chrono-q').addEventListener('input', e => renderTimeline(e.target.value));
document.querySelectorAll('.chrono-suggestions .chip').forEach(c => {
  c.addEventListener('click', () => {
    document.getElementById('chrono-q').value = c.dataset.q;
    renderTimeline(c.dataset.q);
  });
});

// ---------- PWA ----------
if ('serviceWorker' in navigator) {
  // Optional: skip for prototype
}
