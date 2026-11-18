import { Hono } from 'hono';
import type { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { makeAdminToken, verifyAdminToken, timingSafeEqual, randomToken, signValue, verifyValue } from './auth';
import { DIMENSIONS, pickQuestionIds, serializeQuestions, scoreAnswers, archetypeKey, describeArchetype, type Locale } from './quiz';
import { rankTables, rebalance, genderShares, DEFAULT_WEIGHTS, type TableState, type Weights } from './assign';

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
  EVENT_NAME?: string;
}

type App = { Bindings: Env; Variables: { guest?: GuestRow } };
const app = new Hono<App>();

// ---------------------------------------------------------------- tipi DB
interface GuestRow {
  id: number; first_name: string; last_name: string; company: string; department: string; group_key: string; gender: string;
  facilitator_table_id: number | null; consent_at: string | null; device_token: string | null; locale: string | null;
  quiz_question_ids: string | null; answers: string | null; vector: string | null; archetype: string | null;
  table_id: number | null; assigned_at: string | null; assigned_by: string | null; created_at: string; invite_token: string | null;
}
interface TableRow { id: number; name: string; capacity: number; seed_vector: string | null }

// ---------------------------------------------------------------- helpers
const parseJson = <T>(s: string | null, fallback: T): T => { try { return s ? (JSON.parse(s) as T) : fallback; } catch { return fallback; } };

async function getSettings(db: D1Database): Promise<Record<string, string>> {
  const { results } = await db.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>();
  return Object.fromEntries(results.map(r => [r.key, r.value]));
}

async function weightsFrom(db: D1Database, settings: Record<string, string>): Promise<Weights> {
  const { results } = await db.prepare('SELECT gender FROM guests').all<{ gender: string }>();
  return {
    ...DEFAULT_WEIGHTS,
    maxSameGroup: Math.max(1, Number(settings.max_same_group) || 2),
    gender: settings.gender_balance === '0' ? 0 : DEFAULT_WEIGHTS.gender,
    genderShare: genderShares(results.map(r => r.gender)),
  };
}

const normGender = (v: unknown): string => {
  const s = String(v ?? '').trim().toLowerCase();
  if (['m', 'uomo', 'maschio', 'male', 'homme', 'h'].includes(s)) return 'M';
  if (['f', 'donna', 'femmina', 'female', 'femme', 'w'].includes(s)) return 'F';
  return '';
};

function pickLocale(c: Context<App>, explicit?: unknown): Locale {
  if (explicit === 'fr' || explicit === 'it') return explicit;
  const al = (c.req.header('accept-language') || '').toLowerCase();
  return al.startsWith('fr') || /,\s*fr/.test(al.split(';')[0]) ? 'fr' : 'it';
}

const isSecure = (c: Context<App>) => new URL(c.req.url).protocol === 'https:';
const cookieOpts = (c: Context<App>, maxAge: number) => ({ httpOnly: true, sameSite: 'Lax' as const, secure: isSecure(c), path: '/', maxAge });

async function log(db: D1Database, kind: string, guestId: number | null, detail?: unknown) {
  await db.prepare('INSERT INTO events (kind, guest_id, detail) VALUES (?, ?, ?)')
    .bind(kind, guestId, detail === undefined ? null : JSON.stringify(detail)).run();
}

async function loadTableStates(db: D1Database): Promise<{ rows: TableRow[]; states: TableState[] }> {
  const [t, g] = await db.batch([
    db.prepare('SELECT id, name, capacity, seed_vector FROM tables ORDER BY id'),
    db.prepare('SELECT table_id, vector, group_key, gender FROM guests WHERE table_id IS NOT NULL'),
  ]);
  const rows = t.results as unknown as TableRow[];
  const states: TableState[] = rows.map(r => ({ id: r.id, capacity: r.capacity, seed: parseJson<number[] | null>(r.seed_vector, null), occupants: [] }));
  const byId = new Map(states.map(s => [s.id, s]));
  for (const o of g.results as unknown as { table_id: number; vector: string | null; group_key: string; gender: string }[]) {
    byId.get(o.table_id)?.occupants.push({ vector: parseJson<number[] | null>(o.vector, null), group: o.group_key, gender: o.gender });
  }
  return { rows, states };
}

