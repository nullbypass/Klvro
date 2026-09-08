import crypto from 'node:crypto';
import Stripe from 'stripe';
import { grantPremium } from './db.mjs';
import { PLANS } from './plans.mjs';

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

function appUrl(path = '/') {
  const base = (process.env.PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}${path}`;
}

export function getPlan(planId) {
  const plan = PLANS[planId];
  if (!plan) {
    const error = new Error('Plan inválido.');
    error.status = 400;
    throw error;
  }
  return plan;
}

export async function createStripeCheckout({ userId, planId }) {
  if (!stripe) {
    const error = new Error('Stripe todavía no está configurado.');
    error.status = 503;
    throw error;
  }

  const plan = getPlan(planId);
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    client_reference_id: userId,
    managed_payments: {
      enabled: false,
    },
    line_items: [
      {
        price_data: {
          currency: plan.currency,
          product_data: {
            name: `Klvro ${plan.name}`,
            description: plan.description,
          },
          unit_amount: plan.amount,
        },
        quantity: 1,
      },
    ],
    metadata: {
      klvro_user_id: userId,
      klvro_plan: plan.id,
    },
    success_url: appUrl('/billing/stripe/success?session_id={CHECKOUT_SESSION_ID}'),
    cancel_url: appUrl('/?billing=cancelled'),
  });

  return session.url;
}

export async function finalizeStripeSession(sessionId) {
  if (!stripe) throw new Error('Stripe no está configurado.');

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== 'paid') {
    const error = new Error('El pago todavía no aparece como completado.');
    error.status = 400;
    throw error;
  }

  const userId = session.metadata?.klvro_user_id || session.client_reference_id;
  const plan = getPlan(session.metadata?.klvro_plan);
  if (!userId) throw new Error('El pago no contiene un usuario de Klvro.');

  const paymentId = String(session.payment_intent || session.id);
  await grantPremium({
    userId,
    plan: plan.id,
    provider: 'stripe',
    paymentId,
    amount: plan.amount,
    currency: plan.currency,
    days: plan.days,
  });

  return { userId, plan: plan.id };
}

function paypalBaseUrl() {
  return process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

async function paypalAccessToken() {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    const error = new Error('PayPal todavía no está configurado.');
    error.status = 503;
    throw error;
  }

  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const response = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || 'No se pudo autenticar con PayPal.');
  return data.access_token;
}

export async function createPayPalOrder({ userId, planId }) {
  const plan = getPlan(planId);
  const token = await paypalAccessToken();
  const response = await fetch(`${paypalBaseUrl()}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': crypto.randomUUID(),
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
            landing_page: 'LOGIN',
            shipping_preference: 'NO_SHIPPING',
            user_action: 'PAY_NOW',
            return_url: appUrl('/billing/paypal/success'),
            cancel_url: appUrl('/?billing=cancelled'),
          },
        },
      },
      purchase_units: [
        {
          custom_id: `${userId}:${plan.id}`,
          description: plan.description,
          amount: {
            currency_code: plan.currency.toUpperCase(),
            value: (plan.amount / 100).toFixed(2),
          },
        },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'No se pudo crear la orden de PayPal.');
  }

  const approve = data.links?.find((link) => link.rel === 'payer-action' || link.rel === 'approve');
  if (!approve?.href) throw new Error('PayPal no devolvió el enlace de aprobación.');
  return { orderId: data.id, url: approve.href };
}

export async function capturePayPalOrder(orderId) {
  const token = await paypalAccessToken();

  const currentResponse = await fetch(`${paypalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  let order = await currentResponse.json();
  if (!currentResponse.ok) throw new Error(order.message || 'No se pudo consultar la orden de PayPal.');

  if (order.status !== 'COMPLETED') {
    const response = await fetch(`${paypalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `capture-${orderId}`,
      },
      body: '{}',
    });

    order = await response.json();
    if (!response.ok) {
      throw new Error(order.message || 'No se pudo capturar el pago de PayPal.');
    }
  }

  if (order.status !== 'COMPLETED') {
    const error = new Error('El pago de PayPal todavía no está completado.');
    error.status = 400;
    throw error;
  }

  const purchaseUnit = order.purchase_units?.[0];
  const [userId, planId] = String(purchaseUnit?.custom_id || '').split(':');
  const plan = getPlan(planId);
  if (!userId) throw new Error('La orden de PayPal no contiene un usuario de Klvro.');

  const captureId = purchaseUnit?.payments?.captures?.[0]?.id || order.id;
  await grantPremium({
    userId,
    plan: plan.id,
    provider: 'paypal',
    paymentId: captureId,
    amount: plan.amount,
    currency: plan.currency,
    days: plan.days,
  });

  return { userId, plan: plan.id };
}
