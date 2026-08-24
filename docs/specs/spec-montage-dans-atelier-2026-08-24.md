# Spec — monter la vidéo depuis l'Atelier : plan de fond, musique, aperçu

- Date : 2026-08-24
- Demandeur / décideur : Nicolas
- Statut : à valider

## Le besoin en trois phrases

L'Atelier sert au **montage** : c'est là qu'on doit assembler la voix, le plan de fond et la
musique, en un seul geste. Aujourd'hui le fond et la musique se choisissent ailleurs, en
*rattachant* un fichier au poème depuis Ressources — un détour que rien ne signale et que le
sélecteur « Image de fond » de la fiche rend trompeur, puisqu'il reste vide quand du métrage
existe. Et comme le fond de secours généré a été supprimé, **toute vidéo exige désormais un
plan réel** : autant le demander à l'endroit où l'on monte.

## Hors périmètre

- **Le montage multi-plans.** `build_broll` sait enchaîner plusieurs clips par coupes de 3,2 s ;
  on n'expose **qu'un seul plan**, rejoué en boucle. Décision de Nicolas, 24/08.
- **La boucle sans couture.** Le raccord fin → début restera une coupe franche en v1. La boucle
  en miroir est écartée : elle inverserait la physique (le sable du sablier remonterait, la
  fumée redescendrait). Un fondu enchaîné serait la bonne réponse — il est noté en question
  ouverte, pas dans ce lot.
- **La boucle « valider / refaire » sur un vrai rendu.** L'aperçu est une approximation, pas une
  étape d'approbation qui relance l'usine.
- **Les styles `musee` et `galerie`.** Ils continuent de fonctionner sur `image_asset_id` ;
  seul `cinetique` reçoit le sélecteur de plan.
- **Le réglage du cadrage par poème** (aujourd'hui heuristique à 62 %). Inchangé.
- **La génération de la banque de musique.** Nicolas téléverse lui-même les nappes produites par
  `make_music.py`.

## Parcours cible

Fiche poème, bloc « Générer la vidéo », visible dès que le texte et la voix existent.

1. **Voix** — inchangé.
2. **Plan de fond** — `<select>` intitulé **« Plan de fond »** (et non plus « Image de fond »).
   Liste tous les assets `kind = 'broll'`, **qu'ils soient liés à un poème ou non** : le vivier
   est commun par construction.
   Première entrée : `— choisir un plan —`, valeur vide.

   **Écart assumé à l'implémentation (24/08)** : la définition s'affiche **sous le sélecteur,
   après le choix**, et non dans chaque `<option>`. Aucune colonne ne stocke les dimensions,
   et les lire pour toutes les entrées obligerait à charger les métadonnées des huit vidéos à
   l'ouverture de chaque fiche. On les lit à la volée sur le seul plan choisi : l'avertissement
   arrive au moment où il sert, pour un coût nul.
   ⚠ Les plans **horizontaux sont signalés** : « horizontal — recadré, 31 % de la largeur
   conservée ». On ne les interdit pas, on dit ce qu'ils coûtent.
3. **Musique** — `<select>` intitulé **« Musique »**. Première entrée `— nappe générée —`
   (valeur vide, comportement actuel), puis tous les assets `kind = 'music'`.
4. **Aperçu** — bouton « Aperçu ». Ouvre un cadre 9:16 qui joue :
   le plan de fond en boucle, muet, sous un filtre CSS approchant l'étalonnage ;
   la voix et la musique ensemble, la musique atténuée pour refléter `MUSIQUE_LUFS = -21` ;
   les premiers vers en Cormorant Garamond par-dessus, dans la DA des vidéos.
   **Libellé obligatoire sous le cadre** : « Aperçu approché — le rendu final étalonne l'image,
   cale les mots sur la voix et ajoute les coupes. » Sans cette phrase, l'aperçu ment.
5. **Direction artistique** — inchangé (`cinetique` par défaut).
6. **Générer la vidéo** — **désactivé tant qu'aucun plan n'est choisi**, avec la raison affichée.
7. Une fois le rendu terminé, la vidéo produite est **jouable dans la fiche** (`<video controls>`
   sur une URL signée). C'est le seul aperçu fidèle, et il ne coûte rien puisque le fichier existe.

## Données et écritures

**Migration nécessaire : oui.**

```sql
alter table public.render_jobs
  add column broll_asset_id uuid references public.assets(id) on delete set null,
  add column music_asset_id uuid references public.assets(id) on delete set null;
```

`ON DELETE SET NULL`, comme `image_asset_id` et comme `video_asset_id` depuis `20260824d` :
un job reste un fait historique même si sa source a été effacée.

**Pourquoi sur le job et pas par rattachement au poème** (la question laissée ouverte) :
écrire `assets.poem_id` à la sélection rendrait le clip indisponible pour les autres poèmes,
alors que le vivier partagé a été créé exprès pour qu'un même plan resserve. Le choix appartient
au **rendu**, pas au fichier. Conséquence assumée : deux rendus du même poème peuvent avoir des
fonds différents, et c'est souhaitable — c'est ce qui permet d'essayer.

**Tables touchées** : `render_jobs` (deux colonnes), `assets` (lecture seule), `poems` (aucune).
**Droits** : inchangés, `is_member()` couvre déjà `render_jobs` en `ALL`.

**`lib/etapes.ts` — changement de règle.** `etapeCalculee` exige aujourd'hui un `image` ou un
`broll` **lié au poème** pour sortir de « à préparer ». Cette condition **disparaît** : le fond
n'est plus une propriété du poème mais un choix du rendu. Un poème est « prêt à rendre » dès
qu'il a un texte et une voix. `manqueDe` perd sa branche « aucun fond ».
⚠ L'invariant du 23/08 — *pas de vidéo sans fond réel* — **est conservé**, mais déplacé : il est
désormais tenu par le bouton désactivé et par le contrôle de `render.py`, c'est-à-dire au moment
où la décision se prend, et non trois écrans plus tôt.

**`pipeline/render.py`** :
- `job["broll_asset_id"]` devient la source du métrage. **Repli** sur la recherche actuelle par
  `poem_id` si la colonne est nulle, pour que les jobs déjà en file continuent de passer.
- même schéma pour `job["music_asset_id"]`, avec repli sur le `kind='music'` lié au poème, puis
  sur la nappe générée.
- `build_broll` est appelé avec **une liste d'un seul élément** : aucun changement de code, il
  gère déjà ce cas en avançant une tête de lecture par segments contigus et en rebouclant.

## Cas limites

1. **Aucun plan dans le vivier.** Le sélecteur affiche `— aucun plan disponible —`, le bouton
   « Générer » reste désactivé, et un lien mène à Ressources. On n'invente pas de fond : c'est
   la décision du 23/08, elle tient.
2. **Le plan choisi est supprimé de Ressources entre la sélection et le rendu.** La colonne passe
   à `NULL` (`ON DELETE SET NULL`), `render.py` ne trouve plus de fond et **échoue franchement**
   avec le message existant, visible dans l'historique de la fiche. Pas de rendu muet.
3. **Le plan est plus court que le poème.** C'est le cas normal (clips de 3 à 10 s, poèmes de 1 à
   2 min) : `build_broll` reboucle. Le raccord se voit une fois par tour — accepté en v1, cf.
   hors périmètre.
