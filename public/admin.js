/* Pannello admin */
(() => {
  const $ = s => document.querySelector(s);
  const app = $('#app');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = m => { const el = $('#toast'); el.textContent = m; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2200); };
  const api = async (path, opts = {}) => {
    const r = await fetch(path, { headers: { 'content-type': 'application/json' }, credentials: 'same-origin', ...opts, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) { S = null; renderLogin(); throw new Error('unauthorized'); }
    if (!r.ok) throw Object.assign(new Error(data.error || 'error'), { status: r.status, data });
    return data;
  };

  let S = null; let tab = localStorage.getItem('adminTab') || 'tavoli'; let filter = ''; let timer;

  async function refresh(silent) {
    try { S = await api('/api/admin/state'); if (!silent) render(); else if (tab === 'tavoli') render(); } catch (e) { if (e.message !== 'unauthorized') toast('Errore: ' + e.message); }
  }

  function renderLogin() {
    clearInterval(timer);
    $('#topActions').innerHTML = '';
    app.innerHTML = `<div class="card" style="max-width:420px;margin:40px auto"><h1>Accesso admin</h1>
      <input type="password" id="pw" placeholder="Password" autofocus><p></p><button class="btn" id="login">Entra</button><p class="err" id="err"></p></div>`;
    const go = async () => {
      try { await api('/api/admin/login', { method: 'POST', body: { password: $('#pw').value } });
        const next = new URLSearchParams(location.search).get('next'); if (next && next.startsWith('/')) { location.href = next; return; }
        await refresh(); start(); }
      catch (e) { $('#err').textContent = e.status === 401 ? 'Password errata' : 'Errore: ' + (e.data?.error || e.message); }
    };
    $('#login').onclick = go; $('#pw').onkeydown = e => { if (e.key === 'Enter') go(); };
  }

  function start() { clearInterval(timer); timer = setInterval(() => refresh(true), 10000); }

  function render() {
    if (!S) return renderLogin();
    const st = S.stats;
    $('#sub').textContent = `${st.seated} seduti · ${st.done} quiz fatti · ${st.consented} accessi · ${st.guests} invitati` + (st.waiting ? ` · ⚠️ ${st.waiting} in attesa di posto` : '');
    $('#topActions').innerHTML = `
      <label class="muted" style="font-size:13px"><input type="checkbox" id="locked" ${S.settings.locked === '1' ? 'checked' : ''}> Iscrizioni chiuse</label>
      <label class="muted" style="font-size:13px"><input type="checkbox" id="reveal" ${S.settings.reveal !== '0' ? 'checked' : ''}> Mostra tavolo subito</label>
      <a class="btn small secondary" href="/board" target="_blank">Tabellone</a>
      <a class="btn small secondary" href="/api/admin/export.csv">Export CSV</a>
      <button class="btn small secondary" id="logout">Esci</button>`;
    $('#locked').onchange = e => saveSettings({ locked: e.target.checked });
    $('#reveal').onchange = e => saveSettings({ reveal: e.target.checked });
    $('#logout').onclick = async () => { await api('/api/admin/logout', { method: 'POST' }); S = null; renderLogin(); };
    const tabs = [['tavoli', 'Tavoli live'], ['invitati', 'Invitati'], ['setup', 'Setup'], ['log', 'Log']];
    app.innerHTML = `<div class="tabs">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-t="${k}">${l}</button>`).join('')}</div><div id="panel"></div>`;
    app.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; localStorage.setItem('adminTab', tab); render(); });
    ({ tavoli: renderTables, invitati: renderGuests, setup: renderSetup, log: renderLog })[tab]();
  }

  async function saveSettings(patch) { try { S.settings = (await api('/api/admin/settings', { method: 'PUT', body: patch })).settings; toast('Salvato'); } catch (e) { toast('Errore: ' + e.message); } }

  const tableOptions = (sel) => `<option value="">— nessuno —</option>` + S.tables.map(t => `<option value="${t.id}" ${sel === t.id ? 'selected' : ''}>${t.id} ${esc(t.name)}</option>`).join('');

  function renderTables() {
    const byTable = new Map(S.tables.map(t => [t.id, []]));
    const waiting = [];
    for (const g of S.guests) { if (g.tableId != null) byTable.get(g.tableId)?.push(g); else if (g.done) waiting.push(g); }
    const dimLbl = v => v == null ? '' : S.dimensions.map((d, i) => `${v[i] >= 0 ? d.high : d.low}`).join(' · ');
    $('#panel').innerHTML = `
      ${waiting.length ? `<div class="card danger"><b>In attesa di un posto (${waiting.length})</b>: ${waiting.map(g => `${esc(g.firstName)} ${esc(g.lastName)} <select data-move="${g.id}">${tableOptions(null)}</select>`).join(' · ')}</div>` : ''}
      <div class="grid">${S.tables.map(t => {
        const list = (byTable.get(t.id) || []).sort((a, b) => (b.facilitatorTableId === t.id) - (a.facilitatorTableId === t.id) || a.lastName.localeCompare(b.lastName));
        const full = list.length >= t.capacity;
        return `<div class="tcard"><h3><span>${t.id} · ${esc(t.name)}</span><span class="cap ${full ? 'full' : ''}">${list.length}/${t.capacity}</span></h3>
          ${t.seed ? `<div class="muted" style="font-size:11px;margin-bottom:4px">Profilo: ${dimLbl(t.seed)}</div>` : '<div class="muted" style="font-size:11px;margin-bottom:4px">Facilitatore non ancora giocato</div>'}
          <ul>${list.map(g => `<li class="${g.facilitatorTableId === t.id ? 'fac' : ''}" title="${esc(g.archetype || '')}"><span>${g.facilitatorTableId === t.id ? '★ ' : ''}${esc(g.firstName)} ${esc(g.lastName)}</span><span class="co">${esc(g.department || g.company)}</span></li>`).join('') || '<li class="muted">vuoto</li>'}</ul></div>`;
      }).join('')}</div>
      ${!S.tables.length ? '<p class="muted">Nessun tavolo: vai in Setup.</p>' : ''}`;
    $('#panel').querySelectorAll('select[data-move]').forEach(s => s.onchange = () => move(Number(s.dataset.move), s.value ? Number(s.value) : null));
  }

  async function move(id, tableId) {
    try { await api(`/api/admin/guests/${id}/move`, { method: 'POST', body: { tableId } }); toast('Spostato'); await refresh(); }
    catch (e) {
      if (e.data?.error === 'table_full' && confirm('Il tavolo è pieno. Forzare comunque?')) { await api(`/api/admin/guests/${id}/move`, { method: 'POST', body: { tableId, force: true } }); await refresh(); }
      else toast('Errore: ' + (e.data?.error || e.message));
    }
  }

  function renderGuests() {
    const f = filter.toLowerCase();
    const list = S.guests.filter(g => !f || `${g.firstName} ${g.lastName} ${g.company} ${g.department}`.toLowerCase().includes(f));
    $('#panel').innerHTML = `
      <div class="row"><input type="text" id="f" placeholder="Filtra…" value="${esc(filter)}">
        <input type="text" id="nf" placeholder="Nome"><input type="text" id="nl" placeholder="Cognome"><input type="text" id="nc" placeholder="Azienda"><input type="text" id="nd" placeholder="Dipartimento (Danfoss)"><button class="btn small" id="add">+ Aggiungi</button></div>
      <div class="card" style="padding:0;overflow:auto;max-height:70vh"><table class="list"><thead><tr><th>Cognome</th><th>Nome</th><th>Azienda</th><th>Dip.</th><th>Stato</th><th>Archetipo</th><th>Tavolo</th><th>Facilitatore di</th><th></th></tr></thead><tbody>
      ${list.map(g => `<tr>
        <td><b>${esc(g.lastName)}</b></td><td>${esc(g.firstName)}</td><td>${esc(g.company)}</td><td>${esc(g.department)}</td>
        <td>${g.done ? '<span class="ok">✓ quiz</span>' : g.started ? 'in corso' : g.consent ? 'entrato' : '—'}</td>
        <td style="font-size:11px">${esc(g.archetype || '')}</td>
        <td><select data-move="${g.id}">${tableOptions(g.tableId)}</select></td>
        <td><select data-fac="${g.id}">${tableOptions(g.facilitatorTableId)}</select></td>
        <td style="white-space:nowrap"><button class="btn small secondary" data-reset="${g.id}" title="Azzera quiz e tavolo">↺</button> <button class="btn small secondary" data-del="${g.id}" title="Elimina">🗑</button></td>
      </tr>`).join('')}</tbody></table></div>
      <p class="muted">${list.length} persone. ★ = facilitatore. ↺ azzera il quiz (la persona potrà rigiocare).</p>`;
    $('#f').oninput = e => { filter = e.target.value; renderGuests(); $('#f').focus(); $('#f').setSelectionRange(filter.length, filter.length); };
    $('#add').onclick = async () => {
      try { await api('/api/admin/guests', { method: 'POST', body: { firstName: $('#nf').value, lastName: $('#nl').value, company: $('#nc').value, department: $('#nd').value } }); toast('Aggiunto'); await refresh(); }
      catch (e) { toast('Errore: ' + (e.data?.error || e.message)); }
    };
    const p = $('#panel');
    p.querySelectorAll('select[data-move]').forEach(s => s.onchange = () => move(Number(s.dataset.move), s.value ? Number(s.value) : null));
    p.querySelectorAll('select[data-fac]').forEach(s => s.onchange = async () => { try { await api(`/api/admin/guests/${s.dataset.fac}/facilitator`, { method: 'POST', body: { tableId: s.value ? Number(s.value) : null } }); toast('Facilitatore aggiornato'); await refresh(); } catch (e) { toast('Errore: ' + e.message); } });
    p.querySelectorAll('button[data-reset]').forEach(b => b.onclick = async () => { if (!confirm('Azzerare quiz e tavolo di questa persona?')) return; await api(`/api/admin/guests/${b.dataset.reset}/reset`, { method: 'POST' }); toast('Azzerato'); await refresh(); });
    p.querySelectorAll('button[data-del]').forEach(b => b.onclick = async () => { if (!confirm('Eliminare questa persona?')) return; await api(`/api/admin/guests/${b.dataset.del}`, { method: 'DELETE' }); toast('Eliminato'); await refresh(); });
  }

  function renderSetup() {
    $('#panel').innerHTML = `
      <div class="card"><h2>1. Tavoli</h2>
        <div class="row">Crea <input type="number" id="genN" min="1" max="99" value="${S.tables.length || 12}" style="width:70px"> tavoli da <input type="number" id="genC" min="1" max="50" value="${S.settings.default_capacity || 10}" style="width:70px"> posti <button class="btn small" id="gen">Genera mancanti</button></div>
        <table class="list"><thead><tr><th>N.</th><th>Nome (tema del tavolo, solo backend)</th><th>Posti</th><th></th></tr></thead><tbody id="tbody">
          ${S.tables.map(t => `<tr><td>${t.id}</td><td><input type="text" data-name="${t.id}" value="${esc(t.name)}" style="width:100%"></td><td><input type="number" data-cap="${t.id}" value="${t.capacity}" min="1" max="50" style="width:70px"></td><td><button class="btn small secondary" data-rm="${t.id}">🗑</button></td></tr>`).join('')}
        </tbody></table>
        <p></p><button class="btn small" id="saveTables">Salva tavoli</button> <span class="muted">Un tavolo si elimina solo se vuoto; la capienza non può scendere sotto gli occupanti.</span></div>

      <div class="card"><h2>2. Invitati (CSV)</h2>
        <p class="muted">Colonne riconosciute (intestazione obbligatoria, separatore ; o ,): <code>nome; cognome; azienda; dipartimento; tavolo</code>. “tavolo” = numero del tavolo di cui la persona è facilitatore (vuoto per gli altri). Per Danfoss il dipartimento è usato come gruppo da distribuire.</p>
        <input type="file" id="csvFile" accept=".csv,text/csv"> <p></p>
        <textarea id="csv" rows="6" placeholder="nome;cognome;azienda;dipartimento;tavolo&#10;Mario;Rossi;Danfoss;Sales;1&#10;Anna;Bianchi;Partner Srl;;"></textarea><p></p>
        <div class="row"><button class="btn small" id="imp">Importa (aggiungi/aggiorna)</button><button class="btn small secondary" id="impR">Sostituisci tutta la lista</button></div></div>

      <div class="card"><h2>3. Regole</h2>
        <div class="row">Max persone dello stesso gruppo per tavolo prima della penalità forte: <input type="number" id="msg" min="1" max="20" value="${S.settings.max_same_group}" style="width:70px"> <button class="btn small" id="saveMsg">Salva</button></div>
        <div class="row"><button class="btn small secondary" id="rebal">Ricalcola tutte le assegnazioni</button><span class="muted">Facilitatori fissi, tutti gli altri ridistribuiti per affinità. Da usare prima della cena, non durante.</span></div></div>

      <div class="card danger"><h2>Fine evento</h2><div class="row"><button class="btn small secondary" id="wipe">Cancella tutti i dati personali</button><span class="muted">Irreversibile. Restano solo i tavoli.</span></div></div>`;
    const p = $('#panel');
    $('#gen').onclick = async () => {
      const n = Number($('#genN').value), cap = Number($('#genC').value);
      const tables = S.tables.map(t => ({ id: t.id, name: t.name, capacity: t.capacity }));
      for (let i = 1; i <= n; i++) if (!tables.find(t => t.id === i)) tables.push({ id: i, name: `Tavolo ${i}`, capacity: cap });
      await saveSettings({ default_capacity: cap });
      await saveTables(tables);
    };
    $('#saveTables').onclick = () => saveTables(S.tables.map(t => ({ id: t.id, name: p.querySelector(`[data-name="${t.id}"]`).value, capacity: Number(p.querySelector(`[data-cap="${t.id}"]`).value) })));
    p.querySelectorAll('button[data-rm]').forEach(b => b.onclick = () => { if (confirm(`Eliminare il tavolo ${b.dataset.rm}?`)) saveTables(S.tables.filter(t => t.id !== Number(b.dataset.rm)).map(t => ({ id: t.id, name: t.name, capacity: t.capacity }))); });
    $('#csvFile').onchange = e => { const f = e.target.files[0]; if (f) f.text().then(t => $('#csv').value = t); };
    const imp = async mode => {
      const csv = $('#csv').value; if (!csv.trim()) return toast('CSV vuoto');
      if (mode === 'replace' && !confirm('Sostituire TUTTA la lista invitati?')) return;
      try { const r = await api('/api/admin/guests/import', { method: 'POST', body: { csv, mode } }); toast(`Inseriti ${r.inserted}, aggiornati ${r.updated}, duplicati ${r.skipped}` + (r.unknownTables.length ? ` · tavoli inesistenti: ${r.unknownTables.join(',')}` : '')); await refresh(); }
      catch (e) { toast(e.data?.error === 'replace_blocked_quiz_done' ? 'Impossibile sostituire: ci sono già quiz completati' : 'Errore: ' + (e.data?.error || e.message)); }
    };
    $('#imp').onclick = () => imp('merge'); $('#impR').onclick = () => imp('replace');
    $('#saveMsg').onclick = () => saveSettings({ max_same_group: Number($('#msg').value) });
    $('#rebal').onclick = async () => { if (!confirm('Ricalcolare tutte le assegnazioni? Le persone vedranno il nuovo tavolo al prossimo accesso.')) return; const r = await api('/api/admin/rebalance', { method: 'POST' }); toast(`Riassegnati ${r.moved}` + (r.unseated ? `, senza posto ${r.unseated}` : '')); await refresh(); };
    $('#wipe').onclick = async () => { const c = prompt('Scrivi CANCELLA TUTTO per confermare'); if (c !== 'CANCELLA TUTTO') return; await api('/api/admin/wipe', { method: 'POST', body: { confirm: c } }); toast('Dati cancellati'); await refresh(); };
  }

  async function saveTables(tables) {
    try { await api('/api/admin/tables', { method: 'PUT', body: { tables } }); toast('Tavoli salvati'); await refresh(); }
    catch (e) { toast({ table_not_empty: `Il tavolo ${e.data?.table} non è vuoto`, capacity_below_occupancy: `Tavolo ${e.data?.table}: capienza sotto gli occupanti (${e.data?.occupancy})` }[e.data?.error] || 'Errore: ' + (e.data?.error || e.message)); }
  }

  async function renderLog() {
    const ev = await api('/api/admin/events');
    const names = new Map(S.guests.map(g => [g.id, `${g.firstName} ${g.lastName}`]));
    $('#panel').innerHTML = `<div class="card" style="padding:0;overflow:auto;max-height:75vh"><table class="list"><thead><tr><th>Quando (UTC)</th><th>Evento</th><th>Persona</th><th>Dettaglio</th></tr></thead><tbody>
      ${ev.map(e => `<tr><td>${esc(e.at)}</td><td>${esc(e.kind)}</td><td>${esc(names.get(e.guest_id) || e.guest_id || '')}</td><td style="font-size:11px">${esc(e.detail || '')}</td></tr>`).join('')}</tbody></table></div>`;
  }

  refresh().then(() => { if (S) start(); });
})();
