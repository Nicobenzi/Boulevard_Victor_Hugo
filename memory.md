# memory.md — mémoire du projet

Dernière consolidation : **24 août 2026**, fin d'après-midi. Consolidation précédente : 23/08.
Structure : §1 le projet · §2 la DA · §3 le montage · §4 les décisions et leur *pourquoi* ·
§5 l'infrastructure et les pièges · §6 l'état et ce qui reste.

Lire ce fichier au début de chaque session. Le mettre à jour après toute décision structurante.
**Quand une décision en remplace une autre, réécrire l'ancienne — ne pas empiler la correction
en dessous.** La consolidation du 24/08 a dû démêler six contradictions nées de cette habitude.

> **Rappel d'ouverture** — ce projet n'est **pas** Coprovia, malgré les plugins `coprovia-*`
> et l'adresse mail de Nicolas. Voir l'encadré en tête de `CLAUDE.md`. Et si les outils ne
> voient pas le dossier, le demander (`request_cowork_directory`) plutôt que de supposer que le
> projet est vide : la base de connaissances Claude.ai l'est, le dossier ne l'est pas.

---

## 1. Le projet

**Boulevard Victor Hugo** — poèmes du domaine public, lus à voix haute, montés en vidéo verticale
(1080×1920) pour Instagram / TikTok / YouTube. Signature de fin : « chaque jour, un poème ».

- **Charley**, le frère de Nicolas : la voix (choix des poèmes, enregistrement des lectures).
  Il a un compte sur l'app **depuis le 24/08** — on peut donc concevoir pour deux, ce qu'a
  inauguré le fil de notes (§ 4). Il tient par ailleurs `gaya__scienza` depuis 2021 (594
  publications de textes savants), ce qui a nourri la discussion sur les captions (§ 4).
- **Nicolas** : production, montage, tech, publication.
- Projet passion à deux, coût visé = 0 €. Priorité : **régularité de publication > perfection
  technique**. C'est l'arbitrage qui tranche la plupart des débats de ce fichier.

**Droits** : ne monter que des auteurs morts depuis plus de 70 ans (Baudelaire, Heredia, Rimbaud,
Verlaine, Hugo, Apollinaire…). Prévert, Aragon, Char = encore protégés, à éviter.
Idem pour les tableaux : domaine public (Wikimedia Commons), et attention aux *enregistrements*
musicaux modernes d'œuvres classiques, qui restent protégés → d'où la musique composée maison.

---

## 2. Direction artistique

**Deux palettes, à ne jamais confondre.**

**La DA des vidéos est figée** : fond `#0e0c0a`, panel `#161311`, crème `#ece4d4`, or `#c9a45c`.
Titres et vers en **Cormorant Garamond**. Ne pas introduire d'autres couleurs ni polices.
Contrastes conformes AA et AAA. **La palette n'est pas le problème** — si une vidéo paraît terne,
chercher du côté du cadrage et du rythme, pas de la couleur.

**L'app est en clair, un seul thème, pas de bascule** (`app/globals.css`).
Le choix de fond : l'app est un **outil** ouvert en plein jour, la vidéo est le **produit**.
Rien n'oblige l'atelier à ressembler à ce qu'on y fabrique.

Palette courante et ratios mesurés (24/08) :