function guestView(g: GuestRow, tables: Map<number, TableRow>, settings: Record<string, string>, locale: Locale) {
  const done = !!g.vector;
  const reveal = settings.reveal !== '0';
  const table = g.table_id != null ? tables.get(g.table_id) : undefined;
  return {
    id: g.id, firstName: g.first_name, lastName: g.last_name, company: g.company,
    consent: !!g.consent_at, done, locked: settings.locked === '1',
    isFacilitator: g.facilitator_table_id != null,
    facilitatorTable: g.facilitator_table_id != null ? { id: g.facilitator_table_id, name: tables.get(g.facilitator_table_id)?.name ?? '' } : null,
    archetype: done && g.archetype ? describeArchetype(g.archetype, locale) : null,
    vector: done ? parseJson<number[]>(g.vector, []) : null,
    dimensions: DIMENSIONS.map(d => ({ key: d.key, low: d.low[locale], high: d.high[locale] })),
    table: done && reveal && table ? { id: table.id, name: table.name } : null,
    waitingTable: done && !g.table_id,     // quiz fatto ma nessun posto libero: l'admin interviene
    revealLater: done && !reveal,
    assignedAt: g.assigned_at ? g.assigned_at.replace(' ', 'T') + (g.assigned_at.endsWith('Z') ? '' : 'Z') : null,
    now: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------- API pubblica
app.get('/api/config', async c => {
  const s = await getSettings(c.env.DB);
  return c.json({ eventName: c.env.EVENT_NAME || 'Partner Meeting', locked: s.locked === '1', reveal: s.reveal !== '0', locale: pickLocale(c) });
});

app.get('/api/guests/search', async c => {
  const q = (c.req.query('q') || '').trim().toLowerCase();
  if (q.length < 2) return c.json([]);
  const like = `%${q.replace(/[%_]/g, '')}%`;
  const { results } = await c.env.DB.prepare(
    `SELECT id, first_name, last_name, company, (vector IS NOT NULL) AS done
     FROM guests
     WHERE lower(first_name || ' ' || last_name) LIKE ?1 OR lower(last_name || ' ' || first_name) LIKE ?1
     ORDER BY last_name, first_name LIMIT 12`).bind(like).all();
  return c.json(results.map((r: any) => ({ id: r.id, firstName: r.first_name, lastName: r.last_name, company: r.company, done: !!r.done })));
});

const DEVICE_COOKIE = 'device_done';
/** Marca il telefono: ha già completato il quiz per questo ospite (cookie firmato, 60 giorni). */
async function markDeviceDone(c: Context<App>, guestId: number) {
  setCookie(c, DEVICE_COOKIE, await signValue(c.env.SESSION_SECRET || 'dev', String(guestId)), cookieOpts(c, 60 * 60 * 24 * 60));
}
/** Id dell'ospite per cui questo telefono ha già giocato, se il cookie è valido. */
async function deviceDoneGuestId(c: Context<App>): Promise<number | null> {
  const v = await verifyValue(c.env.SESSION_SECRET || 'dev', getCookie(c, DEVICE_COOKIE));
  return v && /^\d+$/.test(v) ? Number(v) : null;
}

async function guestFromCookie(c: Context<App>): Promise<GuestRow | null> {
  const tok = getCookie(c, 'guest_token');
  if (!tok) return null;
  return (await c.env.DB.prepare('SELECT * FROM guests WHERE device_token = ?').bind(tok).first<GuestRow>()) ?? null;
}

app.get('/api/me', async c => {
  const g = await guestFromCookie(c);
  if (!g) return c.json({ guest: null });
  const [s, t] = await Promise.all([getSettings(c.env.DB), c.env.DB.prepare('SELECT * FROM tables').all<TableRow>()]);
  const locale = pickLocale(c, c.req.query('locale'));
  return c.json({ guest: guestView(g, new Map(t.results.map(r => [r.id, r])), s, locale) });
});

/** Link personale: chi lo apre vede il proprio nome già selezionato. */
app.get('/api/invite/:token', async c => {
  const token = c.req.param('token');
  if (!/^[a-f0-9]{16,64}$/.test(token)) return c.json({ error: 'not_found' }, 404);
  const g = await c.env.DB.prepare('SELECT * FROM guests WHERE invite_token = ?').bind(token).first<GuestRow>();
  if (!g) return c.json({ error: 'not_found' }, 404);
  const t = g.facilitator_table_id != null ? await c.env.DB.prepare('SELECT id, name FROM tables WHERE id = ?').bind(g.facilitator_table_id).first<TableRow>() : null;
  return c.json({ guest: { id: g.id, firstName: g.first_name, lastName: g.last_name, company: g.company, done: !!g.vector,
    facilitatorTable: t ? { id: t.id, name: t.name } : null } });
});

/** L'utente sceglie il proprio nome (o arriva da un link personale) e accetta l'informativa. */
app.post('/api/claim', async c => {
  const body = await c.req.json<{ guestId?: number; inviteToken?: string; consent?: boolean; locale?: string }>().catch(() => ({} as any));
  if (body.consent !== true) return c.json({ error: 'consent_required' }, 400);
  const locale = pickLocale(c, body.locale);
  const db = c.env.DB;
  let g: GuestRow | null = null;
  if (typeof body.inviteToken === 'string' && /^[a-f0-9]{16,64}$/.test(body.inviteToken)) {
    g = await db.prepare('SELECT * FROM guests WHERE invite_token = ?').bind(body.inviteToken).first<GuestRow>();
  } else {
    const id = Number(body.guestId);
    if (!Number.isInteger(id)) return c.json({ error: 'bad_request' }, 400);
    g = await db.prepare('SELECT * FROM guests WHERE id = ?').bind(id).first<GuestRow>();
  }
  if (!g) return c.json({ error: 'not_found' }, 404);
  const id = g.id;
  // Anti-scherzo: un telefono che ha già completato il quiz per qualcuno non può giocare per un altro nome.
  const lockedTo = await deviceDoneGuestId(c);
  if (lockedTo != null && lockedTo !== id) {
    const other = await db.prepare('SELECT id, first_name, last_name, vector FROM guests WHERE id = ?').bind(lockedTo).first<{ id: number; first_name: string; last_name: string; vector: string | null }>();
    if (other && other.vector) {
      await log(db, 'device_blocked', id, { deviceGuest: lockedTo });
      return c.json({ error: 'device_used', by: { firstName: other.first_name, lastName: other.last_name } }, 409);
    }
  }
  if (!g.device_token) {
    // Primo accesso: creiamo il token. L'UPDATE condizionale evita che due telefoni creino due token.
    const tok = randomToken();
    const r = await db.prepare("UPDATE guests SET device_token = ?, consent_at = datetime('now'), locale = ? WHERE id = ? AND device_token IS NULL")
      .bind(tok, locale, id).run();
    if (r.meta.changes === 0) g = (await db.prepare('SELECT * FROM guests WHERE id = ?').bind(id).first<GuestRow>())!;
    else { g = { ...g, device_token: tok, consent_at: new Date().toISOString(), locale }; await log(db, 'claim', id, { locale }); }
  } else {
    await log(db, 'reclaim', id, { ua: c.req.header('user-agent') });
  }
  setCookie(c, 'guest_token', g.device_token!, cookieOpts(c, 60 * 60 * 24 * 30));
  if (g.vector) await markDeviceDone(c, g.id);
  const [s, t] = await Promise.all([getSettings(db), db.prepare('SELECT * FROM tables').all<TableRow>()]);
  return c.json({ guest: guestView(g, new Map(t.results.map(r => [r.id, r])), s, locale) });
});

app.post('/api/logout', c => { deleteCookie(c, 'guest_token', { path: '/' }); return c.json({ ok: true }); });

/** Estrae (una volta sola) le 4 domande della persona. */
app.post('/api/quiz/start', async c => {
  const g = await guestFromCookie(c);
  if (!g) return c.json({ error: 'unauthorized' }, 401);
  if (g.vector) return c.json({ error: 'already_done' }, 409);
  const body = await c.req.json<{ locale?: string }>().catch(() => ({} as any));
  const locale = pickLocale(c, body.locale);
  let ids = parseJson<string[] | null>(g.quiz_question_ids, null);
  if (!ids || !ids.length) {
    ids = pickQuestionIds();
    await c.env.DB.prepare('UPDATE guests SET quiz_question_ids = ?, locale = ? WHERE id = ? AND quiz_question_ids IS NULL')
      .bind(JSON.stringify(ids), locale, g.id).run();
    const fresh = await c.env.DB.prepare('SELECT quiz_question_ids FROM guests WHERE id = ?').bind(g.id).first<{ quiz_question_ids: string }>();
    ids = parseJson<string[]>(fresh!.quiz_question_ids, ids);
  }
  return c.json({ questions: serializeQuestions(ids, locale) });
});

/** Riceve le risposte, calcola l'archetipo e assegna il tavolo in modo atomico. */
app.post('/api/quiz/submit', async c => {
  const db = c.env.DB;
  const g = await guestFromCookie(c);
  if (!g) return c.json({ error: 'unauthorized' }, 401);
  const body = await c.req.json<{ answers?: Record<string, number>; locale?: string }>().catch(() => ({} as any));
  const locale = pickLocale(c, body.locale);
  const settings = await getSettings(db);
  const tablesAll = await db.prepare('SELECT * FROM tables').all<TableRow>();
  const tableMap = new Map(tablesAll.results.map(r => [r.id, r]));
  const respond = async (row: GuestRow, status = 200) => {
    if (row.vector) await markDeviceDone(c, row.id);
    return c.json({ guest: guestView(row, tableMap, settings, locale) }, status as any);
  };

  if (g.vector) return respond(g); // idempotente: doppio tap, refresh, ecc.
  if (settings.locked === '1') return c.json({ error: 'locked' }, 423);
  const ids = parseJson<string[] | null>(g.quiz_question_ids, null);
  if (!ids) return c.json({ error: 'quiz_not_started' }, 400);

  let vector: number[];
  try { vector = scoreAnswers(ids, body.answers || {}); } catch { return c.json({ error: 'invalid_answers' }, 400); }
  const arch = archetypeKey(vector);
  const w = await weightsFrom(db, settings);
  const vecJson = JSON.stringify(vector), ansJson = JSON.stringify(body.answers);

  // --- Facilitatore: va al suo tavolo e ne diventa il seme. Non è soggetto al limite posti.
  if (g.facilitator_table_id != null && tableMap.has(g.facilitator_table_id)) {
    const tid = g.facilitator_table_id;
    const r = await db.prepare(
      `UPDATE guests SET answers=?, vector=?, archetype=?, table_id=?, assigned_at=datetime('now'), assigned_by='facilitator'
       WHERE id=? AND table_id IS NULL AND vector IS NULL`).bind(ansJson, vecJson, arch, tid, g.id).run();
    if (r.meta.changes === 1) {
      await db.prepare('UPDATE tables SET seed_vector = ? WHERE id = ?').bind(vecJson, tid).run();
      await log(db, 'assign', g.id, { table: tid, by: 'facilitator', vector });
    }
    return respond((await db.prepare('SELECT * FROM guests WHERE id = ?').bind(g.id).first<GuestRow>())!);
  }

  // --- Ospite normale: tenta i tavoli in ordine di affinità. L'UPDATE è atomico:
  //     assegna solo se la persona è ancora libera E il tavolo ha ancora posto.
  for (let attempt = 0; attempt < 6; attempt++) {
    const { states } = await loadTableStates(db);
    const ranked = rankTables(states, { vector, group: g.group_key, gender: g.gender }, w);
    if (!ranked.length) break;
    for (const tid of ranked.slice(0, 3)) {
      const r = await db.prepare(
        `UPDATE guests SET answers=?1, vector=?2, archetype=?3, table_id=?4, assigned_at=datetime('now'), assigned_by='quiz'
         WHERE id=?5 AND table_id IS NULL AND vector IS NULL
           AND (SELECT COUNT(*) FROM guests WHERE table_id=?4) < (SELECT capacity FROM tables WHERE id=?4)`)
        .bind(ansJson, vecJson, arch, tid, g.id).run();
      if (r.meta.changes === 1) {
        await log(db, 'assign', g.id, { table: tid, by: 'quiz', attempt, vector });
        return respond((await db.prepare('SELECT * FROM guests WHERE id = ?').bind(g.id).first<GuestRow>())!);
      }
      // 0 righe: o il tavolo si è riempito nel frattempo, o la persona è già stata assegnata altrove.
      const cur = await db.prepare('SELECT * FROM guests WHERE id = ?').bind(g.id).first<GuestRow>();
      if (cur?.vector) return respond(cur);
    }
  }
  // Nessun posto libero: salviamo comunque il risultato, l'admin vedrà la persona "in attesa".
  await db.prepare('UPDATE guests SET answers=?, vector=?, archetype=? WHERE id=? AND vector IS NULL').bind(ansJson, vecJson, arch, g.id).run();
  await log(db, 'no_seat', g.id, { vector });
  return respond((await db.prepare('SELECT * FROM guests WHERE id = ?').bind(g.id).first<GuestRow>())!);
});

// ---------------------------------------------------------------- Admin
app.post('/api/admin/login', async c => {
  const body = await c.req.json<{ password?: string }>().catch(() => ({} as any));
  const expected = c.env.ADMIN_PASSWORD || '';
  if (!expected || !c.env.SESSION_SECRET) return c.json({ error: 'server_not_configured' }, 500);
  if (typeof body.password !== 'string' || !timingSafeEqual(body.password, expected)) {
    await new Promise(r => setTimeout(r, 400));
    return c.json({ error: 'invalid_password' }, 401);
  }
  setCookie(c, 'admin_session', await makeAdminToken(c.env.SESSION_SECRET), cookieOpts(c, 60 * 60 * 24));
  return c.json({ ok: true });
});
app.post('/api/admin/logout', c => { deleteCookie(c, 'admin_session', { path: '/' }); return c.json({ ok: true }); });

const admin = new Hono<App>();
admin.use('*', async (c, next) => {
  // Due modi per autenticarsi: cookie di sessione (pannello web) oppure
  // header "Authorization: Bearer <ADMIN_PASSWORD>" per automazioni/API.
  const bearer = (c.req.header('authorization') || '').replace(/^Bearer\s+/i, '');
  const byHeader = !!bearer && !!c.env.ADMIN_PASSWORD && timingSafeEqual(bearer, c.env.ADMIN_PASSWORD);
  if (!byHeader && !(await verifyAdminToken(c.env.SESSION_SECRET || '', getCookie(c, 'admin_session')))) return c.json({ error: 'unauthorized' }, 401);
  await next();
});

admin.get('/state', async c => {
  const db = c.env.DB;
  const [s, t, g] = await Promise.all([
    getSettings(db),
    db.prepare('SELECT * FROM tables ORDER BY id').all<TableRow>(),
    db.prepare('SELECT * FROM guests ORDER BY last_name, first_name').all<GuestRow>(),
  ]);
  const guests = g.results.map(x => ({
    id: x.id, firstName: x.first_name, lastName: x.last_name, company: x.company, department: x.department, groupKey: x.group_key, gender: x.gender,
    facilitatorTableId: x.facilitator_table_id, consent: !!x.consent_at, started: !!x.quiz_question_ids, done: !!x.vector,
    vector: parseJson<number[] | null>(x.vector, null), archetype: x.archetype ? describeArchetype(x.archetype, 'it').name : null,
    tableId: x.table_id, assignedAt: x.assigned_at, assignedBy: x.assigned_by, locale: x.locale, inviteToken: x.invite_token,
  }));
  return c.json({
    settings: s,
    tables: t.results.map(r => ({ id: r.id, name: r.name, capacity: r.capacity, seed: parseJson<number[] | null>(r.seed_vector, null) })),
    guests,
    dimensions: DIMENSIONS.map(d => ({ key: d.key, low: d.low.it, high: d.high.it })),
    stats: { guests: guests.length, consented: guests.filter(x => x.consent).length, done: guests.filter(x => x.done).length,
             seated: guests.filter(x => x.tableId != null).length, waiting: guests.filter(x => x.done && x.tableId == null).length,
             genders: Object.fromEntries(['M', 'F', ''].map(k => [k || 'nd', guests.filter(x => x.gender === k).length])) },
  });
});

admin.put('/settings', async c => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
  const allowed: Record<string, (v: unknown) => string | null> = {
    locked: v => (v === true || v === '1' || v === 1 ? '1' : '0'),
    reveal: v => (v === false || v === '0' || v === 0 ? '0' : '1'),
    gender_balance: v => (v === false || v === '0' || v === 0 ? '0' : '1'),
    max_same_group: v => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 20 ? String(n) : null; },
    default_capacity: v => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 50 ? String(n) : null; },
  };
  const stmts = [];
  for (const [k, fn] of Object.entries(allowed)) if (k in body) {
    const v = fn(body[k]); if (v === null) return c.json({ error: `invalid_${k}` }, 400);
    stmts.push(c.env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, v));
  }
  if (stmts.length) await c.env.DB.batch(stmts);
  await log(c.env.DB, 'admin_settings', null, body);
  return c.json({ settings: await getSettings(c.env.DB) });
});

