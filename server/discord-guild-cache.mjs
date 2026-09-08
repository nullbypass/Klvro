const nativeFetch = globalThis.fetch.bind(globalThis);
const cache = new Map();
const inflight = new Map();
const TTL_MS = 2 * 60_000;
const STALE_MS = 10 * 60_000;

function requestUrl(input) {
  if (typeof input === 'string' || input instanceof URL) return String(input);
  return input?.url || '';
}

function requestHeaders(input, init) {
  const headers = new Headers(input?.headers || undefined);
  if (init?.headers) {
    for (const [key, value] of new Headers(init.headers)) headers.set(key, value);
  }
  return headers;
}

function isDiscordGuildList(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'discord.com' && parsed.pathname === '/api/v10/users/@me/guilds';
  } catch {
    return false;
  }
}

function makeResponse(entry) {
  return new Response(entry.body, {
    status: entry.status,
    statusText: entry.statusText,
    headers: entry.headers,
  });
}

async function fetchAndCache(input, init, key, stale) {
  const response = await nativeFetch(input, init);

  if (response.ok) {
    const clone = response.clone();
    const body = await clone.text();
    cache.set(key, {
      body,
      status: clone.status,
      statusText: clone.statusText,
      headers: [...clone.headers.entries()],
      expiresAt: Date.now() + TTL_MS,
      staleUntil: Date.now() + STALE_MS,
    });
    return response;
  }

  if ((response.status === 429 || response.status >= 500) && stale?.staleUntil > Date.now()) {
    console.warn(`[Klvro] Discord guilds ${response.status}; usando caché temporal.`);
    return makeResponse(stale);
  }

  return response;
}

globalThis.fetch = async function klvroFetch(input, init = undefined) {
  const url = requestUrl(input);
  if (!isDiscordGuildList(url)) return nativeFetch(input, init);

  const headers = requestHeaders(input, init);
  const authorization = headers.get('authorization') || '';
  const key = `${authorization}|${url}`;
  const cached = cache.get(key);

  if (cached?.expiresAt > Date.now()) return makeResponse(cached);

  if (inflight.has(key)) {
    const entry = await inflight.get(key);
    return makeResponse(entry);
  }

  const task = (async () => {
    const response = await fetchAndCache(input, init, key, cached);
    const stored = cache.get(key);

    if (response.ok && stored) return stored;

    const body = await response.text();
    return {
      body,
      status: response.status,
      statusText: response.statusText,
      headers: [...response.headers.entries()],
      expiresAt: 0,
      staleUntil: 0,
    };
  })();

  inflight.set(key, task);
  try {
    const entry = await task;
    return makeResponse(entry);
  } finally {
    inflight.delete(key);
  }
};

console.log('[Klvro] Caché de servidores de Discord activa.');
