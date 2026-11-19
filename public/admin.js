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

  const inviteUrl = tok => `${location.origin}/?invite=${tok}`;
  const copy = async txt => { try { await navigator.clipboard.writeText(txt); toast('Link copiato'); } catch { prompt('Copia il link:', txt); } };
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
    $('#sub').innerHTML = ''; $('#sub').style.fontSize = '15px'; $('#sub').textContent = `${st.seated} seduti · ${st.done} quiz fatti · ${st.consented} accessi · ${st.guests} invitati (${st.genders.M} M, ${st.genders.F} F${st.genders.nd ? `, ${st.genders.nd} n.d.` : ''})` + (st.waiting ? ` · ⚠️ ${st.waiting} in attesa di posto` : '');
    $('#topActions').innerHTML = `
      <label class="muted" style="font-size:13px"><input type="checkbox" id="locked" ${S.settings.locked === '1' ? 'checked' : ''}> Iscrizioni chiuse</label>
      <label class="muted" style="font-size:13px"><input type="checkbox" id="reveal" ${S.settings.reveal !== '0' ? 'checked' : ''}> Mostra tavolo subito</label>
      <a class="btn small secondary" href="/board" target="_blank">Tabellone</a>
      <a class="btn small secondary" href="/qr" target="_blank">QR</a>
      <a class="btn small secondary" href="/api/admin/export.csv">Export CSV</a>
      <button class="btn small secondary" id="logout">Esci</button>`;
    $('#locked').onchange = e => saveSettings({ locked: e.target.checked });
    $('#reveal').onchange = e => saveSettings({ reveal: e.target.checked });
    $('#logout').onclick = async () => { await api('/api/admin/logout', { method: 'POST' }); S = null; renderLogin(); };
    const tabs = [['tavoli', 'Tavoli live'], ['invitati', 'Invitati'], ['setup', 'Setup'], ['regole', 'Regole'], ['log', 'Log']];
    app.innerHTML = `<div class="tabs">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-t="${k}">${l}</button>`).join('')}</div><div id="panel"></div>`;
    app.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; localStorage.setItem('adminTab', tab); render(); });
    ({ tavoli: renderTables, invitati: renderGuests, setup: renderSetup, regole: renderRules, log: renderLog })[tab]();
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
        const nF = list.filter(g => g.gender === 'F').length, nM = list.filter(g => g.gender === 'M').length;
        const nExt = list.filter(g => !g.internal).length, minExt = Number(S.settings.min_external) || 0;
        const extWarn = minExt > 0 && list.length > 0 && nExt < minExt;
        return `<div class="tcard"><h3><span>${t.id} · ${esc(t.name)}</span><span class="cap ${full ? 'full' : ''}" title="${nM} uomini, ${nF} donne, ${nExt} di aziende esterne">${list.length}/${t.capacity} <small>(${nM}M ${nF}F · <span class="${extWarn ? 'warn' : ''}">${nExt} est.</span>)</small></span></h3>
          ${t.seed ? `<div class="muted" style="font-size:11px;margin-bottom:4px">Profilo: ${dimLbl(t.seed)}</div>` : '<div class="muted" style="font-size:11px;margin-bottom:4px">Facilitatore non ancora giocato</div>'}
          <ul>${list.map(g => { const alone = !g.internal && S.settings.buddies !== '0' && list.filter(x => x.groupKey === g.groupKey).length === 1; return `<li class="${g.facilitatorTableId === t.id ? 'fac' : ''}" title="${esc(g.archetype || '')}">
              <span class="person" data-person="${g.id}">${g.facilitatorTableId === t.id ? '★ ' : ''}${esc(g.firstName)} ${esc(g.lastName)}</span>
              <span class="co ${alone ? 'warn' : ''}" title="${alone ? 'Unico della sua azienda a questo tavolo' : ''}">${esc(g.department || g.company)}${alone ? ' · solo' : ''}</span>
              <span class="actions hidden" data-actions="${g.id}">
                <select data-move="${g.id}" title="Sposta a un altro tavolo">${tableOptions(g.tableId)}</select>
                <button class="btn small secondary" data-reset="${g.id}" title="Azzera quiz e tavolo: potrà rifare il test">↺</button>
              </span></li>`; }).join('') || '<li class="muted">vuoto</li>'}</ul></div>`;
      }).join('')}</div>
      ${!S.tables.length ? '<p class="muted">Nessun tavolo: vai in Setup.</p>' : '<p class="muted">Tocca un nome per spostarlo a un altro tavolo o azzerarne il quiz (↺): la persona potrà rifare il test.</p>'}`;
    const p = $('#panel');
    p.querySelectorAll('select[data-move]').forEach(s => s.onchange = () => move(Number(s.dataset.move), s.value ? Number(s.value) : null));
    p.querySelectorAll('.person').forEach(el => el.onclick = () => { const a = p.querySelector(`[data-actions="${el.dataset.person}"]`); const open = !a.classList.contains('hidden'); p.querySelectorAll('.actions').forEach(x => x.classList.add('hidden')); if (!open) a.classList.remove('hidden'); });
    p.querySelectorAll('button[data-reset]').forEach(b => b.onclick = async () => {
      const g = S.guests.find(x => x.id === Number(b.dataset.reset));
      if (!confirm(`Azzerare quiz e tavolo di ${g.firstName} ${g.lastName}? Potrà rifare il test.`)) return;
      await api(`/api/admin/guests/${g.id}/reset`, { method: 'POST' }); toast('Azzerato: può rifare il test'); await refresh();
    });
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
        <input type="text" id="nf" placeholder="Nome"><input type="text" id="nl" placeholder="Cognome"><input type="text" id="nc" placeholder="Azienda"><input type="text" id="nd" placeholder="Dipartimento (Danfoss)"><select id="ng"><option value="">Genere</option><option value="M">M</option><option value="F">F</option></select><button class="btn small" id="add">+ Aggiungi</button></div>
      <div class="card" style="padding:0;overflow:auto;max-height:70vh"><table class="list"><thead><tr><th>Cognome</th><th>Nome</th><th>Azienda</th><th>Dip.</th><th>Genere</th><th>Stato</th><th>Archetipo</th><th>Tavolo</th><th>Facilitatore di</th><th></th></tr></thead><tbody>
      ${list.map(g => `<tr>
        <td><b>${esc(g.lastName)}</b></td><td>${esc(g.firstName)}</td><td>${esc(g.company)}</td><td><input type="text" data-dept="${g.id}" value="${esc(g.department)}" style="width:110px;font-size:12px;padding:4px 6px;border-radius:8px"></td>
        <td><select data-gender="${g.id}"><option value="" ${!g.gender ? 'selected' : ''}>—</option><option value="M" ${g.gender === 'M' ? 'selected' : ''}>M</option><option value="F" ${g.gender === 'F' ? 'selected' : ''}>F</option></select></td>
        <td>${g.done ? '<span class="ok">✓ quiz</span>' : g.started ? 'in corso' : g.consent ? 'entrato' : '—'}</td>
        <td style="font-size:11px">${esc(g.archetype || '')}</td>
        <td><select data-move="${g.id}">${tableOptions(g.tableId)}</select></td>
        <td><select data-fac="${g.id}">${tableOptions(g.facilitatorTableId)}</select></td>
        <td style="white-space:nowrap"><button class="btn small secondary" data-link="${g.id}" data-tok="${g.inviteToken || ''}" title="Copia link personale">🔗</button> <button class="btn small secondary" data-reset="${g.id}" title="Azzera quiz e tavolo">↺</button> <button class="btn small secondary" data-del="${g.id}" title="Elimina">🗑</button></td>
      </tr>`).join('')}</tbody></table></div>
      <p class="muted">${list.length} persone. 🔗 copia il link personale (salta la ricerca del nome), ↺ azzera il quiz (la persona potrà rigiocare).</p>`;
    $('#f').oninput = e => { filter = e.target.value; renderGuests(); $('#f').focus(); $('#f').setSelectionRange(filter.length, filter.length); };
    $('#add').onclick = async () => {
      try { await api('/api/admin/guests', { method: 'POST', body: { firstName: $('#nf').value, lastName: $('#nl').value, company: $('#nc').value, department: $('#nd').value, gender: $('#ng').value } }); toast('Aggiunto'); await refresh(); }
      catch (e) { toast('Errore: ' + (e.data?.error || e.message)); }
    };
    const p = $('#panel');
    p.querySelectorAll('select[data-move]').forEach(s => s.onchange = () => move(Number(s.dataset.move), s.value ? Number(s.value) : null));
    p.querySelectorAll('select[data-gender]').forEach(s => s.onchange = async () => { await api(`/api/admin/guests/${s.dataset.gender}`, { method: 'PATCH', body: { gender: s.value } }); toast('Genere aggiornato'); await refresh(true); });
    p.querySelectorAll('input[data-dept]').forEach(i => i.onchange = async () => { await api(`/api/admin/guests/${i.dataset.dept}`, { method: 'PATCH', body: { department: i.value } }); toast('Dipartimento aggiornato'); await refresh(true); });
    p.querySelectorAll('select[data-fac]').forEach(s => s.onchange = async () => { try { await api(`/api/admin/guests/${s.dataset.fac}/facilitator`, { method: 'POST', body: { tableId: s.value ? Number(s.value) : null } }); toast('Facilitatore aggiornato'); await refresh(); } catch (e) { toast('Errore: ' + e.message); } });
    p.querySelectorAll('button[data-link]').forEach(b => b.onclick = async () => {
      let tok = b.dataset.tok;
      if (!tok) { tok = (await api(`/api/admin/guests/${b.dataset.link}/invite`, { method: 'POST', body: {} })).inviteToken; await refresh(true); }
      copy(inviteUrl(tok));
    });
    p.querySelectorAll('button[data-reset]').forEach(b => b.onclick = async () => { if (!confirm('Azzerare quiz e tavolo di questa persona?')) return; await api(`/api/admin/guests/${b.dataset.reset}/reset`, { method: 'POST' }); toast('Azzerato'); await refresh(); });
    p.querySelectorAll('button[data-del]').forEach(b => b.onclick = async () => { if (!confirm('Eliminare questa persona?')) return; await api(`/api/admin/guests/${b.dataset.del}`, { method: 'DELETE' }); toast('Eliminato'); await refresh(); });
  }

  function renderSetup() {
    $('#panel').innerHTML = `
      <div class="card"><h2>1. Tavoli</h2>
        <div class="row">Crea <input type="number" id="genN" min="1" max="99" value="${S.tables.length || 12}" style="width:70px"> tavoli da <input type="number" id="genC" min="1" max="50" value="${S.settings.default_capacity || 10}" style="width:70px"> posti <button class="btn small" id="gen">Genera mancanti</button></div>
        <table class="list"><thead><tr><th>N.</th><th>Nome (tema del tavolo)</th><th>Posti</th><th>Facilitatore</th><th>Link personale per il test</th><th></th></tr></thead><tbody id="tbody">
          ${S.tables.map(t => { const fac = S.guests.find(g => g.facilitatorTableId === t.id); return `<tr><td>${t.id}</td><td><input type="text" data-name="${t.id}" value="${esc(t.name)}" style="width:100%"></td><td><input type="number" data-cap="${t.id}" value="${t.capacity}" min="1" max="50" style="width:70px"></td>
            <td class="facell">${fac
              ? `<span class="facname">★ ${esc(fac.firstName)} ${esc(fac.lastName)} <small class="muted">${esc(fac.company)}</small></span> <button class="btn small secondary" data-facclear="${t.id}" title="Rimuovi facilitatore">✕</button>`
              : `<span class="facsearch"><input type="text" data-facq="${t.id}" placeholder="Cerca nome…" autocomplete="off"><div class="sugg hidden" data-facsugg="${t.id}"></div></span>`}</td>
            <td>${fac && fac.inviteToken ? `<button class="btn small secondary" data-copy="${fac.inviteToken}">📋 Copia link</button> <span class="muted">${fac.done ? '✓ test fatto' : 'test non ancora fatto'}</span>` : '<span class="muted">—</span>'}</td>
            <td><button class="btn small secondary" data-rm="${t.id}">🗑</button></td></tr>`; }).join('')}
        </tbody></table>
        <p></p><button class="btn small" id="saveTables">Salva nomi e posti</button> <button class="btn small secondary" id="copyAll">📋 Copia tutti i link</button> <span class="muted">Un tavolo si elimina solo se vuoto; la capienza non può scendere sotto gli occupanti. Il facilitatore si salva subito alla selezione.</span>
        <p class="muted">Invia a ogni facilitatore il suo link personale via email: aprendolo salta la ricerca del nome e fa subito il test. Il suo profilo diventa il "seme" del tavolo, quindi è bene che lo faccia prima degli ospiti.</p></div>

      <div class="card"><h2>2. Invitati (CSV)</h2>
        <p class="muted">Colonne riconosciute (intestazione obbligatoria, separatore ; o ,): <code>nome; cognome; azienda; dipartimento; genere; tavolo</code>. “genere” = M o F (serve per il bilanciamento), “tavolo” = numero del tavolo di cui la persona è facilitatore (vuoto per gli altri). Per Danfoss il dipartimento è usato come gruppo da distribuire. Reimportando lo stesso file le persone già presenti vengono aggiornate, non duplicate.</p>
        <input type="file" id="csvFile" accept=".csv,text/csv"> <p></p>
        <textarea id="csv" rows="6" placeholder="nome;cognome;azienda;dipartimento;genere;tavolo&#10;Mario;Rossi;Danfoss;Sales;M;1&#10;Anna;Bianchi;Partner Srl;;F;"></textarea><p></p>
        <div class="row"><button class="btn small" id="imp">Importa (aggiungi/aggiorna)</button><button class="btn small secondary" id="impR">Sostituisci tutta la lista</button></div></div>

      <div class="card"><h2>3. Riazzera assegnazioni</h2>
        <div class="row"><button class="btn small secondary" id="resetAll">Riazzera assegnazioni di tutti</button><span class="muted">Cancella quiz, archetipo e tavolo di tutti gli invitati: tutti potranno rifare il test. Lista invitati, facilitatori, link personali e tavoli restano. Utile dopo le prove, prima dell'evento.</span></div></div>

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
    const setFac = async (guestId, tid) => { try { await api(`/api/admin/guests/${guestId}/facilitator`, { method: 'POST', body: { tableId: tid } }); toast('Facilitatore aggiornato'); await refresh(); } catch (e) { toast('Errore: ' + (e.data?.error || e.message)); } };
    p.querySelectorAll('button[data-facclear]').forEach(b => b.onclick = () => { const tid = Number(b.dataset.facclear); const prev = S.guests.find(g => g.facilitatorTableId === tid); if (prev && confirm(`Rimuovere ${prev.firstName} ${prev.lastName} come facilitatore del tavolo ${tid}?`)) setFac(prev.id, null); });
    p.querySelectorAll('input[data-facq]').forEach(inp => {
      const tid = Number(inp.dataset.facq); const box = p.querySelector(`[data-facsugg="${tid}"]`);
      const show = () => {
        const q = inp.value.trim().toLowerCase();
        if (q.length < 2) { box.classList.add('hidden'); box.innerHTML = ''; return; }
        const hits = S.guests.filter(g => `${g.firstName} ${g.lastName} ${g.lastName} ${g.firstName} ${g.company}`.toLowerCase().includes(q)).slice(0, 8);
        box.innerHTML = hits.length ? hits.map(g => `<div class="sugg-item" data-g="${g.id}"><b>${esc(g.lastName)}</b> ${esc(g.firstName)} <small class="muted">${esc(g.company)}${g.facilitatorTableId != null ? ` · già facilitatore tavolo ${g.facilitatorTableId}` : ''}</small></div>`).join('') : '<div class="sugg-item muted">Nessun risultato</div>';
        box.classList.remove('hidden');
        box.querySelectorAll('.sugg-item[data-g]').forEach(it => it.onmousedown = e => { e.preventDefault(); setFac(Number(it.dataset.g), tid); });
      };
      inp.oninput = show; inp.onfocus = show; inp.onblur = () => setTimeout(() => box.classList.add('hidden'), 150);
      inp.onkeydown = e => { if (e.key === 'Enter') { const first = box.querySelector('.sugg-item[data-g]'); if (first) setFac(Number(first.dataset.g), tid); } if (e.key === 'Escape') box.classList.add('hidden'); };
    });
    p.querySelectorAll('button[data-copy]').forEach(b => b.onclick = () => copy(inviteUrl(b.dataset.copy)));
    $('#copyAll').onclick = () => {
      const lines = S.tables.map(t => { const f = S.guests.find(g => g.facilitatorTableId === t.id); return f && f.inviteToken ? `Tavolo ${t.id} ${t.name} - ${f.firstName} ${f.lastName} - ${inviteUrl(f.inviteToken)}` : `Tavolo ${t.id} ${t.name} - (nessun facilitatore)`; });
      copy(lines.join('\n'));
    };
    p.querySelectorAll('button[data-rm]').forEach(b => b.onclick = () => { if (confirm(`Eliminare il tavolo ${b.dataset.rm}?`)) saveTables(S.tables.filter(t => t.id !== Number(b.dataset.rm)).map(t => ({ id: t.id, name: t.name, capacity: t.capacity }))); });
    $('#csvFile').onchange = e => { const f = e.target.files[0]; if (f) f.text().then(t => $('#csv').value = t); };
    const imp = async mode => {
      const csv = $('#csv').value; if (!csv.trim()) return toast('CSV vuoto');
      if (mode === 'replace' && !confirm('Sostituire TUTTA la lista invitati?')) return;
      try { const r = await api('/api/admin/guests/import', { method: 'POST', body: { csv, mode } }); toast(`Inseriti ${r.inserted}, aggiornati ${r.updated}, duplicati ${r.skipped}` + (r.unknownTables.length ? ` · tavoli inesistenti: ${r.unknownTables.join(',')}` : '')); await refresh(); }
      catch (e) { toast(e.data?.error === 'replace_blocked_quiz_done' ? 'Impossibile sostituire: ci sono già quiz completati' : 'Errore: ' + (e.data?.error || e.message)); }
    };
    $('#imp').onclick = () => imp('merge'); $('#impR').onclick = () => imp('replace');
    $('#resetAll').onclick = async () => { const c = prompt(`Riazzerare quiz e tavolo di tutti i ${S.stats.guests} invitati? Scrivi AZZERA per confermare`); if (c !== 'AZZERA') return; await api('/api/admin/reset-all', { method: 'POST', body: { confirm: c } }); toast('Assegnazioni azzerate: tutti possono rigiocare'); await refresh(); };
    $('#wipe').onclick = async () => { const c = prompt('Scrivi CANCELLA TUTTO per confermare'); if (c !== 'CANCELLA TUTTO') return; await api('/api/admin/wipe', { method: 'POST', body: { confirm: c } }); toast('Dati cancellati'); await refresh(); };
  }

  function renderRules() {
    const ext = S.guests.filter(g => !g.internal).length, intl = S.guests.length - ext;
    $('#panel').innerHTML = `
      <div class="card"><h2>Regole di assegnazione</h2>
        <p class="muted">L'affinità del quiz decide il tavolo; queste regole correggono la scelta. Si applicano a ogni nuova assegnazione e al ricalcolo globale. Invitati: ${intl} Danfoss, ${ext} di aziende esterne.</p>
        <div class="row"><b>1.</b> Max persone dello stesso gruppo per tavolo: <input type="number" id="msg" min="1" max="20" value="${S.settings.max_same_group}" style="width:70px"> <button class="btn small" id="saveMsg">Salva</button></div>
        <p class="muted">Vale per i dipartimenti Danfoss: oltre la soglia la penalità diventa molto forte. Per le aziende esterne vale invece la regola 3.</p>
        <div class="row"><b>2.</b> Almeno <input type="number" id="minext" min="0" max="10" value="${S.settings.min_external ?? 2}" style="width:70px"> persone di aziende esterne per tavolo <button class="btn small" id="saveMinExt">Salva</button></div>
        <p class="muted">I posti necessari a raggiungere il minimo restano riservati agli esterni: un Danfoss non può occuparli. Gli esterni vengono attratti dai tavoli ancora sotto il minimo. Con 0 la regola è spenta. Nei Tavoli live il conteggio "est." diventa rosso se un tavolo è sotto il minimo.</p>
        <div class="row"><b>3.</b> <label><input type="checkbox" id="bud" ${S.settings.buddies !== '0' ? 'checked' : ''}> Nessun esterno da solo</label></div>
        <p class="muted">I colleghi della stessa azienda esterna si siedono a coppie; chi resterebbe spaiato si unisce a una coppia e forma un trio (azienda di 3 = trio, di 5 = coppia + trio, di 7 = due coppie + trio). Il posto accanto a un esterno ancora solo resta riservato al collega. Nei Tavoli live un esterno senza colleghi al tavolo è evidenziato in rosso: se un collega non si presenta, usa il ricalcolo o spostalo a mano.</p>
        <div class="row"><b>4.</b> <label><input type="checkbox" id="gb" ${S.settings.gender_balance !== '0' ? 'checked' : ''}> Bilanciamento di genere</label></div>
        <p class="muted">Distribuisce uomini e donne su ogni tavolo in proporzione alla lista invitati, così la minoranza non si concentra.</p>
      </div>
      <div class="card"><h2>Ricalcolo</h2>
        <div class="row"><button class="btn small secondary" id="rebal">Ricalcola tutte le assegnazioni</button><span class="muted">Facilitatori fissi, tutti gli altri ridistribuiti applicando affinità e regole. Da usare prima della cena, non durante.</span></div>
      </div>`;
    $('#saveMsg').onclick = () => saveSettings({ max_same_group: Number($('#msg').value) });
    $('#saveMinExt').onclick = () => saveSettings({ min_external: Number($('#minext').value) });
    $('#gb').onchange = e => saveSettings({ gender_balance: e.target.checked });
    $('#bud').onchange = e => saveSettings({ buddies: e.target.checked });
    $('#rebal').onclick = async () => { if (!confirm('Ricalcolare tutte le assegnazioni? Le persone vedranno il nuovo tavolo al prossimo accesso.')) return; const r = await api('/api/admin/rebalance', { method: 'POST' }); toast(`Riassegnati ${r.moved}` + (r.unseated ? `, senza posto ${r.unseated}` : '')); await refresh(); };
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