/** Crea/aggiorna tavoli. Un tavolo si può eliminare solo se vuoto; la capienza non può scendere sotto gli occupanti. */
admin.put('/tables', async c => {
  const db = c.env.DB;
  const body = await c.req.json<{ tables?: { id: number; name?: string; capacity?: number }[] }>().catch(() => ({} as any));
  if (!Array.isArray(body.tables)) return c.json({ error: 'bad_request' }, 400);
  const s = await getSettings(db);
  const defCap = Number(s.default_capacity) || 10;
  const occ = await db.prepare('SELECT table_id, COUNT(*) AS n FROM guests WHERE table_id IS NOT NULL GROUP BY table_id').all<{ table_id: number; n: number }>();
  const occMap = new Map(occ.results.map(r => [r.table_id, r.n]));
  const existing = await db.prepare('SELECT id FROM tables').all<{ id: number }>();
  const keep = new Set<number>();
  const stmts: D1PreparedStatement[] = [];
  for (const t of body.tables) {
    const id = Number(t.id);
    if (!Number.isInteger(id) || id < 1 || id > 999) return c.json({ error: 'invalid_table_id' }, 400);
    const cap = t.capacity == null ? defCap : Number(t.capacity);
    if (!Number.isInteger(cap) || cap < 1 || cap > 50) return c.json({ error: 'invalid_capacity', table: id }, 400);
    if (cap < (occMap.get(id) ?? 0)) return c.json({ error: 'capacity_below_occupancy', table: id, occupancy: occMap.get(id) }, 409);
    keep.add(id);
    stmts.push(db.prepare(`INSERT INTO tables (id, name, capacity) VALUES (?1, ?2, ?3)
                           ON CONFLICT(id) DO UPDATE SET name = excluded.name, capacity = excluded.capacity`)
      .bind(id, String(t.name ?? '').slice(0, 80), cap));
  }
  for (const e of existing.results) if (!keep.has(e.id)) {
    if ((occMap.get(e.id) ?? 0) > 0) return c.json({ error: 'table_not_empty', table: e.id }, 409);
    stmts.push(db.prepare('UPDATE guests SET facilitator_table_id = NULL WHERE facilitator_table_id = ?').bind(e.id));
    stmts.push(db.prepare('DELETE FROM tables WHERE id = ?').bind(e.id));
  }
  if (stmts.length) await db.batch(stmts);
  await log(db, 'admin_tables', null, { count: keep.size });
  return c.json({ ok: true });
});

