# memory.md — mémoire du projet
Dernière consolidation : 23 août 2026 (fin de journée)

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

Palette unique : fond `#0e0c0a`, panel `#161311`, crème `#ece4d4`, or `#c9a45c`.
Titres et vers en **Cormorant Garamond**. Ne pas introduire d'autres couleurs ni polices.
Contrastes vérifiés le 23/08 : tous conformes AA et AAA. **La palette n'est pas le problème** —
si une vidéo paraît terne, chercher du côté du cadrage et du rythme, pas de la couleur.

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
  Alternative écartée : serveur dédié (~5 €/mois). Attention, ce n'est **pas gratuit** sur un
  dépôt privé : voir § 6.
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

---

## 5. Infrastructure

| Élément | Détail |
|---|---|
| App | https://boulevard-victor-hugo.vercel.app |
| Vercel | team `nicobenzis-projects` (Pro), projet `boulevard-victor-hugo`, deploy auto sur `main` |
| Repo | github.com/Nicobenzi/Boulevard_Victor_Hugo — **privé** (cf. § 6) |
| Supabase | projet `cjnnzmfbqybgcmmvrodx`, org perso (Free), région eu-west-1 |
| Secrets Actions | `SUPABASE_URL` ✅ · `SUPABASE_SERVICE_ROLE_KEY` ❌ **à poser** (cf. § 6) |
| Rendu | `.github/workflows/render.yml` — cron **2 h** + manuel → `pipeline/render.py` (Python 3.11) |

Tables : `profiles`, `allowed_emails`, `poems`, `assets`, `publications`, `render_jobs`,
`inspirations`. Buckets privés : `videos`, `audios`, `images`.
Accès = allowlist `allowed_emails` + RLS `for all using (public.is_member()) with check (…)`.
Auth = lien magique ; Site URL sur l'URL Vercel (sinon le lien renvoie vers localhost).

**Pièges rencontrés (ne pas refaire)**

- Vercel refuse Next.js 15.1 (CVE) → rester sur `^15.5.4`.
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

## 6. État au 23 août 2026 (fin de journée)

### GitHub Actions — diagnostic constaté, pas supposé

Ce n'est **pas** un paiement en échec, malgré le message d'erreur qui mentionne les deux cas :
c'est le **quota de minutes épuisé**. Les limites incluses se réinitialisent en début de mois
→ **attendre débloque réellement**.

La consommation ne vient pas de ce projet, qui n'existait pas avant le 23 : elle est antérieure.
Attendre débloquera donc, puis le problème reviendra le mois suivant.
(Détails de facturation volontairement non versionnés — voir les notes hors dépôt.)

- **Correctif robuste, non appliqué** : passer le repo en **public**. Actions y est gratuit et
  illimité, hors quota. Sans risque — aucun secret dans le code, `service_role` en GitHub Secrets.
  Historique vérifié le 23/08 : aucun secret n'a jamais été committé.
- **Correctif appliqué** : cron 30 min → **2 h**. 48 sondages/jour facturés une minute chacun
  faisaient ~1 440 min/mois pour rien ; à 2 h, ~360 min/mois.

Tant que c'est bloqué, les rendus se font à la main dans Cowork, mêmes réglages que `render.py`.

### ⚠ Le secret le plus important n'existe pas

Constaté le 23/08 à la **première exécution réelle** du workflow : la page Secrets ne contient
que `SUPABASE_URL`. **`SUPABASE_SERVICE_ROLE_KEY` n'a jamais été créé**, malgré la note
« posés » qui figurait ici. Indétectable jusque-là : le blocage de quota refusait les jobs
avant démarrage, donc `render.py` n'a jamais tourné une seule fois.

Le pipeline n'aurait donc pu fonctionner sur **aucun** commit, dans **aucun** style.

Deux défauts corrigés dans la foulée :
- L'étape « Check queued jobs » faisait `len()` sur la réponse JSON. Avec un secret manquant,
  PostgREST renvoie un **objet d'erreur** dont `len()` compte les clés → le workflow croyait
  avoir 3 jobs et enchaînait. Il vérifie maintenant que la réponse est bien une liste.
- `os.environ["X"]` ne lève pas d'erreur pour une variable **vide** : `render.py` échouait plus
  loin sur « supabase_key is required ». Le contrôle est désormais en tête de fichier.

→ À faire : Supabase → Project Settings → API Keys → `service_role`, puis GitHub → Settings →
Secrets and variables → Actions → New repository secret, nom exact `SUPABASE_SERVICE_ROLE_KEY`.

### En attente d'une action de Nicolas

1. **Deux SQL à passer** dans l'éditeur Supabase — la base est encore vide :
   l'insertion des deux poèmes, puis `supabase/migrations/20260823_inspirations.sql`.
   Sans la migration, l'onglet Veille affiche une erreur.
2. **Branche `nav/fusion-publications`** — 6 commits, +1298/−300, **non mergée et non testée
   en usage réel**. Les 6 déploiements Vercel sont en READY (les builds sont sains), mais
   personne n'a cliqué dans la preview. À vérifier en priorité : la bascule calendrier/liste
   et le dépôt multi-fichiers, les deux endroits où le comportement a le plus changé.
3. **Jamais exécuté de bout en bout** : le style `cinetique` dans `render.py`, et la lecture
   d'une bande son liée au poème. Validés par morceaux, jamais dans un vrai job.
4. Ajouter l'email du frère dans `allowed_emails`.
5. Uploader les 4 vidéos déjà montées — **après** l'insertion des poèmes, l'upload exige le lien.

### Déjà produit (monté à la main)

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
