# makefun-gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/tngrha/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/tngrha/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# SOLMAR HEAT

An original open-world crime game for the make.fun **gta6-01** bounty
("Make GTA 6"). Everything — the city of Solmar, Leo Marín, Nadia Voss,
the Jackals, the cars, the story, the art and the music — is original work
created for this entry. Nothing is taken from Rockstar Games or any other
commercial game.

## The game

Leo Marín is back in Solmar with empty pockets and a name to make. Explore
a sun-soaked coastal city on foot and by car, steal vehicles, outrun the
police, run jobs for fixer Nadia Voss, and take the docks back from the
rival Jackals gang.

**Systems:** explorable city (roads, downtown towers, park, beach, pier,
docks) · driving with arcade physics · traffic and pedestrians · stealing
cars · wanted level (0–5 stars) with police cars that chase and ram ·
5-mission story plus repeatable side jobs · on-foot combat with pistol,
enemies and health bars · cash, 12 hidden cash stashes · HUD with circular
minimap, wanted stars, health, ammo and speed · start screen, pause and
wasted screens · progress saved to localStorage · procedural WebAudio
sound (engine, sirens, gunshots, bassline music) · deterministic demo
scenes via `?shot=chase|drive|foot|start` for screenshots.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive |
| Shift | Run |
| Mouse drag | Orbit camera |
| Click | Shoot (on foot) |
| E | Enter / steal car, leave car |
| Space | Handbrake |
| Esc / P | Pause |
| R | Respawn after WASTED |
| Enter | Start from the title screen |

## Playing it

Serve `game/` with any static server and open `game/index.html` in desktop
Chrome — the game makes no network request:

```sh
node serve.ts   # http://localhost:8080
```

## Tech

Three.js r160 (vendored as minified `game/vendor/three.min.js`), plain ES
modules, no build step. Source is split by job: `city.js`, `vehicles.js`,
`pedestrians.js`, `combat.js`, `missions.js`, `hud.js`, `audio.js`,
`player.js`, `input.js`, `save.js`, `textures.js`, `config.js`,
`shots.js`, `main.js`.

## License

MIT — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=px8mhdxd&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