// ---- Invitati
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
  const split = (line: string) => {
    const out: string[] = []; let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
      else if (ch === sep && !inQ) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur); return out.map(x => x.trim());
  };
  const norm = (h: string) => h.toLowerCase().replace(/[^a-z]/g, '');
  const aliases: Record<string, string> = {
    nome: 'first_name', firstname: 'first_name', prenom: 'first_name', name: 'first_name',
    cognome: 'last_name', lastname: 'last_name', nom: 'last_name', surname: 'last_name',
    azienda: 'company', company: 'company', societe: 'company', societa: 'company', partner: 'company',
    dipartimento: 'department', department: 'department', reparto: 'department', dept: 'department', funzione: 'department',
    tavolo: 'table', table: 'table', facilitatore: 'table', facilitator: 'table',
    genere: 'gender', gender: 'gender', sesso: 'gender', sexe: 'gender', sex: 'gender',
  };
  const header = split(lines[0]).map(h => aliases[norm(h)] ?? norm(h));
  return lines.slice(1).map(split).map(cells => Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ''])));
}

export function groupKeyFor(company: string, department: string): string {
  const co = company.trim().toLowerCase();
  if (co.includes('danfoss')) return department.trim() ? `danfoss:${department.trim().toLowerCase()}` : 'danfoss';
  return co;
}
const nameKey = (f: string, l: string) => `${f.trim().toLowerCase()}|${l.trim().toLowerCase()}`;

