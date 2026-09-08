import React, { useEffect, useMemo, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { CreditCard, LoaderCircle, LockKeyhole, X } from 'lucide-react';
import './payment-modal.css';

const COUNTRIES = [
  ['DO', 'República Dominicana', 'DOP'], ['US', 'Estados Unidos', 'USD'], ['PR', 'Puerto Rico', 'USD'],
  ['MX', 'México', 'MXN'], ['CO', 'Colombia', 'COP'], ['AR', 'Argentina', 'ARS'], ['CL', 'Chile', 'CLP'],
  ['PE', 'Perú', 'PEN'], ['BR', 'Brasil', 'BRL'], ['VE', 'Venezuela', 'VES'], ['EC', 'Ecuador', 'USD'],
  ['PA', 'Panamá', 'PAB'], ['CR', 'Costa Rica', 'CRC'], ['GT', 'Guatemala', 'GTQ'], ['HN', 'Honduras', 'HNL'],
  ['NI', 'Nicaragua', 'NIO'], ['SV', 'El Salvador', 'USD'], ['UY', 'Uruguay', 'UYU'], ['PY', 'Paraguay', 'PYG'],
  ['BO', 'Bolivia', 'BOB'], ['ES', 'España', 'EUR'], ['FR', 'Francia', 'EUR'], ['DE', 'Alemania', 'EUR'],
  ['IT', 'Italia', 'EUR'], ['GB', 'Reino Unido', 'GBP'], ['CA', 'Canadá', 'CAD'], ['AU', 'Australia', 'AUD'],
  ['JP', 'Japón', 'JPY'], ['KR', 'Corea del Sur', 'KRW'], ['TR', 'Turquía', 'TRY'],
].map(([code, name, currency]) => ({ code, name, currency }));

const PLAN_LABELS = {
  lite: 'Premium Lite',
  pro: 'Premium Pro',
};

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const type = response.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw new Error(data?.error || `Error HTTP ${response.status}`);
  return data;
}

function money(value, currency, locale = 'es-DO') {
  if (value === null || value === undefined || !currency) return '—';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: ['JPY', 'KRW', 'CLP', 'PYG'].includes(currency) ? 0 : 2,
    }).format(Number(value));
  } catch {
    return `${Number(value).toFixed(2)} ${currency}`;
  }
}

