# PROJECT: ECHOFALL (Vision → Reality)

Je vroeg om hoog in te zetten: niet een simpel spelletje, maar denken als een **AAA-studio**.

Dit project is opgezet in twee lagen:
1. **Droombeeld (north star):** de ultieme gamevisie.
2. **Realistische start:** een speelbare vertical slice die technisch schaalbaar is.

---

## Wat is nu nieuw (art + audio polish)

De vertical slice is nu visueel en auditief zwaar opgewaardeerd:

### Art-upgrades
- Meerdere achtergrondlagen met parallax sterrenveld.
- Sterkere sci-fi color grading + glow/vignette post-effecten.
- Screen shake + screen flash feedback op abilities/hits/events.
- Betere material look via gradients (player/enemy/boss).
- Projectile glow, impact particles en trail effects.
- Meer cinematic HUD-presentatie.

### Audio-upgrades (procedural, geen externe assets)
- Dynamische synth soundtrack (real-time gegenereerd via WebAudio).
- Event-based SFX:
  - shoot
  - enemy shoot
  - dash
  - nova
  - hurt
  - kill
  - level up
  - boss entrance
  - victory / fail
- Audio toggle in UI (`Audio: AAN/UIT`).

> Audio start na eerste interactie (browser policy).

---

## Controls
- **WASD / pijltjes:** bewegen
- **Muis:** richten
- **Linkermuisknop:** schieten
- **Shift:** Dash
- **Q:** Pulse Nova
- **R:** Herstart run
- **Audio knop:** audio aan/uit

---

## Waarom dit een goede AAA-start is

Deze build combineert:
- combat feel,
- readability,
- emotionele feedback via audio/FX,
- en systems die door te bouwen zijn naar faction politics + campaign + co-op.

Precies wat je vroeg: geen concessie aan de droom, maar wel een realistische stap die nu al “presence” heeft.

---

## Runnen
Open `index.html` direct in je browser,
of run lokaal:

```bash
python3 -m http.server 8000
```

Ga daarna naar `http://localhost:8000`.
