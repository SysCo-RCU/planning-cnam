/* Bouton « PDF » : exporte l'onglet affiché (semaine, mois, à venir, examens, avancement,
   modifications, sondages) en PDF, via l'impression du navigateur (« Enregistrer en PDF »
   sur ordinateur, « Imprimer › Partager › Enregistrer dans Fichiers » sur iPhone / iPad).
   Seul le contenu de l'onglet est imprimé, avec un titre, en clair même en thème sombre. */
(() => {
  const html = document.documentElement;
  const tx = (fr, en) => (html.lang === 'en' ? en : fr);
  const TITRE = document.title;

  const style = document.createElement('style');
  style.textContent = `
#pdfBtn{min-height:36px;white-space:nowrap}
#weeknav[style*="none"] ~ #pdfBtn{margin-left:auto}
#printhead{display:none}
@media (max-width:560px){#pdfBtn{margin-left:auto}}
@media print{
  html,html[data-theme][data-theme]{--bg:#fff;--bg2:#f1eeea;--card:#fff;--ink:#17151a;--ink2:#4a4550;--ink3:#6b6570;--line:#d9d3cc;--shadow:none;color-scheme:light}
  html[data-theme][data-theme]{--ok:#0f7b46;--ok-soft:#e5f5ec;--warn:#9a5b00;--warn-soft:#fff2db;--blue:#1d4ed8;--blue-soft:#e8eefc}
  body{background:#fff!important;font-size:12px;zoom:1!important}
  body::before{display:none!important}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-shadow:none!important;animation:none!important;transition:none!important}
  .wrap{max-width:none;padding:0}
  header,#alert,#hero,#frise,.bar,#chips,footer,dialog,.vbasc,.sdg-haut,.sdg-form,.ssup,#notifBtn{display:none!important}
  #printhead{display:flex;justify-content:space-between;align-items:baseline;gap:16px;border-bottom:2px solid #17151a;padding-bottom:6px;margin-bottom:12px}
  #printhead h1{font-family:var(--display);font-size:20px;font-weight:800}
  #printhead p{font-size:11px;color:#4a4550;text-align:right}
  .ev,.batch,.chg,.uecard,.sdc,.row,.lday,.exams>*{break-inside:avoid}
  .day{min-height:0;opacity:1!important}
  .day.past{opacity:1!important}
  .sopt{border:1px solid #d9d3cc!important}
  a{text-decoration:none;color:inherit}
}`;
  document.head.appendChild(style);
  // format de page selon l'onglet : paysage pour la semaine et le mois, portrait sinon
  const page = document.createElement('style');
  document.head.appendChild(page);

  // titre imprimé en haut du PDF
  const tete = document.createElement('div');
  tete.id = 'printhead';
  tete.dataset.notr = '';
  const vue = document.getElementById('view');
  vue.parentNode.insertBefore(tete, vue);

  const ICONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/></svg>';
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.id = 'pdfBtn';
  bouton.className = 'btn ghost';
  bouton.dataset.notr = '';
  document.getElementById('tabs').parentNode.appendChild(bouton);

  const NOMS = {
    week: ['Semaine', 'Week'], month: ['Mois', 'Month'], list: ['À venir', 'Upcoming'], exams: ['Examens', 'Exams'],
    ue: ['Avancement', 'Progress'], changes: ['Modifications', 'Changes'], sondages: ['Sondages', 'Polls'],
  };
  const nomOnglet = () => {
    if (S.q) return `${tx('Recherche', 'Search')} « ${S.q} »`;
    const n = NOMS[S.tab];
    return n ? tx(n[0], n[1]) : '';
  };
  function majBouton() {
    bouton.innerHTML = `${ICONE}<span>PDF</span>`;
    const l = tx(`Exporter l'onglet « ${nomOnglet()} » en PDF`, `Export the “${nomOnglet()}” tab as PDF`);
    bouton.title = l;
    bouton.setAttribute('aria-label', l);
  }

  bouton.onclick = () => {
    const onglet = nomOnglet();
    const lbl = document.getElementById('weeklbl');
    let periode = '';
    if (!S.q && ['week', 'month'].includes(S.tab) && lbl) {
      const petit = lbl.querySelector('small');
      const haut = petit ? petit.textContent.trim() : '';
      const reste = lbl.textContent.replace(haut, '').replace(/\s+/g, ' ').trim();
      periode = S.tab === 'week' && haut ? `${haut} (${reste})` : reste;
    }
    const sous = (document.getElementById('subtitle') || {}).textContent || '';
    const maintenant = new Date().toLocaleString(html.lang === 'en' ? 'en-GB' : 'fr-FR', { dateStyle: 'long', timeStyle: 'short' });
    tete.innerHTML = '';
    const h = document.createElement('h1');
    h.textContent = `Planning Cnam — ${onglet}${periode ? ` · ${periode}` : ''}`;
    const p = document.createElement('p');
    p.textContent = `${sous}\n${tx('Exporté le', 'Exported on')} ${maintenant}`;
    p.style.whiteSpace = 'pre-line';
    tete.append(h, p);
    const paysage = !S.q && ['week', 'month'].includes(S.tab);
    page.textContent = `@page{size:A4 ${paysage ? 'landscape' : 'portrait'};margin:10mm}`;
    // nom du fichier proposé par le navigateur
    document.title = `Planning Cnam - ${onglet}${periode ? ` - ${periode}` : ''}`.replace(/[\\/:*?"<>|«»“”]/g, '').replace(/\s+/g, ' ').trim();
    const remettre = () => { document.title = TITRE; window.removeEventListener('afterprint', remettre); };
    window.addEventListener('afterprint', remettre);
    setTimeout(() => window.print(), 50);
    setTimeout(remettre, 60000);
  };

  // libellé du bouton à jour selon l'onglet et la langue
  const rendreVueBase = rendreVue;
  rendreVue = function () {   // eslint-disable-line no-global-assign
    rendreVueBase.apply(this, arguments);
    majBouton();
  };
  new MutationObserver(majBouton).observe(html, { attributes: true, attributeFilter: ['lang'] });
  majBouton();
})();
