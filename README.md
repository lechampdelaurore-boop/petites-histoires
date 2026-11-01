# Petites histoires

De courtes histoires lues à voix haute, avec des questions pour chercher les indices cachés dans le texte.

- **Jouer en ligne :** https://lechampdelaurore-boop.github.io/petites-histoires/
- Fait partie des [applis de Marc](https://lechampdelaurore-boop.github.io/).

## L'appli

- 10 histoires originales, courtes (8 à 10 phrases), en grosses lettres, un paragraphe par écran.
- Chaque histoire est lue à voix haute (voix de l'appareil), la phrase lue est surlignée. On peut toucher une phrase pour la réécouter, autant de fois qu'on veut. Option « Voix plus lente ».
- Puis 3 questions « entre les lignes » (pourquoi, comment se sent…, que veut dire…). Après la bonne réponse, il faut **toucher la phrase de l'histoire qui le prouve**.
- Aucun chrono. Une erreur n'est jamais sanctionnée : la carte secoue la tête, le téléphone vibre, puis le passage utile est surligné en jaune ; après une deuxième erreur sur la preuve, la bonne phrase brille. La question finit toujours par une réussite.
- Récompenses : étoiles qui jaillissent, un personnage kawaii à chaque preuve trouvée, une étoile par question réussie du premier coup (le meilleur score est gardé, il ne baisse jamais), un trophée 🏆 pour trois étoiles, et un badge « séance du jour » avec la semaine en étoiles. Tout se désactive avec l'option « Sons et animations ».
- « Carnet du parent » (en bas de l'accueil) : pour chaque histoire, combien de fois elle a été lue, le meilleur score, et la dernière fois les réponses et preuves trouvées du premier coup.
- S'installe sur l'écran d'accueil d'un téléphone ou d'une tablette et fonctionne hors ligne (la voix dépend de l'appareil).

Les progrès restent dans le navigateur de l'appareil (clés `marc.histoires.*`) : aucun compte, et rien n'est envoyé sur internet.

## Ajouter une histoire

Les histoires sont dans `index.html`, entre `HISTOIRES-DEBUT` et `HISTOIRES-FIN`. Pour chaque question, la première réponse est la bonne (l'ordre est mélangé à l'écran), et `preuve` liste des morceaux de phrase : toucher une phrase qui contient un de ces morceaux prouve la réponse. Vérifier ensuite avec `node tests/histoires.cjs`.

## Fichiers

- `index.html` : toute l'appli (HTML, CSS et JavaScript, sans bibliothèque), histoires et personnages compris.
- `sw.js` et `manifest.webmanifest` : mode hors ligne et installation. Après une modification, changer la valeur de `CACHE` dans `sw.js`.
- `icons/` : icône de l'appli ; `fonts/` : polices Fredoka et Nunito (licence SIL Open Font License, voir les fichiers `OFL-*.txt`).
- `tests/histoires.cjs` : vérifie les histoires (chaque preuve désigne bien une seule phrase).
- `tests/telephone.cjs` et `.github/workflows/test-telephone.yml` : après chaque mise en ligne, GitHub ouvre le site publié dans Chrome au format téléphone (7 tailles d'écran), lit une histoire entière avec une erreur volontaire, et vérifie qu'il n'y a ni débordement, ni bouton caché, ni erreur dans la console. Résultat et captures dans l'onglet Actions. Lancement local : `npm install --no-save playwright && node tests/telephone.cjs`.