| variable | valeur | contraste |
|---|---|---|
| `--bg` | `#f7f3ec` | page |
| `--panel` | `#ffffff` | cartes, champs |
| `--ink` | `#1a1512` | 18,1 sur carte |
| `--ink-dim` | `#5f574a` | 6,4 sur page |
| `--gold` | `#7d6021` | 5,3 page / 5,9 carte |
| `--gold-light` | `#c9a45c` | **aplats seulement**, jamais du texte |
| `--line` | `#94866a` | **3,2 page / 3,6 carte** |
| `--danger` | `#a8322f` | (l'ancien `#d65454` tombait à 3,0) |

Plus aucun hexadécimal en dur dans les composants — tout passe par les variables.

> ⚠ **La leçon de contraste, en deux temps, parce qu'elle a été apprise deux fois.**
> **23/08** — « on voit rien » n'était pas un problème de texte (AAA partout) mais de
> **séparation des surfaces** : carte contre page à 1,06, bordure à 1,27, là où une limite
> d'interface demande **3,0**. On lisait chaque mot sans voir la forme de rien.
> **24/08** — la règle avait été écrite mais pas appliquée : `--line` valait encore `#9c8e72`,
> soit **2,91** contre la page, sous le seuil que le projet s'était donné. Densifié à `#94866a`.
> Même jour, même famille de défaut : les pastilles de plateforme posaient la couleur de marque
> **en texte** sur son propre aplat à 20 % — TikTok à **1,77** pour un seuil de 4,5. La couleur
> est devenue un **point**, le texte est passé en `--ink`.
> **Deux règles à retenir** : *vérifier le contraste des bordures et des surfaces, pas seulement
> celui du texte* ; et *une couleur de marque informe, elle n'a pas à être lue*.

**Styles implémentés dans `render.py`** (valeur de `render_jobs.style`) :

- **`cinetique`** *(style à privilégier)* — les mots apparaissent un à un sur la voix, **un seul
  accent or par vers** (le mot le plus long), et l'image **alterne** avec de la typographie sur
  noir, par mouvements de 3-4 vers. L'image n'est jamais en plan large : on entre à ~1,55× et la
  fenêtre est calée sur le **bas** de l'image, là où sont les figures.
  C'est le **seul style qui lit du métrage** — voir l'avertissement ci-dessous.
- **`musee`** *(défaut historique)* — image plein écran, Ken Burns lent (1 → 1,085) ; travelling
  horizontal si l'image est en paysage. Dégradé sombre en bas pour la lisibilité.
- **`galerie`** — image encadrée d'un filet doré sur fond noir, vers sous le cadre.
  À utiliser quand l'image est en basse résolution (elle reste nette en petit).

> ⚠ **Le style détermine le type de fond accepté.** `render.py` n'ouvre le métrage que sous
> `if style == "cinetique"` ; `musee` et `galerie` veulent une **image fixe** (`image_asset_id`).
> Composer « Musée + un plan de métrage » produit un job qui part en file et **échoue deux heures
> plus tard**. L'écran l'interdit depuis le 24/08 (bouton désactivé, raison affichée) — ne pas
> retirer ce contrôle.

> ⚠ **Tout rendu exige un fond fourni.** Il n'y a **plus de fond de secours** : `painterly_bg` a
> été supprimé le 23/08 (§ 6). Sans fond, le job échoue volontairement.
> « Nocturne » (typographie seule sur dégradé) figurait dans d'anciennes notes mais n'a **jamais**
> été implémenté ; `cinetique` couvre le besoin. Ne pas le réintroduire sans raison.

**Pourquoi le cinétique** (veille du 23/08) : un plan fixe est une cible de scroll — sous 50 % de
rétention à 3 s, le reste ne compte pas. L'ancien Ken Burns faisait 0,15 %/s, soit une image fixe
à l'œil. Et les tableaux ne sont pas tristes : c'était le **cadrage large** qui l'était. Le même
Poussin recadré sur les figures n'a plus rien à voir.

**Ce que fait la concurrence** : les comptes français qui marchent sont des visages
(@violenteviande, >180 k) ou du texte posé (@poesiefrancaise, ~14 k). Presque personne ne fait
« image + voix off » → notre format est **différenciant**, il ne faut pas l'abandonner, seulement
lui donner de l'énergie. Références classées dans l'onglet Veille.
Veille 2026 : la typographie animée est devenue un style à part entière (« le texte est le
personnage principal »), et le grain argentique revient contre le rendu numérique trop propre.

**Structure d'une vidéo** : hook direct sur le premier vers (le titre lu est coupé), cartouche
titre + auteur en fondu à 1 s, vers sous-titrés au rythme de la voix, carte signature à la fin.

---

## 3. Règles de montage (dures, issues de l'expérience)

- Les sous-titres affichent le **texte canonique** (`poems.body`, un vers par ligne), jamais la
  transcription brute — le public de poésie repère les écarts. La transcription (faster-whisper)
  sert à **caler** les vers (alignement difflib) et, en cinétique, à donner les attaques mot à mot.
  Si l'alignement est trop pauvre, le générateur retombe sur une répartition proportionnelle à la
  longueur des mots — suffisant, vérifié.
- **Texte de référence** : collationner sur une édition de référence, apostrophes typographiques
  `’`. Ne pas se fier à un texte recopié. *État vérifié le 24/08 : le `poems.body` de* Bacchanale
  *est conforme à l'édition Lemerre 1893 — les deux virgules parasites signalées le 23/08 étaient
  dans le montage fait à la main, pas en base.*
  ⚠ Wikisource ne répond pas aux requêtes automatisées (réponses vides) ; passer par une source
  secondaire et le dire.
- Césure des vers longs à l'hémistiche (2 lignes max), gérée par `cesure()`.
- Voix : `highpass=70` + `afftdn` + `loudnorm I=-14:TP=-1.5` (norme plateformes).
- **Un seul export**, avec musique. La voix seule ne servait qu'au flux « ajouter un son » de
  TikTok, jamais utilisé — et elle doublait le stockage, qui est le vrai plafond.
- **Niveaux audio** : voix à −14,2 LUFS, nappe générée à −29,6 → 15 LU d'écart, inaudible. La
  musique est remontée à `MUSIQUE_LUFS = -21` avant mixage, puis le mix entier renormalisé à
  −14 LUFS / −1,5 dBTP. **Ne pas remplacer ce dernier `loudnorm` par un `alimiter`** : celui-ci
  ne borne que la crête d'échantillon, la crête **réelle** montait à 0,0 dBTP (écrêtage
  inter-échantillon à l'encodage AAC).
- Une musique plus courte que la voix est **rebouclée** (`-stream_loop -1 -t <durée>`) puis coupée
  net ; la coupe est masquée par le fondu de sortie de 1,2 s. Rien à faire.
- **Étalonnage du métrage** — constante `ETALONNAGE` dans `render.py`, **un seul endroit à
  régler**. L'ancien réglage était homéopathique : un feu restait orange saturé et aucun plan
  n'avait l'air d'appartenir au même film. La chaîne actuelle — désaturation forte, virage vers la
  palette, flou, vignette, grain — ramène n'importe quelle source dans la DA. Mesuré sur aplats :
  braises `#ff7a1a → #ba8d51`, brouillard `#bfbfbf → #c8be9a`, mer `#2a9dd6 → #6f836f`.
  ⚠ **`brightness` à −0,03 et pas plus bas** : à −0,12 les zones sombres tombaient à `#000000` et
  le fond perdait tout mouvement. Assombrir sous le texte est le travail de `make_grad_overlay`,
  pas de l'étalonnage.
  **Conséquence pratique : le choix du plan devient secondaire.** On prend celui dont le
  *mouvement* plaît — même leçon que le Poussin recadré.
- **Métrage : privilégier le vertical.** Un 1280×720 recadré en 9:16 ne garde que **31 %** de sa
  largeur et s'agrandit 2,7×. Sur les 8 premiers clips, **2 seulement sont verticaux**
  (braise-bougie, melancolie-sablier) — le réflexe « je prends ce qui me plaît » ramène surtout du
  paysage. L'app affiche la définition sous le sélecteur dès qu'un plan est choisi.
- **Génération vidéo IA en local : écartée.** Sur M1 Max 64 Go, Wan 2.2 en GGUF met **82 min pour
  2 s**. Les services en ligne à palier gratuit sont écartés pour une autre raison : filigrane
  **et usage commercial interdit**. → métrage filmé libre (Pexels, Pixabay, Coverr, **Mixkit**,
  Videezy) + étalonnage.
- **Musique** : 100 % générée, aucun sample → aucun risque de réclamation. `pipeline/make_music.py`
  produit la banque (5 tonalités + un pouls). Aucune fondamentale sous ~65 Hz : en dessous, un
  haut-parleur de téléphone ne restitue rien.
- Durées : ~1 min = idéal Reels/TikTok. Au-delà de 1 min 30, prévoir YouTube ou 2 parties.
- ⚠ **Les enregistrements sortent du dictaphone en `Boulevard Victor Hugo N.m4a`, et le N ne dit
  rien du poème.** Le 24/08 les deux voix ont été rattachées au mauvais poème à l'upload.
  **Toujours vérifier par la durée avant de lier**, jamais par le nom : un texte de 14 vers calé
  sur 110 s de voix donne des sous-titres inutilisables, et **l'alignement difflib ne proteste
  pas** — il retombe sur une répartition proportionnelle et sort une vidéo *plausible mais fausse*.
  Renommer à l'export serait le vrai remède.

---

## 4. Décisions d'architecture

### Le socle

- App volontairement simple : **tout en client components** + supabase-js direct, pas de couche
  d'abstraction (skill `karpathy`). Pas de route API sauf nécessité réelle.
- **Usine de rendu = GitHub Actions** — ffmpeg + Whisper sont trop lourds pour Vercel.
  Serveur dédié (~5 €/mois) écarté. Actions n'est gratuit que sur dépôt **public**, d'où la
  bascule du 23/08.
  ⚠ **La règle « tout en client » concerne l'app, jamais l'usine.** On a déjà un exécuteur
  serveur avec des secrets ; l'oublier a fait écarter à tort des options (voir Publication).
- **Déclenchement = bouton « Générer la vidéo »**, pas de rendu automatique à l'upload.
- **Nav : Accueil · Atelier · Ressources · Veille.** `Publications` a fusionné dans `Atelier`
  (bascule kanban / calendrier) — un poème programmé est le même objet vu plus tard.
  `/poemes`, `/publications`, `/bibliotheque`, `/calendrier`, `/publier` sont des redirections.
  ⚠ Cette fusion est ce qui maintient le compte à **quatre** onglets. Si elle saute, la refonte
  devient un enrichissement et l'objectif « simplifier » est manqué.

### L'avancement est dérivé

- **L'étape d'un poème se déduit des faits** : body → audio → vidéo → publication.
  `poems.status` reste éditable mais **n'est plus la source de vérité** — ne pas s'y fier.
- **Deux exceptions assumées**, et une seule condition les rend tenables : qu'elles se **voient**.
  - `poems.etape_manuelle` — on peut déposer une carte dans n'importe quelle colonne, même contre
    les données. Une carte forcée porte un liseré or et la mention « déplacée à la main — en
    réalité *<étape calculée>* » ; sa fiche offre « revenir au calcul ». **Ne jamais retirer ces
    marqueurs** : sans eux on recrée `poems.status`, un champ saisi qui dérive en silence.
    Déposer une carte dans la colonne que le calcul donnait déjà remet la colonne à `NULL`.
  - `à valider` (à venir, lot 3) — c'est un état humain, il ne se dérive de rien.
- `lib/etapes.ts` distingue `etapeCalculee()` (les faits), `etapeDe()` (l'affiché, forçage
  prioritaire) et `estForcee()`. **Tout écran qui appelle `etapeDe()` doit sélectionner
  `etape_manuelle`** — sinon il affiche l'étape calculée pendant que le kanban montre l'autre.
- ⚠ **`etapeCalculee` n'exige PAS de fond** (changé le 24/08). Un poème est prêt à rendre dès
  qu'il a un texte et une voix. L'invariant « pas de vidéo sans fond réel » n'est pas abandonné,
  il est **déplacé** au bouton « Générer », désactivé tant qu'aucun plan n'est choisi, et au
  contrôle de `render.py`. Il s'applique là où la décision se prend. **Ne pas le remettre dans
  `etapes.ts` en croyant réparer un oubli.**

### Le montage se fait dans l'Atelier

Spec : `docs/specs/spec-montage-dans-atelier-2026-08-24.md`.

- **Le plan de fond et la musique se choisissent AU MONTAGE**, dans la fiche du poème
  (`render_jobs.broll_asset_id` et `music_asset_id`, migration `20260824e`).
  **Pourquoi sur le job et pas sur le poème** : écrire `assets.poem_id` à la sélection rendrait le
  clip indisponible pour les autres poèmes, alors que le vivier partagé existe précisément pour
  qu'un plan resserve. Effet secondaire souhaité : deux rendus du même poème peuvent avoir des
  fonds différents — c'est ce qui permet d'essayer.
  `render.py` lit d'abord la colonne du job, **puis retombe** sur la recherche par `poem_id` (les
  jobs antérieurs passent toujours), puis sur la nappe générée pour la musique.
