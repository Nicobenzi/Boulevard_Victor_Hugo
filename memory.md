# memory.md — mémoire du projet
Dernière consolidation : 23 août 2026

Lire ce fichier au début de chaque session. Le mettre à jour après toute décision structurante.

---

## 1. Le projet

**Boulevard Victor Hugo** — poèmes du domaine public, lus à voix haute, montés en vidéo verticale
(1080×1920) pour Instagram / TikTok / YouTube. Signature de fin : « chaque semaine, un poème ».

- **Le frère de Nicolas** : la voix (choix des poèmes, enregistrement des lectures).
- **Nicolas** : production, montage, tech, publication.
- Projet passion à deux, coût visé = 0 €. Priorité : régularité de publication > perfection technique.

**Droits** : ne monter que des auteurs morts depuis plus de 70 ans (Baudelaire, Heredia, Rimbaud,
Verlaine, Hugo, Apollinaire…). Prévert, Aragon, Char = encore protégés, à éviter.
Idem pour les tableaux : domaine public (Wikimedia Commons), et attention aux *enregistrements*
musicaux modernes d'œuvres classiques, qui restent protégés → d'où la musique composée maison.

---

## 2. Direction artistique (validée)

Palette unique : fond `#0e0c0a`, panel `#161311`, crème `#ece4d4`, or `#c9a45c`.
Titres et vers en **Cormorant Garamond**. Ne pas introduire d'autres couleurs ni polices.

- **I. Musée** (défaut) — tableau plein écran, Ken Burns lent (zoom 1 → 1,085) ; si le tableau est
  en format paysage, travelling horizontal lent à la place. Dégradé sombre en bas pour la lisibilité.
- **II. Galerie** — tableau encadré d'un filet doré sur fond noir, vers sous le cadre.
  À utiliser quand l'image est en basse résolution (elle reste nette en petit).
- **III. Nocturne** — typographie seule sur dégradé, sans image. Pour alterner.
- **IV. Cinétique** (23/08/2026, après veille concurrence) — les mots apparaissent un à un sur la
  voix, **un seul accent or par vers** (le mot le plus long), et l'image **alterne** avec de la
  typographie sur noir tous les 3-4 vers. L'image n'est jamais montrée en plan large : on entre
  à ~1,55× et la fenêtre est calée sur le **bas** du tableau, là où sont les figures.

**Pourquoi** : un plan fixe est une cible de scroll (rétention < 50 % à 3 s = le reste ne compte
pas). L'ancien Ken Burns faisait 0,15 %/s, soit une image fixe à l'œil. Et les tableaux ne sont
pas tristes — c'était le **cadrage large** qui l'était : le même Poussin recadré sur les figures
n'a plus rien à voir. Vérifié sur *Bacchanale*.

**Structure d'une vidéo** : hook direct sur le premier vers (le titre lu est coupé), cartouche
titre + auteur en fondu à 1 s, vers sous-titrés au rythme de la voix, carte signature à la fin.

---

## 3. Règles de montage (dures, issues de l'expérience)

- Les sous-titres affichent le **texte canonique** du poème (`poems.body`, un vers par ligne),
  jamais la transcription brute — le public de poésie repère les écarts.
  La transcription (faster-whisper, mots horodatés) ne sert qu'à **caler** les vers (alignement difflib).
- Césure des vers longs à l'hémistiche (2 lignes max).
- Voix : `highpass=70` + `afftdn` + `loudnorm I=-14:TP=-1.5` (norme plateformes).
- Toujours **2 exports** : *avec musique* et *voix seule* — la voix seule sert quand on ajoute
  un son via l'app TikTok/Reels (meilleure portée).
- Musique : nappe drone générée (numpy) + piano composé à la main, 100 % original → aucun risque
  de réclamation de droits. Ré mineur pour Bacchanale, la mineur (plus vénéneux) pour l'Hymne.
- Durées : ~1 min = idéal Reels/TikTok. Au-delà de 1 min 30, prévoir YouTube ou un découpage en 2 parties.

---

## 4. Décisions d'architecture

- **Publication v1 = assistée**, pas d'API directe. Vérifié en août 2026 : Instagram exige un
  compte Business + app review Meta (2-4 semaines) ; TikTok poste en « moi uniquement » sans audit ;
  YouTube verrouille en privé les uploads d'un projet non audité.
  → L'app prépare le fichier + la caption, Nicolas publie en 2 clics.
  v2 : YouTube auto d'abord (le plus simple : privé → public à la main), puis Meta/TikTok après reviews.
- **Usine de rendu = GitHub Actions** (gratuit, 2 000 min/mois) — ffmpeg + Whisper sont trop lourds
  pour Vercel. Alternative écartée : serveur dédié (~5 €/mois).
- **Déclenchement = bouton « Générer la vidéo »** sur la fiche poème (choix bande son + tableau + DA),
  pas de rendu automatique à l'upload → évite les rendus inutiles.
- App volontairement simple : tout en client components + supabase-js direct, pas de couche
  d'abstraction (voir skill `karpathy`).
- **Nav à 3 onglets** (23/08/2026, suite à l'audit navigation). `Calendrier` et `À publier` étaient
  deux vues de la même table `publications` : fusionnés en un onglet **Publications** avec bascule
  calendrier / liste. Une seule requête pour les deux vues, filtrage du mois côté client.
  `/calendrier` et `/publier` restent en redirections.
  Corollaire : l'état d'avancement d'un poème est désormais **dérivé** (body → audio → vidéo →
  publication) et affiché sur la liste Poèmes. Le champ `poems.status` reste éditable mais n'est
  plus la source de vérité — ne pas s'y fier.
