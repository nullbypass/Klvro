import React, { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  Crown,
  LoaderCircle,
  LogIn,
  LogOut,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  XCircle,
} from 'lucide-react';
import './admin-panel.css';

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

function Avatar({ user }) {
  if (user?.avatar) return <img className="admin-user-avatar" src={user.avatar} alt="" />;
  const label = user?.globalName || user?.username || user?.id || '?';
  return <div className="admin-user-avatar admin-user-fallback">{String(label).slice(0, 1).toUpperCase()}</div>;
}

function dateText(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('es-DO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function actionLabel(action) {
  if (action === 'ban') return 'Usuario baneado';
  if (action === 'unban') return 'Usuario desbaneado';
  if (action === 'premium_grant') return 'Premium añadido';
  return action;
}

export default function AdminPanel({ me, onLogin, onHome, onLogout }) {
  const [overview, setOverview] = useState({ users: 0, bans: 0, premium: 0 });
  const [users, setUsers] = useState([]);
  const [actions, setActions] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [reason, setReason] = useState('');
  const [plan, setPlan] = useState('pro');
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedId) || null,
    [users, selectedId]
  );

  useEffect(() => {
    if (me?.authenticated && me?.admin) refreshAll();
  }, [me?.authenticated, me?.admin]);

  async function refreshAll(query = search) {
    setLoading(true);
    setError('');
    try {
      const [summaryData, usersData, actionsData] = await Promise.all([
        api('/api/admin/overview'),
        api(`/api/admin/users?search=${encodeURIComponent(query || '')}`),
        api('/api/admin/actions'),
      ]);
      setOverview(summaryData.overview || { users: 0, bans: 0, premium: 0 });
      setUsers(usersData.users || []);
      setActions(actionsData.actions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function validateTarget() {
    const id = String(selectedId || '').trim();
    if (!/^\d{16,22}$/.test(id)) {
      setError('Escribe o selecciona un ID de Discord válido.');
      return null;
    }
    return id;
  }

  async function banTarget() {
    const userId = validateTarget();
    if (!userId) return;
    if (!window.confirm(`¿Banear de Klvro al usuario ${userId}?`)) return;
    setLoadingAction('ban');
    setError('');
    setSuccess('');
    try {
      await api('/api/admin/ban', {
        method: 'POST',
        body: JSON.stringify({ userId, reason: reason.trim() }),
      });
      setSuccess('Usuario baneado de Klvro.');
      await refreshAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAction('');
    }
  }

  async function unbanTarget() {
    const userId = validateTarget();
    if (!userId) return;
    setLoadingAction('unban');
    setError('');
    setSuccess('');
    try {
      await api('/api/admin/unban', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
      setSuccess('Usuario desbaneado.');
      await refreshAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAction('');
    }
  }

  async function addPremium() {
    const userId = validateTarget();
    if (!userId) return;
    const safeDays = Number(days);
    if (!Number.isInteger(safeDays) || safeDays < 1 || safeDays > 365) {
      setError('La duración debe estar entre 1 y 365 días.');
      return;
    }
    setLoadingAction('premium');
    setError('');
    setSuccess('');
    try {
      const data = await api('/api/admin/premium', {
        method: 'POST',
        body: JSON.stringify({ userId, plan, days: safeDays }),
      });
      setSuccess(`Premium ${data.premium?.plan === 'pro' ? 'Pro' : 'Lite'} añadido correctamente.`);
      await refreshAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAction('');
    }
  }

  if (me?.loading) {
    return <div className="admin-gate"><LoaderCircle className="spin" size={28} /><span>Comprobando sesión…</span></div>;
  }

  if (!me?.authenticated) {
    return (
      <div className="admin-gate">
        <div className="admin-gate-card">
          <div className="admin-gate-icon"><ShieldCheck size={26} /></div>
          <h1>Administración de Klvro</h1>
          <p>Inicia sesión con la cuenta de Discord autorizada para continuar.</p>
          <button className="admin-primary" onClick={onLogin}><LogIn size={17} /> Iniciar sesión con Discord</button>
          <button className="admin-link" onClick={onHome}>Volver a Klvro</button>
        </div>
      </div>
    );
  }

  if (!me?.admin) {
    return (
      <div className="admin-gate">
        <div className="admin-gate-card">
          <div className="admin-gate-icon danger"><XCircle size={26} /></div>
          <h1>Acceso denegado</h1>
          <p>Tu cuenta de Discord no tiene acceso al panel administrativo.</p>
          <button className="admin-primary" onClick={onHome}>Volver a Klvro</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <button className="admin-brand" onClick={onHome}>
          <img src="/klvro-logo.jpg" alt="" />
          <div><strong>Klvro</strong><span>Admin</span></div>
        </button>
        <div className="admin-top-actions">
          <button className="admin-icon-button" onClick={() => refreshAll()} title="Actualizar"><RefreshCcw size={17} /></button>
          <div className="admin-me"><Avatar user={me.user} /><div><strong>{me.user?.globalName || me.user?.username}</strong><span>Administrador</span></div></div>
          <button className="admin-icon-button" onClick={onLogout} title="Cerrar sesión"><LogOut size={17} /></button>
        </div>
      </header>

      <main className="admin-content">
        <section className="admin-heading">
          <div><span className="admin-kicker">KLVRO CONTROL</span><h1>Panel administrativo</h1><p>Gestiona usuarios, sanciones y Premium desde un solo lugar.</p></div>
          <div className="admin-secure-chip"><ShieldCheck size={15} /> Acceso restringido</div>
        </section>

        {error && <div className="admin-alert error">{error}</div>}
        {success && <div className="admin-alert success">{success}</div>}

        <section className="admin-stats">
          <article><div><span>Usuarios</span><strong>{overview.users ?? 0}</strong></div><Users size={20} /></article>
          <article><div><span>Premium activos</span><strong>{overview.premium ?? 0}</strong></div><Crown size={20} /></article>
          <article><div><span>Baneados</span><strong>{overview.bans ?? 0}</strong></div><Ban size={20} /></article>
        </section>

        <section className="admin-grid">
          <div className="admin-card admin-users-card">
            <div className="admin-card-head"><div><h2>Usuarios</h2><p>Busca por nombre o ID de Discord.</p></div>{loading && <LoaderCircle className="spin" size={18} />}</div>
            <form className="admin-search" onSubmit={(event) => { event.preventDefault(); refreshAll(search); }}>
              <Search size={17} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ID o nombre de usuario" />
              <button type="submit">Buscar</button>
            </form>
            <div className="admin-user-list">
              {users.length === 0 && !loading ? <div className="admin-empty">No se encontraron usuarios.</div> : users.map((user) => (
                <button
                  type="button"
                  key={user.id}
                  className={`admin-user-row ${selectedId === user.id ? 'selected' : ''}`}
                  onClick={() => { setSelectedId(user.id); setReason(user.banReason || ''); }}
                >
                  <Avatar user={user} />
                  <div className="admin-user-copy">
                    <strong>{user.globalName || user.username}</strong>
                    <span>{user.id}</span>
                  </div>
                  <div className="admin-user-tags">
                    {user.premium && <span className="premium">{user.premium.plan === 'pro' ? 'Pro' : 'Lite'}</span>}
                    {user.banned && <span className="banned">Baneado</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="admin-side-stack">
            <div className="admin-card">
              <div className="admin-card-head"><div><h2>Usuario seleccionado</h2><p>También puedes escribir un ID manualmente.</p></div><UserRound size={19} /></div>
              <label className="admin-field"><span>ID de Discord</span><input value={selectedId} onChange={(event) => setSelectedId(event.target.value.replace(/\D/g, '').slice(0, 22))} placeholder="123456789012345678" /></label>
              {selectedUser && (
                <div className="admin-selected-summary">
                  <Avatar user={selectedUser} />
                  <div><strong>{selectedUser.globalName || selectedUser.username}</strong><span>{selectedUser.banned ? `Baneado${selectedUser.banReason ? ` · ${selectedUser.banReason}` : ''}` : 'Acceso permitido'}</span></div>
                </div>
              )}
            </div>

            <div className="admin-card">
              <div className="admin-card-head"><div><h2>Acceso a Klvro</h2><p>Bloquea o restaura el acceso del usuario.</p></div><Ban size={19} /></div>
              <label className="admin-field"><span>Motivo</span><textarea rows="3" maxLength="500" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo del baneo (opcional)" /></label>
              <div className="admin-action-row">
                <button className="admin-danger" onClick={banTarget} disabled={Boolean(loadingAction)}>{loadingAction === 'ban' ? <LoaderCircle className="spin" size={16} /> : <Ban size={16} />} Banear</button>
                <button className="admin-secondary" onClick={unbanTarget} disabled={Boolean(loadingAction)}>{loadingAction === 'unban' ? <LoaderCircle className="spin" size={16} /> : <ShieldCheck size={16} />} Desbanear</button>
              </div>
            </div>

            <div className="admin-card">
              <div className="admin-card-head"><div><h2>Añadir Premium</h2><p>Extiende el Premium del usuario manualmente.</p></div><Sparkles size={19} /></div>
              <div className="admin-two-fields">
                <label className="admin-field"><span>Plan</span><select value={plan} onChange={(event) => setPlan(event.target.value)}><option value="lite">Premium Lite</option><option value="pro">Premium Pro</option></select></label>
                <label className="admin-field"><span>Días</span><input type="number" min="1" max="365" value={days} onChange={(event) => setDays(Number(event.target.value))} /></label>
              </div>
              <button className="admin-primary full" onClick={addPremium} disabled={Boolean(loadingAction)}>{loadingAction === 'premium' ? <LoaderCircle className="spin" size={16} /> : <Crown size={16} />} Añadir Premium</button>
            </div>
          </div>
        </section>

        <section className="admin-card admin-actions-card">
          <div className="admin-card-head"><div><h2>Actividad reciente</h2><p>Registro de acciones realizadas desde este panel.</p></div></div>
          <div className="admin-action-list">
            {actions.length === 0 ? <div className="admin-empty">Todavía no hay acciones administrativas.</div> : actions.map((item) => (
              <div className="admin-action-item" key={item.id}>
                <div className={`admin-action-dot ${item.action}`} />
                <div><strong>{actionLabel(item.action)}</strong><span>{item.globalName || item.username || item.targetUserId} · {item.targetUserId}</span></div>
                <time>{dateText(item.createdAt)}</time>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
