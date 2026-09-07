export const PLANS = {
  lite: {
    id: 'lite',
    name: 'Premium Lite',
    amount: 299,
    currency: 'usd',
    days: 30,
    description: '30 días de Premium Lite para Klvro',
  },
  pro: {
    id: 'pro',
    name: 'Premium Pro',
    amount: 599,
    currency: 'usd',
    days: 30,
    description: '30 días de Premium Pro para Klvro',
  },
};

export function publicPlans() {
  return Object.values(PLANS).map(({ id, name, amount, currency, days, description }) => ({
    id,
    name,
    amount,
    currency,
    days,
    description,
  }));
}
