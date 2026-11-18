/**
 * Test di carico e di correttezza.
 *   node scripts/loadtest.mjs [BASE_URL] [ADMIN_PASSWORD]
 * Scenario A: 12 tavoli x 10 posti, 110 persone (50 Danfoss in 8 dipartimenti, 60 partner), 12 facilitatori;
 *             tutti giocano contemporaneamente, ognuno invia il quiz due volte (doppio tap).
 * Scenario B: 3 tavoli x 4 posti, 20 persone concorrenti → esattamente 12 sedute, 8 in attesa, mai sovraccapienza.
 * ATTENZIONE: cancella e ricrea i dati del database a cui punta. Usare solo in locale/staging.
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8787';
const PW = process.argv[3] || 'test1234';

const cookieOf = res => (res.headers.get('set-cookie') || '').split(';')[0];
async function call(path, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, cookie: cookieOf(res) };
}
const assert = (cond, msg) => { if (!cond) { console.error('❌ ' + msg); process.exitCode = 1; } else console.log('✅ ' + msg); };

async function adminLogin() {
  const r = await call('/api/admin/login', { method: 'POST', body: { password: PW } });
  if (r.status !== 200) throw new Error('login admin fallito: ' + JSON.stringify(r.data));
  return r.cookie;
}

function makeGuests(n, danfoss, facilitators) {
  const depts = ['Sales', 'Marketing', 'Service', 'Finance', 'HR', 'R&D', 'Operations', 'Legal'];
  const rows = ['nome;cognome;azienda;dipartimento;genere;tavolo'];
  let f = 1;
  for (let i = 1; i <= n; i++) {
    const isD = i <= danfoss;
    const company = isD ? 'Danfoss' : `Partner ${Math.ceil((i - danfoss) / 3)} Srl`;
    const dept = isD ? depts[i % depts.length] : '';
    const table = f <= facilitators && i % 5 === 0 ? f++ : '';
    const gender = i % 5 === 1 ? 'F' : 'M'; // ~20% donne, come nella lista reale
    rows.push(`Nome${i};Cognome${i};${company};${dept};${gender};${table}`);
  }
  return rows.join('\n');
}

async function setup(admin, tables, capacity, guestsCsv) {
  await call('/api/admin/wipe', { method: 'POST', body: { confirm: 'CANCELLA TUTTO' }, cookie: admin });
  await call('/api/admin/tables', { method: 'PUT', body: { tables: [] }, cookie: admin });
  const t = Array.from({ length: tables }, (_, i) => ({ id: i + 1, name: `Tavolo ${i + 1}`, capacity }));
  const r1 = await call('/api/admin/tables', { method: 'PUT', body: { tables: t }, cookie: admin });
  if (r1.status !== 200) throw new Error('tables: ' + JSON.stringify(r1.data));
  const r2 = await call('/api/admin/guests/import', { method: 'POST', body: { csv: guestsCsv, mode: 'replace' }, cookie: admin });
  if (r2.status !== 200) throw new Error('import: ' + JSON.stringify(r2.data));
  await call('/api/admin/settings', { method: 'PUT', body: { locked: false, reveal: true }, cookie: admin });
  return (await call('/api/admin/state', { cookie: admin })).data;
}

async function play(guestId) {
  const c = await call('/api/claim', { method: 'POST', body: { guestId, consent: true, locale: Math.random() < 0.3 ? 'fr' : 'it' } });
  if (c.status !== 200) return { guestId, error: 'claim ' + c.status };
  const cookie = c.cookie;
  const s = await call('/api/quiz/start', { method: 'POST', body: {}, cookie });
  if (s.status !== 200) return { guestId, error: 'start ' + s.status };
  const answers = Object.fromEntries(s.data.questions.map(q => [q.id, Math.floor(Math.random() * q.options.length)]));
  // doppio tap: due submit in parallelo
  const [a, b] = await Promise.all([
    call('/api/quiz/submit', { method: 'POST', body: { answers }, cookie }),
    call('/api/quiz/submit', { method: 'POST', body: { answers }, cookie }),
  ]);
  const ta = a.data.guest?.table?.id ?? null, tb = b.data.guest?.table?.id ?? null;
  return { guestId, status: [a.status, b.status], tables: [ta, tb], waiting: !!a.data.guest?.waitingTable };
}

function verify(state, label) {
  const byTable = new Map(state.tables.map(t => [t.id, []]));
  for (const g of state.guests) if (g.tableId != null) byTable.get(g.tableId).push(g);
  const over = state.tables.filter(t => byTable.get(t.id).length > t.capacity);
  assert(over.length === 0, `${label}: nessun tavolo oltre la capienza`);
  const multi = state.guests.filter(g => Array.isArray(g.tableId));
  assert(multi.length === 0, `${label}: nessuna persona con più tavoli`);
  const facOk = state.guests.filter(g => g.facilitatorTableId != null && g.done).every(g => g.tableId === g.facilitatorTableId);
  assert(facOk, `${label}: ogni facilitatore è al proprio tavolo`);
  const groupStats = [];
  for (const t of state.tables) {
    const counts = {};
    for (const g of byTable.get(t.id)) counts[g.groupKey] = (counts[g.groupKey] || 0) + 1;
    groupStats.push(Math.max(0, ...Object.values(counts)));
  }
  console.log(`   ${label}: occupazione per tavolo = ${state.tables.map(t => byTable.get(t.id).length).join(',')}`);
  console.log(`   ${label}: max persone dello stesso gruppo per tavolo = ${groupStats.join(',')}`);
  const women = state.tables.map(t => byTable.get(t.id).filter(g => g.gender === 'F').length);
  console.log(`   ${label}: donne per tavolo = ${women.join(',')}`);
  return { byTable, women };
  return { byTable };
}

(async () => {
  const admin = await adminLogin();

  // ---------------- Scenario A
  console.log('\n=== Scenario A: 110 persone, 12 tavoli x 10, tutti insieme ===');
  let st = await setup(admin, 12, 10, makeGuests(110, 50, 12));
  assert(st.guests.length === 110, 'importati 110 invitati');
  const facs = st.guests.filter(g => g.facilitatorTableId != null);
  assert(facs.length === 12, '12 facilitatori');
  await Promise.all(facs.map(f => play(f.id)));                 // i facilitatori giocano per primi
  const others = st.guests.filter(g => g.facilitatorTableId == null);
  const t0 = Date.now();
  const results = await Promise.all(others.map(g => play(g.id)));
  const dt = Date.now() - t0;
  const errors = results.filter(r => r.error);
  assert(errors.length === 0, `nessun errore HTTP su ${others.length} giocate concorrenti (${dt} ms)` + (errors.length ? ' ' + JSON.stringify(errors.slice(0, 3)) : ''));
  assert(results.every(r => r.tables[0] === r.tables[1]), 'doppio submit restituisce sempre lo stesso tavolo');
  assert(results.every(r => r.tables[0] != null), 'tutti hanno un tavolo (110 persone su 120 posti)');
  st = (await call('/api/admin/state', { cookie: admin })).data;
  assert(st.stats.seated === 110, `seduti = 110 (trovati ${st.stats.seated})`);
  const vA = verify(st, 'A');
  const totalWomen = st.guests.filter(g => g.gender === 'F' && g.tableId != null).length;
  const ideal = totalWomen / st.tables.length;
  assert(vA.women.every(w => Math.abs(w - ideal) <= 2), `bilanciamento di genere: ogni tavolo entro ±2 dalla media (${ideal.toFixed(1)} donne)`);
  // riaccesso: stesso nome → stesso tavolo, nessuna rigiocata
  const someone = others[0];
  const again = await call('/api/claim', { method: 'POST', body: { guestId: someone.id, consent: true } });
  assert(again.data.guest.done && again.data.guest.table, 'riaccesso mostra il tavolo già assegnato');
  const retry = await call('/api/quiz/start', { method: 'POST', body: {}, cookie: again.cookie });
  assert(retry.status === 409, 'impossibile rifare il quiz (409)');
  // ricalcolo globale
  const rb = await call('/api/admin/rebalance', { method: 'POST', cookie: admin });
  st = (await call('/api/admin/state', { cookie: admin })).data;
  assert(rb.data.unseated === 0 && st.stats.seated === 110, 'ricalcolo globale: tutti ancora seduti');
  verify(st, 'A dopo ricalcolo');

  // ---------------- Scenario B
  console.log('\n=== Scenario B: 20 persone su 3 tavoli x 4 (overbooking) ===');
  st = await setup(admin, 3, 4, makeGuests(20, 0, 0));
  const res = await Promise.all(st.guests.map(g => play(g.id)));
  st = (await call('/api/admin/state', { cookie: admin })).data;
  assert(st.stats.seated === 12, `esattamente 12 seduti (trovati ${st.stats.seated})`);
  assert(st.stats.waiting === 8, `8 in attesa (trovati ${st.stats.waiting})`);
  assert(res.filter(r => r.waiting).length === 8, 'le 8 persone in attesa hanno ricevuto lo stato "waiting"');
  verify(st, 'B');
  // lock
  await call('/api/admin/settings', { method: 'PUT', body: { locked: true }, cookie: admin });
  const extra = await call('/api/admin/guests', { method: 'POST', body: { firstName: 'Late', lastName: 'Comer', company: 'X' }, cookie: admin });
  const c = await call('/api/claim', { method: 'POST', body: { guestId: extra.data.id, consent: true } });
  await call('/api/quiz/start', { method: 'POST', body: {}, cookie: c.cookie });
  const sub = await call('/api/quiz/submit', { method: 'POST', body: { answers: {} }, cookie: c.cookie });
  assert(sub.status === 423, 'a iscrizioni chiuse il submit risponde 423');
  await call('/api/admin/settings', { method: 'PUT', body: { locked: false }, cookie: admin });

  console.log(process.exitCode ? '\n❌ TEST FALLITI' : '\n✅ TUTTO OK');
})().catch(e => { console.error(e); process.exit(1); });
