# AETHER DOMINION — 3D Strategy/Management Vertical Slice

Je feedback was duidelijk: minder simpele 2D-feel, meer richting high-end strategy/management met serieuze visuals.
Daarom is de game volledig omgegooid naar een **3D RTS/management prototype**.

## Wat je nu speelt

Een 3D command simulation waarin je:
- economie runt (workers + crystal mining)
- base uitbouwt (turrets + habitats)
- golven vijanden afslaat
- resources managet (credits, energy, population)
- wint door meerdere waves te overleven

## Visual focus (maximaal binnen browser-only build)

- Volledige 3D scene met **WebGL/Three.js**
- Dynamische belichting (key/fill/hemisphere)
- Schaduwen op terrain en units
- Procedurally gevormde terrain met reliëf
- Atmosferische fog + diepe sky/star layer
- Emissive materials voor sci-fi core/crystals
- Particle sparks en projectile effects
- Cinematic HUD met command log

## Controls

- **RMB drag**: camera draaien
- **Mouse wheel**: zoomen
- **WASD / Arrow keys**: camera pannen
- **Q/E**: camera yaw
- **Build Turret**: defense placement
- **Build Habitat**: population + economy uitbreiding
- **Overclock Economy**: tijdelijke economic boost

## Gameplay loop

1. Workers minen crystals en brengen resources naar je core.
2. Jij beslist: investeren in defense of growth.
3. Vijandelijke waves schalen op in kracht.
4. Als core HP 0 wordt: defeat.
5. Overleef alle waves: victory.

## Runnen

Open `index.html` direct in je browser, of gebruik een lokale server:

```bash
python3 -m http.server 8000
```

Ga naar `http://localhost:8000`.