function CardForm({ plan, quote, email, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (!stripe || !elements || loading) return;

    setLoading(true);
    setError('');
    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/billing/stripe/embedded-success`,
          receipt_email: email,
        },
        redirect: 'if_required',
      });

      if (result.error) throw new Error(result.error.message || 'Stripe rechazó el pago.');

      if (result.paymentIntent?.status === 'succeeded') {
        await api('/api/billing/stripe/finalize', {
          method: 'POST',
          body: JSON.stringify({ paymentIntentId: result.paymentIntent.id }),
        });
        onSuccess();
        return;
      }

      if (result.paymentIntent?.status && !['processing', 'requires_action'].includes(result.paymentIntent.status)) {
        throw new Error('El pago no pudo completarse.');
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <form className="klvro-pay-card-form" onSubmit={submit}>
      <div className="klvro-pay-stripe-box">
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>
      {error && <div className="klvro-pay-error">{error}</div>}
      <button className="klvro-pay-primary" type="submit" disabled={!stripe || loading}>
        {loading ? <LoaderCircle size={18} className="spin" /> : <LockKeyhole size={17} />}
        {loading ? 'Procesando…' : `Pagar ${money(quote?.usd, 'USD', 'en-US')}`}
      </button>
      <p className="klvro-pay-security">Los datos de tu tarjeta los procesa Stripe. Klvro no recibe ni guarda el número de tarjeta ni el CVC.</p>
    </form>
  );
}

export default function PaymentModal({ plan, onClose }) {
  const [country, setCountry] = useState('DO');
  const [email, setEmail] = useState('');
  const [quote, setQuote] = useState(null);
  const [mode, setMode] = useState('methods');
  const [intent, setIntent] = useState(null);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const stripePromise = useMemo(
    () => (intent?.publishableKey ? loadStripe(intent.publishableKey) : null),
    [intent?.publishableKey]
  );

  useEffect(() => {
    let alive = true;
    setQuote(null);
    api(`/api/billing/quote?plan=${encodeURIComponent(plan)}&country=${encodeURIComponent(country)}`)
      .then((data) => { if (alive) setQuote(data); })
      .catch(() => { if (alive) setQuote(null); });
    return () => { alive = false; };
  }, [plan, country]);

  const countryInfo = COUNTRIES.find((item) => item.code === country) || COUNTRIES[0];

  async function startCard() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Escribe un correo válido para enviarte la confirmación del pago.');
      return;
    }

    setLoading('stripe');
    setError('');
    try {
      const data = await api('/api/billing/stripe/intent', {
        method: 'POST',
        body: JSON.stringify({ plan, country, email: email.trim() }),
      });
      setIntent(data);
      if (data.quote) setQuote(data.quote);
      setMode('card');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading('');
    }
  }

  async function payPal() {
    setLoading('paypal');
    setError('');
    try {
      const data = await api('/api/billing/paypal', {
        method: 'POST',
        body: JSON.stringify({ plan }),
      });
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setLoading('');
    }
  }

  function paymentSuccess() {
    setDone(true);
    setTimeout(() => {
      window.location.href = '/?billing=success';
    }, 1100);
  }

  const elementsOptions = intent?.clientSecret ? {
    clientSecret: intent.clientSecret,
    appearance: {
      theme: 'night',
      variables: {
        colorPrimary: '#5865f2',
        colorBackground: '#13161b',
        colorText: '#f2f4f8',
        colorDanger: '#ff6b78',
        borderRadius: '10px',
        fontFamily: 'Inter, system-ui, sans-serif',
      },
    },
  } : null;

  return (
    <div className="klvro-pay-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading && !done) onClose(); }}>
      <div className="klvro-pay-modal" role="dialog" aria-modal="true" aria-label="Pago de Klvro Premium">
        <button className="klvro-pay-close" type="button" onClick={onClose} disabled={Boolean(loading) || done} aria-label="Cerrar"><X size={18} /></button>

        {done ? (
          <div className="klvro-pay-success">
            <div className="klvro-pay-success-icon">✓</div>
            <h2>Pago completado</h2>
            <p>Tu Premium está activo. También te enviaremos la confirmación al correo indicado.</p>
          </div>
        ) : (
          <>
            <div className="klvro-pay-heading">
              <div className="klvro-pay-icon"><CreditCard size={21} /></div>
              <div>
                <span>Pago seguro</span>
                <h2>{PLAN_LABELS[plan] || 'Klvro Premium'}</h2>
              </div>
            </div>

            <div className="klvro-pay-total">
              <div>
                <span>Total a cobrar</span>
                <strong>{quote ? money(quote.usd, 'USD', 'en-US') : 'Cargando…'}</strong>
              </div>
              <div className="klvro-pay-local">
                <span>Aprox. en {countryInfo.currency}</span>
                <strong>{quote?.local !== null && quote?.local !== undefined ? money(quote.local, quote.currency || countryInfo.currency) : '—'}</strong>
              </div>
            </div>

            <label className="klvro-pay-field">
              <span>País</span>
              <select value={country} onChange={(event) => { setCountry(event.target.value); setIntent(null); if (mode === 'card') setMode('methods'); }}>
                {COUNTRIES.map((item) => <option value={item.code} key={item.code}>{item.name} · {item.currency}</option>)}
              </select>
            </label>

            <label className="klvro-pay-field">
              <span>Correo para la confirmación</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" autoComplete="email" disabled={mode === 'card'} />
            </label>

            {quote?.warning && <div className="klvro-pay-note">{quote.warning} El cobro seguirá siendo en USD.</div>}
            {!quote?.warning && quote?.currency && quote.currency !== 'USD' && (
              <div className="klvro-pay-note">La conversión es informativa. Tu banco puede aplicar otra tasa o cargos. Klvro cobrará exactamente {money(quote.usd, 'USD', 'en-US')}.</div>
            )}

            {error && <div className="klvro-pay-error">{error}</div>}

            {mode === 'methods' && (
              <div className="klvro-pay-methods">
                <button className="klvro-pay-paypal" type="button" onClick={payPal} disabled={Boolean(loading)}>
                  {loading === 'paypal' ? <LoaderCircle size={18} className="spin" /> : null}
                  <b>PayPal</b><span>Continuar con PayPal</span>
                </button>
                <button className="klvro-pay-card" type="button" onClick={startCard} disabled={Boolean(loading) || !quote}>
                  {loading === 'stripe' ? <LoaderCircle size={18} className="spin" /> : <CreditCard size={18} />}
                  <span>{loading === 'stripe' ? 'Preparando pago…' : 'Pagar con tarjeta'}</span>
                </button>
              </div>
            )}

            {mode === 'card' && intent?.clientSecret && stripePromise && elementsOptions && (
              <>
                <button type="button" className="klvro-pay-back" onClick={() => { setMode('methods'); setIntent(null); }}>← Cambiar método</button>
                <Elements stripe={stripePromise} options={elementsOptions}>
                  <CardForm plan={plan} quote={quote} email={email.trim()} onSuccess={paymentSuccess} />
                </Elements>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
