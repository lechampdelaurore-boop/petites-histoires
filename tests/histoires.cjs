// Vérifie les histoires écrites dans index.html (entre HISTOIRES-DEBUT et HISTOIRES-FIN),
// selon les règles du format v2 : niveaux, longueurs, questions, pièges, explications, preuves.
// Usage : node tests/histoires.cjs [fichier]   (par défaut index.html ; accepte aussi un fichier qui ne contient que le tableau)
const fs = require('fs');
const file = process.argv[2] || __dirname + '/../index.html';
const src = fs.readFileSync(file, 'utf8');
const bloc = src.includes('/* HISTOIRES-DEBUT */') ? src.split('/* HISTOIRES-DEBUT */')[1].split('/* HISTOIRES-FIN */')[0] : src;
const HISTOIRES = new Function(bloc + '; return HISTOIRES;')();

const TYPES = ['litterale', 'inference-locale', 'inference-globale', 'mot', 'idee-principale', 'structure'];
const PIEGES = ['paraphrase', 'laterale', 'personnage-moment', 'mot-detourne', 'fausse'];
const NIV = {
  1: { mots: [75, 120], par: [3, 3], q: 3, phrase: 15 },
  2: { mots: [150, 250], par: [4, 5], q: 4, phrase: 18 },
  3: { mots: [250, 400], par: [5, 7], q: 4, phrase: 22 },
  4: { mots: [200, 300], par: [3, 5], q: 4, phrase: 22, total: [400, 600] }
};
// Comptage commun (auteur, tests, appli) : une élision compte pour un mot.
const compte = t => t.replace(/[«»—–:;!?]/g, ' ').split(/\s+/).filter(Boolean).length;

let erreurs = 0, alertes = 0;
const ko = (h, m) => { erreurs++; console.log('❌ ' + (h.titre || h.id) + ' : ' + m); };
const warn = (h, m) => { alertes++; console.log('⚠️  ' + (h.titre || h.id) + ' : ' + m); };
const ids = new Set(), titres = new Set(), parNiveau = {};

function checkQ(h, q, phrases, nom) {
  const label = nom + ' « ' + q.q + ' »';
  if (!TYPES.includes(q.type)) ko(h, label + ' : type « ' + q.type + ' » inconnu');
  if (!Array.isArray(q.reponses) || q.reponses.length !== 3) { ko(h, label + ' : il faut 3 réponses'); return; }
  if (new Set(q.reponses.map(r => r.t)).size !== 3) ko(h, label + ' : réponses en double');
  if (q.reponses.filter(r => r.juste === true).length !== 1) ko(h, label + ' : il faut une seule réponse juste');
  for (const r of q.reponses) {
    if (!r.t) ko(h, label + ' : réponse vide');
    if (!r.explication) ko(h, label + ' : pas d\'explication pour « ' + r.t + ' »');
    else if (compte(r.explication) > 20) ko(h, label + ' : explication de ' + compte(r.explication) + ' mots (20 au plus)');
    if (r.juste && r.piege) ko(h, label + ' : la bonne réponse a un piège');
    if (!r.juste && !PIEGES.includes(r.piege)) ko(h, label + ' : piège « ' + r.piege + ' » inconnu pour « ' + r.t + ' »');
  }
  if (!Array.isArray(q.preuve)) { ko(h, label + ' : preuve manquante'); return; }
  if ((q.type === 'idee-principale') !== (q.preuve.length === 0)) ko(h, label + ' : preuve vide seulement pour « idee-principale »');
  for (const bout of q.preuve) {
    const n = phrases.filter(p => p.includes(bout)).length;
    if (n !== 1) ko(h, label + ' : « ' + bout + ' » trouvé dans ' + n + ' phrases');
  }
}

function checkEpisode(h, ep, niv, nom) {
  const R = NIV[niv];
  if (!Array.isArray(ep.texte) || !ep.texte.length) { ko(h, nom + 'pas de texte'); return 0; }
  const phrases = ep.texte.flat();
  const mots = compte(phrases.join(' '));
  if (mots < R.mots[0] || mots > R.mots[1]) ko(h, nom + mots + ' mots (attendu ' + R.mots[0] + ' à ' + R.mots[1] + ')');
  if (ep.texte.length < R.par[0] || ep.texte.length > R.par[1]) ko(h, nom + ep.texte.length + ' paragraphes (attendu ' + R.par.join(' à ') + ')');
  for (const p of phrases) if (compte(p) > R.phrase) warn(h, nom + 'phrase de ' + compte(p) + ' mots : « ' + p.slice(0, 40) + '… »');
  const qs = ep.questions || [], rv = ep.revision || [];
  if (qs.length !== R.q) ko(h, nom + qs.length + ' questions au lieu de ' + R.q);
  if (rv.length !== 2) ko(h, nom + rv.length + ' questions de relecture au lieu de 2');
  qs.forEach(q => checkQ(h, q, phrases, nom + 'question'));
  rv.forEach(q => checkQ(h, q, phrases, nom + 'relecture'));
  if (new Set(qs.map(q => q.type)).size !== qs.length) ko(h, nom + 'deux questions du même type');
  if (!qs.some(q => q.type === 'inference-globale')) ko(h, nom + 'aucune question « inference-globale »');
  if (rv.length && !rv.some(q => q.type === 'idee-principale' || q.type === 'structure')) ko(h, nom + 'relecture sans « idee-principale » ni « structure »');
  const avecFausse = qs.filter(q => (q.reponses || []).some(r => r.piege === 'fausse')).length;
  if (niv <= 2) {
    for (const q of qs) {
      const p = (q.reponses || []).filter(r => !r.juste).map(r => r.piege);
      if (p.filter(x => x === 'fausse').length !== 1) ko(h, nom + '« ' + q.q + ' » : il faut 1 « fausse » + 1 piège (niveaux 1 et 2)');
    }
  } else if (avecFausse * 2 < qs.length) ko(h, nom + 'moins de la moitié des questions gardent une « fausse »');
  const stat = parNiveau[niv];
  for (const q of qs) {
    stat.types[q.type] = (stat.types[q.type] || 0) + 1;
    for (const r of q.reponses || []) if (!r.juste) stat.pieges[r.piege] = (stat.pieges[r.piege] || 0) + 1;
  }
  return mots;
}

