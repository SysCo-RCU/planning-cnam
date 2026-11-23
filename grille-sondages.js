/* Vue « Grille » de la semaine (emploi du temps heure par heure, sur ordinateur et tablette)
   et onglet « Sondages » de la classe.
   Sondages : les questions sont dans data/sondages.json ; les votes sont comptés par le même
   service gratuit que le compteur de vues (CountAPI). Anonymes, un vote par téléphone. */
(() => {
  const html = document.documentElement;
  const tx = (fr, en) => (html.lang === 'en' ? en : fr);
  const mem = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* stockage indisponible */ } },
  };
  const ecranLarge = window.matchMedia('(min-width: 761px)');

  /* ============================================================ vue grille */
  const PX = 56;   // hauteur d'une heure, en pixels
  let mode = mem.get('planning-cnam:vueSemaine') === 'grille' ? 'grille' : 'cartes';
  const ICONES = {
    cartes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="4" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    grille: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>',
  };

  // interrupteur « Cartes | Grille » au début de la navigation de semaine
  const nav = document.getElementById('weeknav');
  const bascule = document.createElement('div');
  bascule.className = 'vbasc';
  bascule.dataset.notr = '';
  bascule.setAttribute('role', 'radiogroup');
  nav.insertBefore(bascule, nav.firstChild);
  function majBascule() {
    bascule.hidden = !(S.tab === 'week' && !S.q);
    bascule.setAttribute('aria-label', tx('Affichage de la semaine', 'Week layout'));
    bascule.innerHTML = [['cartes', tx('Cartes', 'Cards')], ['grille', tx('Grille', 'Grid')]].map(([v, l]) =>
      `<button type="button" role="radio" aria-checked="${mode === v}" data-v="${v}">${ICONES[v]}<span>${l}</span></button>`).join('');
    bascule.querySelectorAll('button').forEach((b) => (b.onclick = () => {
      mode = b.dataset.v;
      mem.set('planning-cnam:vueSemaine', mode);
      rendreVue();
    }));
  }

  const minutes = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

  // cours qui se chevauchent : côte à côte, une colonne par cours simultané
  function placer(jour) {
    const res = [];
    let groupe = [], finGroupe = -1;
    const vider = () => {
      const n = Math.max(...groupe.map((g) => g.col)) + 1;
      groupe.forEach((g) => { g.ncol = n; res.push(g); });
      groupe = [];
    };
    for (const e of jour) {
      const s = minutes(e.start), f = minutes(e.end);
      if (groupe.length && s >= finGroupe) vider();
      const prises = groupe.filter((g) => minutes(g.e.end) > s).map((g) => g.col);
      let col = 0;
      while (prises.includes(col)) col++;
      groupe.push({ e, col });
      finGroupe = Math.max(finGroupe, f);
    }
    if (groupe.length) vider();
    return res;
  }

  function grille(lun) {
    const fin = addDays(lun, 7);
    const sem = [...S.data.events, ...S.ghosts].filter(visible)
      .filter((e) => { const d = parseISO(e.date); return d >= lun && d < fin; });
    const nbJours = sem.some((e) => parseISO(e.date).getDay() === 0) ? 7 : sem.some((e) => parseISO(e.date).getDay() === 6) ? 6 : 5;
    let h0 = 8, h1 = 18;
    for (const e of sem) { h0 = Math.min(h0, Math.floor(minutes(e.start) / 60)); h1 = Math.max(h1, Math.ceil(minutes(e.end) / 60)); }
    const y = (m) => ((m - h0 * 60) / 60) * PX;
    const auj = dISO(new Date());
    let lignes = '', heures = '';
    for (let h = h0; h <= h1; h++) {
      lignes += `<i style="top:${(h - h0) * PX}px"></i>`;
      heures += `<span style="top:${(h - h0) * PX}px">${String(h).padStart(2, '0')}:00</span>`;
    }
    let tetes = '', colonnes = '';
    for (let i = 0; i < nbJours; i++) {
      const d = addDays(lun, i), iso = dISO(d);
      const jour = sem.filter((e) => e.date === iso).sort((a, b) => a.start.localeCompare(b.start) || (a._ghost ? 1 : -1));
      tetes += `<div class="gh${iso === auj ? ' today' : ''}"><span class="dn">${d.getDate()}</span><span class="dw">${JOURS[d.getDay()]}</span>${iso === auj ? '<span class="today-tag">Aujourd\'hui</span>' : ''}</div>`;
      let contenu = placer(jour).map(({ e, col, ncol }) => {
        const haut = y(minutes(e.start)), h = Math.max(30, y(minutes(e.end)) - haut);
        return `<div class="gc" style="top:${haut + 2}px;height:${h - 4}px;left:calc(${(col * 100) / ncol}% + 3px);width:calc(${100 / ncol}% - 6px)">${carte(e)}</div>`;
      }).join('');
      if (!jour.length) {
        const st = S.data.events.some((e) => e.date === iso) ? 'cnam' : statutJour(iso);
        contenu = `<div class="gvide ${st || ''}">${LIB_JOUR[st] || 'Pas de cours'}</div>`;
      }
      if (iso === auj) {
        const n = new Date(), m = n.getHours() * 60 + n.getMinutes();
        if (m >= h0 * 60 && m <= h1 * 60) contenu += `<div class="gnow" style="top:${y(m)}px"></div>`;
      }
      colonnes += `<div class="gcol${iso === auj ? ' today' : ''}">${contenu}</div>`;
    }
    return `<div class="gwrap" style="--cols:${nbJours}"><div class="ghead"><div></div>${tetes}</div>
      <div class="gbody" style="height:${(h1 - h0) * PX + 14}px"><div class="glignes">${lignes}</div><div class="gheures">${heures}</div>${colonnes}</div></div>`;
  }

  const vueSemaineCartes = vueSemaine;
  vueSemaine = function (el) {   // eslint-disable-line no-global-assign
    vueSemaineCartes(el);   // titre de la semaine + cas « entreprise » / « pas encore publiée »
    if (mode !== 'grille' || !ecranLarge.matches) return;
    const lun = S.week, fin = addDays(lun, 7);
    const reels = S.data.events.some((e) => { const d = parseISO(e.date); return d >= lun && d < fin; });
    if (!reels || lun > parseISO(S.data.windowEnd)) return;
    el.innerHTML = grille(lun);
  };
  ecranLarge.addEventListener?.('change', () => { if (S.data) rendreVue(); });

  /* ============================================================ sondages */
  const API = 'https://countapi.mileshilliard.com/api/v1', P = 'sysco-rcu-planning-cnam-sondage-';
  const CLE_VOTES = 'planning-cnam:votes', CLE_ATTENTE = 'planning-cnam:votes-attente';
  let votes = {}, attente = [];
  try { votes = JSON.parse(mem.get(CLE_VOTES) || '{}') || {}; } catch { votes = {}; }
  try { attente = JSON.parse(mem.get(CLE_ATTENTE) || '[]') || []; } catch { attente = []; }
  const comptes = {};
  const cle = (id, i) => `${id}-${i}`;
  const ouvert = (s) => !s.fin || Date.parse(s.fin) > Date.now();
  const ICONE_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  function appel(route, k) {
    const ctl = window.AbortController ? new AbortController() : null;
    const minuteur = ctl ? setTimeout(() => ctl.abort(), 6000) : null;
    return fetch(`${API}/${route}/${P}${k}?t=${Date.now()}`, ctl ? { signal: ctl.signal } : undefined)
      .then((r) => { if (r.ok) return r.json(); if (r.status === 404) return { value: 0 }; throw new Error(`HTTP ${r.status}`); })
      .then((j) => Math.max(0, Number(j.value) || 0))
      .finally(() => clearTimeout(minuteur));
  }

  // onglet « Sondages » : libellé + pastille du nombre de sondages ouverts sans vote
  const onglet = document.querySelector('.tab[data-tab="sondages"]');
  if (onglet) onglet.dataset.notr = '';
  function majOnglet() {
    if (!onglet) return;
    const n = (S.sondages || []).filter((s) => ouvert(s) && votes[s.id] === undefined).length;
    onglet.innerHTML = `<span>${tx('Sondages', 'Polls')}</span>${n ? `<span class="n">${n}</span>` : ''}`;
  }

  const dateFin = (iso) => new Date(iso).toLocaleString(html.lang === 'en' ? 'en-GB' : 'fr-FR',
    { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  function carteSondage(s) {
    const moi = votes[s.id], ouv = ouvert(s), vu = moi !== undefined || !ouv;
    const c = comptes[s.id], total = c ? c.reduce((a, b) => a + b, 0) : null;
    const options = s.options.map((o, i) => {
      const pct = total ? Math.round((c[i] / total) * 100) : 0;
      const montrer = vu && total != null;
      const actif = ouv && moi === undefined;
      return `<button type="button" class="sopt${moi === i ? ' moi' : ''}" ${actif ? `data-s="${esc(s.id)}" data-i="${i}"` : 'disabled'} aria-pressed="${moi === i}">
        <span class="sbar" style="width:${montrer ? pct : 0}%"></span><span class="sl">${esc(o)}</span>${montrer ? `<span class="sp">${pct} %</span>` : ''}${moi === i ? `<span class="sv">${ICONE_OK}</span>` : ''}</button>`;
    }).join('');
    const etat = !ouv ? tx('Terminé', 'Closed') : s.fin ? `${tx('Fin', 'Ends')} : ${dateFin(s.fin)}` : '';
    let pied = total == null ? tx('Chargement des votes…', 'Loading votes…') : `${total} vote${total > 1 ? 's' : ''}`;
    if (total != null && moi !== undefined) pied += ` · ${tx('tu as voté', 'you voted')}`;
    else if (total != null && ouv) pied += ` · ${tx('touche une réponse pour voter', 'tap an answer to vote')}`;
    return `<article class="sdc${ouv ? '' : ' fini'}"><div class="sdh"><span class="stag">${esc(s.tag || tx('Sondage', 'Poll'))}</span><span class="sfin">${esc(etat)}</span></div>
      <h3>${esc(s.question)}</h3>${s.detail ? `<p class="sdet">${esc(s.detail)}</p>` : ''}<div class="sopts">${options}</div><p class="spied">${pied}</p></article>`;
  }

  function vueSondages(el) {
    $('#weeknav').style.display = 'none';
    if (S.sondages === undefined) { el.innerHTML = `<div class="placeholder" data-notr><h3>${tx('Chargement…', 'Loading…')}</h3></div>`; return; }
    if (!S.sondages.length) {
      el.innerHTML = `<div class="placeholder" data-notr><h3>${tx('Aucun sondage pour l\'instant', 'No polls yet')}</h3><p>${tx('Les sondages de la classe apparaîtront ici.', 'Class polls will show up here.')}</p></div>`;
      return;
    }
    const liste = [...S.sondages].sort((a, b) => ouvert(b) - ouvert(a));
    el.innerHTML = `<div class="sdg" data-notr><p class="sdg-note">${tx('Anonymes · un vote par téléphone', 'Anonymous · one vote per phone')}</p><div class="sdgs">${liste.map(carteSondage).join('')}</div></div>`;
    el.querySelectorAll('.sopt[data-s]').forEach((b) => (b.onclick = () => voter(b.dataset.s, Number(b.dataset.i))));
    rafraichir();
  }
  const rendreSiOuvert = () => { if (S.tab === 'sondages' && !S.q) vueSondages($('#view')); };

  let derniere = 0, enCours = false;
  async function rafraichir(force) {
    if (enCours || !S.sondages || (!force && Date.now() - derniere < 15000)) return;
    enCours = true;
    try {
      for (const s of S.sondages) {
        try { comptes[s.id] = await Promise.all(s.options.map((o, i) => appel('get', cle(s.id, i)))); } catch { /* service injoignable : on garde l'affichage */ }
      }
      derniere = Date.now();
    } finally { enCours = false; }
    // un vote envoyé à l'instant peut ne pas encore être lu : on le garde au minimum à 1
    for (const [id, i] of Object.entries(votes)) if (comptes[id] && comptes[id][i] < 1) comptes[id][i] = 1;
    rendreSiOuvert();
  }

  async function envoyer(id, i) {
    try {
      const v = await appel('hit', cle(id, i));
      attente = attente.filter(([a]) => a !== id);
      mem.set(CLE_ATTENTE, JSON.stringify(attente));
      if (comptes[id]) comptes[id][i] = Math.max(comptes[id][i], v);
      return true;
    } catch { return false; }   // le vote reste en attente, renvoyé à la prochaine ouverture
  }

  async function voter(id, i) {
    const s = (S.sondages || []).find((x) => x.id === id);
    if (!s || !ouvert(s) || votes[id] !== undefined || !(i >= 0 && i < s.options.length)) return;
    votes[id] = i;
    mem.set(CLE_VOTES, JSON.stringify(votes));
    attente.push([id, i]);
    mem.set(CLE_ATTENTE, JSON.stringify(attente));
    if (comptes[id]) comptes[id][i]++;
    majOnglet();
    rendreSiOuvert();
    await envoyer(id, i);
    rendreSiOuvert();
  }

  // chargement des questions (data/sondages.json)
  fetch(`data/sondages.json?t=${Date.now()}`).then((r) => (r.ok ? r.json() : [])).catch(() => []).then((j) => {
    const brut = Array.isArray(j) ? j : Array.isArray(j?.sondages) ? j.sondages : [];
    S.sondages = brut.filter((s) => s && s.id && s.question && Array.isArray(s.options) && s.options.length >= 2)
      .map((s) => ({ ...s, id: String(s.id).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60), options: s.options.map(String).slice(0, 8) }))
      .filter((s) => s.id);
    majOnglet();
    rendreSiOuvert();
    // votes pas encore arrivés au service (réseau coupé au moment du vote)
    attente.filter(([id]) => S.sondages.some((s) => s.id === id)).forEach(([id, i]) => envoyer(id, i));
  });
  setInterval(() => { if (S.tab === 'sondages' && !document.hidden) rafraichir(); }, 15000);

  /* ============================================================ branchement dans la page */
  const rendreVueBase = rendreVue;
  rendreVue = function () {   // eslint-disable-line no-global-assign
    majBascule();
    if (S.tab === 'sondages' && !S.q) { vueSondages($('#view')); return; }
    rendreVueBase();
  };
  const rendreChipsBase = rendreChips;
  rendreChips = function () {   // eslint-disable-line no-global-assign
    if (S.tab === 'sondages' && !S.q) { $('#chips').innerHTML = ''; return; }
    rendreChipsBase();
  };
  // changement de langue dans les Paramètres
  new MutationObserver(() => { majOnglet(); majBascule(); rendreSiOuvert(); })
    .observe(html, { attributes: true, attributeFilter: ['lang'] });

  majBascule();
  majOnglet();
})();
