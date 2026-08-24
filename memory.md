# memory.md — mémoire du projet
Dernière consolidation : 23 août 2026, fin de soirée — 15 PR mergées.
Structure : §1 le projet · §2 la DA · §3 le montage · §4 les décisions et leur *pourquoi* ·
§5 l'infrastructure et les pièges · §6 l'état, ce qui reste, ce qui est ouvert.

Lire ce fichier au début de chaque session. Le mettre à jour après toute décision structurante.

> **Rappel d'ouverture** — ce projet n'est **pas** Coprovia, malgré les plugins `coprovia-*`
> installés et l'adresse mail de Nicolas. Voir l'encadré en tête de `CLAUDE.md`. Et si les outils
> ne voient pas le dossier, le demander (`request_cowork_directory`) plutôt que de supposer que le
> projet est vide : la base de connaissances Claude.ai l'est, le dossier ne l'est pas.

---

## 1. Le projet

**Boulevard Victor Hugo** — poèmes du domaine public, lus à voix haute, montés en vidéo verticale
(1080×1920) pour Instagram / TikTok / YouTube. Signature de fin : « chaque jour, un poème ».

- **Le frère de Nicolas** : la voix (choix des poèmes, enregistrement des lectures).
  Il n'a pas encore de compte sur l'app — ne pas concevoir de fonctionnalité qui suppose sa présence.
- **Nicolas** : production, montage, tech, publication.
- Projet passion à deux, coût visé = 0 €. Priorité : régularité de publication > perfection technique.

**Droits** : ne monter que des auteurs morts depuis plus de 70 ans (Baudelaire, Heredia, Rimbaud,
Verlaine, Hugo, Apollinaire…). Prévert, Aragon, Char = encore protégés, à éviter.
Idem pour les tableaux : domaine public (Wikimedia Commons), et attention aux *enregistrements*
musicaux modernes d'œuvres classiques, qui restent protégés → d'où la musique composée maison.

---

## 2. Direction artistique

**Deux palettes, à ne jamais confondre.**

**La DA des vidéos reste figée** : fond `#0e0c0a`, panel `#161311`, crème `#ece4d4`, or `#c9a45c`.
Titres et vers en **Cormorant Garamond**. Ne pas introduire d'autres couleurs ni polices.
Contrastes vérifiés le 23/08 : tous conformes AA et AAA. **La palette n'est pas le problème** —
si une vidéo paraît terne, chercher du côté du cadrage et du rythme, pas de la couleur.

**L'app est passée en clair le 23/08** (`app/globals.css`), **un seul thème, pas de bascule**.
Motif : « on voit rien ». Le diagnostic a montré que ce n'était **pas** un problème de texte —
celui-ci était AAA partout (14,6 sur carte) — mais de **séparation des surfaces** : carte contre
page à **1,06**, bordure contre page à **1,27**, là où une limite d'interface demande **3,0**.
On lisait chaque mot sans voir la forme de rien, et le kanban à six colonnes rendait ça criant.
Leçon : *vérifier le contraste des bordures et des surfaces, pas seulement celui du texte.*
Palette claire : `--bg #f7f3ec` / `--panel #ffffff` / `--ink #1a1512` / `--ink-dim #5f574a` /
`--gold #7d6021` (l'or densifié — `#c9a45c` ne tient pas sur clair, gardé en `--gold-light` pour
les aplats seulement) / `--line #9c8e72` / `--danger #a8322f` (l'ancien `#d65454` tombait à 3,0
sur blanc). Ratios : texte 18,1 · atténué 7,1 · or 5,9 · bordure 2,9 page / 3,2 carte.
Plus aucun hexadécimal en dur dans les composants — tout passe par les variables.

> ⚠ **Correction du 24/08 — la leçon du 23/08 n'avait pas été appliquée jusqu'au bout.**
> `--line` valait `#9c8e72`, soit **2,91** contre la page : au-dessous du seuil de 3,0 que ce
> projet s'est lui-même donné, et c'est le cas dominant puisque les cartes reposent sur `--bg`.
> Le 23/08 avait mesuré 2,9 et écrit la règle sans changer la couleur. Densifié à `#94866a` :
> **3,23** sur la page, **3,57** sur la carte.
> Deuxième défaut, du même genre : les pastilles de plateforme posaient la couleur de marque
> **en texte** sur son propre aplat à 20 % — TikTok tombait à **1,77** pour un seuil de 4,5,
> Instagram et YouTube à 3,11. La couleur est devenue un **point** ; le texte est passé en
> `--ink` (18,1). Règle à retenir : *une couleur de marque informe, elle n'a pas à être lue.*

> Le choix de fond : l'app est un **outil** ouvert en plein jour, la vidéo est le **produit**.
> Rien n'oblige l'atelier à ressembler à ce qu'on y fabrique.

**Styles implémentés dans `render.py`** (valeur du champ `render_jobs.style`) :

