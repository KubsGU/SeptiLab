/* Vercel serverless function — tworzy sesję Stripe Checkout.
   Obsługuje BLIK, Przelewy24 (p24) i karty. Wymaga zmiennej środowiskowej
   STRIPE_SECRET_KEY (Vercel → Project → Settings → Environment Variables).
   Opcjonalnie PRICE_GROSZE (cena w groszach, domyślnie 9900 = 99,00 zł). */
import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(501).json({ error: 'not_configured' });

  const stripe = new Stripe(key);
  const origin = req.headers.origin || `https://${req.headers.host}`;
  const amount = Number(process.env.PRICE_GROSZE || 9900);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'blik', 'p24'],
      locale: 'pl',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'pln',
            unit_amount: amount,
            product_data: {
              name: 'SeptiLab 1 kg — biopreparat do szamb i oczyszczalni',
              description: 'Bakterie Bacillus + kompleks 4 enzymów. Zapas na rok.',
            },
          },
        },
      ],
      shipping_address_collection: { allowed_countries: ['PL'] },
      success_url: `${origin}/?zamowienie=sukces`,
      cancel_url: `${origin}/?zamowienie=anulowano#zamow`,
    });
    return res.status(200).json({ url: session.url });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