admin.post('/guests/import', async c => {
  const db = c.env.DB;
  const body = await c.req.json<{ csv?: string; mode?: 'merge' | 'replace' }>().catch(() => ({} as any));
  if (typeof body.csv !== 'string') return c.json({ error: 'bad_request' }, 400);
  const rows = parseCsv(body.csv).filter(r => (r.first_name || '') && (r.last_name || ''));
  if (!rows.length) return c.json({ error: 'no_rows' }, 400);
  const mode = body.mode === 'replace' ? 'replace' : 'merge';
  if (mode === 'replace') {
    const done = await db.prepare('SELECT COUNT(*) AS n FROM guests WHERE vector IS NOT NULL').first<{ n: number }>();
    if ((done?.n ?? 0) > 0) return c.json({ error: 'replace_blocked_quiz_done', done: done?.n }, 409);
    await db.batch([db.prepare('DELETE FROM guests'), db.prepare('UPDATE tables SET seed_vector = NULL')]);
  }
  const existing = await db.prepare('SELECT id, first_name, last_name FROM guests').all<{ id: number; first_name: string; last_name: string }>();
  const byName = new Map(existing.results.map(r => [nameKey(r.first_name, r.last_name), r.id]));
  const tables = new Set((await db.prepare('SELECT id FROM tables').all<{ id: number }>()).results.map(r => r.id));
  let inserted = 0, updated = 0, skipped = 0; const unknownTables: number[] = [];
  const stmts: D1PreparedStatement[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const key = nameKey(r.first_name, r.last_name);
    if (seen.has(key)) { skipped++; continue; } seen.add(key);
    const company = (r.company || '').trim(), department = (r.department || '').trim();
    const gk = groupKeyFor(company, department);
    const gender = normGender(r.gender);
    let tid: number | null = null;
    if (r.table && r.table.trim()) { const n = Number(r.table); if (Number.isInteger(n) && tables.has(n)) tid = n; else unknownTables.push(n); }
    const id = byName.get(key);
    if (id) {
      updated++;
      stmts.push(db.prepare(`UPDATE guests SET company=?, department=?, group_key=?, gender=CASE WHEN ?<>'' THEN ? ELSE gender END,
                             facilitator_table_id=COALESCE(?, facilitator_table_id),
                             invite_token=CASE WHEN ? IS NOT NULL THEN COALESCE(invite_token, ?) ELSE invite_token END WHERE id=?`)
        .bind(company, department, gk, gender, gender, tid, tid, randomToken(), id));
    } else {
      inserted++;
      stmts.push(db.prepare(`INSERT INTO guests (first_name, last_name, company, department, group_key, gender, facilitator_table_id, invite_token) VALUES (?,?,?,?,?,?,?,?)`)
        .bind(r.first_name.trim(), r.last_name.trim(), company, department, gk, gender, tid, tid != null ? randomToken() : null));
    }
  }
  for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
  await log(db, 'admin_import', null, { mode, inserted, updated, skipped });
  return c.json({ inserted, updated, skipped, unknownTables });
});

