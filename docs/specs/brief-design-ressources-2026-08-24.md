# Brief design — Refonte UX/UI de la section Ressources (2026-08-24)

> Destinataire : Claude design. Statut : brief de cadrage, à instruire puis à spécifier.
> Espace : app web `novalis`, route `/ressources` (Next.js, tout en client, Supabase).
> Fichier concerné : `app/ressources/page.tsx` (~520 lignes, un seul composant client).
> Contexte antérieur : `docs/specs/spec-refonte-ux-atelier-2026-08-23.md` (lot 2 « le vivier »).

---

## 1. Le produit, en trois phrases

L'app est l'**usine et le planning** d'une chaîne de production vidéo : un poème du domaine
public → une voix enregistrée → un fond (image ou métrage) + une bande son → un rendu → une
publication programmée. Les poèmes se travaillent **en dehors** de l'app ; l'app ne sert qu'à
fabriquer et à tenir le rythme (objectif affiché : un poème par jour).

Deux utilisateurs, pas de rôles, pas de public externe. Accès par allowlist.

Quatre onglets : **Accueil · Atelier · Ressources · Veille**.

## 2. Ce qu'est « Ressources » dans cette chaîne

`Ressources` est le **vivier de matière première** : métrages, images, bandes son, voix, vidéos
montées. C'est un stock **partagé** — un plan ressert pour plusieurs poèmes — et c'est la seule
page où l'on **classe** ce stock.

Deux gestes seulement s'y font :

1. **Déposer** (glisser-déposer ou bouton) — le type est deviné du MIME, rien n'est demandé.
2. **Classer** — reclasser le type, coudre à un poème (ou laisser au vivier commun), cocher des
   ambiances.

Le **choix** artistique, lui, ne se fait pas ici : il se fait au montage, dans l'Atelier. Ce
découplage est intentionnel et doit être préservé — mais il est aujourd'hui mal servi (cf. § 4.2).

### Le vocabulaire des ambiances (fermé, figé le 23/08 — ne pas y toucher)

`nuit` · `braise` · `orage` · `vertige` · `mélancolie` · `tendresse` · `âpre` · `solennel` · `vide`

Ce sont des mots d'**atmosphère**, pas de sujet — parce que le vivier mélange des images et des
nappes sonores, et que « mer » ne veut rien dire pour une bande son. Ils sont stockés dans
`assets.meta.ambiances` (jsonb), donc modifiables sans migration.

### Les types

`métrage` (broll) · `image` · `bande son` (music) · `voix` (audio) · `vidéo montée` (video).
Seuls les trois premiers alimentent le vivier partagé ; une voix appartient à un poème et se
dépose sur sa fiche, dans l'Atelier.

## 3. L'état actuel de la page, sans complaisance

Un **tableau à sept colonnes** (Nom · Type · Ambiances · Poème · Taille · Ajouté · actions),
triable par en-tête, précédé d'un empilement vertical de quatre barres :

1. champ de recherche unique (couvre nom, type, ambiance, titre de poème) + bouton « Déposer » ;
2. jetons des filtres actifs + « tout effacer » + compteur « n sur N » ;
3. facettes (types, puis ambiances, puis « vivier commun »), chacune avec son compte, **masquées
   si elles ne ramènent rien** ;
4. invite « → n ressources à classer par ambiance ».

Édition **en place** : cliquer une cellule Type / Ambiances / Poème l'ouvre en éditeur.

Le travail déjà fait est réel et ne doit pas être défait : le champ unique, les facettes
auto-masquées et les comptes évalués sans la facette elle-même sont des décisions justes,
documentées en commentaire dans le fichier. **Le problème n'est pas la logique de filtrage.**

## 4. Les problèmes à traiter

### 4.1 — Une bibliothèque d'images et de sons présentée comme un tableur

C'est le problème central. On demande à l'utilisateur de cocher « braise » ou « vide » sur une
ligne où figure `1756042931_0_IMG_4471.jpg` — **un nom de fichier, jamais l'image**. Une nappe
sonore ne s'écoute pas. Le seul moyen de voir ce qu'on classe est de télécharger le fichier dans
un nouvel onglet (bouton `↓`, qui ouvre une URL signée).

La conséquence est mesurable : `sansAmbiance` reste élevé, et l'app affiche une invite à classer
qu'on ne peut pas honorer sans quitter l'écran.

**Attendu :** que voir et écouter la matière soit le mode par défaut, pas un détour.

### 4.2 — Le vivier est filtrable là où l'on ne choisit pas, et muet là où l'on choisit

Dans l'Atelier (`app/atelier/page.tsx`, ~l. 931), le fond se choisit dans un
`<select>` listant les titres de fichiers. Pas de vignette, pas d'ambiance, pas d'écoute.

