/* App ospite: scelta nome → consenso → quiz 4 clic → slot machine → tavolo + archetipo */
(() => {
  const I18N = {
    it: {
      title: 'Trova il tuo tavolo', intro: 'Quattro domande, zero pensieri. Ti diciamo chi sei (più o meno) e dove ti siedi stasera.',
      search: 'Cerca il tuo nome…', noResults: 'Nessun nome trovato. Chiedi allo staff.', typeMore: 'Scrivi almeno due lettere',
      consentLabel: 'Ho letto l’informativa e acconsento al trattamento dei miei dati per l’assegnazione del tavolo.',
      termsTitle: 'Informativa privacy',
      terms: 'Titolare del trattamento: Danfoss. Finalità: assegnazione dei posti a tavola durante la cena del Partner Meeting e gestione dell’evento. Dati trattati: nome, cognome, azienda, le risposte al gioco e il tavolo assegnato. Base giuridica: consenso. I dati sono visibili solo agli organizzatori e vengono cancellati entro 30 giorni dall’evento. Puoi chiedere accesso, rettifica o cancellazione rivolgendoti allo staff presente in sala.',
      start: 'Inizia il gioco', back: '← Cambia nome', loading: 'Un attimo…',
      alreadyDone: 'Bentornato! Il tuo tavolo è già deciso.', hi: 'Ciao',
      qOf: (i, n) => `Domanda ${i} di ${n}`, next: 'Avanti', finish: 'Scopri il tavolo',
      spinning: 'La slot machine sta decidendo…', yourTable: 'Il tuo tavolo', youAre: 'Sei',
      revealLater: 'Il tavolo verrà svelato poco prima della cena. Torna su questa pagina più tardi!',
      waiting: 'I tavoli sono tutti pieni: rivolgiti allo staff, ti troviamo noi un posto.',
      locked: 'Le iscrizioni sono chiuse. Rivolgiti allo staff per il tuo tavolo.',
      keep: 'Fai uno screenshot: ti servirà a cena 📸', again: 'Torna indietro', error: 'Qualcosa è andato storto, riprova.',
      lockedShort: 'Iscrizioni chiuse', rules: 'Una sola giocata a persona: niente ripensamenti!',
      inviteHi: n => `Ciao ${n}, questo è il tuo link personale.`,
      facilitatorIntro: t => `Sei il padrone di casa del tavolo ${t}: il tuo profilo darà il tono al tavolo e attirerà gli ospiti più affini.`,
      facilitatorBadge: t => `Padrone di casa del tavolo ${t}`,
      inviteInvalid: 'Questo link non è valido o è scaduto. Cerca il tuo nome qui sotto.',
      deviceUsed: n => `Da questo telefono ha già giocato ${n}. Vale una giocata per telefono: se sei tu, cerca il tuo nome per rivedere il tavolo.`,
      regret: mmss => `Hai cambiato idea? Entro ${mmss} puoi chiedere allo staff di farti rifare il test.`,
    },
    fr: {
      title: 'Trouve ta table', intro: 'Quatre questions, zéro prise de tête. On te dit qui tu es (à peu près) et où tu t’assois ce soir.',
      search: 'Cherche ton nom…', noResults: 'Aucun nom trouvé. Demande au staff.', typeMore: 'Tape au moins deux lettres',
      consentLabel: 'J’ai lu la notice et j’accepte le traitement de mes données pour l’attribution de la table.',
      termsTitle: 'Notice de confidentialité',
      terms: 'Responsable du traitement : Danfoss. Finalité : attribution des places à table lors du dîner du Partner Meeting et gestion de l’événement. Données traitées : nom, prénom, société, réponses au jeu et table attribuée. Base juridique : consentement. Les données sont visibles uniquement par les organisateurs et supprimées dans les 30 jours suivant l’événement. Tu peux demander l’accès, la rectification ou la suppression auprès du staff présent sur place.',
      start: 'Commencer le jeu', back: '← Changer de nom', loading: 'Un instant…',
      alreadyDone: 'Re-bonjour ! Ta table est déjà décidée.', hi: 'Salut',
      qOf: (i, n) => `Question ${i} sur ${n}`, next: 'Suivant', finish: 'Découvrir la table',
      spinning: 'La machine à sous décide…', yourTable: 'Ta table', youAre: 'Tu es',
      revealLater: 'La table sera révélée juste avant le dîner. Reviens sur cette page plus tard !',
      waiting: 'Les tables sont toutes pleines : adresse-toi au staff, on te trouve une place.',
      locked: 'Les inscriptions sont closes. Adresse-toi au staff pour ta table.',
      keep: 'Fais une capture d’écran : elle te servira au dîner 📸', again: 'Retour', error: 'Quelque chose a cloché, réessaie.',
      lockedShort: 'Inscriptions closes', rules: 'Une seule partie par personne : pas de regrets !',
      inviteHi: n => `Salut ${n}, voici ton lien personnel.`,
      facilitatorIntro: t => `Tu es l’hôte de la table ${t} : ton profil donnera le ton de la table et attirera les invités les plus proches de toi.`,
      facilitatorBadge: t => `Hôte de la table ${t}`,
      inviteInvalid: 'Ce lien n’est pas valide ou a expiré. Cherche ton nom ci-dessous.',
      deviceUsed: n => `${n} a déjà joué depuis ce téléphone. Une seule partie par téléphone : si c’est toi, cherche ton nom pour revoir ta table.`,
      regret: mmss => `Tu as changé d’avis ? Pendant ${mmss} tu peux demander au staff de te faire refaire le test.`,
    },
  };

  let lang = localStorage.getItem('lang') || ((navigator.language || 'it').toLowerCase().startsWith('fr') ? 'fr' : 'it');
  const t = k => I18N[lang][k];
  const $ = s => document.querySelector(s);
  const app = $('#app');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const api = async (path, opts = {}) => {
    const r = await fetch(path, { headers: { 'content-type': 'application/json' }, credentials: 'same-origin', ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.error || 'error'), { status: r.status, data });
    return data;
  };

  let config = { eventName: '', locked: false };
  let state = { guest: null, selected: null, questions: null, answers: {}, qi: 0, invite: null, inviteError: false };

  function setLang(l) {
    lang = l; localStorage.setItem('lang', l); document.documentElement.lang = l;
    document.querySelectorAll('.lang button').forEach(b => b.classList.toggle('on', b.dataset.lang === l));
    document.title = t('title');
    render();
  }
  document.querySelectorAll('.lang button').forEach(b => b.onclick = () => setLang(b.dataset.lang));

  // ------------------------------------------------------------ schermate
  function render() {
    const g = state.guest;
    if (!g) return renderSearch();
    if (g.done) return renderResult(g, false);
    if (!state.questions) { startQuiz(); return renderLoading(); }
    renderQuestion();
  }

  function renderLoading() { app.innerHTML = `<div class="card center"><div class="spinner"></div><p class="muted">${t('loading')}</p></div>`; }

  function renderSearch() {
    const inv = state.invite;
    app.innerHTML = `
      <div class="card">
        <h1>${t('title')}</h1>
        <p class="muted">${t('intro')}</p>
        ${config.locked && !inv ? `<p class="err">${t('locked')}</p>` : ''}
        ${state.inviteError ? `<p class="err">${t('inviteInvalid')}</p>` : ''}
        ${inv ? `<p><b>${t('inviteHi')(esc(inv.firstName))}</b></p>${inv.facilitatorTable ? `<p class="muted">${t('facilitatorIntro')(inv.facilitatorTable.id)}</p>` : ''}
                 <input type="text" value="${esc(inv.firstName + ' ' + inv.lastName)}" disabled>`
              : `<input type="search" id="q" placeholder="${t('search')}" autocomplete="off" autocapitalize="words" ${state.selected ? `value="${esc(state.selected.firstName + ' ' + state.selected.lastName)}"` : ''}>`}
        <div class="results" id="res"></div>
        <div id="consentBox" class="${state.selected || inv ? '' : 'hidden'}">
          <details class="terms"><summary>${t('termsTitle')}</summary><p>${t('terms')}</p></details>
          <label class="consent"><input type="checkbox" id="consent"><span>${t('consentLabel')}</span></label>
          <p class="muted">${t('rules')}</p>
          <button class="btn" id="go" disabled>${t('start')}</button>
          <p class="err" id="err"></p>
        </div>
      </div>`;
    const q = $('#q'), res = $('#res'), go = $('#go'), consent = $('#consent');
    let timer;
    if (q) q.oninput = () => {
      state.selected = null; $('#consentBox').classList.add('hidden');
      clearTimeout(timer);
      const v = q.value.trim();
      if (v.length < 2) { res.innerHTML = v ? `<p class="muted">${t('typeMore')}</p>` : ''; return; }
      timer = setTimeout(async () => {
        const list = await api('/api/guests/search?q=' + encodeURIComponent(v)).catch(() => []);
        res.innerHTML = list.length ? list.map(x => `
          <div class="result" data-id="${x.id}"><div><div>${esc(x.firstName)} <b>${esc(x.lastName)}</b></div><div class="co">${esc(x.company)}</div></div>${x.done ? '<span class="tag">✓</span>' : ''}</div>`).join('')
          : `<p class="muted">${t('noResults')}</p>`;
        res.querySelectorAll('.result').forEach(el => el.onclick = () => {
          state.selected = list.find(x => String(x.id) === el.dataset.id);
          q.value = state.selected.firstName + ' ' + state.selected.lastName; res.innerHTML = '';
          $('#consentBox').classList.remove('hidden'); consent.focus();
        });
      }, 180);
    };
    consent.onchange = () => go.disabled = !consent.checked;
    go.onclick = async () => {
      go.disabled = true; $('#err').textContent = '';
      try {
        const r = await api('/api/claim', { method: 'POST', body: inv ? { inviteToken: inv.token, consent: true, locale: lang } : { guestId: state.selected.id, consent: true, locale: lang } });
        state.guest = r.guest; state.questions = null; state.answers = {}; state.qi = 0;
        render();
      } catch (e) {
        $('#err').textContent = e.status === 409 && e.data?.error === 'device_used' ? t('deviceUsed')(`${e.data.by.firstName} ${e.data.by.lastName}`) : t('error');
        go.disabled = false;
      }
    };
    if (!state.selected && q) setTimeout(() => q.focus(), 50);
  }

  async function startQuiz() {
    try {
      const r = await api('/api/quiz/start', { method: 'POST', body: { locale: lang } });
      state.questions = r.questions; state.qi = 0; state.answers = {};
      render();
    } catch (e) {
      if (e.status === 409) { const me = await api('/api/me?locale=' + lang); state.guest = me.guest; return render(); }
      app.innerHTML = `<div class="card"><p class="err">${t('error')}</p><button class="btn secondary" onclick="location.reload()">↻</button></div>`;
    }
  }

  function renderQuestion() {
    const qs = state.questions, i = state.qi, q = qs[i];
    const g = state.guest;
    app.innerHTML = `
      <div class="card">
        <p class="muted">${t('hi')} ${esc(g.firstName)} · ${t('qOf')(i + 1, qs.length)}</p>
        <div class="progress">${qs.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>
        <div class="q">${esc(q.text)}</div>
        <div class="opts">${q.options.map((o, k) => `<button class="opt" data-k="${k}"><span class="em">${o.emoji}</span><span>${esc(o.text)}</span></button>`).join('')}</div>
        <p class="err" id="err"></p>
      </div>`;
    app.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      app.querySelectorAll('.opt').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
      state.answers[q.id] = Number(b.dataset.k);
      setTimeout(() => { if (i + 1 < qs.length) { state.qi++; renderQuestion(); } else submit(); }, 260);
    });
  }

  async function submit() {
    renderSpinning();
    const started = Date.now();
    let result;
    try {
      result = await api('/api/quiz/submit', { method: 'POST', body: { answers: state.answers, locale: lang } });
    } catch (e) {
      if (e.status === 423) { app.innerHTML = `<div class="card"><p class="err">${t('locked')}</p></div>`; return; }
      if (e.status === 400 && e.data?.error === 'quiz_not_started') { state.questions = null; return render(); }
      app.innerHTML = `<div class="card"><p class="err">${t('error')}</p><button class="btn" id="retry">↻</button></div>`;
      $('#retry').onclick = submit; return;
    }
    state.guest = result.guest;
    const wait = Math.max(0, 2600 - (Date.now() - started));
    const tableNo = result.guest.table ? result.guest.table.id : null;
    await spinTo(tableNo, wait + 600);
    renderResult(result.guest, true);
  }

  // ------------------------------------------------------------ slot machine
  function renderSpinning() {
    app.innerHTML = `<div class="card center"><h2>${t('spinning')}</h2><div class="slot" id="slot">${reelHtml()}${reelHtml()}</div><p class="muted">🎰</p></div>`;
    document.querySelectorAll('.reel .strip').forEach(s => s.style.animation = `scroll ${0.5 + Math.random() * .3}s linear infinite`);
    injectKeyframes();
  }
  function reelHtml() { return `<div class="reel"><div class="strip">${Array.from({ length: 20 }, (_, i) => `<span>${i % 10}</span>`).join('')}</div></div>`; }
  function injectKeyframes() {
    if (document.getElementById('kf')) return;
    const st = document.createElement('style'); st.id = 'kf';
    st.textContent = '@keyframes scroll { from { transform: translateY(0) } to { transform: translateY(-960px) } }';
    document.head.appendChild(st);
  }
  function spinTo(n, total) {
    return new Promise(resolve => {
      const reels = [...document.querySelectorAll('.reel')];
      if (n == null) { setTimeout(resolve, Math.min(total, 1200)); return; }
      const digits = String(n).padStart(2, '0').split('').map(Number);
      if (digits.length > reels.length) { const slot = $('#slot'); while (reels.length < digits.length) { slot.insertAdjacentHTML('afterbegin', reelHtml()); reels.unshift(slot.firstElementChild); } }
      reels.forEach((r, idx) => setTimeout(() => {
        const strip = r.querySelector('.strip');
        strip.style.animation = 'none';
        strip.style.transition = 'transform .9s cubic-bezier(.17,.84,.44,1)';
        strip.style.transform = 'translateY(0)';
        requestAnimationFrame(() => { strip.style.transform = `translateY(-${(10 + digits[idx]) * 96}px)`; });
        setTimeout(() => { r.classList.add('done'); if (navigator.vibrate) navigator.vibrate(30); }, 900);
      }, total - 1500 + idx * 450));
      setTimeout(resolve, total + 300);
    });
  }

  // ------------------------------------------------------------ risultato
  function renderResult(g, fresh) {
    const a = g.archetype;
    const dims = (g.dimensions || []).map((d, i) => {
      const v = g.vector ? g.vector[i] : 0; const pct = ((v + 2) / 4) * 100;
      return `<div class="dim"><div class="lbl"><span>${esc(d.low)}</span><span>${esc(d.high)}</span></div><div class="bar"><b style="left:${pct}%"></b></div></div>`;
    }).join('');
    const tableBlock = g.table
      ? `<div class="big-table"><div class="muted">${t('yourTable')}</div><div class="n">${g.table.id}</div>${g.table.name ? `<div class="name">${esc(g.table.name)}</div>` : ''}${g.facilitatorTable ? `<p class="muted" style="margin-top:8px">★ ${t('facilitatorBadge')(g.facilitatorTable.id)}</p>` : ''}</div>`
      : g.revealLater ? `<p class="center">${t('revealLater')}</p>`
      : g.waitingTable ? `<p class="err center">${t('waiting')}</p>` : '';
    app.innerHTML = `
      ${!fresh ? `<div class="card center"><p class="muted">${t('alreadyDone')}</p><b>${esc(g.firstName)} ${esc(g.lastName)}</b></div>` : ''}
      <div class="card">${tableBlock}</div>
      ${a ? `<div class="card"><div class="arch"><div class="em">${a.emoji}</div><div class="muted">${t('youAre')}</div><div class="nm">${esc(a.name)}</div><p class="muted">${esc(a.blurb)}</p></div><div class="dims">${dims}</div></div>` : ''}
      <p class="center muted">${t('keep')}</p>
      <p class="center regret" id="regret"></p>
      <button class="btn secondary" id="back">${t('again')}</button>`;
    startRegretCountdown(g);
    $('#back').onclick = async () => { await api('/api/logout', { method: 'POST' }); state = { guest: null, selected: null, questions: null, answers: {}, qi: 0, invite: null, inviteError: false }; render(); };
  }

  // Finestra di ripensamento: 5 minuti dall'assegnazione, scritta piccola con conto alla rovescia.
  let regretTimer;
  function startRegretCountdown(g) {
    clearInterval(regretTimer);
    const el = document.getElementById('regret');
    if (!el || !g.assignedAt || !g.table) return;
    const skew = Date.now() - new Date(g.now).getTime();          // allinea l'orologio del telefono al server
    const end = new Date(g.assignedAt).getTime() + 5 * 60 * 1000 + skew;
    const tick = () => {
      const left = end - Date.now();
      if (left <= 0) { el.textContent = ''; clearInterval(regretTimer); return; }
      const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
      el.textContent = t('regret')(`${m}:${String(s).padStart(2, '0')}`);
    };
    tick(); regretTimer = setInterval(tick, 1000);
  }

  // ------------------------------------------------------------ avvio
  (async () => {
    try {
      const [cfg, me] = await Promise.all([api('/api/config'), api('/api/me?locale=' + lang)]);
      config = cfg; if (!localStorage.getItem('lang') && cfg.locale) lang = cfg.locale;
      state.guest = me.guest;
      const token = new URLSearchParams(location.search).get('invite');
      if (token) {
        try {
          const inv = await api('/api/invite/' + encodeURIComponent(token));
          // Se sul telefono c'è già un'altra identità, il link personale ha la precedenza.
          if (state.guest && state.guest.id !== inv.guest.id) { await api('/api/logout', { method: 'POST' }); state.guest = null; }
          if (!state.guest) state.invite = { ...inv.guest, token };
        } catch (e) { state.inviteError = true; }
        history.replaceState(null, '', location.pathname);
      }
    } catch (e) { /* offline: mostriamo comunque la ricerca */ }
    setLang(lang);
  })();
})();