admin.post('/guests', async c => {
  const b = await c.req.json<{ firstName?: string; lastName?: string; company?: string; department?: string; gender?: string }>().catch(() => ({} as any));
  if (!b.firstName?.trim() || !b.lastName?.trim()) return c.json({ error: 'name_required' }, 400);
  const company = (b.company || '').trim(), department = (b.department || '').trim();
  const r = await c.env.DB.prepare('INSERT INTO guests (first_name, last_name, company, department, group_key, gender) VALUES (?,?,?,?,?,?)')
    .bind(b.firstName.trim(), b.lastName.trim(), company, department, groupKeyFor(company, department), normGender(b.gender)).run();
  return c.json({ id: r.meta.last_row_id });
});

/** Modifica anagrafica (azienda, dipartimento, genere). */
admin.patch('/guests/:id', async c => {
  const id = Number(c.req.param('id'));
  const b = await c.req.json<{ company?: string; department?: string; gender?: string }>().catch(() => ({} as any));
  const g = await c.env.DB.prepare('SELECT * FROM guests WHERE id = ?').bind(id).first<GuestRow>();
  if (!g) return c.json({ error: 'not_found' }, 404);
  const company = b.company !== undefined ? String(b.company).trim() : g.company;
  const department = b.department !== undefined ? String(b.department).trim() : g.department;
  const gender = b.gender !== undefined ? normGender(b.gender) : g.gender;
  await c.env.DB.prepare('UPDATE guests SET company=?, department=?, group_key=?, gender=? WHERE id=?')
    .bind(company, department, groupKeyFor(company, department), gender, id).run();
  return c.json({ ok: true });
});