- **`cinetique`** *(depuis le 23/08, style à privilégier)* — les mots apparaissent un à un sur la
  voix, **un seul accent or par vers** (le mot le plus long), et l'image **alterne** avec de la
  typographie sur noir, par mouvements de 3-4 vers. L'image n'est jamais montrée en plan large :
  on entre à ~1,55× et la fenêtre est calée sur le **bas** du tableau, là où sont les figures.
- **`musee`** *(défaut historique)* — tableau plein écran, Ken Burns lent (1 → 1,085) ; travelling
  horizontal si le tableau est en paysage. Dégradé sombre en bas pour la lisibilité.
- **`galerie`** — tableau encadré d'un filet doré sur fond noir, vers sous le cadre.
  À utiliser quand l'image est en basse résolution (elle reste nette en petit).

> « Nocturne » (typographie seule sur dégradé) figurait dans les notes mais **n'a jamais été
> implémenté**. Le style `cinetique` couvre le besoin. Ne pas le réintroduire sans raison.

> ⚠ **Tout rendu exige désormais un fond fourni** — une image ou du métrage lié au poème.
> Il n'y a **plus de fond de secours** : `painterly_bg` a été supprimé le 23/08 parce qu'il
> produisait une image par endroits plus claire que le texte. Sans fond, le job échoue
> volontairement. Le détail et le raisonnement sont en **§ 6**.

**Pourquoi le cinétique** (veille concurrence du 23/08) : un plan fixe est une cible de scroll —
sous 50 % de rétention à 3 s, le reste ne compte pas. L'ancien Ken Burns faisait 0,15 %/s, soit
une image fixe à l'œil. Et les tableaux ne sont pas tristes : c'était le **cadrage large** qui
l'était. Le même Poussin recadré sur les figures n'a plus rien à voir. Vérifié sur *Bacchanale*.

**Ce que fait la concurrence** : les comptes français qui marchent sont des visages
(@violenteviande, >180 k, punchlines face caméra) ou du texte posé (@poesiefrancaise, ~14 k).
Presque personne ne fait « tableau + voix off » → notre format est **différenciant**, il ne faut
pas l'abandonner, seulement lui donner de l'énergie. Références classées dans l'onglet Veille.

**Structure d'une vidéo** : hook direct sur le premier vers (le titre lu est coupé), cartouche
titre + auteur en fondu à 1 s, vers sous-titrés au rythme de la voix, carte signature à la fin.

---

## 3. Règles de montage (dures, issues de l'expérience)

- Les sous-titres affichent le **texte canonique** du poème (`poems.body`, un vers par ligne),
  jamais la transcription brute — le public de poésie repère les écarts.
  La transcription (faster-whisper) sert à **caler** les vers (alignement difflib) et, pour le
  style cinétique, à donner les attaques mot à mot. Si l'alignement est trop pauvre, le générateur
  retombe sur une répartition proportionnelle à la longueur des mots — suffisant, vérifié.
- **Texte de référence** : collationner sur Wikisource (« Textes validés »), apostrophes
  typographiques `’`. Les deux poèmes montés en août contenaient chacun un écart avec l'édition
  de référence — ne pas se fier à un texte recopié.
- Césure des vers longs à l'hémistiche (2 lignes max), gérée par `cesure()`.
- Voix : `highpass=70` + `afftdn` + `loudnorm I=-14:TP=-1.5` (norme plateformes).
- **Un seul export**, avec musique (23/08). La voix seule ne servait qu'au flux « ajouter un
  son » de TikTok, jamais utilisé — et elle doublait le stockage, qui est le vrai plafond.
