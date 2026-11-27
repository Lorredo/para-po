# Para Po

> Your stop, never missed.

**Para Po** is a web-based destination alarm (PWA) for jeepney, bus and train commuters in the Philippines. Pick your stop on the map, set an alert radius, and Para Po rings and vibrates when you get close.

The name comes from **"Para po!"**, the polite call jeepney passengers use to say _"Stop here, please!"_

- **Live:** https://para-po-alpha.vercel.app/
- **Try a demo ride (no travel needed):** https://para-po-alpha.vercel.app/?sim=edsa&speed=10
- **Build plan, progress and decisions:** [docs/PLAN.md](docs/PLAN.md)

> 🚧 Work in progress. The full README (architecture, limitations and trade-offs, native vs web comparison) is coming in a later milestone.

## Run locally

Requires Node 22+.

```bash
npm install
npm run dev        # start the dev server
npm test           # run unit tests
npm run lint       # oxlint
npm run format     # prettier
npm run build      # type-check and build to dist/
```
