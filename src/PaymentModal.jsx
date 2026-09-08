import React, { useState } from 'react';
import { LoaderCircle, X } from 'lucide-react';
import './payment-modal.css';

const PLAN_LABELS = {
  lite: 'Premium Lite',
  pro: 'Premium Pro',
};

const PLAN_PRICES = {
  lite: 'US$2.99',
  pro: 'US$5.99',
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

export default function PaymentModal({ plan, onClose }) {
  const planId = typeof plan === 'string' ? plan : plan?.id;
  const planLabel = PLAN_LABELS[planId] || (typeof plan === 'object' ? plan?.name : '') || 'Klvro Premium';
  const planPrice = (typeof plan === 'object' && plan?.price) || PLAN_PRICES[planId] || '';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function payPal() {
    if (!planId) {
      setError('No se pudo identificar el plan seleccionado.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await api('/api/billing/paypal', {
        method: 'POST',
        body: JSON.stringify({ plan: planId }),
      });
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div
      className="klvro-pay-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      <div className="klvro-pay-modal" role="dialog" aria-modal="true" aria-label="Pago de Klvro Premium">
        <button
          className="klvro-pay-close"
          type="button"
          onClick={onClose}
          disabled={loading}
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>

        <div className="klvro-pay-heading">
          <div className="klvro-pay-icon klvro-pay-paypal-heading">
            <img src="/paypal-mark.svg" alt="" />
          </div>
          <div>
            <span>Pago seguro</span>
            <h2>{planLabel}</h2>
          </div>
        </div>

        <div className="klvro-pay-total klvro-pay-paypal-summary">
          <div>
            <span>Total</span>
            <strong>{planPrice || '30 días'}</strong>
          </div>
          <div className="klvro-pay-local">
            <span>Duración</span>
            <strong>30 días</strong>
          </div>
        </div>

        {error && <div className="klvro-pay-error">{error}</div>}

        <div className="klvro-pay-methods klvro-pay-methods-simple">
          <button
            className="klvro-pay-paypal klvro-pay-paypal-logo"
            type="button"
            onClick={payPal}
            disabled={loading}
            aria-label="Pagar con PayPal"
            title="Pagar con PayPal"
          >
            {loading ? <LoaderCircle size={22} className="spin" /> : <img src="/paypal-mark.svg" alt="PayPal" />}
          </button>
        </div>

        <p className="klvro-pay-security">
          El pago se completa en PayPal. Klvro activa tu Premium cuando PayPal confirma la compra.
        </p>
      </div>
    </div>
  );
}