4. **Deux rendus lancés en même temps sur le même poème.** Rien ne l'empêche aujourd'hui et rien
   ne l'empêchera : ce sont deux lignes de `render_jobs` indépendantes, `MAX_JOBS = 2` les traite
   à la suite. Chacune produit son fichier. C'est déjà arrivé le 23/08 (deux exports des
   *Conquérants*) — le remède est la purge, pas un verrou.
5. **La musique choisie est plus courte que la voix.** ~~À vérifier.~~ Vérifié en lisant
   `render.py` : le morceau est chargé avec `-stream_loop -1 -t <durée>`, donc **rebouclé
   autant que nécessaire puis coupé net**. Rien à faire. La coupe finale est masquée par le
   fondu de sortie de 1,2 s.
6. **L'aperçu sur un navigateur qui refuse la lecture automatique.** Deux `<audio>` et un
   `<video>` démarrés ensemble par un clic utilisateur : le geste satisfait la politique
   d'autoplay. Si un flux échoue quand même, on l'affiche au lieu de laisser un cadre muet.

## Critères d'acceptation

- [ ] La fiche d'un poème ayant texte + voix mais **aucun fond lié** affiche le bloc « Générer la
      vidéo » (avant : elle affichait « il manque un fond »).
- [ ] Le sélecteur « Plan de fond » liste les 8 clips du vivier, **aucun n'étant lié à un poème**.
- [ ] Choisir un clip `1280×720` affiche sous le sélecteur « horizontal — recadré en 9:16,
      31 % de la largeur conservée », et un clip `720×1280` affiche « vertical ».
- [ ] Le bouton « Générer la vidéo » est désactivé tant qu'aucun plan n'est choisi, et la raison
      est écrite à l'écran.
- [ ] Le sélecteur « Musique » propose `— nappe générée —` en premier, puis les assets `music`.
- [ ] L'aperçu joue simultanément le plan, la voix et la musique, et porte la phrase
      « Aperçu approché… ».
- [ ] Un rendu lancé depuis ce bloc produit une vidéo dont le fond est **le plan choisi**, même
      s'il n'est lié à aucun poème.
- [ ] Un job créé **avant** cette migration (colonnes nulles) passe toujours, en retombant sur le
      métrage lié au poème.
- [ ] La vidéo produite est lisible depuis la fiche, sans téléchargement.
- [ ] `npm run build` vert sur le Mac.

## Questions restées ouvertes

- **Fondu enchaîné au raccord de boucle** — améliore nettement un plan court rejoué vingt fois,
  mais c'est du travail `ffmpeg` séparé. À décider par Nicolas, lot suivant.
- **Faut-il conserver `image_asset_id` dans l'écran ?** La spec le retire de `cinetique` mais le
  garde en base pour `musee` et `galerie`. Si ces deux styles ne servent plus, un lot de ménage
  les retirerait — décision de Nicolas, pas de l'implémentation.
- **La banque de musique** doit être téléversée avant que le sélecteur ait un intérêt. Nicolas
  s'en charge ; à faire avant la recette.