- **Un seul plan, rejoué en boucle.** `build_broll` gère ce cas sans modification : il avance une
  tête de lecture par segments contigus et repart à zéro une fois le clip épuisé. Le raccord est
  une coupe franche ; le fondu enchaîné reste une question ouverte, pas un manque.
- **Le choix de l'image et de la musique reste manuel.** C'est la seule décision artistique qui
  subsiste une fois le rendu automatisé — l'automatiser reviendrait à automatiser la valeur.
  Règle générale : *automatiser ce qui est mécanique et vérifiable, garder à la main ce qui relève
  du jugement* — et **ne pas automatiser un geste qu'on n'a pas fait vingt fois**.
- **L'aperçu est une approximation navigateur**, pas un rendu : plan filtré en CSS pour approcher
  l'étalonnage, voix et musique au rapport réel (−7 LU, soit 0,45 d'amplitude), premiers vers en
  Cormorant. Le vrai rendu coûte 3 min d'usine et ~4 à 10 Mo par essai, sur un quota que rien ne
  purge. **La phrase « Aperçu approché… » sous le cadre est obligatoire** : sans elle, l'aperçu se
  ferait passer pour le résultat, ce qui serait pire que pas d'aperçu.
  La vidéo une fois produite est lisible dans la fiche — c'est le seul aperçu fidèle, et gratuit.
