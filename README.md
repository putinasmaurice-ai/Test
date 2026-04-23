# NEXUS — dein Leben, intelligent

Eine mobile PWA, die fünf KI-Module in einer App vereint — angetrieben von der **DeepSeek API**.

| Modul | Idee | Live-KI? |
|---|---|---|
| **Agent** (Home) | Proaktiver KI-Agent, erledigt Aufgaben autonom. Prompt-Bar unten ruft DeepSeek auf. | ✅ DeepSeek |
| **Lens** | AR-Kamera mit multimodaler Analyse (Produkte, Verträge, Haut, Übersetzung). | Demo-Daten |
| **Twin** | Decision-Twin — Monte-Carlo-Simulation deiner Entscheidungen, JSON-Antwort. | ✅ DeepSeek |
| **Signal** | Passive Gesundheit (Stimm-Biomarker, HRV, Tipp-Muster). | Mock-Sensorik |
| **Chrono** | Durchsuchbares Gedächtnis aller Gespräche und Ideen. | Lokale Suche |

## Setup

```bash
# 1. DeepSeek API Key besorgen → https://platform.deepseek.com/
# 2. Server starten:
DEEPSEEK_API_KEY=sk-xxxxx node server.js

# Optional:
DEEPSEEK_MODEL=deepseek-chat       # default
# oder:
DEEPSEEK_MODEL=deepseek-reasoner   # für tiefere Twin-Analysen
PORT=8080
```

Dann im Browser: **http://localhost:8080**

Auf dem Handy testen: gleiche LAN-IP nutzen, z.B. `http://192.168.1.42:8080`. Im Browser-Menü → "Zum Home-Bildschirm hinzufügen" → fühlt sich an wie eine echte App.

## Architektur

```
Browser (PWA)  ──► /api/chat (Node-Proxy)  ──► api.deepseek.com
                   ▲
                   └── API-Key bleibt server-seitig (Bearer-Token im ENV)
```

Der Proxy ist nötig, weil:
1. **CORS**: DeepSeek erlaubt keine direkten Browser-Calls.
2. **Sicherheit**: Der API-Key darf nie ins Frontend.

## Struktur

```
index.html      App-Shell + 5 Screens
styles.css      Dark Theme, Glassmorphism, Animationen
app.js          Module-Logik + DeepSeek-Calls
server.js       Node-Proxy für DeepSeek + Static-File-Server
manifest.json   PWA-Config
icon.svg        App-Icon
```

## Was als Nächstes?

- **Lens** an `deepseek-vl` anbinden (Vision) für echte Produkt-/Vertrags-Scans
- **Chrono** mit Embeddings-Suche (semantische Suche statt Substring)
- **Streaming**-Antworten für den Agent (Token-für-Token)
- **Tool-Calling**: Agent ruft Kalender-/E-Mail-/Banking-APIs autonom auf
