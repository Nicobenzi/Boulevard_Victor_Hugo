# memory.md — mémoire du projet
Dernière consolidation : 23 août 2026 (soir — après le premier rendu réussi)

Lire ce fichier au début de chaque session. Le mettre à jour après toute décision structurante.

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

> ⚠ **Le fond du style cinétique est le sujet non tranché du 23/08.** `painterly_bg` produit une
> tache pâle qui se bat avec le texte, et Nicolas ne veut plus de tableaux de maîtres. Les
> constats, le générateur retenu et la place des portraits sont en **§ 6**, pas ici.

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
- **Pré-remplissage titre/auteur/texte depuis la voix : abandonné.** Gain réel = 2 champs ; coût =
  serveur + API payante + règle « tout en client » cassée, sur un projet à coût visé 0 €. Et le
  texte doit venir de Wikisource collationné — Whisper ne peut pas en être la source.
- **`à valider` est un état humain**, donc une vraie colonne : c'est la seule exception au principe
  « l'avancement est dérivé ».
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

## 6. État au 23 août 2026 (soir)

### La chaîne tourne

Premier rendu réussi le 23/08 à 15 h 06, sur *Les Conquérants*, style `cinetique`.
**3 minutes** par vidéo, pas les 15 estimées. Le workflow passe au vert, `render.py` produit
le MP4, l'uploade et crée l'asset. Les trois blocages de la journée sont levés :

- **Quota Actions** → dépôt passé en **public**, Actions y est gratuit et illimité, hors quota.
  Historique vérifié avant bascule : aucun secret n'a jamais été committé.
- **`SUPABASE_SERVICE_ROLE_KEY` n'existait pas.** Découvert à la première exécution réelle,
  masqué jusque-là par le quota. Posé depuis. Deux garde-fous ajoutés pour que ça ne puisse plus
  passer inaperçu : le workflow refuse de démarrer si un secret est vide, et vérifie que la
  réponse Supabase est bien une **liste** (avec un secret manquant, PostgREST renvoie un objet
  d'erreur dont `len()` compte les clés → le workflow croyait avoir 3 jobs et déroulait tout).
  `render.py` contrôle aussi ses variables d'env en tête de fichier : `os.environ["X"]` ne lève
  rien pour une variable **vide**.
- **`render_jobs_style_check` n'autorisait que `musee` et `galerie`** : la base rejetait tout job
  en `cinetique`. Corrigé par la migration `20260823b`, qui ajoute aussi le type d'asset `broll`
  et le trigger `updated_at` manquant sur `inspirations`.

### Ce qui reste ouvert sur l'image

C'est le seul sujet non tranché, et il occupe la fin de la journée. Nicolas ne veut ni tableaux
de maîtres (« ça fait vieux ») ni le fond actuel.

- **`painterly_bg` est le coupable, pas la génération.** Il produit une grosse tache pâle et
  jaune, centrée, qui se bat avec le texte. D'autres fonds **générés exactement pareil**
  fonctionnent très bien. Ne pas conclure « il faut du filmé » : il faut un meilleur générateur.
- **Le candidat retenu (« E »)** : nébuleuse de braise + champ d'étoiles, **animé** (bruit 3D
  dont la 3ᵉ dimension est le temps, interpolé entre tranches), semé sur l'identifiant du poème.
  Sombre, dans la palette, avec de grandes zones calmes pour le texte. À substituer à `painterly_bg`.
- **Portraits d'auteur : pas en fond.** Testé sur la gravure de Heredia. Le traitement serré en
  noir et blanc dur + grain est visuellement très fort — mais un portrait remplit le cadre de
  détail partout et n'a **aucune zone calme** : les vers y sont illisibles. La bonne place est la
  **carte d'ouverture** (titre + auteur, premières secondes), là où un regard retient mieux
  qu'une texture. Puis le poème se déroule sur la matière et le noir.
