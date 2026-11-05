// Joue l'appli sur le site EN LIGNE, à 7 tailles de téléphone, et vérifie :
// - pas de débordement sur le côté, bouton « Suite » visible sans faire défiler, 4 lignes au plus par écran de lecture ;
// - la voix ne part pas toute seule (réglage par défaut) ;
// - d'anciens progrès (v1) sont gardés et « lire tout seul » passe à non ;
// - une histoire du niveau 1 (avec un piège : explication puis passage en jaune), une du niveau 3
//   et un épisode du niveau 4 jouées en entier ; une question « L'idée » se finit sans preuve ;
// - la relecture apparaît dans « Ma séance du jour » 2 jours plus tard et se joue ;
// - le carnet du parent s'affiche ; l'appli marche hors ligne après une première visite (https) ;
// - aucune erreur dans la console.
// Usage : node tests/telephone.cjs [url]   (captures dans captures/)
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.argv[2] || 'https://lechampdelaurore-boop.github.io/petites-histoires/';
const SIZES = [[320, 568], [360, 640], [375, 667], [390, 664], [390, 844], [412, 780], [430, 932]];
const expectedCache = (fs.readFileSync('sw.js', 'utf8').match(/petites-histoires-v\d+/) || [])[0];

// Progrès et réglages tels que la v1 les enregistrait.
const V1_PREFS = { autoRead: true, slow: false, sons: true, anims: true };
const V1_PROG = { stories: { velo: { best: 2, plays: 1, first: '2026-11-01', last: '2026-11-01', res: [{ a: 1, p: 1 }, { a: 2, p: 1 }, { a: 1, p: 2 }], listens: 0 } }, days: ['2026-11-01'] };

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
  const lines = ['| Écran | Accueil | Niveau 1 | Niveau 3 | Niveau 4 | L\'idée | Relecture | Carnet | Console |', '|---|---|---|---|---|---|---|---|---|'];
  let failed = false;
  for (const [w, h] of SIZES) {
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(([p, g]) => {
      if (!sessionStorage.getItem('init')) {
        sessionStorage.setItem('init', '1');
        localStorage.setItem('marc.histoires.reglages', JSON.stringify(p));
        localStorage.setItem('marc.histoires.progres', JSON.stringify(g));
      }
      // Compte les phrases dites par la voix.
      window.__dit = 0;
      if (window.speechSynthesis) { const s = speechSynthesis.speak.bind(speechSynthesis); speechSynthesis.speak = u => { window.__dit++; try { s(u); } catch (e) {} }; }
    }, [V1_PREFS, V1_PROG]);
    await page.goto(URL + '?nocache=' + Date.now());
    await page.waitForTimeout(400);

    const st = () => page.evaluate(() => window.__histoires.etat());
    const wide = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const below = sel => page.evaluate(s => Math.max(0, Math.ceil(document.querySelector(s).getBoundingClientRect().bottom - window.innerHeight)), sel);
    const pb = [];
    const check = async (name, extra) => {
      const d = await wide();
      await page.screenshot({ path: `captures/${w}x${h}-${name}.png` });
      if (d > 0) pb.push(name + ' : déborde de ' + d + ' px');
      if (extra > 0) pb.push(name + ' : bouton caché de ' + extra + ' px');
    };
    const cells = [];
    const cell = (start) => { const mine = pb.slice(start); cells.push(mine.length ? '❌ ' + mine.join(' ; ').slice(0, 160) : '✅'); if (mine.length) failed = true; };

    // Accueil, migration des réglages et des progrès v1.
    let p0 = pb.length;
    await check('accueil');
    const s0 = await st();
    if (s0.prefs.autoRead !== false || s0.prefs.v !== 2) pb.push('autoRead pas passé à false');
    if (!s0.prog.stories.velo || s0.prog.stories.velo.best !== 2) pb.push('progrès v1 perdus');
    cell(p0);

    let sawIdee = false;
    // Joue un épisode ; trap : choisir d'abord un piège à la 1re question.
    async function play(name, opts) {
      opts = opts || {};
      if (await page.isVisible('#introGo')) { await check(name + '-avant'); await page.click('#introGo'); await page.waitForTimeout(200); }
      if (!(await page.isVisible('#nextPage'))) { pb.push(name + ' : pas d\'écran de lecture'); return; }
      await check(name + '-lecture', await below('#nextPage'));
      let maxLines = 0;
      for (let k = 0; k < 40 && await page.isVisible('#nextPage'); k++) {
        maxLines = Math.max(maxLines, await page.evaluate(() => { const t = document.querySelector('#readText'); return Math.round(t.getBoundingClientRect().height / parseFloat(getComputedStyle(t).lineHeight)); }));
        await page.click('#nextPage');
        await page.waitForTimeout(120);
      }
      if (maxLines > 4) pb.push(name + ' : ' + maxLines + ' lignes sur un écran');
      for (let k = 0; k < 10; k++) {
        const s = await st();
        if (s.vue !== 'quiz') break;
        if (opts.trap && s.qi === 0) {
          const trap = s.pieges.find(x => x.piege !== 'fausse') || s.pieges[0];
          await page.evaluate(t => { [...document.querySelectorAll('#choices .choix')].find(b => b.querySelector('.rep').textContent === t).click(); }, trap.t);
          await page.waitForTimeout(600);
          const shown = await page.evaluate(() => !document.querySelector('#explain').hidden && document.querySelector('#explainText').textContent);
          if (shown !== trap.explication) pb.push(name + ' : explication du piège absente');
          if (s.preuves.length && !(await page.locator('#storyText p.zone').count())) pb.push(name + ' : pas de passage en jaune');
          await check(name + '-piege');
        }
        await page.click('#choices .choix[data-ok="1"]');
        await page.waitForTimeout(300);
        if (s.preuves.length) {
          await page.locator('#storyText .ph', { hasText: s.preuves[0] }).first().click();
          await page.waitForTimeout(350);
          if (await page.locator('#storyText .ph.trouvee').count() !== 1) pb.push(name + ' : preuve refusée');
        } else {
          sawIdee = true;
          if (!(await page.isVisible('#nextQ')) || await page.isVisible('#prompt')) pb.push(name + ' : « L\'idée » demande une preuve');
        }
        await page.click('#nextQ');
        await page.waitForTimeout(250);
      }
      if (!(await page.isVisible('#done'))) pb.push(name + ' : pas d\'écran de fin');
      await check(name + '-fin');
    }
    const eps = await page.evaluate(() => window.__histoires.HISTOIRES.map(h => ({ id: h.id, niveau: h.niveau, eps: (h.episodes || [1]).length, idee: (h.episodes || [h]).some(e => (e.questions || []).some(q => q.type === 'idee-principale')) })));

    // Niveau 1 par « Ma séance du jour », avec un piège : 2 étoiles attendues.
    p0 = pb.length;
    await page.click('#todayBtn');
    await page.waitForTimeout(200);
    const k1 = (await st()).cle;
    await play('niveau1', { trap: true });
    const stars = await page.locator('#stars .on').count();
    if (stars !== 2) pb.push(stars + ' étoiles au lieu de 2');
    if (await page.evaluate(() => window.__dit) > 0) pb.push('la voix est partie toute seule');
    cell(p0);

    // Niveau 3 (beaucoup de pages).
    p0 = pb.length;
    const n3 = eps.find(x => x.niveau === 3);
    if (n3) { await page.evaluate(id => window.__histoires.ouvrir(id), n3.id); await page.waitForTimeout(200); await play('niveau3'); } else pb.push('pas de niveau 3');
    cell(p0);

    // Niveau 4 : épisode 1 en entier, puis l'écran « Dans l'épisode 1… » de l'épisode 2.
    p0 = pb.length;
    const n4 = eps.find(x => x.niveau === 4 && x.eps === 2);
    if (n4) {
      await page.evaluate(id => window.__histoires.ouvrir(id + '#1'), n4.id);
      await page.waitForTimeout(200);
      await play('niveau4');
      await page.evaluate(id => window.__histoires.ouvrir(id + '#2'), n4.id);
      await page.waitForTimeout(200);
      if (!(await page.isVisible('#introRappel'))) pb.push('épisode 2 sans rappel');
      await check('niveau4-episode2');
      await page.click('#intro [data-quit]');
    } else pb.push('pas de niveau 4 en 2 épisodes');
    cell(p0);

    // « L'idée » : sans preuve à toucher.
    p0 = pb.length;
    if (!sawIdee) {
      const x = eps.find(e => e.idee && e.eps === 1);
      if (x) { await page.evaluate(id => window.__histoires.ouvrir(id), x.id); await page.waitForTimeout(200); await play('idee'); }
      if (!sawIdee) pb.push('aucune question « L\'idée » jouée');
    }
    cell(p0);

    // Relecture à J+2.
    p0 = pb.length;
    if (await page.isVisible('#backBtn')) await page.click('#backBtn');
    await page.evaluate(() => { window.__histoires.decaler(2); });
    const plan = (await st()).plan;
    if (plan.mode !== 'relecture') pb.push('pas de relecture à J+2 (plan : ' + plan.cle + ')');
    else {
      await check('relecture-accueil');
      await page.click('#todayBtn');
      await page.waitForTimeout(200);
      if (await page.isVisible('#introGo')) pb.push('relecture : écran « Avant de lire » affiché');
      await play('relecture');
      const s = await st();
      if (!(s.prog.stories[plan.cle] || {}).revu) pb.push('relecture non enregistrée');
      if (plan.cle !== k1 && !s.prog.stories[k1].revoir) pb.push('relecture non programmée');
    }
    cell(p0);

    // Carnet du parent.
    p0 = pb.length;
    await page.evaluate(() => { document.querySelector('[data-reglages]').click(); });
    await page.click('#parentBtn');
    await page.waitForTimeout(200);
    await check('carnet');
    if (!(await page.locator('#parentTypes tr').count())) pb.push('carnet vide');
    cell(p0);

    // Hors ligne (seulement sur https, où le service worker s'installe).
    if (URL.startsWith('https') && w === 390 && h === 844) {
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.waitForTimeout(500);
      await context.setOffline(true);
      await page.reload();
      await page.waitForTimeout(500);
      if (!(await page.isVisible('#todayBtn'))) { failed = true; errors.push('ne marche pas hors ligne'); }
      await context.setOffline(false);
    }

    if (errors.length) failed = true;
    cells.push(errors.length ? '❌ ' + errors.join(' ; ').slice(0, 200) : '✅');
    lines.push(`| ${w}×${h} | ${cells.join(' | ')} |`);
    await context.close();
  }
  await browser.close();
  const report = lines.join('\n');
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '## Test téléphone (site en ligne)\n\n' + report + '\n');
  process.exit(failed ? 1 : 0);
})();
