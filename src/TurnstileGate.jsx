import React, { useEffect, useRef, useState } from 'react';
import './turnstile-gate.css';

const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  const existing = document.querySelector(`script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const timer = setInterval(() => {
        if (window.turnstile) {
          clearInterval(timer);
          resolve(window.turnstile);
        } else if (Date.now() - started > 10000) {
          clearInterval(timer);
          reject(new Error('Cloudflare no respondió a tiempo.'));
        }
      }, 80);
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('No se pudo iniciar Cloudflare.'));
    script.onerror = () => reject(new Error('No se pudo cargar Cloudflare Turnstile.'));
    document.head.appendChild(script);
  });
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Error HTTP ${response.status}`);
  return data;
}

export default function TurnstileGate() {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [state, setState] = useState('loading');
  const [siteKey, setSiteKey] = useState('');
  const [message, setMessage] = useState('Comprobando tu navegador…');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const config = await request('/api/turnstile/config');
        if (!alive) return;
        if (!config.enabled || !config.siteKey) {
          setState('done');
          return;
        }
        const status = await request('/api/turnstile/status');
        if (!alive) return;
        if (status.verified) {
          setState('done');
          return;
        }
        setSiteKey(config.siteKey);
        setState('challenge');
      } catch (error) {
        if (!alive) return;
        setMessage(error.message || 'No se pudo iniciar la verificación.');
        setState('error');
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (state !== 'challenge' || !siteKey || !containerRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const turnstile = await loadTurnstileScript();
        if (cancelled || !containerRef.current) return;
        if (widgetIdRef.current != null) {
          try { turnstile.remove(widgetIdRef.current); } catch {}
        }
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'dark',
          size: 'normal',
          appearance: 'always',
          action: 'site_access',
          callback: async (token) => {
            try {
              setMessage('Verificando…');
              const result = await request('/api/turnstile/verify', {
                method: 'POST',
                body: JSON.stringify({ token }),
              });
              if (!result.verified) throw new Error('Cloudflare no pudo verificar la solicitud.');
              setMessage('Verificación completada');
              setState('success');
              window.setTimeout(() => {
                setState('done');
                const params = new URLSearchParams(window.location.search);
                const next = params.get('next');
                if (next && next.startsWith('/') && !next.startsWith('//')) window.location.href = next;
              }, 450);
            } catch (error) {
              setMessage(error.message || 'No se pudo verificar. Inténtalo otra vez.');
              setState('error');
              try { turnstile.reset(widgetIdRef.current); } catch {}
            }
          },
          'expired-callback': () => {
            setMessage('La verificación expiró. Inténtalo otra vez.');
            try { turnstile.reset(widgetIdRef.current); } catch {}
          },
          'error-callback': () => {
            setMessage('Cloudflare no pudo completar la comprobación.');
          },
        });
      } catch (error) {
        if (!cancelled) {
          setMessage(error.message || 'No se pudo cargar Cloudflare.');
          setState('error');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [state, siteKey]);

  if (state === 'done') return null;

  return (
    <div className="cf-gate" role="dialog" aria-modal="true" aria-label="Verificación de seguridad">
      <div className="cf-gate-card">
        <img src="/klvro-logo.jpg" alt="Klvro" className="cf-gate-logo" />
        <h1>Verificación de seguridad</h1>
        <p>Confirma que eres humano para continuar a Klvro.</p>

        <div className="cf-gate-widget-wrap">
          {(state === 'challenge' || state === 'error') && <div ref={containerRef} className="cf-gate-widget" />}
          {state === 'loading' && <span className="cf-gate-spinner" />}
          {state === 'success' && <div className="cf-gate-success">✓</div>}
        </div>

        <div className={`cf-gate-status ${state === 'error' ? 'error' : ''}`}>{message}</div>
        {state === 'error' && (
          <button type="button" className="cf-gate-retry" onClick={() => { setMessage('Comprobando tu navegador…'); setState('challenge'); }}>
            Reintentar
          </button>
        )}
        <small>Protegido por Cloudflare Turnstile</small>
      </div>
    </div>
  );
}
