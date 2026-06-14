/* ---------------------------------------------------------------------------
   Konfiguracja płatności.

   Wybierz JEDNĄ z dwóch ścieżek:

   1) NAJPROŚCIEJ (działa na każdym hostingu, też GitHub Pages):
      Wklej gotowy link płatniczy poniżej — Stripe Payment Link, Przelewy24,
      PayU, Tpay itp. Przyciski "Zamów" przekierują wprost do niego.

   2) WŁASNY CHECKOUT NA VERCEL (Stripe Checkout, BLIK / Przelewy24 / karta):
      Zostaw PAYMENT_LINK pusty, wdróż projekt na Vercel i ustaw zmienną
      środowiskową STRIPE_SECRET_KEY (oraz opcjonalnie PRICE_GROSZE).
      Funkcja /api/checkout utworzy sesję płatności. Szczegóły w README.
--------------------------------------------------------------------------- */

export const PAYMENT_LINK = '';
export const CHECKOUT_ENDPOINT = '/api/checkout';
