# SeptiLab — scroll-driven WebGL site

An interactive, scroll-activated single-page site for **SeptiLab** (Syntebio) — a
bacteria + enzyme biopreparat for septic tanks. Built with **three.js** + **GSAP**.

A glowing green "living culture" path follows the camera through the full product
story as you scroll:

1. **Pozyskanie szczepów** — strains collected from nature (soil, compost)
2. **Testy laboratoryjne** — lab bench, glassware, analysis beams
3. **Hodowla inokulacyjna** — shaker flasks + small fermenters
4. **Bioreaktor** — large agitated tanks, bubbles, pulse
5. **Zagęszczanie i suszenie** — spray dryer, cyclone, centrifuge, powder
6. **Formulacja i pakowanie** — mixing vat → the finished SeptiLab jar
7. **Działanie w szambie** — the dose poured into a cutaway septic tank where
   the bacteria break down waste and the tank turns healthy

Mouse movement parallaxes the scene; selective bloom makes the culture glow.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
```

Production build + local preview of the built output:

```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages

A GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and publishes
the site on every push to `main`.

One-time setup in the repository:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions**
2. Push to `main` (or run the workflow manually from the **Actions** tab).

The site is served at `https://<user>.github.io/<repo>/`. `vite.config.js` uses
`base: './'`, so assets resolve correctly under that sub-path without extra config.

## Stack

- [three.js](https://threejs.org/) — WebGL scene, procedural low-poly geometry, UnrealBloom
- [GSAP](https://gsap.com/) + ScrollTrigger — scroll-scrubbed timeline
- [Vite](https://vite.dev/) — dev server & build

All 3D models are generated procedurally in code (`src/scene/`); no external 3D assets.
