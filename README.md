# Munch Pixels

A text-free pixel-eating colour sort by Pebblit: tap a hungry muncher, and the pixels of its
colour fly off the snack into its mouth one by one until it is full; under every snack, a face
peeks through. Phaser 3 + TypeScript + Vite, for Playgama (web portals) and YouTube Playables.

- Design: [GDD.md](GDD.md) · Rules, generator, solver: [GENERATOR.md](GENERATOR.md)
- Build brief: [briefs/munch-pixels.md](briefs/munch-pixels.md) · Epics: [TASKS.md](TASKS.md)
- Where we are: [docs/PROGRESS.md](docs/PROGRESS.md) · Decisions: [docs/questions.md](docs/questions.md)

```sh
npm ci
npm run dev        # LAN dev server
npm test           # unit tests
npm run check      # types, lint, format
npm run levels     # rebuild src/data/levels.json
npm run build      # dist/ + audit
npm run e2e        # dev build + Playwright
npm run zip        # submission ZIP + SHA-256
```