- **Le poème lié est obligatoire** à l'upload d'une voix. Le métrage et la musique, eux, vivent
  dans le **vivier commun** sans poème lié.
- **Vivier décrit par un vocabulaire fermé de 9 ambiances** (`lib/ambiances.ts`, figé le 23/08 :
  `nuit braise orage vertige melancolie tendresse apre solennel vide`). Identifiants sans accents,
  libellés accentués. Rangées dans `assets.meta.ambiances`. Du texte libre ne se filtre pas et ne
  se retrouve pas trois mois plus tard — ne pas étendre la liste sans décision de Nicolas.

### Filtrer : la barre de Ressources (24/08)

Constat mesuré avant de toucher : la barre affichait **14 commandes dont 10 ne pouvaient
renvoyer que du vide** — aucune image en base, aucune ambiance renseignée. Elle annonçait une
bibliothèque qui n'existait pas, et pour 19 fichiers faire défiler la table allait plus vite.

Quatre règles retenues, valables au-delà de cet écran :

- **Un seul champ qui cherche partout** — nom, type, ambiance, poème. Il doit couvrir les
  **libellés affichés** (« métrage », « braise »), sinon le champ unique ment et il faut
  remettre des menus à côté. C'est ce qui a permis de supprimer le déroulant des poèmes.
- **Une facette n'existe que si elle ramène quelque chose**, et porte son compte. Une pastille
  qui ne peut rendre que du vide est du bruit. La barre regrandit d'elle-même quand le vivier
  se remplit — on ne règle rien « au cas où ».
- ⚠ **Le compte d'une facette s'évalue SANS elle-même.** Sinon il répète la sélection au lieu
  de dire ce qu'on gagnerait à cliquer ailleurs.
- ⚠ **Une facette active ne disparaît jamais**, même à zéro résultat — sinon on ne peut plus la
  décocher et on reste coincé sur une liste vide.
- **Les filtres actifs se rassemblent en jetons**, avec le compte « n sur N ». Éparpillés, on en
  oublie un et la bibliothèque paraît vide sans qu'on sache pourquoi.
- **Un constat doit porter son geste** : « 14 sans ambiance — invisibles aux filtres » est
  devenu un bouton qui les affiche.

Le tri reste dans les **en-têtes de colonne** : c'est là qu'on le cherche, et une commande
séparée aurait rajouté au fouillis qu'on venait d'enlever.
⚠ **Caduc depuis la refonte du 24/08** (ci-dessous) : il n'y a plus de colonnes, donc plus
d'en-têtes. Le tri devient un groupe de boutons `aria-pressed` intitulé « Trier ».

### Le vivier se regarde et s'écoute — refonte de Ressources (24/08)

Brief : `docs/specs/brief-design-ressources-2026-08-24.md` → planche de Claude design →
spec : `docs/specs/spec-vivier-visible-2026-08-24.md`, quatre lots.
**Lot 1 livré et mergé le 24/08** (`feat/vivier-visible-lot1`, 4 fichiers, +835/−451) :
`lib/vignette.ts`, `components/Vivier.tsx`, `app/ressources/page.tsx` réduite au quota + dépôt +
montage du vivier, `--encre` dans `globals.css`.
**Lot 2 livré le 24/08** : contrôle pré-vol du dépôt (type, 50 Mo par fichier, quota restant
**décompté au fil de la brassée** — trois fichiers de 400 Mo ne peuvent pas tous « tenir dans ce
qui reste »), file avec total et compte plutôt qu'une barre par fichier, réessai d'un seul
fichier, état vide, jauge qui propose le tri par poids au-dessus de 90 %.
⚠ **Un échec d'`insert` après un `upload` réussi retire le fichier du stockage.** Sinon il
consomme le quota sans apparaître nulle part — même raisonnement que l'ordre base-puis-stockage
de la suppression.
**Lot 3 livré le 24/08** : les deux `<select>` de noms de fichiers du montage (plan de fond,
musique) sont remplacés par le composant `Vivier` en `mode="selection"`, monté **à la demande**
sous le texte du poème — tant qu'on ne clique pas « changer », l'Atelier ne charge aucune
vignette. Ce qui est choisi s'affiche en récapitulatif (`<Miniature>`, durée, ambiances), parce
qu'un choix doit se voir là où on l'a fait. `loadVivier` demande désormais `meta`.
**Lot 4 (palette sur les quatre onglets) reste à faire.** Tant qu'il n'est pas passé, l'app vit
avec deux identités : Ressources et le panneau de montage en encre, le reste tout en or.

Le défaut central n'était pas la logique de filtrage — elle est reprise au caractère près —
mais que **la matière n'était jamais visible** : on cochait « braise » sur un nom de fichier.

Parti pris retenu : **une liste vignettée unique + une fiche latérale**. Pas de grille, pas de
bascule, pas de mode plein écran. Pour vingt fichiers, deux vues à maintenir seraient une dette
pour rien. La fiche reste ouverte pendant qu'on descend la liste : c'est elle, le mode « classer ».

Deux choses qu'on croyait manquer et qui ne manquaient pas :

- **Mieux signaler une cellule éditable ne sert à rien.** Une pastille de 20 px dans une ligne de
  34 ne sera jamais une bonne cible, signalée ou non. L'édition **sort de la ligne**.