admin.delete('/guests/:id', async c => {
  const id = Number(c.req.param('id'));
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE tables SET seed_vector = NULL WHERE id = (SELECT facilitator_table_id FROM guests WHERE id = ?)").bind(id),
    c.env.DB.prepare('DELETE FROM guests WHERE id = ?').bind(id),
  ]);
  await log(c.env.DB, 'admin_delete_guest', id);
  return c.json({ ok: true });
});

/** Azzera quiz e tavolo di una persona: potrà rifare il test. */
admin.post('/guests/:id/reset', async c => {
  const id = Number(c.req.param('id'));
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE tables SET seed_vector = NULL WHERE id = (SELECT facilitator_table_id FROM guests WHERE id = ?)').bind(id),
    c.env.DB.prepare(`UPDATE guests SET quiz_question_ids=NULL, answers=NULL, vector=NULL, archetype=NULL, table_id=NULL, assigned_at=NULL, assigned_by=NULL WHERE id=?`).bind(id),
  ]);
  await log(c.env.DB, 'admin_reset', id);
  return c.json({ ok: true });
});

/** Spostamento manuale (o rimozione dal tavolo con tableId null). */
admin.post('/guests/:id/move', async c => {
  const db = c.env.DB;
  const id = Number(c.req.param('id'));
  const b = await c.req.json<{ tableId?: number | null; force?: boolean }>().catch(() => ({} as any));
  if (b.tableId == null) {
    await db.prepare('UPDATE guests SET table_id=NULL, assigned_at=NULL, assigned_by=NULL WHERE id=?').bind(id).run();
  } else {
    const tid = Number(b.tableId);
    const t = await db.prepare('SELECT id FROM tables WHERE id = ?').bind(tid).first();
    if (!t) return c.json({ error: 'table_not_found' }, 404);
    const r = b.force
      ? await db.prepare("UPDATE guests SET table_id=?1, assigned_at=datetime('now'), assigned_by='admin' WHERE id=?2").bind(tid, id).run()
      : await db.prepare(`UPDATE guests SET table_id=?1, assigned_at=datetime('now'), assigned_by='admin' WHERE id=?2
                          AND (SELECT COUNT(*) FROM guests WHERE table_id=?1 AND id<>?2) < (SELECT capacity FROM tables WHERE id=?1)`).bind(tid, id).run();
    if (r.meta.changes === 0) return c.json({ error: 'table_full' }, 409);
  }
  await log(db, 'admin_move', id, { tableId: b.tableId, force: !!b.force });
  return c.json({ ok: true });
});

/** Imposta / rimuove il ruolo di facilitatore. */
admin.post('/guests/:id/facilitator', async c => {
  const db = c.env.DB;
  const id = Number(c.req.param('id'));
  const b = await c.req.json<{ tableId?: number | null }>().catch(() => ({} as any));
  const g = await db.prepare('SELECT * FROM guests WHERE id = ?').bind(id).first<GuestRow>();
  if (!g) return c.json({ error: 'not_found' }, 404);
  const stmts: D1PreparedStatement[] = [];
  if (g.facilitator_table_id != null) stmts.push(db.prepare('UPDATE tables SET seed_vector = NULL WHERE id = ?').bind(g.facilitator_table_id));
  if (b.tableId == null) {
    stmts.push(db.prepare('UPDATE guests SET facilitator_table_id = NULL WHERE id = ?').bind(id));
  } else {
    const tid = Number(b.tableId);
    if (!(await db.prepare('SELECT id FROM tables WHERE id = ?').bind(tid).first())) return c.json({ error: 'table_not_found' }, 404);
    stmts.push(db.prepare('UPDATE guests SET facilitator_table_id = NULL WHERE facilitator_table_id = ? AND id <> ?').bind(tid, id));
    stmts.push(db.prepare('UPDATE guests SET facilitator_table_id = ?, invite_token = COALESCE(invite_token, ?) WHERE id = ?').bind(tid, randomToken(), id));
    if (g.vector) {
      stmts.push(db.prepare("UPDATE guests SET table_id = ?, assigned_at = datetime('now'), assigned_by = 'facilitator' WHERE id = ?").bind(tid, id));
      stmts.push(db.prepare('UPDATE tables SET seed_vector = ? WHERE id = ?').bind(g.vector, tid));
    }
  }
  await db.batch(stmts);
  await log(db, 'admin_facilitator', id, { tableId: b.tableId });
  return c.json({ ok: true });
});