for (const h of HISTOIRES) {
  if (ids.has(h.id)) ko(h, 'id en double');
  if (!/^[a-z0-9-]+$/.test(h.id || '')) ko(h, 'id « ' + h.id + ' » : minuscules sans accent et tirets seulement');
  if (titres.has(h.titre)) ko(h, 'titre en double');
  ids.add(h.id); titres.add(h.titre);
  if (!NIV[h.niveau]) { ko(h, 'niveau « ' + h.niveau + ' » invalide'); continue; }
  if (!['recit', 'documentaire'].includes(h.genre)) ko(h, 'genre « ' + h.genre + ' » invalide');
  if (!h.emoji) ko(h, 'pas d\'emoji');
  parNiveau[h.niveau] = parNiveau[h.niveau] || { n: 0, types: {}, pieges: {}, structure: 0 };
  parNiveau[h.niveau].n++;
  let mots = 0;
  if (h.niveau === 4) {
    if (h.texte || h.questions || h.revision) ko(h, 'niveau 4 : texte et questions vont dans « episodes »');
    if (!Array.isArray(h.episodes) || h.episodes.length !== 2) { ko(h, 'niveau 4 : il faut 2 épisodes'); continue; }
    h.episodes.forEach((ep, k) => {
      if (!ep.titre) ko(h, 'épisode ' + (k + 1) + ' sans titre');
      if (k === 0 && ep.rappel) ko(h, 'l\'épisode 1 ne doit pas avoir de rappel');
      if (k === 1 && !ep.rappel) ko(h, 'l\'épisode 2 doit avoir un rappel');
      mots += checkEpisode(h, ep, 4, 'épisode ' + (k + 1) + ' : ');
    });
    const last = (h.episodes[1].questions || []).slice(-1)[0];
    if (last && !['idee-principale', 'structure'].includes(last.type)) ko(h, 'la dernière question de l\'épisode 2 doit porter sur toute l\'histoire');
    const T = NIV[4].total;
    if (mots < T[0] || mots > T[1]) ko(h, mots + ' mots en tout (attendu ' + T[0] + ' à ' + T[1] + ')');
  } else {
    if (h.episodes) ko(h, '« episodes » seulement au niveau 4');
    mots = checkEpisode(h, h, h.niveau, '');
  }
  if (h.mots !== mots) ko(h, '« mots » vaut ' + h.mots + ' mais le texte en compte ' + mots);
  console.log(('N' + h.niveau + ' ' + h.titre + ' ').padEnd(40, '.') + ' ' + mots + ' mots');
}

for (const niv of [1, 2, 3, 4]) {
  const s = parNiveau[niv];
  const tag = { titre: 'Niveau ' + niv };
  if (!s) { ko(tag, 'aucune histoire'); continue; }
  if (s.n !== 10) ko(tag, s.n + ' histoires au lieu de 10');
  for (const p of PIEGES.filter(p => p !== 'fausse')) if ((s.pieges[p] || 0) < 4) ko(tag, 'le piège « ' + p + ' » apparaît ' + (s.pieges[p] || 0) + ' fois (4 au moins)');
  if (niv === 1) {
    const n = (s.types['idee-principale'] || 0) + (s.types.structure || 0);
    if (n < 3) ko(tag, n + ' questions « idee-principale » ou « structure » (3 au moins)');
  } else {
    for (const t of TYPES) if ((s.types[t] || 0) < 4) ko(tag, 'le type « ' + t + ' » apparaît ' + (s.types[t] || 0) + ' fois (4 au moins)');
  }
}

console.log((alertes ? alertes + ' alerte(s) (phrases longues). ' : '') + (erreurs ? erreurs + ' erreur(s)' : '✅ ' + HISTOIRES.length + ' histoires valides'));
process.exit(erreurs ? 1 : 0);