- **La progression par fichier n'est pas le manque.** `storage.upload()` n'en donne pas sans
  réécrire l'envoi en XHR. Le vrai manque est en amont : rien n'était refusé **avant** l'envoi.
  Donc un **contrôle pré-vol** (poids, type, quota restant) et un total, pas une barre.

⚠ **Décision de palette — Nicolas, 24/08 : `2c bleu d'encre #2f3b52` est adopté.**
Motif : `--gold` faisait quatre métiers (libellés, jetons actifs, liens de poème, bouton Déposer)
— quand tout est or, rien ne ressort. Le bleu prend **tout ce qui est interactif** (sélection,
lecture, ambiances, filtres actifs, liens) ; l'or redevient un accent d'apparat, réservé aux
titres, aux libellés et au dépôt.
Ratios mesurés : **10,2 sur la page** (`--bg #f7f3ec`) et 11,2 sur blanc — le plus lisible des
trois propositions, et très au-dessus du seuil de 3,0 des surfaces.
**Contrepartie assumée, à ne pas oublier : les quatre onglets passent à la même palette.**
Ressources livrée seule détonnerait — c'est le risque explicite signalé par Design. Ce n'est
donc plus un réglage local mais une évolution de la DA de l'app. La DA des **vidéos** est
inchangée : elle reste sombre et vit dans `pipeline/render.py`.

⚠ **Un canvas alimenté depuis une autre origine se « tainte » et `toDataURL` lève une
SecurityError.** Les URL signées Supabase sont une autre origine : la fabrique de vignettes
travaille donc **toujours sur un Blob local** — le `File` du dépôt, ou `storage.download()` pour
le rattrapage. Vaut pour tout ce qu'on voudra dessiner un jour à partir du stockage.

Deux réserves, tranchées à l'écriture de la spec :

- **Design proposait d'afficher les fichiers originaux** en `object-fit: cover` sur 76 × 52.
  Tenable aujourd'hui (22 fichiers, 107 Mo, et **aucune image en base** : 8 métrages, 6 nappes,
  5 vidéos montées, 3 voix) — mais le jour où les images arrivent, 24 lignes à 2,5 Mo font 60 Mo
  par chargement contre **5 Go d'egress par mois** sur le plan Free, soit ~80 ouvertures.
  ✅ **Tranché : la vignette est fabriquée au dépôt** (canvas, JPEG 152 × 104, ~8 Ko) et rangée
  dans `meta.vignette`. Elle voyage avec la ligne : zéro requête de stockage à l'affichage, zéro
  migration, et pas de bucket de miniatures à tenir cohérent avec les suppressions.
- `meta.duree` écrit à la première lecture : la policy `members_all_assets` (ALL, `is_member()`)
  l'**autorisait** — la question n'était pas la permission mais l'opportunité.
  ✅ **Tranché : la durée s'écrit au dépôt, avec la vignette.** Un affichage ne doit pas écrire en
  base, surtout à deux sur la même page. Le rattrapage des fichiers déjà en base se déclenche par
  un bouton, jamais tout seul.

Suite attendue : `docs/specs/spec-vivier-visible-2026-08-24.md`, en trois lots — 1) le composant
`Vivier` et la liste vignettée, 2) le dépôt pré-vol et le quota, 3) le panneau de l'Atelier.

### Les captions

