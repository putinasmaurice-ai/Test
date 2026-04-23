# NEXUS — dein Leben, intelligent

Eine mobile PWA, die fünf KI-Module in einer App vereint:

| Modul | Idee |
|---|---|
| **Agent** (Home) | Proaktiver KI-Agent — erledigt Aufgaben autonom (Kündigungen, Terminbuchungen, Reklamationen). |
| **Lens** | AR-Kamera mit multimodaler KI — scannt Produkte, Verträge, Hautstellen, übersetzt live. |
| **Twin** | Digitaler Entscheidungszwilling — Monte-Carlo-Simulation deiner Lebensentscheidungen. |
| **Signal** | Passive Gesundheit via Stimm-Biomarker, HRV, Tipp-Muster — Frühwarnsystem. |
| **Chrono** | Durchsuchbares Gedächtnis — alle Gespräche, Meetings, Ideen indiziert und abrufbar. |

## Demo starten

```bash
# einfach im Browser öffnen
xdg-open index.html

# oder als lokaler Server (für PWA-Install)
python3 -m http.server 8080
```

Auf dem Handy: Browser → `http://<deine-ip>:8080` → "Zum Home-Bildschirm hinzufügen".

## Stack
Pure HTML / CSS / JS. Keine Build-Tools, kein Framework. Single-page mit clientseitigem Routing.

## Struktur
```
index.html      App-Shell + 5 Screens
styles.css      Dark Theme, Glassmorphism, Animationen
app.js          Module-Logik, Demo-Daten, Interaktionen
manifest.json   PWA-Config
icon.svg        App-Icon
```