/** Genera (o rigenera con force) il link personale di una persona. */
admin.post('/guests/:id/invite', async c => {
  const id = Number(c.req.param('id'));
  const b = await c.req.json<{ force?: boolean }>().catch(() => ({} as any));
  const tok = randomToken();
  await c.env.DB.prepare(b.force ? 'UPDATE guests SET invite_token = ? WHERE id = ?' : 'UPDATE guests SET invite_token = COALESCE(invite_token, ?) WHERE id = ?').bind(tok, id).run();
  const g = await c.env.DB.prepare('SELECT invite_token FROM guests WHERE id = ?').bind(id).first<{ invite_token: string }>();
  return c.json({ inviteToken: g?.invite_token });
});

/** Ricalcolo globale: facilitatori fissi, tutti gli altri ridistribuiti per affinità. */
admin.post('/rebalance', async c => {
  const db = c.env.DB;
  const s = await getSettings(db);
  const t = await db.prepare('SELECT * FROM tables').all<TableRow>();
  const g = await db.prepare('SELECT * FROM guests WHERE vector IS NOT NULL').all<GuestRow>();
  const tables = t.results.map(r => ({ id: r.id, capacity: r.capacity, seed: parseJson<number[] | null>(r.seed_vector, null) }));
  const fixed = g.results.filter(x => x.facilitator_table_id != null && x.table_id != null)
    .map(x => ({ guestId: x.id, tableId: x.table_id!, vector: parseJson<number[] | null>(x.vector, null), group: x.group_key, gender: x.gender }));
  const movable = g.results.filter(x => !(x.facilitator_table_id != null && x.table_id != null))
    .map(x => ({ guestId: x.id, vector: parseJson<number[]>(x.vector, []), group: x.group_key, gender: x.gender }));
  const plan = rebalance(tables, fixed, movable, await weightsFrom(db, s));
  const stmts = movable.map(m => plan.has(m.guestId)
    ? db.prepare("UPDATE guests SET table_id=?, assigned_at=datetime('now'), assigned_by='rebalance' WHERE id=?").bind(plan.get(m.guestId), m.guestId)
    : db.prepare('UPDATE guests SET table_id=NULL WHERE id=?').bind(m.guestId));
  for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
  await log(db, 'admin_rebalance', null, { moved: plan.size, unseated: movable.length - plan.size });
  return c.json({ moved: plan.size, unseated: movable.length - plan.size });
});

admin.get('/export.csv', async c => {
  const g = await c.env.DB.prepare(`SELECT g.*, t.name AS table_name FROM guests g LEFT JOIN tables t ON t.id = g.table_id ORDER BY g.table_id, g.last_name`).all<GuestRow & { table_name: string | null }>();
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['tavolo', 'nome_tavolo', 'cognome', 'nome', 'azienda', 'dipartimento', 'genere', 'facilitatore_di', 'archetipo', 'energia', 'gusto', 'social', 'metodo', 'assegnato_il', 'assegnato_da'];
  const lines = [head.join(';')];
  for (const x of g.results) {
    const v = parseJson<number[]>(x.vector, []);
    lines.push([x.table_id, x.table_name, x.last_name, x.first_name, x.company, x.department, x.gender, x.facilitator_table_id,
      x.archetype ? describeArchetype(x.archetype, 'it').name : '', v[0], v[1], v[2], v[3], x.assigned_at, x.assigned_by].map(esc).join(';'));
  }
  return new Response('﻿' + lines.join('\r\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="tavoli.csv"' } });
});

admin.get('/events', async c => {
  const { results } = await c.env.DB.prepare('SELECT * FROM events ORDER BY id DESC LIMIT 200').all();
  return c.json(results);
});

/** Cancella tutti i dati personali (da usare dopo l'evento). */
admin.post('/wipe', async c => {
  const b = await c.req.json<{ confirm?: string }>().catch(() => ({} as any));
  if (b.confirm !== 'CANCELLA TUTTO') return c.json({ error: 'confirmation_required' }, 400);
  await c.env.DB.batch([c.env.DB.prepare('DELETE FROM guests'), c.env.DB.prepare('DELETE FROM events'), c.env.DB.prepare('UPDATE tables SET seed_vector = NULL')]);
  return c.json({ ok: true });
});

app.route('/api/admin', admin);

app.notFound(c => c.req.path.startsWith('/api/') ? c.json({ error: 'not_found' }, 404) : c.env.ASSETS.fetch(c.req.raw));
app.onError((err, c) => { console.error(err); return c.json({ error: 'internal', message: String(err?.message || err) }, 500); });

export default app;