- **Niveaux audio, mesurés le 23/08** : voix à −14,2 LUFS, nappe générée à **−29,6** → 15 LU
  d'écart, inaudible. La musique est désormais remontée à `MUSIQUE_LUFS = -21` avant mixage,
  puis le mix entier est renormalisé à −14 LUFS / −1,5 dBTP. Ne pas remplacer ce dernier
  `loudnorm` par un `alimiter` : celui-ci ne borne que la crête d'échantillon, la crête
  **réelle** montait à 0,0 dBTP (écrêtage inter-échantillon à l'encodage AAC).
- **Étalonnage du métrage de fond (23/08)** — constante `ETALONNAGE` dans `render.py`, un seul
  endroit à régler. L'ancien réglage (`brightness=-0.06:saturation=0.92`) était homéopathique :
  un feu de cheminée restait orange saturé, et aucun métrage n'avait jamais l'air d'appartenir
  au même film. La chaîne actuelle — désaturation forte, virage vers la palette, flou, vignette,
  grain — ramène n'importe quelle source dans la DA. Mesuré sur aplats :
  braises `#ff7a1a → #ba8d51` (l'or est `#c9a45c`), brouillard `#bfbfbf → #c8be9a`
  (la crème est `#ece4d4`), mer `#2a9dd6 → #6f836f`.
  ⚠ **`brightness` à −0,03 et pas plus bas** : à −0,12 les zones sombres tombaient à `#000000`
  et le fond perdait tout mouvement (braises dans la nuit). Assombrir sous le texte n'est pas
  le travail de l'étalonnage mais celui de `make_grad_overlay`.
  **Conséquence pratique : le choix du plan devient secondaire.** On prend celui dont le
  *mouvement* plaît, l'étalonnage fait le reste — même leçon que le Poussin recadré.
- **Génération vidéo IA en local : écartée** (recherche du 23/08). Sur M1 Max 64 Go, Wan 2.2 en
  GGUF met **82 min pour 2 s**. LTX-2 passe sur M3/M4 via MPS mais reste très lent (MPS n'a pas
  `torch.compile`, aucune optimisation Metal native). Constituer une banque prendrait des jours.
  → Pour du rendu réel : **métrage filmé libre** (Pexels, Pixabay, Coverr, **Mixkit** curé,
  **Videezy** pour les matières abstraites) + étalonnage. Les services IA en ligne à palier
  gratuit sont écartés pour une autre raison : filigrane **et usage commercial interdit**.
- **Musique** : 100 % générée, aucun sample, aucun enregistrement → aucun risque de réclamation.
  `pipeline/make_music.py` produit la banque (5 tonalités + un pouls). Aucune fondamentale sous
  ~65 Hz : en dessous, un haut-parleur de téléphone ne restitue rien.
- Durées : ~1 min = idéal Reels/TikTok. Au-delà de 1 min 30, prévoir YouTube ou 2 parties.

---

## 4. Décisions d'architecture

- **Publication v1 = assistée**, pas d'API directe. Vérifié en août 2026 : Instagram exige un
  compte Business + app review Meta (2-4 semaines) ; TikTok poste en « moi uniquement » sans audit ;
  YouTube verrouille en privé les uploads d'un projet non audité.
  → L'app prépare le fichier + la caption, Nicolas publie en 2 clics.
  **Lire les publications demanderait en plus une Edge Function** (tokens côté serveur), ce qui
  contredit la règle « tout en client ». À ne pas lancer sans décision explicite.
  Étape la moins chère si le sujet revient : mieux afficher `publications.published_url`,
  qui existe déjà et ne demande aucune API.
- **Usine de rendu = GitHub Actions** — ffmpeg + Whisper sont trop lourds pour Vercel.
  Alternative écartée : serveur dédié (~5 €/mois). Ce n'est **pas gratuit** sur un dépôt privé —
  d'où le passage du dépôt en public le 23/08, qui sort Actions du quota (cf. § 6).
- **Déclenchement = bouton « Générer la vidéo »** sur la fiche poème, pas de rendu automatique
  à l'upload → évite les rendus inutiles.
- App volontairement simple : tout en client components + supabase-js direct, pas de couche
  d'abstraction (voir skill `karpathy`).
- **Nav (23/08, audit navigation)** — `Calendrier` et `À publier` étaient deux vues de la même
  table `publications` : fusionnés en un onglet **Publications** avec bascule calendrier / liste.
  Une seule requête pour les deux vues, filtrage du mois côté client. `/calendrier` et `/publier`
  restent en redirections. Onglets actuels : Publications, Poèmes, Bibliothèque, Veille.
- **L'avancement d'un poème est dérivé**, pas saisi : body → audio → vidéo → publication.
  Le badge de la liste Poèmes le calcule. `poems.status` reste éditable mais **n'est plus la
  source de vérité** — ne pas s'y fier, ne pas l'utiliser pour filtrer.
- **La musique se choisit en la liant au poème** dans la Bibliothèque. `render.py` utilise la
  bande son liée si elle existe, sinon génère sa nappe. Il n'y a pas d'autre réglage.
- **Le poème lié est obligatoire** à l'upload d'une vidéo / voix / image. Un asset orphelin est
  introuvable depuis la fiche et provoquait des « ajoute d'abord une bande son » inexplicables.
- **Veille** — table `inspirations` (et non `references`, mot réservé en SQL) + onglet dédié :
  carnet des comptes et vidéos repérés ailleurs.

### Refonte UX du 23/08 (soir) — spec `docs/specs/spec-refonte-ux-atelier-2026-08-23.md`

Constat décisif : **les poèmes se travaillent en dehors de l'app** (choix, collationnement,
enregistrement). L'app n'est donc pas un studio d'écriture mais une **usine de rendu + un planning**.
L'onglet « Poèmes » mentait sur le produit, et sa fiche faisait saisir des champs jamais relus.

- **Nav cible : Accueil · Atelier · Ressources · Veille.** `Publications` **fusionne dans `Atelier`**
  (bascule kanban / calendrier) — un poème programmé est le même objet vu plus tard. Même logique
  que la fusion `Calendrier` + `À publier` plus haut. Redirections à conserver.
  ⚠ Cette fusion est ce qui maintient le compte à **quatre** onglets : si elle saute, la refonte
  devient un enrichissement et l'objectif « simplifier » est manqué.
- **Fiche poème = 4 champs** : titre, auteur, texte, voix. `source`, `statut`, `notes` retirés de
  l'écran ; **colonnes conservées en base** (on ne migre pas pour cacher).
- **Le choix de l'image et de la musique reste manuel.** C'est la seule décision artistique qui
  subsiste une fois le rendu automatisé — l'automatiser reviendrait à automatiser la valeur et à
  garder la saisie. Le tirage semé évoqué en § 6 est **écarté** pour le choix ; l'app *assiste*
  (texte à gauche, vivier filtrable à droite) au lieu de choisir.
  Règle générale retenue : *automatiser ce qui est mécanique et vérifiable, garder à la main ce qui
  relève du jugement* — et ne pas automatiser un geste qu'on n'a pas fait vingt fois.
- **Vivier décrit par un vocabulaire fermé de 8-10 ambiances**, coché à l'upload. Du texte libre ne
  se filtre pas et ne se retrouve pas trois mois plus tard. **Liste à trancher par Nicolas.**
- **Caption générée par gabarit déterministe** (titre, auteur, premier vers, signature, hashtags),
  **sans LLM**, éditable ensuite.
  → **Rediscuté et reconduit le 23/08 au soir.** Le frère de Nicolas tient depuis 2021 le compte
  Instagram `gaya__scienza` : 594 publications de textes savants (Empédocle, Thalès, Kant,
  Descartes, Newton, Darwin), ~376 caractères en médiane. La question s'est posée d'écrire les
  captions dans ce registre plutôt qu'au gabarit. **Écartée** : un gabarit ne peut pas produire
  ce genre de texte (il faut savoir qui est Heredia, ce qu'est Palos, pourquoi la Croix du Sud) —
  il faudrait soit un LLM (coût + rupture de la règle « tout en client »), soit du travail humain.
  Décision : **on garde le gabarit**. Le champ caption reste éditable dans l'Atelier, donc une
  note écrite à la main peut toujours remplacer le gabarit sur un poème qui le mérite, sans
  jamais bloquer la publication. Ne pas rouvrir sans que Nicolas le demande.
  → **24/08 : la caption devient une propriété du POÈME** (`poems.caption`, migration
  `20260824b`). Elle n'existait que sur `publications`, donc il fallait programmer une date
  pour avoir le droit d'écrire un texte — alors qu'une caption se pense en lisant le poème.
  Règle de reprise, dans `captionPour()` : à la programmation, la publication prend
  `poems.caption` si elle est renseignée, sinon le gabarit. Ce qui est écrit à la main gagne
  toujours ; le gabarit reste le défaut, donc **la décision ci-dessus tient**.
  Conséquence assumée : une caption écrite à la main vaut pour les trois plateformes,
  hashtags compris — on ne lui ajoute pas les tags de plateforme, sinon on ne saurait plus en
  la relisant ce qui vient de soi et ce qui vient du gabarit. Le bouton « régénérer » d'une
  publication appelle `genererCaption` et non `captionPour` : régénérer veut dire *revenir au
  gabarit*, y compris quand c'est de la caption du poème qu'on veut sortir.
  ⚠ **Une table `captions` dédiée a été examinée et écartée** : il n'y a qu'une caption par
  poème. On éclatera le jour où il en faudra une par plateforme, pas avant.

- ⚠ **L'export Instagram du frère** (`posts/` ≈ 71 Mo de JPG, plus un `posts_1.html` de 1,8 Mo)
  a été trouvé dans le dossier du dépôt le 23/08. **Le dépôt est public.** Ignoré via
  `.gitignore`, mais un fichier ignoré reste posé au mauvais endroit : le sortir du dossier.
  Le HTML contient **594 champs de géolocalisation** à six décimales et des métadonnées d'appareil
  photo. Ce sont les données personnelles d'un tiers — ne rien en publier, ne rien en committer,
  et ne pas s'en servir comme source d'images sans l'accord explicite de Charley.
- **Pré-remplissage titre/auteur/texte depuis la voix : abandonné.** Gain réel = 2 champs ; coût =
  serveur + API payante + règle « tout en client » cassée, sur un projet à coût visé 0 €. Et le
  texte doit venir de Wikisource collationné — Whisper ne peut pas en être la source.
- **`à valider` est un état humain**, donc une vraie colonne : c'est la seule exception au principe
  « l'avancement est dérivé ».

### Forçage des cartes du kanban — livré le 23/08 (colonne `poems.etape_manuelle`)

Nicolas a tranché pour la permissivité : **on peut déposer une carte dans n'importe quelle
colonne**, même contre les données. `poems.etape_manuelle` (text, nullable, contrainte sur les
6 identifiants d'étape) porte le forçage ; `NULL` = l'étape reste calculée.

⚠ **C'est la seule entorse au principe « l'avancement est dérivé », et elle n'est tenable qu'à
une condition : que le forçage se VOIE.** Une carte forcée porte un liseré or et la mention
« déplacée à la main — en réalité *<étape calculée>* » ; sa fiche rappelle la même chose et offre
« revenir au calcul ». Sans ces marqueurs on recréerait exactement `poems.status` : un champ
saisi qui dérive en silence et auquel plus personne ne se fie. **Ne jamais les retirer.**
Déposer une carte dans la colonne que le calcul donnait déjà remet `etape_manuelle` à `NULL` —
le retour au calcul est donc aussi naturel que le forçage.

`lib/etapes.ts` distingue désormais `etapeCalculee()` (les faits), `etapeDe()` (l'affiché, forçage
prioritaire) et `estForcee()`. **Tout écran qui appelle `etapeDe()` doit sélectionner
`etape_manuelle`** — sinon il affiche l'étape calculée pendant que le kanban montre l'autre, et les
écrans se contredisent (piège rencontré sur l'accueil, corrigé).

> 💡 **Le MCP Supabase n'est pas entièrement en lecture seule.** `execute_sql` refuse les écritures
> (`cannot execute INSERT in a read-only transaction`), mais **`apply_migration` fonctionne** : le
> DDL passe. Autrement dit, une migration peut être appliquée directement ; une insertion ou une
> mise à jour de données doit toujours passer par l'éditeur SQL du dashboard.
- **Accueil = « tient-on le rythme ? »** (vidéos prêtes d'avance, prochain trou au calendrier), pas
  un comptage d'objets — la régularité de publication est la priorité du projet.

Lots : **1** sans aucune migration (nav, fiche, caption, accueil) → livrable seul ;
**2** vivier (migration asset sans poème + mots-clés) ; **3** validation (migration) ;
**4** plomberie pipeline, à ne pas mélanger.

---

## 5. Infrastructure

| Élément | Détail |
|---|---|
| App | https://boulevard-victor-hugo.vercel.app |
| Vercel | team `nicobenzis-projects` (Pro), projet `boulevard-victor-hugo`, deploy auto sur `main` |
| Repo | github.com/Nicobenzi/Boulevard_Victor_Hugo — **public** (Actions gratuit et illimité) |
| Supabase | projet `cjnnzmfbqybgcmmvrodx`, org perso (Free), région eu-west-1 |
| Secrets Actions | `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` — **posés et vérifiés** le 23/08 |
| Rendu | `.github/workflows/render.yml` — cron **2 h** + manuel → `pipeline/render.py` (Python 3.11) |

Tables : `profiles`, `allowed_emails`, `poems`, `assets`, `publications`, `render_jobs`,
`inspirations`. Buckets privés : `videos`, `audios`, `images`.
Accès = allowlist `allowed_emails` + RLS `for all using (public.is_member()) with check (…)`.
Auth = lien magique ; Site URL sur l'URL Vercel (sinon le lien renvoie vers localhost).

**Pièges rencontrés (ne pas refaire)**

- **Version de Next : rester sur le rameau courant, pas sur un rameau fermé.** Vercel refuse de
  déployer une version porteuse d'une CVE — c'est ce qui avait forcé à quitter 15.1. Le rameau 15
  s'est fermé sur 15.5.23 (tag `backport`), qui épingle `postcss@8.4.31` et `sharp@^0.34.3`, tous
  deux vulnérables et **sans correctif possible en 15** (versions épinglées à l'exact par Next :
  ni `npm audit fix` ni un override propre n'y peuvent rien). Passage à **Next 16** le 23/08.
  Exposition réelle du projet : nulle (aucun `next/image`, aucun CSS tiers) — le motif est la
  continuité de déploiement, pas la sécurité. Migration sans friction : config vide, aucune route
  API, aucun middleware, aucune route dynamique, seul `next/font/google` est utilisé.
  Résultat : `found 0 vulnerabilities`, build vert en 9,6 s. **Next 16 utilise Turbopack par
  défaut** au build. Il **réécrit `tsconfig.json`** au passage (`jsx` → `react-jsx`, ajout de
  `.next/dev/types/**/*.ts` aux `include`) : ces changements sont à committer, sinon chaque build
  les réapplique et l'arbre reste sale. `next-env.d.ts` est généré → ajouté au `.gitignore`.
  `package-lock.json` est désormais suivi (il ne l'était pas).
- Le dashboard Supabase intercepte les frappes clavier automatisées : configurer l'auth à la main.
- **Le MCP Supabase est en lecture seule.** Toute écriture (insertion, migration) doit passer par
  l'éditeur SQL du dashboard. Prévoir des scripts collables et idempotents.
- **Police, repli silencieux.** `build_ass` demandait déjà Cormorant Garamond, mais le workflow la
  téléchargeait avec `|| true` : en cas d'échec, libass substitue **sans erreur** et les vidéos
  sortent dans une autre fonte que le site. Corrigé le 23/08 — plus de `|| true`, vérification
  `fc-list` dans le workflow **et** `check_font()` au démarrage de `render.py`.
- **ffmpeg redécode un PNG à chaque frame** avec `-loop 1 -i image.png` : ~1,9 img/s. Le filtre
  `loop` (décodage unique, image en mémoire) monte à ~9 img/s en 1080×1920. Appliqué au style
  cinétique ; musée et galerie sont restés sur l'ancien schéma et ont donc le même défaut.
- **GitHub arrondit chaque job à la minute pleine** : une exécution à vide de 4 s coûte 1 minute.

---
## 6. État au 23 août 2026 (fin de soirée)

### La chaîne tourne

Premier rendu réussi le 23/08 à 15 h 06 sur *Les Conquérants*, style `cinetique` : **3 minutes**
par vidéo, pas les 15 estimées. Les trois blocages de la journée sont levés :

- **Quota Actions** → dépôt passé en **public** (Actions y est gratuit et illimité, hors quota).
  Historique vérifié avant bascule : aucun secret n'a jamais été committé.
- **`SUPABASE_SERVICE_ROLE_KEY` n'existait pas**, masqué jusque-là par le quota. Posé depuis, avec
  deux garde-fous : le workflow refuse de démarrer si un secret est vide, et vérifie que la réponse
  Supabase est bien une **liste** (avec un secret manquant, PostgREST renvoie un objet d'erreur dont
  `len()` compte les clés → le workflow croyait avoir 3 jobs). `render.py` contrôle ses variables
  d'env en tête de fichier : `os.environ["X"]` ne lève rien pour une variable **vide**.
- **`render_jobs_style_check` n'autorisait que `musee` et `galerie`** : la base rejetait tout job
  `cinetique`. Corrigé par la migration `20260823b`.

### Livré le 23/08 au soir — 15 PR, toutes mergées

**L'app** — refonte UX complète (spec `docs/specs/spec-refonte-ux-atelier-2026-08-23.md`) :
nav à 4 onglets, Publications fusionné dans l'Atelier, fiche à 4 champs, caption générée, accueil
« tenue du rythme ». Puis palette claire, Ressources en base de données, vrai kanban sur une ligne
avec détail en fenêtre, colonnes déplaçables, forçage des cartes, vocabulaire d'ambiances.
Le détail de chaque décision et de son *pourquoi* est en **§ 4**, pas ici.

**Le socle** — **Next 16** (les 3 CVE `high` postcss/sharp éteintes, `found 0 vulnerabilities` ;
le rameau 15 est fermé et sans correctif possible), `tsconfig` réécrit par Next 16 et commité,
`package-lock.json` désormais suivi, `next-env.d.ts` ignoré.

**Le pipeline** — étalonnage du métrage (§ 3), repêchage des jobs bloqués, `MAX_JOBS = 2`.

**Les accès** — Charley est dans `allowed_emails` ; son profil se créera à sa première connexion
par lien magique (déclencheur `handle_new_user`).
→ **Ça n'a pas marché, et voici pourquoi (24/08).** `handle_new_user` ne crée un profil que si
l'adresse est **déjà** dans `allowed_emails` **au moment de l'inscription**. Charley s'était
connecté avant l'ajout : compte `auth.users` créé, profil jamais créé. Comme `is_member()`
interroge `profiles` et non l'allowlist, RLS le rejetait sur toutes les tables — app vide, aucun
message compréhensible. Réparé par la migration `20260824a` (idempotente, rejouable après chaque
ajout à l'allowlist). ⚠ **Le trou reste ouvert** pour tout compte créé avant son allowlistage :
le correctif de fond serait de faire retomber `is_member()` sur `allowed_emails` quand le profil
manque. Nicolas l'a jugé inutile — Charley est le seul collaborateur prévu.
**Leçon générale** : un déclencheur `AFTER INSERT` ne rattrape jamais les lignes déjà là. Toute
règle « à l'inscription » a besoin de son script de rattrapage.

**Les garde-fous de session** — encadré en tête de `CLAUDE.md` (ce projet n'est pas Coprovia,
vérifier l'accès au dossier) et `.claude/settings.json` qui désactive les six plugins `coprovia-*`
pour ce projet.
→ ⚠ **Vérifié le 24/08 : `.claude/settings.json` ne sert à rien ici.** Les skills `coprovia-*`
apparaissent quand même. Diagnostic : `list_plugins` ne renvoie **aucun** plugin installé
localement, et ces skills sont servies depuis un chemin de session (`…/rpm/plugin_*/skills/`).
Elles sont donc **attachées côté Claude.ai**, poussées dans la session au démarrage — alors que
`enabledPlugins` est un mécanisme Claude Code qui lit la config du projet sur disque. Aucun
fichier posé dans le dépôt ne peut les éteindre. **Il faut les détacher dans les réglages du
projet côté app Claude.** Le fichier est conservé comme trace du diagnostic, pas comme remède.

### Livré le 24/08 — PR #20, mergée

Reprise du projet après une semaine. Trois choses réparées, une ajoutée.

- **Charley avait bien un compte mais aucun profil** — diagnostic et migration de rattrapage
  `20260824a`. Le détail du piège (`AFTER INSERT` ne rattrape pas les lignes déjà là) est plus
  haut, dans « Les accès ».
- **`poems.caption`** (migration `20260824b`) — la caption devient une propriété du poème.
  Décision et règle de reprise en § 4.
- **Atelier utilisable au clavier** — le kanban ne se pilotait qu'à la souris ; un sélecteur
  d'étape dans la fiche porte le même forçage, avec la même règle de retour au calcul. Jours du
  calendrier en vrais boutons, piège à focus dans la fenêtre, cible du bouton « replier » de 8 à
  32 px. **Règle générale à garder** : toute action qui n'existe qu'au glisser-déposer doit avoir
  son équivalent ailleurs, sinon elle n'existe pas pour qui n'a pas de souris.
- **Contrastes corrigés** — `--line` et pastilles de plateforme, cf. l'encadré du 24/08 en § 2.

⚠ **Le bac à sable Linux ne peut pas builder** (les `node_modules` sont installés pour macOS, il
faudrait retélécharger `@next/swc-linux-arm64-gnu`, et son disque est plein). `npx tsc --noEmit`
y fonctionne et valide le typage, mais **`npm run build` doit tourner sur le Mac avant tout push**.
⚠ **Et mes commandes `git` côté bac à sable laissent un `.git/index.lock` orphelin** que je n'ai
pas le droit de supprimer : le `git commit` suivant échoue côté Mac avec « Another git process
seems to be running ». C'est arrivé le 24/08. Remède : `rm -f .git/index.lock` après avoir
vérifié qu'aucun processus git ne tourne. Mieux : ne pas lancer de `git` depuis le bac à sable.

### Le seul sujet encore ouvert : l'image

Nicolas ne veut ni tableaux de maîtres (« ça fait vieux ») ni le fond généré actuel.

- ✅ **`painterly_bg` a été SUPPRIMÉ le 23/08.** Mesuré avant de couper : la moitié haute montait à
  **143** de luminance et les pics à **247**, pour un crème de texte à **226** — le fond était par
  endroits *plus clair que les vers*, qui disparaissaient. Deux défauts de conception : les sept
  taches étaient tirées dans un carré central (`cx` 0,15–0,85) donc se superposaient toujours au
  même endroit, et la palette était claire par nature (`(228,188,122)`) sans rien qui borne la
  somme avant le `clip` final.
  **Décision de Nicolas : pas de fond de secours du tout.** `render.py` échoue franchement si
  aucune image ni métrage n'est lié — « aucun fond : lie une image ou du metrage à ce poème ».
  Le job passe en `error`, visible dans l'historique de la fiche. *Un fond raté publié vaut moins
  qu'un rendu qui refuse de partir.*
  L'app applique la même règle : `etapeCalculee()` garde le poème en « À préparer » tant qu'il n'a
  pas de fond, la carte affiche « aucun fond », et la fiche remplace le bouton par l'explication.
  ⚠ **Le contrôle côté `render.py` et celui de `lib/etapes.ts` doivent rester d'accord.** Si l'un
  bouge, l'autre aussi — sinon l'app propose un rendu qui échouera, ou le refuse à tort.
- **Si un générateur revient un jour**, le candidat était « E » : nébuleuse de braise + champ
  d'étoiles, animé (bruit 3D dont la 3ᵉ dimension est le temps), semé sur l'identifiant du poème.
  Principe à retenir de l'échec de `painterly_bg` : **partir du noir et ajouter très peu de
  lumière**, au lieu d'empiler des taches claires en espérant que l'assombrissement final rattrape.
- **Portraits d'auteur : pas en fond.** Testé sur la gravure de Heredia — un portrait remplit le
  cadre de détail et n'a **aucune zone calme**, les vers y sont illisibles. Sa place est la **carte
  d'ouverture** (titre + auteur), là où un regard retient mieux qu'une texture.
- **Le métrage filmé est désormais viable** grâce à l'étalonnage (§ 3) : le choix du plan devient
  secondaire, on prend celui dont le *mouvement* plaît. Premier vivier : 8 clips Mixkit dans
  `metrage/` (hors git), nommés `<ambiance>-<sujet>-<idMixkit>.mp4`, licence et provenance dans
  `metrage/SOURCES.md`.
- **Génération vidéo par IA : écartée** (§ 3). Filmé libre + étalonnage, ou fond généré maison.
- **Sources libres — deux pièges.** Sur Pexels, des vignettes iStock **payantes** sont mêlées aux
  résultats gratuits : si l'URL quitte `pexels.com`, c'est payant. Et sur toutes ces banques,
  aucune autorisation des personnes filmées n'est garantie → **pas de visages identifiables**.
  ⚠ Mixkit interdit explicitement le téléchargement automatisé (User Terms 9.10) : on télécharge
  à la main, ce qui est de toute façon plus rapide que de câbler un outil.
- Veille 2026 : la typographie animée est devenue un style à part entière (« le texte est le
  personnage principal »), et le grain argentique revient contre le rendu numérique trop propre.

### À faire

1. **Carte d'ouverture** avec portrait d'auteur traité en N&B dur.
2. **Purger les exports en double** : trois fichiers coexistent pour *Les Conquérants*
   (`cinetique`, `voix seule`, `avec musique`) ≈ 12 Mo, alors que la règle « un seul export » est
   actée. Résidus d'avant la décision.
3. **Cache du modèle Whisper** (~500 Mo retéléchargés à chaque exécution).
4. **Lot 3 de la refonte** : colonne `à valider`. C'est un état humain — le seul qui ne se dérive
   pas des données, comme `etape_manuelle` (§ 4).
5. ~~**Sortir du dépôt** l'export Instagram de Charley~~ — **fait**, vérifié le 24/08 : plus
   aucun `posts/` dans le dossier, et `git log` confirme qu'il n'a jamais été committé.
   Le rendre de nouveau consultable est **en suspens — Nicolas tranchera plus tard.** Ne rien
   entreprendre là-dessus sans qu'il le redemande.
   ⚠ **Rectification du 24/08, à ne pas re-perdre** : la note du 23/08 laissait croire que
   `.gitignore` était un pis-aller. C'est faux. `posts/` y figure, donc `git add -A` ne le voit
   pas et il n'atteint ni l'index, ni un commit, ni GitHub — et Vercel déployant depuis le
   dépôt git, pas depuis le disque, un fichier ignoré n'est pas déployé. Les trois cas qui
   cassent : `git add -f` (délibéré), un `.gitignore` réécrit, et surtout **`git clean -xdf`,
   qui ne fuite pas mais SUPPRIME** — le `-x` vise précisément les fichiers ignorés. Le vrai
   argument pour sortir l'export du dépôt est donc la **perte**, pas la fuite.
   Dans tous les cas : **purger l'EXIF avant tout usage** (594 géolocalisations à six
   décimales, métadonnées d'appareil — données personnelles d'un tiers), et aucune image
   publiée sans l'accord explicite de Charley. Me connecter le dossier n'est **pas** nécessaire
   pour que Nicolas le consulte : le jour où une image sert de fond, il passera celle-là.
6. **Les deux premiers poèmes** (*Bacchanale*, *Hymne à la Beauté*) n'existent qu'en texte :
   aucun asset, ni voix ni fond, en base comme sur disque (vérifié le 24/08 — `assets` ne
   contient que les 3 lignes des *Conquérants*). Les 8 clips Mixkit sont dans `metrage/` sur le
   Mac mais **jamais uploadés dans Ressources**. Pour les monter, il manque les deux
   enregistrements de voix. Visuel retenu : les Mixkit. Recollationner au passage le vers 7 de
   *Bacchanale* (deux virgules absentes de l'édition Lemerre 1893).
7. **`npm run build` doit tourner sur le Mac.** Le bac à sable Linux ne peut pas builder : il
   faudrait retélécharger `@next/swc-linux-arm64-gnu` (les `node_modules` sont installés pour
   macOS) et le disque y est plein. `npx tsc --noEmit` y fonctionne en revanche, et suffit à
   valider le typage — mais pas le build Turbopack.

### Plafonds à surveiller

- **50 Mo par fichier** (plan Free). Une vidéo de 56 s pèse ~4 Mo en `cinetique`, donc large — mais
  l'ancien export manuel de l'*Hymne* (1 min 47) faisait 47,8 Mo. Surveiller les poèmes longs.
- **1 Go de stockage.** Un seul export désormais, ce qui double l'autonomie. **Rien ne purge** :
  `render.py` uploade et n'efface jamais. Le compteur en tête de Ressources affiche le total.

### Déjà produit

**Par l'usine** (23/08) — *Les Conquérants* (Heredia), `cinetique`, 4,1 Mo. Premier passage complet
de la chaîne. Fond = `painterly_bg` faute de métrage lié, donc à refaire.

**Monté à la main, avant l'usine**

- *Bacchanale* (Heredia, 56 s) — 2 versions : fond peint généré, puis Poussin (*Bacchanale à la
  joueuse de luth*) en travelling. Musique piano + nappe, ré mineur.
  ⚠ Le texte utilisé contenait deux virgules absentes de l'édition Lemerre 1893 (vers 7).
- *Hymne à la Beauté* (Baudelaire, 1 min 47) — DA Galerie avec Moreau (*L'Apparition*).
  Image en 345×500 : si une version HD est trouvée, refaire en `cinetique`.
  Voix très compressée (26 kbps) → à réenregistrer un jour.

### Idées non tranchées

- v1.1 : upload YouTube automatique ; rappel par mail le jour d'une publication programmée
  (préférable à un polling de `render_jobs` dans l'app).
- Réglage du cadrage par poème pour le style cinétique : aujourd'hui c'est une heuristique
  (fenêtre à 62 % vers le bas). Demanderait une colonne dans `render_jobs`.
- **Couleurs des tags** dans Ressources : monochromes aujourd'hui, parce que `CLAUDE.md` interdit
  d'inventer des couleurs. Cinq teintes (une par type) sont faisables comme variables, mais c'est
  une levée de règle qui appartient à Nicolas.