- **Banque d'images partagée** — idée de Nicolas, à implémenter. Aujourd'hui un `broll` doit être
  lié à un poème, donc aucune mutualisation possible. Prévu : autoriser un `broll` sans poème,
  et faire piocher `render.py` dans ce vivier (tirage semé sur l'identifiant du poème).
  Ordre de priorité : plans propres au poème → banque partagée → fond généré.
- **Pexels : attention aux résultats sponsorisés.** Des vignettes iStock **payantes** sont
  mélangées aux résultats gratuits. Règle : si l'URL quitte `pexels.com`, c'est payant.
  Licence Pexels/Pixabay : commercial, sans attribution — mais aucune autorisation des personnes
  filmées n'est garantie, donc **pas de visages identifiables**.
- Veille 2026 : la typographie animée est devenue un style visuel à part entière (« le texte est
  le personnage principal »), et le grain argentique revient contre le rendu numérique trop propre.

### À faire

1. Remplacer `painterly_bg` par le générateur « E » (nébuleuse animée).
2. Carte d'ouverture avec portrait d'auteur traité en N&B dur.
3. Banque de métrage partagée (`broll` sans poème lié). ⚠ Le **tirage semé est écarté** pour le
   choix d'une ressource (cf. refonte UX du 23/08) : la sélection reste manuelle et assistée.
   Le tirage ne subsiste que comme **repli** quand rien n'est lié. Devient le **lot 2**.
4. **Caption générée** depuis le poème — rien ne la produit, et c'est 3 captions par publication
   à écrire à la main. Le poste manuel qui saturera en premier.
   → Tranché le 23/08 : **gabarit déterministe, sans LLM**. Fait partie du **lot 1** de la refonte UX.
5. **Reprise des jobs bloqués** : `main()` ne reprend que les `queued`. Un job mort reste
   `running` à jamais. Prévoir un repêchage après 1 h, et `MAX_JOBS = 2` (3 × ~3 min tient dans
   les 40 min, mais la marge est faible si un rendu est long).
6. Cache du modèle Whisper (~500 Mo retéléchargés à chaque exécution).
7. Ajouter l'email du frère dans `allowed_emails`.

### Plafonds à surveiller

- **50 Mo par fichier** (plan Free). Une vidéo de 56 s pèse ~4 Mo en `cinetique`, donc large —
  mais l'ancien export manuel de l'*Hymne* (1 min 47) faisait 47,8 Mo. Surveiller les poèmes longs.
- **1 Go de stockage.** Un seul export désormais (la voix seule est supprimée), ce qui double
  l'autonomie. Rien ne purge : `render.py` uploade et n'efface jamais.

### Déjà produit

**Par l'usine** (23/08) — *Les Conquérants* (Heredia), style `cinetique`, 4,1 Mo. Premier passage
complet de la chaîne. Fond = `painterly_bg` faute de métrage lié, donc à refaire quand le
générateur sera remplacé.

**Monté à la main, avant l'usine**

- *Bacchanale* (Heredia, 56 s) — 2 versions : fond peint généré, puis Poussin
  (*Bacchanale à la joueuse de luth*) en travelling. Musique piano + nappe, ré mineur.
  ⚠ Le texte utilisé contenait deux virgules absentes de l'édition Lemerre 1893 (vers 7).
- *Hymne à la Beauté* (Baudelaire, 1 min 47) — DA Galerie avec Moreau (*L'Apparition*).
  Image en 345×500 : si une version HD est trouvée, refaire en `cinetique`.
  Voix très compressée (26 kbps) → à réenregistrer un jour.

### Idées non tranchées

- v1.1 : upload YouTube auto ; rappel par mail le jour d'une publication programmée
  (préférable à un polling de `render_jobs` dans l'app).
- Réglage du cadrage par poème pour le style cinétique : aujourd'hui c'est une heuristique
  (fenêtre à 62 % vers le bas). Demanderait une colonne dans `render_jobs`.
