/* Compteur de vues : vues totales, personnes (appareils) distinctes et personnes en ligne
   Service gratuit sans compte : Abacus (https://abacus.jasoncameron.dev).
   - « vues » : +1 à chaque ouverture de la page
   - « personnes » : +1 la première fois qu'un appareil ouvre la page
   - « en ligne » : chaque appareil qui a la page ouverte et visible se signale une fois
     toutes les 2 minutes ; on affiche le nombre d'appareils signalés sur les dernières minutes
   Ouvrir la page une fois avec ?moi à la fin de l'adresse : cet appareil n'est plus compté. */
(() => {
  const API = 'https://abacus.jasoncameron.dev', NS = 'sysco-planning-cnam';
  const TRANCHE = 120000; // 2 min
  const el = document.getElementById('vues');
  if (!el || !window.fetch) return;

  const mem = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* stockage indisponible */ } },
    del: (k) => { try { localStorage.removeItem(k); } catch { /* stockage indisponible */ } },
  };
  const params = new URLSearchParams(location.search);
  if (params.has('moi')) mem.set('cnam-moi', '1');
  if (params.has('pasmoi')) mem.del('cnam-moi');
  const moi = mem.get('cnam-moi') === '1';

  const val = { vues: null, personnes: null, enligne: null };
  const n = (x) => Number(x).toLocaleString('fr-FR');
  function afficher() {
    if (val.vues == null && val.enligne == null) return;
    const bouts = [];
    if (val.enligne != null) bouts.push(`<span class="vl"><i class="dot ok"></i><span><b>${n(val.enligne)}</b>&nbsp;en ligne</span></span>`);
    if (val.vues != null) bouts.push(`<span><b>${n(val.vues)}</b>&nbsp;vue${val.vues > 1 ? 's' : ''}</span>`);
    if (val.personnes != null) bouts.push(`<span><b>${n(val.personnes)}</b>&nbsp;personne${val.personnes > 1 ? 's' : ''}</span>`);
    el.innerHTML = bouts.join('<span class="sep">·</span>');
    el.title = 'Vues de la page : total des ouvertures, appareils distincts et appareils ayant la page ouverte en ce moment'
      + (moi ? ' (cet appareil n\'est pas compté)' : '');
    el.hidden = false;
  }

  // lit {value} ; une clé qui n'existe pas encore vaut 0
  // (pas d'option « cache » : sur iPhone elle peut déclencher une requête préalable refusée ;
  //  le paramètre t suffit à éviter le cache)
  const erreurs = [];
  const lire = (route, cle) => fetch(`${API}/${route}/${NS}/${cle}?t=${Date.now()}`)
    .then((r) => (r.ok ? r.json() : r.status === 404 ? { value: 0 } : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((j) => Math.max(0, Number(j.value) || 0))
    .catch((e) => { erreurs.push(`${route} ${cle} : ${e && e.message || e}`); throw e; });
  // ?debug : affiche la raison si le compteur ne peut pas se charger
  if (params.has('debug')) setTimeout(() => {
    if (!el.hidden) return;
    el.textContent = `Compteur indisponible — ${erreurs[0] || 'aucune réponse'}`;
    el.hidden = false;
  }, 6000);
  const hit = (cle) => lire('hit', cle);
  const get = (cle) => lire('get', cle);

  // vues et personnes
  (moi ? get('vues') : hit('vues')).then((v) => { val.vues = v; afficher(); }).catch(() => {});
  const nouveau = !moi && !mem.get('cnam-visiteur');
  (nouveau ? hit('personnes') : get('personnes')).then((v) => {
    val.personnes = v; afficher();
    if (nouveau) mem.set('cnam-visiteur', String(Date.now()));
  }).catch(() => {});

  // mises à jour en direct quand quelqu'un d'autre ouvre la page
  if (window.EventSource) {
    for (const cle of ['vues', 'personnes']) {
      try {
        const es = new EventSource(`${API}/stream/${NS}/${cle}`);
        es.onmessage = (e) => {
          let v; try { const j = JSON.parse(e.data); v = typeof j === 'object' ? j.value : j; } catch { v = e.data; }
          v = Number(v);
          if (Number.isFinite(v) && v >= (val[cle] || 0)) { val[cle] = v; afficher(); }
        };
        es.onerror = () => { if (es.readyState === 2) es.close(); };
      } catch { /* pas de flux : les chiffres restent ceux de l'ouverture */ }
    }
  }

  // en ligne : un signal par appareil et par tranche de 2 min, tant que la page est visible
  const tranche = () => Math.floor(Date.now() / TRANCHE);
  // le service répond parfois « réessayez plus tard » : une lecture ratée ne bloque pas le reste
  const sur = (p) => p.catch(() => null);
  async function enLigne() {
    const t = tranche();
    let cur;
    if (!moi && document.visibilityState === 'visible' && mem.get('cnam-enligne') !== String(t)) {
      cur = await sur(hit(`enligne-${t}`));
      if (cur != null) mem.set('cnam-enligne', String(t));
    } else cur = await sur(get(`enligne-${t}`));
    const prec = await sur(get(`enligne-${t - 1}`));
    // la tranche en cours se remplit au fil des signaux : on garde la plus haute des deux
    if (cur != null || prec != null) val.enligne = Math.max(cur || 0, prec || 0, moi ? 0 : 1);
    // relecture des totaux (au cas où le flux en direct n'est pas disponible)
    const v = await sur(get('vues')), p = await sur(get('personnes'));
    if (v != null) val.vues = Math.max(val.vues || 0, v);
    if (p != null) val.personnes = Math.max(val.personnes || 0, p);
    afficher();
  }
  enLigne();
  setInterval(() => { if (document.visibilityState === 'visible') enLigne(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') enLigne(); });
})();
