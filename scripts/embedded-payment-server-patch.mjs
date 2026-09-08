import fs from 'node:fs';

const path = new URL('../server/index.mjs', import.meta.url);
let text = fs.readFileSync(path, 'utf8');

text = text.replace(
`import {
  capturePayPalOrder,
  createPayPalOrder,
  createStripeCheckout,
  finalizeStripeSession,
  stripe,
} from './payments.mjs';`,
`import {
  capturePayPalOrder,
  createPayPalOrder,
  createStripeCheckout,
  createStripePaymentIntent,
  finalizeStripePaymentIntent,
  finalizeStripeSession,
  getPlan,
  stripe,
} from './payments.mjs';`
);

if (!text.includes("from './fx.mjs'")) {
  text = text.replace(
    "import { publicPlans } from './plans.mjs';",
    "import { publicPlans } from './plans.mjs';\nimport { BILLING_COUNTRIES, localQuote } from './fx.mjs';"
  );
}

text = text.replace(
  `scriptSrc: ["'self'"],`,
  `scriptSrc: ["'self'", 'https://js.stripe.com'],`
);
text = text.replace(
  `imgSrc: ["'self'", 'data:', 'https://cdn.discordapp.com'],`,
  `imgSrc: ["'self'", 'data:', 'https://cdn.discordapp.com', 'https://*.stripe.com', 'https://b.stripecdn.com'],`
);
text = text.replace(
  `connectSrc: ["'self'"],`,
  `connectSrc: ["'self'", 'https://api.stripe.com', 'https://m.stripe.network', 'https://q.stripe.com', 'https://r.stripe.com'],\n      frameSrc: ["'self'", 'https://js.stripe.com', 'https://hooks.stripe.com'],`
);

const webhookOld = `    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      await finalizeStripeSession(event.data.object.id);
    }
    return res.json({ received: true });`;
const webhookNew = `    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      await finalizeStripeSession(event.data.object.id);
    } else if (event.type === 'payment_intent.succeeded') {
      await finalizeStripePaymentIntent(event.data.object.id);
    }
    return res.json({ received: true });`;
text = text.replace(webhookOld, webhookNew);

const marker = `app.post('/api/billing/stripe', requireAuth, async (req, res, next) => {`;
if (!text.includes("app.post('/api/billing/stripe/intent'")) {
  const routes = `app.get('/api/billing/countries', (_req, res) => {
  res.json({ countries: BILLING_COUNTRIES });
});

app.get('/api/billing/quote', async (req, res, next) => {
  try {
    const plan = getPlan(String(req.query.plan || ''));
    const quote = await localQuote(plan.amount, String(req.query.country || 'DO'));
    res.json({
      plan: plan.id,
      planName: plan.name,
      amount: plan.amount,
      usd: plan.amount / 100,
      country: quote.country.code,
      countryName: quote.country.name,
      currency: quote.country.currency,
      local: quote.local,
      rate: quote.rate,
      updatedAt: quote.updatedAt,
      source: quote.source,
      warning: quote.warning || null,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/billing/stripe/intent', requireAuth, async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().slice(0, 254);
    if (!/^\\S+@\\S+\\.\\S+$/.test(email)) {
      return res.status(400).json({ error: 'Escribe un correo válido.' });
    }
    if (!process.env.STRIPE_PUBLISHABLE_KEY) {
      return res.status(503).json({ error: 'Falta configurar STRIPE_PUBLISHABLE_KEY.' });
    }

    const plan = getPlan(req.body?.plan);
    const quote = await localQuote(plan.amount, req.body?.country || 'DO');
    const intent = await createStripePaymentIntent({
      userId: req.session.user.id,
      planId: plan.id,
      email,
      country: quote.country.code,
    });

    res.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      quote: {
        plan: plan.id,
        planName: plan.name,
        amount: plan.amount,
        usd: plan.amount / 100,
        country: quote.country.code,
        countryName: quote.country.name,
        currency: quote.country.currency,
        local: quote.local,
        rate: quote.rate,
        updatedAt: quote.updatedAt,
        source: quote.source,
        warning: quote.warning || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/billing/stripe/finalize', requireAuth, async (req, res, next) => {
  try {
    const paymentIntentId = String(req.body?.paymentIntentId || '');
    if (!paymentIntentId.startsWith('pi_')) {
      return res.status(400).json({ error: 'Pago inválido.' });
    }
    const result = await finalizeStripePaymentIntent(paymentIntentId, req.session.user.id);
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

`;
  text = text.replace(marker, routes + marker);
}

if (!text.includes("app.get('/billing/stripe/embedded-success'")) {
  const successMarker = `app.get('/billing/stripe/success', async (req, res) => {`;
  const successRoute = `app.get('/billing/stripe/embedded-success', async (req, res) => {
  try {
    const paymentIntentId = String(req.query.payment_intent || '');
    if (!paymentIntentId.startsWith('pi_')) return res.redirect('/?billing=error');
    await finalizeStripePaymentIntent(paymentIntentId);
    return res.redirect('/?billing=success');
  } catch (error) {
    console.error('[Klvro] Stripe embedded success:', error);
    return res.redirect('/?billing=error');
  }
});

`;
  text = text.replace(successMarker, successRoute + successMarker);
}

fs.writeFileSync(path, text);
console.log('[Klvro] Embedded payment server routes applied.');