La spec du 23/08 prévoyait explicitement « texte du poème à gauche, vivier filtrable à droite,
vignettes d'images et nappes jouables en un clic ». C'est la moitié qui manque — et c'est la
moitié qui porte la valeur, puisque le choix image/musique est **la seule décision artistique
qui subsiste** une fois le rendu automatisé.

**Attendu :** un composant de vivier **réutilisable** — la page Ressources et le sélecteur de
l'Atelier doivent être deux vues du même objet, pas deux implémentations.

### 4.3 — L'édition en place ne se signale pas

Les cellules éditables sont des `<button>` sans affordance : une pastille grise pour le type, un
texte or pour le poème, « + ambiance » pour les ambiances. Rien ne distingue une valeur d'un
contrôle. Les `<select>` s'ouvrent en `autoFocus` et se referment `onBlur`, ce qui produit un
comportement inhabituel au clavier.

### 4.4 — Accessibilité et cibles tactiles

- Les actions de fin de ligne (`↓`, `✕`) sont des glyphes en `text-xs` : **cibles d'environ 12 px**
  alors que WCAG 2.5.8 en demande 24 et que le projet s'est donné 32 px via la classe `.btn-icone`
  déjà présente dans `globals.css`. Elle n'est pas utilisée ici.
- Le tri est porté par des `<button>` dans une grille CSS : la table n'a **aucune sémantique de
  tableau** (`role`, `aria-sort`, en-têtes associés). Un lecteur d'écran n'annonce ni colonne ni
  ordre.
- `✕` puis « confirmer ? » : la confirmation remplace le bouton, sans lien programmatique ni
  annonce. Le geste destructeur le moins réversible de la page est le moins signalé.
- Les erreurs s'affichent dans un encart **en haut de page**, potentiellement hors écran quand
  l'échec concerne la ligne 40.

### 4.5 — Le mobile n'est pas traité

