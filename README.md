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

## Płatności (order buttons)

The "Zamów" buttons (`[data-checkout]`) are wired in `src/checkout.js`. Until you
configure a payment method they degrade gracefully (scroll to the order section +
a toast). Pick one of two paths in `src/config.js`:

**A) Payment link — zero backend, works anywhere (incl. GitHub Pages)**
Paste a hosted checkout URL into `PAYMENT_LINK` (Stripe Payment Link, Przelewy24,
PayU, Tpay…). The buttons redirect straight to it. Done.

**B) Stripe Checkout on Vercel — BLIK / Przelewy24 / card**
Leave `PAYMENT_LINK` empty and deploy to **Vercel** (free, auto-builds this Vite
project; `api/checkout.js` becomes a serverless function automatically):

1. Import the repo at [vercel.com/new](https://vercel.com/new) (framework: Vite — auto-detected).
2. **Settings → Environment Variables**:
   - `STRIPE_SECRET_KEY` — your Stripe secret key (`sk_live_…` / `sk_test_…`)
   - `PRICE_GROSZE` *(optional)* — price in grosze, default `9900` (= 99,00 zł)
3. Deploy. Clicking "Zamów" calls `POST /api/checkout`, which creates a Stripe
   Checkout Session (PLN, BLIK + P24 + card, PL shipping) and redirects to it.
   On return the site shows a success/cancel toast (`?zamowienie=sukces|anulowano`).

Never put the secret key in the frontend — it lives only in the Vercel env / the
serverless function. GitHub Pages can't run `/api/*`, so use path **A** there.

## Stack

- [three.js](https://threejs.org/) — WebGL scene, procedural low-poly geometry, UnrealBloom
- [GSAP](https://gsap.com/) + ScrollTrigger — scroll-scrubbed timeline
- [Vite](https://vite.dev/) — dev server & build

All 3D models are generated procedurally in code (`src/scene/`); no external 3D assets.
