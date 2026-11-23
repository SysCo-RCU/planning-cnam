/**
 * Sondages de la classe – mini-serveur pour la page Planning Cnam
 * (Google Apps Script, déployé en « Application Web »).
 *
 * - Liste les sondages (GET).
 * - Crée un sondage (POST {a:'creer', question, detail, options[], fin, auteur, cle}).
 * - Supprime un sondage (POST {a:'supprimer', id, cle}) : SEUL l'appareil qui l'a créé
 *   peut le supprimer. La « cle » est un code aléatoire gardé sur le téléphone du créateur ;
 *   le serveur n'en garde que l'empreinte (SHA-256) et la vérifie avant de supprimer.
 *
 * Les sondages sont gardés dans les « Propriétés du script » (Paramètres du projet).
 * Les sondages terminés depuis plus de 7 jours sont effacés automatiquement.
 * Pour retirer un sondage à la main : Paramètres du projet > Propriétés du script > supprimer la ligne p_…
 */
const PREFIXE = 'p_';
const MAX_OUVERTS = 30;          // sondages ouverts en même temps, au total
const MAX_PAR_PERSONNE = 5;      // sondages ouverts par appareil
const MAX_CREATIONS_HEURE = 5;   // créations par appareil et par heure

function doGet() {
  return repondre(lister());
}

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return repondre({ ok: false, erreur: 'json' }); }
  const verrou = LockService.getScriptLock();
  verrou.waitLock(10000);
  try {
    if (d.a === 'creer') return repondre(creer(d));
    if (d.a === 'supprimer') return repondre(supprimer(d));
    return repondre({ ok: false, erreur: 'action' });
  } finally {
    verrou.releaseLock();
  }
}

function repondre(objet) {
  return ContentService.createTextOutput(JSON.stringify(objet)).setMimeType(ContentService.MimeType.JSON);
}

function empreinte(texte) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texte, Utilities.Charset.UTF_8)
    .map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, '0'); }).join('');
}

function texte(v, max) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
}

function tous() {
  const p = PropertiesService.getScriptProperties().getProperties();
  return Object.keys(p).filter(function (k) { return k.indexOf(PREFIXE) === 0; }).map(function (k) {
    try { return JSON.parse(p[k]); } catch (err) { return null; }
  }).filter(Boolean);
}

function lister() {
  const maintenant = Date.now();
  const props = PropertiesService.getScriptProperties();
  const liste = [];
  tous().forEach(function (s) {
    if (Date.parse(s.fin) < maintenant - 7 * 864e5) { props.deleteProperty(PREFIXE + s.id); return; }
    liste.push({ id: s.id, question: s.question, detail: s.detail || '', options: s.options, fin: s.fin, cree: s.cree, auteur: s.auteur || '' });
  });
  liste.sort(function (a, b) { return b.cree.localeCompare(a.cree); });
  return { ok: true, sondages: liste };
}

function creer(d) {
  const cle = String(d.cle || '');
  if (!/^[0-9a-f]{32,64}$/.test(cle)) return { ok: false, erreur: 'cle' };
  const question = texte(d.question, 140);
  if (question.length < 3) return { ok: false, erreur: 'question' };
  const options = (Array.isArray(d.options) ? d.options : []).map(function (o) { return texte(o, 60); }).filter(Boolean).slice(0, 6);
  const uniques = {};
  options.forEach(function (o) { uniques[o.toLowerCase()] = 1; });
  if (options.length < 2 || Object.keys(uniques).length !== options.length) return { ok: false, erreur: 'options' };
  const maintenant = Date.now(), fin = Date.parse(d.fin);
  if (!(fin > maintenant + 30 * 60e3 && fin < maintenant + 31 * 864e5)) return { ok: false, erreur: 'fin' };

  const h = empreinte(cle);
  const ouverts = tous().filter(function (s) { return Date.parse(s.fin) > maintenant; });
  if (ouverts.length >= MAX_OUVERTS) return { ok: false, erreur: 'plein' };
  if (ouverts.filter(function (s) { return s.proprio === h; }).length >= MAX_PAR_PERSONNE) return { ok: false, erreur: 'trop' };
  const cache = CacheService.getScriptCache(), cleCache = 'n_' + h.slice(0, 24);
  const n = Number(cache.get(cleCache) || 0);
  if (n >= MAX_CREATIONS_HEURE) return { ok: false, erreur: 'vite' };
  cache.put(cleCache, String(n + 1), 3600);

  const id = 'u' + maintenant.toString(36) + Math.random().toString(36).slice(2, 6);
  const sondage = {
    id: id, question: question, detail: texte(d.detail, 120), options: options,
    fin: new Date(fin).toISOString(), cree: new Date(maintenant).toISOString(),
    auteur: texte(d.auteur, 30), proprio: h,
  };
  PropertiesService.getScriptProperties().setProperty(PREFIXE + id, JSON.stringify(sondage));
  return { ok: true, id: id };
}

function supprimer(d) {
  const id = texte(d.id, 40);
  const props = PropertiesService.getScriptProperties();
  const brut = props.getProperty(PREFIXE + id);
  if (!brut) return { ok: true, deja: true };
  const s = JSON.parse(brut);
  if (empreinte(String(d.cle || '')) !== s.proprio) return { ok: false, erreur: 'interdit' };
  props.deleteProperty(PREFIXE + id);
  return { ok: true };
}
