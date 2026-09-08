const COUNTRIES = [
  ['DO', 'República Dominicana', 'DOP'],
  ['US', 'Estados Unidos', 'USD'],
  ['PR', 'Puerto Rico', 'USD'],
  ['MX', 'México', 'MXN'],
  ['CO', 'Colombia', 'COP'],
  ['AR', 'Argentina', 'ARS'],
  ['CL', 'Chile', 'CLP'],
  ['PE', 'Perú', 'PEN'],
  ['BR', 'Brasil', 'BRL'],
  ['VE', 'Venezuela', 'VES'],
  ['EC', 'Ecuador', 'USD'],
  ['PA', 'Panamá', 'PAB'],
  ['CR', 'Costa Rica', 'CRC'],
  ['GT', 'Guatemala', 'GTQ'],
  ['HN', 'Honduras', 'HNL'],
  ['NI', 'Nicaragua', 'NIO'],
  ['SV', 'El Salvador', 'USD'],
  ['UY', 'Uruguay', 'UYU'],
  ['PY', 'Paraguay', 'PYG'],
  ['BO', 'Bolivia', 'BOB'],
  ['ES', 'España', 'EUR'],
  ['FR', 'Francia', 'EUR'],
  ['DE', 'Alemania', 'EUR'],
  ['IT', 'Italia', 'EUR'],
  ['GB', 'Reino Unido', 'GBP'],
  ['CA', 'Canadá', 'CAD'],
  ['AU', 'Australia', 'AUD'],
  ['JP', 'Japón', 'JPY'],
  ['KR', 'Corea del Sur', 'KRW'],
  ['TR', 'Turquía', 'TRY'],
];

export const BILLING_COUNTRIES = COUNTRIES.map(([code, name, currency]) => ({ code, name, currency }));

let fxCache = null;
let fxFetchedAt = 0;
const FX_TTL = 6 * 60 * 60 * 1000;

async function fetchRates() {
  if (fxCache && Date.now() - fxFetchedAt < FX_TTL) return fxCache;

  const response = await fetch('https://open.er-api.com/v6/latest/USD', {
    headers: { Accept: 'application/json' },
  });
  const data = await response.json();
  if (!response.ok || data.result !== 'success' || !data.rates) {
    throw new Error('No se pudo obtener la tasa de cambio.');
  }

  fxCache = data;
  fxFetchedAt = Date.now();
  return data;
}

export function billingCountry(countryCode = 'DO') {
  const code = String(countryCode || 'DO').toUpperCase();
  return BILLING_COUNTRIES.find((item) => item.code === code) || BILLING_COUNTRIES[0];
}

export async function localQuote(amountCents, countryCode = 'DO') {
  const country = billingCountry(countryCode);
  const usd = Number(amountCents || 0) / 100;

  if (country.currency === 'USD') {
    return {
      country,
      usd,
      local: usd,
      rate: 1,
      updatedAt: new Date().toISOString(),
      source: 'USD',
    };
  }

  try {
    const data = await fetchRates();
    const rate = Number(data.rates?.[country.currency]);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('Tasa no disponible.');

    return {
      country,
      usd,
      local: usd * rate,
      rate,
      updatedAt: data.time_last_update_utc || new Date(fxFetchedAt).toISOString(),
      source: 'open.er-api.com',
    };
  } catch (error) {
    return {
      country,
      usd,
      local: null,
      rate: null,
      updatedAt: null,
      source: null,
      warning: 'No se pudo calcular la conversión local ahora mismo.',
    };
  }
}
