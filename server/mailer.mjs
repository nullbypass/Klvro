import nodemailer from 'nodemailer';

let transport = null;

function smtpReady() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransport() {
  if (!smtpReady()) return null;
  if (transport) return transport;

  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;

  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transport;
}

function money(amount, currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: String(currency || 'USD').toUpperCase(),
  }).format(Number(amount || 0) / 100);
}

export async function sendPremiumThankYouEmail({ to, plan, provider, amount, currency, days = 30 }) {
  if (!to || !smtpReady()) return { sent: false, reason: 'smtp_not_configured' };

  const mailer = getTransport();
  const from = process.env.MAIL_FROM || `Klvro <${process.env.SMTP_USER}>`;
  const planName = plan?.name || String(plan || 'Premium');
  const total = money(amount, currency);
  const providerName = provider === 'paypal' ? 'PayPal' : 'tarjeta';

  try {
    await mailer.sendMail({
      from,
      to,
      subject: `Gracias por tu compra de ${planName} — Klvro`,
      text: `Gracias por apoyar Klvro. Tu pago de ${total} mediante ${providerName} fue recibido correctamente y ${planName} está activo durante ${days} días. Puedes administrar tu bot desde https://klvro.site.`,
      html: `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#0f1115;color:#eef1f5;font-family:Arial,sans-serif;padding:32px 16px">
    <div style="max-width:560px;margin:0 auto;background:#171a20;border:1px solid #2a2f39;border-radius:16px;overflow:hidden">
      <div style="padding:24px;border-bottom:1px solid #2a2f39">
        <img src="https://klvro.site/klvro-logo.jpg" width="44" height="44" alt="Klvro" style="border-radius:12px;display:block;margin-bottom:14px">
        <h1 style="font-size:22px;margin:0 0 8px">Gracias por apoyar Klvro</h1>
        <p style="margin:0;color:#aab1bd;line-height:1.6">Tu pago fue recibido correctamente.</p>
      </div>
      <div style="padding:24px">
        <div style="background:#101318;border:1px solid #292e38;border-radius:12px;padding:16px;margin-bottom:18px">
          <p style="margin:0 0 8px;color:#8f98a8;font-size:12px;text-transform:uppercase;letter-spacing:.08em">Compra</p>
          <p style="margin:0 0 6px"><strong>${planName}</strong></p>
          <p style="margin:0;color:#b9c0ca">${total} · ${providerName} · ${days} días</p>
        </div>
        <p style="color:#b9c0ca;line-height:1.7;margin:0 0 20px">Tu Premium ya está activo. Puedes volver al panel para configurar las funciones incluidas en tu plan.</p>
        <a href="https://klvro.site/app" style="display:inline-block;background:#5865f2;color:white;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px">Abrir Klvro</a>
      </div>
      <div style="padding:18px 24px;border-top:1px solid #2a2f39;color:#7f8794;font-size:12px">Klvro · Bot de Discord</div>
    </div>
  </body>
</html>`,
    });
    return { sent: true };
  } catch (error) {
    console.error('[Klvro] No se pudo enviar el correo de pago:', error.message);
    return { sent: false, reason: 'send_failed' };
  }
}