- **Gabarit déterministe, sans LLM** (`lib/caption.ts`) : titre, auteur, premier vers, signature,
  hashtags. Éditable ensuite.
  Écrire les captions dans le registre savant de `gaya__scienza` a été **examiné et écarté** : un
  gabarit ne peut pas produire ce texte (il faut savoir qui est Heredia, ce qu'est Palos), il
  faudrait un LLM (coût + rupture de « tout en client ») ou du travail humain.
- **La caption est une propriété du POÈME** (`poems.caption`, migration `20260824b`), pas de la
  publication : sinon il fallait programmer une date pour avoir le droit d'écrire un texte, alors
  qu'une caption se pense en lisant le poème.
  Règle de reprise (`captionPour()`) : la publication prend `poems.caption` si renseignée, sinon
  le gabarit. **Ce qui est écrit à la main gagne toujours ; le gabarit reste le défaut.**
  Conséquence assumée : une caption écrite à la main vaut pour les trois plateformes, hashtags
  compris — on ne lui ajoute pas les tags de plateforme, sinon on ne saurait plus en la relisant
  ce qui vient de soi et ce qui vient du gabarit.
  Le bouton « régénérer » d'une publication appelle `genererCaption` et **non** `captionPour` :
  régénérer veut dire *revenir au gabarit*, y compris quand c'est de la caption du poème qu'on
  veut sortir.
  ⚠ Une table `captions` dédiée a été examinée et écartée : il n'y a qu'une caption par poème.
  On éclatera le jour où il en faudra une par plateforme, pas avant.

### Les notes — travailler à deux en asynchrone

Spec : `docs/specs/spec-notes-atelier-2026-08-24.md`. Table `notes`, migration `20260824g`.

- Un fil par poème, chaque note **signée et horodatée**, avec un état traité / en attente.
- ⚠ **`poems.notes` existait déjà et n'a JAMAIS servi** (vide sur les trois poèmes), retiré de
  l'écran le 23/08 parce que « la fiche faisait saisir des champs jamais relus ». Trois causes,
  devenues les trois exigences de la table : **auteur**, **date**, **état** — et surtout
  **quelque chose qui rappelle la note**. C'est ce dernier point qui compte : *une note qui ne
  réclame rien n'est pas lue.* D'où le bloc « Ce qui attend » sur l'**Accueil** (premier écran
  ouvert, le seul qu'on ne peut pas manquer) **et** la pastille sur les cartes du kanban.
  Ne pas réutiliser `poems.notes` en croyant simplifier.
- Choix assumés : **aucune suppression** (on résout — un fil réécrivable perd sa valeur de trace),
  **aucune note privée** (`is_member()` comme partout), et **une note n'est pas une étape** — pas
  de colonne « en discussion », l'avancement reste dérivé des faits.
- ⚠ **Piège PostgREST** : `notes` porte **deux** clés étrangères vers `profiles` (`created_by`,
  `resolved_by`). Une jointure `profiles(...)` est ambiguë et **échoue à l'exécution, pas au
  build**. Nommer la contrainte : `auteur:profiles!notes_created_by_fkey(display_name)`.

### La publication et les comptes

- **Publication v1 = assistée** : l'app prépare le fichier et la caption, Nicolas publie en deux
  clics, puis reporte l'URL dans `publications.published_url`.
- **État réel des API, vérifié le 24/08** :

  | plateforme | sans audit | verdict |
  |---|---|---|
  | Instagram | mode développement + rôle *Instagram Tester* sur **son propre** compte | **faisable** |
  | TikTok | `SELF_ONLY`, et le compte doit être **privé au moment de poster** | inutilisable |
  | YouTube | vidéo **verrouillée en privé, sans appel** | inutilisable |

  ⚠ La note du 23/08 disait « Instagram exige une app review de 2-4 semaines » : c'est vrai pour
  publier **au nom d'autrui**, pas sur son propre compte. Et « il faudrait une Edge Function »
  ignorait qu'on a déjà GitHub Actions, avec ses secrets.
  Coûts réels si le sujet est rouvert : compte Instagram **professionnel lié à une Page Facebook**,
  et **token long-lived qui expire tous les 60 jours** — non rafraîchi, la chaîne casse **en
  silence**, le pire mode de panne pour un projet à maintenance minimale.
  **Décision du 24/08 : on ne le fait pas maintenant.** Zéro vidéo publiée — automatiser un geste
  qu'on n'a pas encore fait est précisément ce que ce projet s'interdit. À rouvrir quand la
  publication à la main sera devenue pénible.
- **Les comptes (décidé le 24/08, pas encore créés)** — les trois plateformes, sous une **adresse
  mail dédiée** partagée (ni Nicolas ni Charley n'est un point de passage obligé), **pseudo
  identique partout**, Instagram en **Créateur**.
  Marche à suivre et bios rédigées : `docs/comptes-reseaux-2026-08-24.md`.
  ⚠ **Créer la Page Facebook liée tout de suite**, même vide : cinq minutes aujourd'hui, une
  soirée sur un compte déjà vivant. C'est le seul geste qui prépare l'avenir.
  ⚠ **Aucun identifiant dans le dépôt** — il est public et l'historique git ne s'efface pas.

### Écartées, et pourquoi

- **Pré-remplissage titre/auteur/texte depuis la voix** : gain réel = 2 champs ; coût = serveur +
  API payante + « tout en client » cassé. Et le texte doit venir d'une édition collationnée —
  Whisper ne peut pas en être la source.
- **Le tirage semé pour choisir l'image** : reviendrait à automatiser le jugement.
- **Table `inspirations`** et non `references` — mot réservé en SQL.

---

## 5. Infrastructure

| Élément | Détail |
|---|---|
| App | https://boulevard-victor-hugo.vercel.app |
| Vercel | team `nicobenzis-projects` (Pro), projet `boulevard-victor-hugo`, deploy auto sur `main` |
| Repo | github.com/Nicobenzi/Boulevard_Victor_Hugo — **public** (Actions gratuit et illimité) |
| Supabase | projet `cjnnzmfbqybgcmmvrodx`, org perso (Free), région eu-west-1 |
| Secrets Actions | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Rendu | `.github/workflows/render.yml` — cron **2 h** + manuel → `pipeline/render.py` (Python 3.11) |

Tables : `profiles`, `allowed_emails`, `poems`, `assets`, `publications`, `render_jobs`,
`inspirations`, **`notes`**. Buckets privés : `videos`, `audios`, `images`.
⚠ Le bucket `videos` contient **aussi le métrage** (`bucketFor` envoie tout `video/*` là) : les
plans du vivier et les vidéos finies y cohabitent.
Accès = allowlist `allowed_emails` + RLS `for all using (public.is_member()) with check (…)`.
Auth = lien magique ; Site URL sur l'URL Vercel (sinon le lien renvoie vers localhost).

⚠ **Le dépôt et l'historique de migrations de la base ne coïncident pas** (constaté le 24/08) :
`init_studio_schema` et `render_jobs` n'ont **jamais eu de fichier** ; `20260823_inspirations` et
`20260823b_broll_et_cinetique` sont **au dépôt mais absents de `schema_migrations`** (passés par
l'éditeur SQL du dashboard avant qu'on utilise `apply_migration`). Conséquence : **`supabase db
push` n'est pas utilisable en l'état** — il tenterait de rejouer ces deux-là. On applique par
`apply_migration` et on écrit le fichier en parallèle. *Écrire le fichier **à chaque fois**, y
compris pour une correction de données* : `20260824c` et `f` avaient été appliquées sans fichier,
donc invisibles pour qui relit le dépôt — rattrapé le soir même.

**Le MCP Supabase, exactement** — `execute_sql` est en **lecture seule** (`cannot execute INSERT
in a read-only transaction`), mais **`apply_migration` écrit**, DDL **comme données : les
migrations `20260824a`, `c` et `f` étaient des `INSERT`/`UPDATE` et sont passées.**
⚠ **Aucun accès aux buckets** en revanche : supprimer une ligne `assets` depuis une session
laisserait le fichier orphelin. Les suppressions passent par le bouton de Ressources, qui fait
les deux dans le bon ordre.

**Python local sur le Mac** — `~/.venvs/bvh` (numpy), `ffmpeg` par Homebrew. macOS refuse
`pip3 install` dans le Python système (PEP 668) : passer par le venv sans l'activer,
`~/.venvs/bvh/bin/python <script>`. C'est le seul environnement Python demandé en local.
⚠ `make_music.py` écrit par défaut dans `musiques/` **relatif au dossier courant**, donc dans le
dépôt public, qui n'ignore pas ce dossier. Toujours lui passer une destination hors du dépôt :
`~/.venvs/bvh/bin/python pipeline/make_music.py ~/Desktop/musiques-bvh 120`.

**Pièges rencontrés (ne pas refaire)**

- **Version de Next : rester sur le rameau courant.** Vercel refuse de déployer une version
  porteuse d'une CVE. Le rameau 15 s'est fermé sur 15.5.23, qui épingle `postcss@8.4.31` et
  `sharp@^0.34.3` **sans correctif possible**. Passage à **Next 16** le 23/08 (`found 0
  vulnerabilities`). Next 16 utilise **Turbopack** au build et **réécrit `tsconfig.json`** :
  ces changements sont à committer, sinon l'arbre reste sale. `next-env.d.ts` est ignoré,
  `package-lock.json` est suivi.
- **Une écriture Supabase dont on n'examine pas le `error` produit un bouton qui a l'air cassé.**
  C'est ce qui a masqué pendant une journée une contrainte `NO ACTION` sur le bouton supprimer de
  Ressources. **Il y en a peut-être d'autres dans le code** — bon candidat pour une passe dédiée.
- **Supprimer dans le bon ordre** : la ligne en base **avant** le fichier. Dans l'ordre inverse,
  un échec en base laisse un asset fantôme, ni téléchargeable ni supprimable.
- **Un déclencheur `AFTER INSERT` ne rattrape jamais les lignes déjà là.** `handle_new_user` ne
  crée un profil que si l'adresse est déjà dans `allowed_emails` au moment de l'inscription — un
  compte créé avant son allowlistage n'en a jamais. Toute règle « à l'inscription » a besoin de
  son script de rattrapage (`20260824a`, idempotent, rejouable).
- **Toute action qui n'existe qu'au glisser-déposer n'existe pas** pour qui n'a pas de souris.
  Le kanban a désormais son sélecteur d'étape au clavier.
- **Police, repli silencieux.** Le workflow téléchargeait Cormorant avec `|| true` : en cas
  d'échec, libass substitue **sans erreur** et les vidéos sortent dans une autre fonte que le
  site. Corrigé — plus de `|| true`, `fc-list` dans le workflow **et** `check_font()` au démarrage.
- **ffmpeg redécode un PNG à chaque frame** avec `-loop 1 -i image.png` : ~1,9 img/s. Le filtre
  `loop` monte à ~9 img/s en 1080×1920. Appliqué au cinétique ; musée et galerie ont encore le
  défaut.
- **GitHub arrondit chaque job à la minute pleine** : une exécution à vide de 4 s coûte 1 minute.
- Le dashboard Supabase intercepte les frappes clavier automatisées : configurer l'auth à la main.

**Le bac à sable Linux de la session**

- ⚠ **Il ne peut pas builder** : les `node_modules` sont installés pour macOS, il faudrait
  retélécharger `@next/swc-linux-arm64-gnu`, et son disque est plein. `npx tsc --noEmit` y
  fonctionne et valide le typage — **`npm run build` doit tourner sur le Mac avant tout push**.
- ⚠ **Ne pas y lancer de `git`** : les commandes laissent un `.git/index.lock` orphelin
  impossible à supprimer depuis la session, et le `git commit` suivant échoue côté Mac avec
  « Another git process seems to be running ». Remède : `rm -f .git/index.lock`.
- ⚠ **Toujours faire `git checkout main` AVANT de modifier des fichiers.** Une branche déjà
  mergée reste sélectionnée après un merge sur GitHub ; trois commits sont partis dessus par
  accident le 24/08, chacun rattrapé par un `cherry-pick`.

---

## 6. État au 24 août 2026

### La chaîne tourne de bout en bout

Deux vidéos produites par l'usine, ~3 min de rendu chacune :

- ***Les Conquérants*** (Heredia), `cinetique`, 3,9 Mo — premier passage complet, 23/08.
  Fond = l'ancien `painterly_bg`, donc **à refaire** avec du métrage.
- ***Hymne à la Beauté*** (Baudelaire, 1 min 50), `cinetique`, 10,3 Mo — 24/08.
  Premier rendu par le **nouveau chemin** (plan choisi au montage), plan `nuit-lune`.
  ⚠ Voix à **26 kbps / 16 kHz** : bande passante perdue à l'encodage, qu'aucun traitement ne
  récupère. **À réenregistrer avant publication.**

***Bacchanale*** a son texte et sa voix (56 s, 74 kbps / 48 kHz), **pas encore de rendu**.
Il ne manque qu'un plan et une musique. Suggestion : `braise-bougie` (vertical, dans la palette)
et `nappe-la-mineur`.

**Stockage** : 67,8 Mo pour 19 fichiers, sur 1 Go. Dont **38 Mo de métrage** contre 10,3 Mo pour
l'unique vidéo finie — *le vivier pèse quatre fois plus lourd que la production, c'est lui qu'il
faudra surveiller en premier*. Rien ne purge : `render.py` uploade et n'efface jamais.
Plafond par fichier : **50 Mo**.

**Vivier** : 8 clips de métrage, 6 nappes de musique, tous dans le vivier commun (aucun poème lié).
Les fichiers sources restent dans `metrage/` sur le Mac (hors git), provenance dans
`metrage/SOURCES.md`.
⚠ **Mixkit interdit le téléchargement automatisé** (User Terms 9.10) : à la main.
⚠ Sur Pexels, des vignettes iStock **payantes** sont mêlées aux résultats gratuits — si l'URL
quitte `pexels.com`, c'est payant. Et **pas de visages identifiables** : aucune autorisation des
personnes filmées n'est garantie sur ces banques.

### Livré le 24/08 — 4 PR (#20 à #23) + 2 commits directs sur `main`

Accès de Charley réparé · caption sur le poème · Atelier utilisable au clavier · contrastes
corrigés · le montage (plan + musique + aperçu) rapatrié dans l'Atelier · le fond exigé dépend du
style · fil de notes · **barre de Ressources refondue** (`c335ff4`, poussé directement sur `main`).
**Le *pourquoi* de chaque décision est en § 4, pas ici.**

**Sept migrations**, `20260824a` à `g` : profils manquants · `poems.caption` · échange des deux
voix · `ON DELETE SET NULL` sur `render_jobs.video_asset_id` · `broll_asset_id` + `music_asset_id` ·
job de l'Hymne rebasculé en cinétique · table `notes`.

### Le sujet encore ouvert : l'image

Nicolas ne veut ni tableaux de maîtres (« ça fait vieux ») ni fond généré. Le métrage filmé est la
réponse actuelle, et l'étalonnage la rend viable.

- ✅ **`painterly_bg` a été supprimé le 23/08.** Mesuré avant de couper : la moitié haute montait à
  **143** de luminance, les pics à **247**, pour un crème de texte à **226** — le fond était par
  endroits *plus clair que les vers*. Deux défauts : les sept taches étaient tirées dans un carré
  central donc se superposaient toujours au même endroit, et la palette était claire par nature
  sans rien qui borne la somme avant le `clip` final.
  *Un fond raté publié vaut moins qu'un rendu qui refuse de partir.*
- **Si un générateur revient un jour**, le candidat était « E » : nébuleuse de braise + champ
  d'étoiles, animé (bruit 3D dont la 3ᵉ dimension est le temps), semé sur l'identifiant du poème.
  Principe à retenir de l'échec de `painterly_bg` : **partir du noir et ajouter très peu de
  lumière**, au lieu d'empiler des taches claires en espérant que l'assombrissement rattrape.
- **Portraits d'auteur : pas en fond.** Testé sur la gravure de Heredia — un portrait remplit le
  cadre de détail et n'a **aucune zone calme**. Sa place est la **carte d'ouverture**.

### À faire

1. **Monter *Bacchanale*** — plan + musique + rendu. Le plus court chemin vers une deuxième vidéo.
2. **Ouvrir les trois comptes** (`docs/comptes-reseaux-2026-08-24.md`) et **publier**. Zéro
   publication pour deux vidéos finies est le vrai retard du projet, pas la technique.
3. **Réenregistrer la voix de l'*Hymne*** (26 kbps).
4. **Refaire *Les Conquérants*** avec du métrage, son fond étant l'ancien générateur supprimé.
5. **Carte d'ouverture** avec portrait d'auteur traité en N&B dur.
6. **Cache du modèle Whisper** (~500 Mo retéléchargés à chaque exécution).
7. **Lot 3 de la refonte** : colonne `à valider`, seul état humain restant.
8. **Passe « erreurs avalées »** sur les écritures Supabase (§ 5).

### En suspens, à ne pas relancer sans Nicolas

- **L'export Instagram de Charley** (`posts/`, ~71 Mo) est sorti du dépôt, vérifié — et il n'y a
  jamais été committé. Le rendre de nouveau consultable : **Nicolas tranchera plus tard.**
  ⚠ Rectification importante : `.gitignore` **n'est pas un pis-aller**. `posts/` y figurait, donc
  `git add -A` ne le voyait pas et il n'atteignait ni l'index, ni un commit, ni GitHub — et Vercel
  déployant depuis git, un fichier ignoré n'est pas déployé. Trois cas cassent : `git add -f`, un
  `.gitignore` réécrit, et surtout **`git clean -xdf` qui ne fuite pas mais SUPPRIME** (le `-x`
  vise les fichiers ignorés). *Le vrai argument pour sortir l'export du dépôt est la perte, pas
  la fuite.*
  Dans tous les cas : **purger l'EXIF avant tout usage** (594 géolocalisations à six décimales,
  métadonnées d'appareil — données personnelles d'un tiers) et **aucune image publiée sans
  l'accord explicite de Charley**.
- **Le trou d'allowlist** : un compte créé avant son ajout à `allowed_emails` n'aura pas de profil.
  Le correctif de fond serait de faire retomber `is_member()` sur l'allowlist. Nicolas l'a jugé
  inutile — Charley est le seul collaborateur prévu.
- **`.claude/settings.json` ne désactive rien.** Les skills `coprovia-*` sont **attachées côté
  Claude.ai** (servies depuis `…/rpm/plugin_*/skills/`), et `list_plugins` ne renvoie aucun plugin
  installé localement. `enabledPlugins` est un mécanisme Claude Code qui lit la config du projet
  sur disque : aucun fichier du dépôt ne peut les éteindre. **Il faut les détacher dans les
  réglages du projet côté app Claude.** Le fichier reste comme trace du diagnostic.

### Idées non tranchées

- Fondu enchaîné au raccord de boucle du métrage (un plan court rejoué vingt fois se voit).
- Suppression d'une note par son auteur dans une fenêtre de cinq minutes (fautes de frappe).
- Réglage du cadrage par poème en cinétique — aujourd'hui heuristique (fenêtre à 62 % vers le bas).
- Rappel par mail le jour d'une publication programmée (préférable à un polling dans l'app).
- **Couleurs des tags** dans Ressources : monochromes, parce que `CLAUDE.md` interdit d'inventer
  des couleurs. Cinq teintes en variables sont faisables, mais c'est une levée de règle qui
  appartient à Nicolas.
- Ménage : `poems.notes`, `source`, `status` sont conservées en base sans écran. À supprimer un
  jour — ou à garder, mais **ne pas les réutiliser en croyant bien faire**.