Le tableau est posé dans un conteneur `minWidth: 900px` avec scroll horizontal. L'app est
consultée au téléphone (la spec l'exige). En l'état, classer une ressource au téléphone suppose
un défilement horizontal permanent.

### 4.6 — Le dépôt sous-informe

La file d'attente affiche `en attente / envoi… / envoyé ✓ / erreur` par fichier — pas de
progression, pas de poids, pas de total. Surtout : **le plafond de 50 Mo par fichier du plan
Supabase Free n'est annoncé nulle part avant l'échec**, alors que la spec du 23/08 le demandait
explicitement. Le quota global (1 Go, rien ne purge — c'est le vrai plafond du projet) est
réduit à une ligne de texte gris à côté du titre.

### 4.7 — Hiérarchie et densité

Quatre barres empilées avant la première ligne de contenu, toutes en `text-xs`, toutes en
pastilles arrondies de même forme : les jetons de filtres actifs, les facettes de types, les
facettes d'ambiances et le bouton « vivier commun » se ressemblent trait pour trait alors qu'ils
n'ont ni le même rôle ni la même durée de vie. Le titre `Ressources` en Cormorant 3xl est la
seule respiration typographique de la page.

## 5. Objectifs

Par ordre de priorité — s'ils entrent en conflit, c'est cet ordre qui tranche.

1. **Classer une ressource sans quitter l'écran ni ouvrir le fichier.** On doit voir l'image et
   entendre le son là où l'on coche l'ambiance.
2. **Rendre le vivier utilisable au moment du choix** (Atelier), via un composant partagé.
3. **Faire du dépôt un geste sans surprise** : ce qu'on peut déposer, ce qui reste de quota, ce
   qui a échoué et pourquoi.
4. **Atteindre le niveau d'accessibilité que le projet s'est déjà donné ailleurs** — pas au-delà,
   mais pas en dessous : le fichier `globals.css` documente des ratios mesurés et un seuil interne
   de 3,0 sur les surfaces. Cette page ne les respecte pas sur les cibles.
5. **Tenir au téléphone.**

## 6. Contraintes — non négociables

| Contrainte | Détail |
|---|---|
| **DA inchangée** | Palette claire : `--bg #f7f3ec` · `--panel #fff` · `--ink #1a1512` · `--ink-dim #5f574a` · `--gold #7d6021` · `--gold-light #c9a45c` (aplats uniquement, jamais de texte) · `--line #94866a` · `--danger #a8322f`. Aucune couleur nouvelle. |
| **Typo** | Cormorant Garamond (`.font-serif2`) pour les titres, Inter pour le reste. Aucune fonte nouvelle. |
| **Aucune dépendance ajoutée** | Pas de librairie de table, de lightbox, de lecteur audio, d'icônes. React + Tailwind v4 + CSS variables, comme le reste du projet. |
| **Contraste** | Seuils que le projet s'applique : 4,5 sur le texte, **3,0 sur les limites d'interface**. `--gold-light` ne porte jamais de texte. |
| **Composants existants** | Réutiliser `.card`, `.btn`, `.btn2`, `.btn-icone`, `.pastille`, `.label` avant d'en inventer. |
| **Tout en client** | Pas de serveur, pas d'API payante, coût visé 0 €. Les URL de fichiers sont des **URL signées à 1 h** (`createSignedUrl`) — toute vignette ou lecture doit composer avec ça (buckets privés `images`, `audios`, `videos`). |
| **Base** | `assets.poem_id` est nullable, `assets.meta` est un jsonb `NOT NULL DEFAULT '{}'`. **Aucune migration ne doit être nécessaire.** Toute proposition qui en demande une est un [HARD-STOP] à signaler, pas à implémenter. |
| **Volumétrie** | Une vingtaine de fichiers aujourd'hui, quelques centaines à terme. Ne pas concevoir pour 10 000 lignes. |

## 7. Livrables attendus

1. **Un diagnostic écrit** : ce qui est repris, ce qui est jeté, et pourquoi — en confirmant ou
   en infirmant les problèmes du § 4. Un désaccord argumenté est plus utile qu'un accord.
2. **Le parti pris d'affichage** : grille de vignettes, table enrichie, ou hybride avec bascule.
   Trancher, ne pas offrir les trois.
3. **Les maquettes** des états : plein · vide (aucun fichier) · filtré à zéro · dépôt en cours ·
   erreur de dépôt · confirmation de suppression · quota proche du plafond.
4. **Le composant de vivier partagé** : son API (props, filtres, mode sélection vs mode gestion)
   et son rendu dans les deux contextes — page Ressources et sélecteur de l'Atelier.
5. **Le mobile**, au moins pour les états plein et dépôt.
6. **Une note d'accessibilité** : sémantique retenue pour la liste/table, ordre de tabulation,
   annonces `aria-live`, cibles ≥ 32 px, parcours clavier de l'édition en place.

## 8. Critères d'acceptation

- [ ] Une image se prévisualise et une bande son s'écoute **sans quitter la page** et sans
      téléchargement manuel.
- [ ] Cocher une ambiance se fait en voyant ou en entendant la ressource concernée.
- [ ] Le sélecteur de fond et de musique de l'Atelier n'est plus un `<select>` de noms de fichiers,
      et partage son code avec la page Ressources.
- [ ] Toutes les cibles interactives font au moins 32 × 32 px.
- [ ] La liste est navigable au clavier de bout en bout ; l'ordre de tri est annoncé.
- [ ] Une erreur concernant une ligne s'affiche **près de cette ligne**.
- [ ] La suppression demande une confirmation qui ne peut pas être déclenchée par un double-clic
      involontaire.
- [ ] Le plafond de 50 Mo par fichier est annoncé **avant** le dépôt ; un fichier trop lourd est
      refusé avec un message qui dit le poids et la limite.
- [ ] Le quota (n Mo sur 1 Go) est lisible d'un coup d'œil et change d'aspect près du plafond.
- [ ] La page est utilisable en portrait sur un écran de 390 px sans scroll horizontal.
- [ ] Le champ de recherche unique et les facettes auto-masquées **sont conservés** dans leur
      logique actuelle (comptes évalués sans la facette elle-même inclus).
- [ ] Aucune couleur, fonte ou dépendance nouvelle. `npm run build` passe.

## 9. Hors périmètre — explicitement

- Le **choix automatique** de l'image ou de la musique (appariement sémantique, tirage semé).
  Décision produit tranchée le 23/08 : on automatise ce qui est mécanique et vérifiable, on garde
  à la main ce qui relève du jugement.
- Toute **migration de schéma**, y compris passer les ambiances de `meta` à une vraie colonne.
- Le **vocabulaire des ambiances** lui-même : neuf mots, figés, non négociables dans ce lot.
- La **purge** ou l'archivage automatique du stockage.
- Les autres onglets, sauf le point de contact décrit au § 4.2.
- Le pipeline de rendu (`pipeline/render.py`) et la DA des vidéos, qui est sombre et n'a rien à
  voir avec celle de l'app.

## 10. À trancher — questions ouvertes pour le designer

1. **Grille ou table ?** La table sert le classement en masse (comparer, trier, repérer les trous) ;
   la grille sert la reconnaissance visuelle. Une bascule règle-t-elle vraiment le problème, ou
   double-t-elle la surface à maintenir pour un vivier de 20 fichiers ?
2. **Où vit la prévisualisation ?** Vignette permanente dans la ligne, survol, panneau latéral,
   ou modale ? Contrainte : URL signées à 1 h, buckets privés, aucune dépendance.
3. **Les bandes son n'ont pas de vignette.** Forme d'onde (coûteuse, sans librairie), pastille
   d'ambiance colorée, ou simple bouton de lecture ? Le vivier mélange les deux natures dans une
   même liste — faut-il les séparer ?
4. **Faut-il un mode « classer »** — une file qui présente une par une les ressources sans
   ambiance, plein écran — plutôt qu'un lien qui filtre la liste ?
5. **La colonne « Poème »** a-t-elle encore sa place au premier plan, maintenant que le vivier
   commun est la norme et le lien l'exception ?

---

## Handoff

Une fois le parti pris arrêté, la sortie attendue est une **spec datée dans `docs/specs/`**, au
format des specs existantes du projet (intention · périmètre · règles & décisions avec le
*pourquoi* · données & sécurité · cas limites · critères d'acceptation · lots), prête pour
`corrige-et-livre`.

---

# Addendum — retour de Claude design et arbitrages (24/08, soir)

Planche reçue : parti pris **liste vignettée + fiche latérale**, les cinq questions du § 10
tranchées, les sept états maquettés, l'API du composant `Vivier` et la note d'a11y. Le § 8 est
tenu, y compris la conservation du champ unique et des facettes auto-masquées. Aucun HARD-STOP :
tout tient dans `meta` jsonb et `createSignedUrls`.

**Les deux désaccords de Design sont acceptés** (§ 4.3 : l'édition sort de la ligne plutôt que
d'être mieux signalée — § 4.6 : contrôle pré-vol au lieu d'une barre de progression). Ils
corrigent le brief, ils ne le contournent pas.

## A. Palette — le § 6 est amendé

Le § 6 disait « aucune couleur nouvelle ». **Nicolas a tranché le contraire, en connaissance de
cause : `2c bleu d'encre #2f3b52` est adopté.**

- *Pourquoi* : `--gold` portait quatre rôles à la fois — libellés, jetons actifs, liens de poème,
  bouton Déposer. Quand tout est or, rien ne ressort. Le bleu prend **tout ce qui est
  interactif** (sélection, lecture, ambiances, filtres actifs, liens) ; l'or redevient un accent
  d'apparat : titres, libellés, dépôt.
- Contraste vérifié : **10,2 contre `--bg #f7f3ec`**, 11,2 sur blanc. Loin au-dessus des seuils
  du projet.
- Forme : une variable de plus dans `globals.css` (`--nuit`), aucun hexadécimal en dur dans les
  composants. Réversible en une ligne.
- **Contrepartie assumée** : la teinte descend sur **les quatre onglets**, pas seulement
  Ressources — sinon la page détonne, comme Design l'a signalé. Ce n'est donc plus un réglage
  local. Ce passage peut être un lot à part, mais il ne peut pas être oublié.
- La **DA des vidéos est inchangée** : `#0e0c0a` / `#161311` / `#ece4d4` / `#c9a45c`, dans
  `pipeline/render.py`. Rien de ce qui précède ne la touche.

## B. Deux réserves à lever dans la spec

1. **Le coût des vignettes.** La proposition affiche les **fichiers originaux** en
   `object-fit: cover` sur 76 × 52, sans miniature générée. État réel de la base au 24/08 :
   **22 fichiers, 107 Mo, et aucune image** — 8 métrages (5 Mo de moyenne), 6 nappes,
   5 vidéos montées, 3 voix. La vignette qui compte aujourd'hui est donc la **première image
   d'une vidéo**, pas un `<img>` : les maquettes sont peuplées d'images qui n'existent pas encore.
   Le jour où elles arrivent, 24 lignes × 2,5 Mo = 60 Mo par chargement, contre **5 Go d'egress
   par mois** sur le plan Free — soit ~80 ouvertures de page. **À chiffrer et à trancher dans la
   spec** : plafonner le nombre de vignettes chargées, ne les charger qu'à l'entrée dans le
   viewport, ou accepter le coût tant que le vivier reste petit.

2. **`meta.duree` écrit à la première lecture.** Écriture implicite sur `assets` déclenchée par
   un simple affichage : vérifier la policy UPDATE et décider si elle est souhaitable.

## C. Suite

`docs/specs/spec-vivier-visible-2026-08-24.md`, trois lots — 1) le composant `Vivier` et la liste
vignettée · 2) le dépôt pré-vol et le quota · 3) le panneau de l'Atelier. Le passage des quatre
onglets au bleu d'encre est à traiter comme un lot 0 ou un lot 4, mais à traiter.
