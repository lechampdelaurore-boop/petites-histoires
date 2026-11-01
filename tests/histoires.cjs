// Vérifie les histoires écrites dans index.html : chaque morceau de « preuve » doit
// désigner exactement une phrase, chaque question a 3 réponses différentes.
// Usage : node tests/histoires.cjs
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const bloc = src.split('/* HISTOIRES-DEBUT */')[1].split('/* HISTOIRES-FIN */')[0];
const HISTOIRES = new Function(bloc + '; return HISTOIRES;')();
let erreurs = 0;
const ids = new Set();
const ko = (h, m) => { erreurs++; console.log('❌ ' + h.titre + ' : ' + m); };
for (const h of HISTOIRES) {
  if (ids.has(h.id)) ko(h, 'id en double');
  ids.add(h.id);
  const phrases = h.texte.flat();
  if (h.questions.length !== 3) ko(h, h.questions.length + ' questions au lieu de 3');
  for (const q of h.questions) {
    if (q.r.length !== 3 || new Set(q.r).size !== 3) ko(h, '« ' + q.q + ' » : il faut 3 réponses différentes');
    if (!q.preuve.length) ko(h, '« ' + q.q + ' » : aucune preuve');
    for (const bout of q.preuve) {
      const n = phrases.filter(p => p.includes(bout)).length;
      if (n !== 1) ko(h, '« ' + bout + ' » trouvé dans ' + n + ' phrases');
    }
  }
  const mots = phrases.join(' ').split(/\s+/).length;
  console.log((h.titre + ' ').padEnd(30, '.') + ' ' + phrases.length + ' phrases, ' + mots + ' mots');
}
console.log(erreurs ? erreurs + ' erreur(s)' : '✅ ' + HISTOIRES.length + ' histoires valides');
process.exit(erreurs ? 1 : 0);