- **Veille** (23/08/2026) — table `inspirations` + onglet dédié : carnet des comptes et vidéos
  repérés chez les autres. La nav repasse donc à 4 onglets, mais pour une **entité distincte** —
  ce n'était pas l'erreur corrigée plus haut, qui était deux onglets pour une seule table.
  Table nommée `inspirations` et non `references` : mot réservé en SQL.
- **Musique** — `render.py` ignorait les assets `kind='music'` et générait toujours sa nappe.
  Corrigé : la bande son liée au poème est utilisée si elle existe. **Lier la musique au poème
  dans la Bibliothèque est donc le mécanisme de sélection** — il n'y a pas d'autre réglage.
  `pipeline/make_music.py` génère la banque de nappes (5 tonalités + un pouls).

---

## 5. Infrastructure

| Élément | Détail |
|---|---|
| App | https://boulevard-victor-hugo.vercel.app |
| Vercel | team `nicobenzis-projects` (Pro), projet `boulevard-victor-hugo`, lié au repo → deploy auto sur `main` |
| Repo | github.com/Nicobenzi/Boulevard_Victor_Hugo (privé) |
| Supabase | projet `cjnnzmfbqybgcmmvrodx`, org perso (Free), région eu-west-1 |
| Secrets Actions | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (posés) |

Base : `profiles`, `allowed_emails`, `poems`, `assets`, `publications`, `render_jobs`.
Buckets privés : `videos`, `audios`, `images`. Accès = allowlist + RLS via `public.is_member()`.
Auth = lien magique par email ; Site URL configurée sur l'URL Vercel (sinon le lien renvoie vers localhost).

**Pièges rencontrés** (ne pas refaire) :
- Vercel refuse Next.js 15.1 (CVE) → rester sur `^15.5.4`.
- Le dashboard Supabase intercepte les frappes clavier automatisées : configurer l'auth à la main.
- **Police : repli silencieux.** `build_ass` demandait déjà Cormorant Garamond, mais le workflow
  la téléchargeait avec `|| true`. En cas d'échec, libass substitue sans erreur et les vidéos
  sortent dans une autre fonte que le site. Corrigé le 23/08 : plus de `|| true`, vérification
  `fc-list` dans le workflow **et** `check_font()` au démarrage de `render.py`.
- **ffmpeg redécode un PNG à chaque frame** quand on fait `-loop 1 -i image.png` : ~1,9 img/s.
  Avec le filtre `loop` (décodage unique, image gardée en mémoire) on passe à ~9 img/s à
  1080×1920. Appliqué au style cinétique ; les styles musée/galerie restent sur l'ancien schéma.

---

## 6. État au 23 août 2026

**GitHub Actions — diagnostic posé le 23/08/2026** (constaté sur la page de facturation, pas supposé).
Ce n'est **pas** un paiement en échec, malgré le libellé du message d'erreur qui mentionne les deux cas :
c'est le **quota Actions épuisé**, 3 000 / 3 000 minutes sur un compte GitHub Pro, budget à 100 %.
Les limites incluses se réinitialisent chaque début de mois → **attendre débloque réellement**.

Mais la consommation monte régulièrement depuis le 1er août (0,63 à 3,73 $/jour) alors que ce projet
n'existait pas avant le 23 : **le quota est vidé par un autre des 9 dépôts**, pas par celui-ci.
Attendre débloquera donc, puis le problème reviendra le mois suivant.

- **Correctif robuste** : passer le repo en **public**. Actions y est gratuit et illimité, hors quota.
  Sans risque : aucun secret dans le code, `service_role` uniquement en GitHub Secrets.
- **Correctif appliqué le 23/08** : cron passé de 30 min à **2 h**. GitHub arrondit chaque job à la
  minute pleine, donc une exécution à vide de 4 s coûte 1 minute : 48 sondages/jour = ~1 440 min/mois
  pour rien. À 2 h : ~360 min/mois.

→ Tant que c'est bloqué, les rendus se font à la main dans Cowork, mêmes réglages que `pipeline/render.py`.

**À faire**
- Ajouter l'email du frère dans `allowed_emails` (toujours en attente).
- Uploader dans la Bibliothèque les 4 vidéos déjà montées. ⚠ Depuis l'audit du 23/08, l'upload
  d'une vidéo / voix / image exige de choisir le poème lié : créer les fiches Bacchanale et
  Hymne à la Beauté d'abord.
- Vérifier la nature du blocage GitHub Actions : un **paiement en échec** ne se débloque pas au
  cycle de facturation suivant, contrairement à ce qui était noté ici.
- v1.1 : upload YouTube auto ; rappel par mail le jour d'une publication programmée.

**Déjà produit (monté à la main)**
- *Bacchanale* (Heredia, 56 s) — 2 versions : fond peint généré, puis Poussin
  (*Bacchanale à la joueuse de luth*) en travelling. Musique piano + nappe, ré mineur.
- *Hymne à la Beauté* (Baudelaire, 1 min 47) — DA Galerie avec Moreau (*L'Apparition*).
  L'image dont on dispose est en 345×500 : si une version HD est trouvée, refaire en DA Musée.
  L'enregistrement de la voix est très compressé (26 kbps) → à réenregistrer un jour.
