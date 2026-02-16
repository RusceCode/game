# PROJECT: ECHOFALL (Vision → Reality)

Je vroeg om hoog in te zetten: niet een simpel spelletje, maar denken als een **AAA-studio**.

Dit project is daarom opgezet in twee lagen:

1. **Droombeeld (north star):** de ultieme gamevisie.
2. **Realistische start:** een speelbare vertical slice die technisch schaalbaar is.

---

## 1) Droombeeld: de ultieme game

**Titel:** ECHOFALL  
**Genre:** Cinematic Action RPG + Squad Tactics + Co-op / PvE live events  
**Pijlers:**
- Filmische combat met superstrakke controls
- Wereld die reageert op keuzes (faction politics)
- Skill-expression (movement, timing, buildcraft)
- Community-endgame met raids/world bosses

Stel je een mix voor van:
- gameplay-flow van snelle action games,
- narrative impact van grote RPG’s,
- en de social longevity van live-service events.

---

## 2) Terugredeneren: wat is nu haalbaar?

In plaats van meteen “alles”, starten we met een **vertical slice** die de kern bewijst:
- Responsieve movement
- Combat loop (schieten + dash + speciale ability)
- AI enemies in waves
- Mini-boss encounter
- XP / levels / upgrades
- Diegetische HUD met cooldowns en game state

Dit is precies wat in deze repo staat.

---

## 3) Wat je nu kunt spelen

Deze build is een top-down combat prototype in canvas:
- Beweeg als een “Vanguard” over een arena
- Schiet op drones
- Gebruik **Dash** en **Pulse Nova** slim op cooldown
- Overleef waves en versla de boss
- Verdien XP, level up en word sterker

### Controls
- **WASD / pijltjes:** bewegen
- **Muis:** richten
- **Linkermuisknop:** schieten
- **Shift:** Dash
- **Q:** Pulse Nova (area burst)
- **R:** Herstart run

---

## 4) Waarom dit een goede AAA-start is

De code is bewust opgesplitst in systemen in `game.js`:
- state & progression
- player ability systems
- enemy spawning / scaling
- collision + damage model
- UI sync + cinematic messaging

Met deze basis kunnen we iteratief doorgroeien naar:
1. betere art/audio
2. class system + talents
3. map objectives
4. co-op netcode
5. content pipeline

---

## 5) Runnen

Open `index.html` direct in de browser,
of run een server:

```bash
python3 -m http.server 8000
```

Ga daarna naar:

`http://localhost:8000`
