// Joue une histoire entière sur le site EN LIGNE, à plusieurs tailles de téléphone :
// pas de débordement sur le côté, boutons de lecture visibles sans faire défiler, 4 lignes au plus par écran de lecture,
// une erreur volontaire (indice), les preuves, le bilan, et aucune erreur dans la console.
// Usage : node tests/telephone.cjs [url]   (captures dans captures/)
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.argv[2] || 'https://lechampdelaurore-boop.github.io/petites-histoires/';
const SIZES = [[320, 568], [360, 640], [375, 667], [390, 664], [390, 844], [412, 780], [430, 932]];
const expectedCache = (fs.readFileSync('sw.js', 'utf8').match(/petites-histoires-v\d+/) || [])[0];
const src = fs.readFileSync('index.html', 'utf8');
const HISTOIRES = new Function(src.split('/* HISTOIRES-DEBUT */')[1].split('/* HISTOIRES-FIN */')[0] + '; return HISTOIRES;')();

(async () => {
  fs.mkdirSync('captures', { recursive: true });
  // Attendre que GitHub Pages serve bien la version du dépôt (même CACHE que sw.js).
  for (let i = 0; ; i++) {
    const live = await fetch(URL + 'sw.js?nocache=' + Date.now()).then(r => r.text()).catch(() => '');
    if (live.includes(expectedCache)) { console.log('Version en ligne : ' + expectedCache); break; }
    if (i >= 18) { console.log('Version en ligne différente de ' + expectedCache + ' après 3 min'); process.exit(1); }
    await new Promise(r => setTimeout(r, 10000));
  }

  const browser = await chromium.launch();
  const lines = ['| Écran | Accueil | Lecture | Question | Preuve | Bilan | Console |', '|---|---|---|---|---|---|---|'];
  let failed = false;
  for (const [w, h] of SIZES) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(() => localStorage.setItem('marc.histoires.reglages', JSON.stringify({ autoRead: false, anims: true, sons: true })));
    await page.goto(URL + '?nocache=' + Date.now());
    await page.waitForTimeout(300);
    const wide = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const below = sel => page.evaluate(s => Math.max(0, Math.ceil(document.querySelector(s).getBoundingClientRect().bottom - window.innerHeight)), sel);
    const cells = [];
    const check = async (name, extra) => {
      const d = await wide();
      const e = extra || 0;
      await page.screenshot({ path: `captures/${w}x${h}-${name}.png` });
      if (d > 0 || e > 0) failed = true;
      cells.push(d > 0 ? `❌ déborde de ${d} px` : e > 0 ? `❌ bouton caché de ${e} px` : '✅');
    };
    await check('accueil');

    const story = HISTOIRES[0];
    await page.click('#todayBtn');
    await page.waitForTimeout(200);
    await check('lecture', await below('#nextPage'));
    // Lecture : 4 lignes au plus par écran, jusqu'aux questions.
    let maxLines = 0;
    for (let p = 0; p < 20 && await page.isVisible('#nextPage'); p++) {
      maxLines = Math.max(maxLines, await page.evaluate(() => { const t = document.querySelector('#readText'); return Math.round(t.getBoundingClientRect().height / parseFloat(getComputedStyle(t).lineHeight)); }));
      await page.click('#nextPage');
      await page.waitForTimeout(150);
    }
    if (maxLines > 4) { failed = true; errors.push('jusqu\'à ' + maxLines + ' lignes sur un écran de lecture'); }

    for (let qi = 0; qi < story.questions.length; qi++) {
      const q = story.questions[qi];
      if (qi === 0) {
        await page.click('#choices .choix:not([data-ok="1"])');
        await page.waitForTimeout(600);
        await check('question-indice');
      }
      await page.click('#choices .choix[data-ok="1"]');
      await page.waitForTimeout(300);
      const phrase = story.texte.flat().find(t => t.includes(q.preuve[0]));
      if (qi === 0) await check('preuve');
      await page.locator('#storyText .ph', { hasText: phrase }).click();
      await page.waitForTimeout(400);
      if (await page.locator('#storyText .ph.trouvee').count() !== 1) { failed = true; errors.push('preuve non acceptée : ' + phrase); }
      await page.click('#nextQ');
      await page.waitForTimeout(300);
    }
    const stars = await page.locator('#stars .on').count();
    if (stars !== 2) { failed = true; errors.push(stars + ' étoiles au lieu de 2'); }
    await check('bilan');
    if (errors.length) failed = true;
    cells.push(errors.length ? '❌ ' + errors.join(' ; ').slice(0, 200) : '✅');
    lines.push(`| ${w}×${h} | ${cells.join(' | ')} |`);
    await page.close();
  }
  await browser.close();
  const report = lines.join('\n');
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '## Test téléphone (site en ligne)\n\n' + report + '\n');
  process.exit(failed ? 1 : 0);
})();
