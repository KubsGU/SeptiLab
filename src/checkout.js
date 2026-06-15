import { PAYMENT_LINK, CHECKOUT_ENDPOINT } from './config.js';

function toast(msg, kind = 'ok') {
  const t = document.createElement('div');
  t.className = `toast toast--${kind}`;
  t.setAttribute('role', 'status');
  t.setAttribute('aria-live', 'polite');
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('is-in'));
  setTimeout(() => {
    t.classList.remove('is-in');
    setTimeout(() => t.remove(), 400);
  }, 4200);
}

async function goToCheckout(btn) {
  // 1) gotowy link płatniczy — działa wszędzie
  if (PAYMENT_LINK) {
    window.location.href = PAYMENT_LINK;
    return;
  }
  // 2) Stripe Checkout przez funkcję serverless (Vercel)
  btn.classList.add('is-loading');
  try {
    const r = await fetch(CHECKOUT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (r.ok) {
      const { url } = await r.json();
      if (url) {
        window.location.href = url;
        return;
      }
    }
    // nieskonfigurowane / brak backendu → łagodny fallback
    const href = btn.getAttribute('href');
    if (href && href.startsWith('#')) document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
    toast('Płatności online nie są jeszcze aktywne — skonfiguruj PAYMENT_LINK lub STRIPE_SECRET_KEY.', 'info');
  } catch {
    toast('Nie udało się rozpocząć płatności. Spróbuj ponownie.', 'info');
  } finally {
    btn.classList.remove('is-loading');
  }
}

export function initCheckout() {
  document.querySelectorAll('[data-checkout]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      goToCheckout(btn);
    });
  });

  // komunikat po powrocie ze Stripe
  const status = new URLSearchParams(location.search).get('zamowienie');
  if (status === 'sukces') toast('Dziękujemy za zamówienie! Potwierdzenie wyślemy e-mailem. 🎉', 'ok');
  else if (status === 'anulowano') toast('Płatność anulowana — koszyk czeka, gdy będziesz gotowy.', 'info');
  if (status) history.replaceState(null, '', location.pathname + location.hash);
}
