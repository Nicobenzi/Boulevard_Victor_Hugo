# Spec — Refonte UX : l'app comme usine et planning (2026-08-23)

> Cadrage produit. Statut : à implémenter. Handoff : corrige-et-livre.
> Espace : app web (Next.js 15, tout en client).

## Intention

L'app est aujourd'hui rangée **par table Supabase** (Publications, Poèmes, Bibliothèque, Veille).
Le travail réel, lui, est une **chaîne** : texte → voix → image/musique → rendu → caption →
publication. Une seule vidéo fait traverser trois onglets.

Constat décisif du cadrage : **les poèmes se travaillent en dehors de l'app** (choix de l'œuvre,
collationnement du texte, enregistrement de la voix). L'app n'est donc pas un studio d'écriture.
C'est une **usine de rendu** et un **planning de publication**. L'onglet « Poèmes » ment sur le
produit, et son formulaire fait saisir des informations que personne ne relit.

On voit que c'est résolu quand : produire une vidéo à partir d'une voix enregistrée ne demande
plus de changer d'écran, et quand aucune caption n'est écrite à la main.

## Périmètre

**Dans**

- Nouvelle navigation à quatre onglets : **Accueil · Atelier · Ressources · Veille**.
- Fusion de `Publications` dans `Atelier` (bascule kanban / calendrier).
- Fiche poème réduite à quatre champs utiles.
- Vivier de ressources partagées (images, musiques) non liées à un poème.
- Écran de sélection image/musique côte à côte avec le texte du poème.
- Caption générée par gabarit déterministe.
- Écran d'accueil orienté « tenue du rythme ».
- Colonne de validation humaine (`à valider`).

**Hors — explicitement**

- **Pré-remplissage titre/auteur/texte depuis la voix.** Abandonné : gain réel de deux champs,
  coût = un serveur + une API payante + la règle « tout en client » cassée. Sur un projet à coût
  visé 0 €, le calcul ne se discute pas. Et le texte doit de toute façon venir de Wikisource
  collationné — Whisper ne peut pas en être la source (deux écarts constatés en août).
- **Choix automatique de l'image ou de la musique** (tirage semé, description automatique,
  appariement sémantique). Voir « Règles métier », décision 5.
- Toute connexion aux API des réseaux sociaux (lecture ou écriture). Cf. `memory.md` § 4.
- Les captions multiples par plateforme (voir « à trancher »).
- La plomberie du pipeline (reprise des jobs bloqués, cache Whisper) : nécessaire, mais hors
  refonte UX. Reste au § 6 de `memory.md`.

## Règles métier & décisions

1. **L'app est une usine + un planning, pas un éditeur.** — *pourquoi* : les poèmes se travaillent
   ailleurs. Toute fonctionnalité d'écriture ou d'annotation est du poids mort.

2. **La fiche poème se réduit à : titre, auteur, texte, voix.** `source`, `statut` et `notes`
   disparaissent de l'interface. — *pourquoi* : trois champs jamais relus, et `poems.status` est
   déjà déclaré non fiable (`memory.md` § 4, l'avancement est dérivé).
   **Les colonnes restent en base** : on retire de l'écran, on ne casse rien et on ne migre pas.

3. **Le bouton « Générer la vidéo » apparaît dès que les quatre champs sont remplis.** — *pourquoi* :
   supprimer l'étape « chercher où se trouve l'action ». Le style reste réglable, défaut `cinetique`.

4. **`Publications` fusionne dans `Atelier`, en bascule de vue.** Kanban = par étape ; calendrier =
   par date de publication. — *pourquoi* : un poème programmé est le même objet vu plus tard.
   Deux onglets affichaient deux vues d'un même cycle. Précédent identique dans `memory.md` § 4
   (fusion `Calendrier` + `À publier` le 23/08). Garder `/publications`, `/poemes`, `/calendrier`
   et `/publier` en redirections.

5. **Le choix de l'image et de la musique reste manuel.** — *pourquoi* : c'est la seule décision
   artistique qui subsiste une fois le rendu automatisé. L'automatiser reviendrait à automatiser
   la valeur et à conserver la saisie. Règle générale retenue : *on automatise ce qui est mécanique
   et vérifiable, on garde à la main ce qui relève du jugement* — et on n'automatise pas un geste
   qu'on n'a pas encore fait vingt fois (3 vidéos produites à ce jour, dont 1 par l'usine).
   L'app **assiste** ce choix au lieu de le faire : texte du poème à gauche, vivier filtrable à
   droite, vignettes d'images et nappes jouables en un clic, sans changer d'écran.

6. **Le vivier est décrit par un vocabulaire fermé de 8 à 10 ambiances**, coché à l'upload.
   — *pourquoi* : du texte libre ne se filtre pas et ne se retrouve pas trois mois plus tard.
   Une rangée de puces coûte deux secondes et rend le filtre réellement utilisable.
   **Liste exacte à trancher** (voir plus bas).

7. **La caption est générée par gabarit déterministe** : titre, auteur, premier vers, signature
   « chaque jour, un poème », hashtags fixes. Aucun LLM. — *pourquoi* : c'est le poste qui sature
   en premier (`memory.md` § 6, à-faire n° 4), trois captions par publication à la main. Un gabarit
   suffit et donne un résultat plus régulier. Reste éditable après génération.

8. **La programmation automatique est conservée, mais rendue explicite.** — *pourquoi* : Nicolas la
   trouve bonne ; le problème n'est pas l'automatisme mais son silence. Le bandeau doit annoncer ce
   qui a été programmé avant que ça le soit, pas après.

9. **`à valider` est un état humain, donc une vraie colonne.** — *pourquoi* : tout le reste de
   l'avancement est dérivé des données (`memory.md` § 4), mais « j'ai regardé la vidéo et elle me
   va » ne se déduit d'aucune donnée. [HARD-STOP] migration.

10. **L'accueil répond à une seule question : « tient-on le rythme ? »** Nombre de vidéos prêtes
    d'avance, prochain trou dans le calendrier, et ce qui bloque. — *pourquoi* : à deux personnes
    et un poème par jour visé, un tableau de bord qui compte les objets est décoratif. La régularité
    de publication est la priorité affichée du projet (`memory.md` § 1).

**À trancher avant ou pendant l'implémentation**

- **La liste des 8 à 10 ambiances** du vocabulaire fermé (sombre, braise, mer, ruine, aube… ?).
  Nicolas seul peut la fixer : elle engage tout le vivier.
- **Les colonnes du kanban.** Proposition dérivable sans nouvelle donnée : *À préparer* (texte ou
  voix manquant) · *Prêt à rendre* · *En rendu* · *À valider* · *Programmé* · *Publié*. Six colonnes,
  c'est peut-être encore trop pour un flux à deux.
- **Le gabarit de caption** : un seul pour les trois plateformes, ou un par plateforme ?
- **Le seuil de « rythme tenu »** sur l'accueil : combien de jours d'avance = vert ?

## Données & sécurité

Tables existantes : `profiles`, `allowed_emails`, `poems`, `assets`, `publications`,
`render_jobs`, `inspirations`. Buckets privés : `videos`, `audios`, `images`.
Accès = allowlist `allowed_emails` + RLS via `public.is_member()`.

- **Lot 1 : aucune écriture de schéma.** Retirer des champs de l'écran, refondre la nav, générer
  une caption et calculer l'accueil se font entièrement en lecture sur l'existant.

- ~~**[HARD-STOP] Autoriser un asset sans poème lié.**~~ **Corrigé le 23/08 après vérification du
  schéma : il n'y a jamais eu de hard-stop.** `assets.poem_id` est **nullable**, et les seules
  contraintes de la table sont la clé primaire, les deux clés étrangères et
  `assets_kind_check`. L'obligation « poème lié » n'existait que **dans le composant**
  (`POEM_REQUIRED`). Le vivier partagé ne demande donc **aucune migration** — livré avec la
  refonte de la page Ressources.

- ~~**[HARD-STOP] Colonne de mots-clés d'ambiance.**~~ **Également levé** : `assets.meta` est un
  `jsonb` existant, `NOT NULL DEFAULT '{}'`. Les ambiances peuvent y être rangées sans migration.
  Reste à trancher : `meta` (zéro migration, moins explicite) ou une vraie colonne (plus propre,
  demande une migration). Le vocabulaire lui-même reste le seul vrai bloquant, et il dépend de
  Nicolas.

- **[HARD-STOP] Colonne de validation** (`validated_at` ou équivalent) sur `render_jobs` ou
  `assets` — le porteur reste à déterminer à l'implémentation. Migration.

- Rappel : **le MCP Supabase est en lecture seule.** Toute migration passe par l'éditeur SQL du
  dashboard, avec un script collable et idempotent, dans `supabase/migrations/`. Ne jamais modifier
  une migration appliquée.

- Pas de données personnelles concernées. Aucun secret nouveau.

## Impact app ↔ mobile

Sans objet : pas d'application mobile sur ce projet. L'app est responsive et consultée au
téléphone — vérifier que le kanban reste utilisable en colonne unique sur petit écran.

## Cas limites

- **Poème sans voix** : la carte reste en *À préparer*, le bouton de rendu est absent (pas grisé
  avec une alerte au clic, comme aujourd'hui).
- **Vivier vide** : l'écran Ressources doit avoir un état vide qui explique quoi déposer, et le
  rendu retombe sur le fond généré (comportement actuel de `render.py`).
- **Ressource sans aucune ambiance cochée** : autorisée, mais invisible aux filtres. Le prévenir à
  l'upload plutôt que de rendre le champ obligatoire.
- **Poème programmé puis vidéo invalidée** : la publication doit repasser en brouillon, pas rester
  programmée avec une vidéo rejetée.
- **Deux publications le même jour** : le calendrier doit les afficher toutes, pas la première.
- **Fichier au-delà de 50 Mo** (plafond Supabase Free) : message explicite à l'upload. Le stockage
  est le vrai plafond du projet (1 Go, rien ne purge).
- **Poème publié puis republié ailleurs** : une même vidéo peut porter plusieurs publications
  (Instagram, TikTok, YouTube) — le kanban ne doit pas la dupliquer.

## Critères d'acceptation

- [ ] La navigation compte quatre onglets : Accueil, Atelier, Ressources, Veille.
- [ ] `/publications`, `/poemes`, `/calendrier` et `/publier` redirigent sans 404.
- [ ] Créer un poème demande exactement quatre champs ; `source`, `statut` et `notes` n'apparaissent
      sur aucun écran.
- [ ] Le bouton de rendu n'est visible que lorsque texte et voix existent.
- [ ] L'Atelier bascule entre kanban et calendrier sans rechargement, en une requête pour les deux.
- [ ] Une image ou une musique peut être déposée **sans** poème lié, et apparaît dans Ressources.
- [ ] Le vivier se filtre par ambiance ; une nappe se joue sans quitter l'écran.
- [ ] Le choix image + musique d'un poème se fait sur un seul écran, texte du poème visible.
- [ ] Toute publication créée porte une caption pré-remplie, éditable, jamais vide.
- [ ] L'accueil affiche le nombre de vidéos prêtes d'avance et la prochaine date non pourvue.
- [ ] La programmation automatique annonce ce qu'elle va faire avant de le faire.
- [ ] Une vidéo peut être marquée validée, et l'état survit à un rechargement.
- [ ] `npm run build` passe.
- [ ] La DA est inchangée : `#0e0c0a` / `#161311` / `#ece4d4` / `#c9a45c`, Cormorant Garamond.
      Aucune couleur ni police nouvelle.
- [ ] Aucune dépendance ajoutée (skill `karpathy`).

## Risques / hard-stops

| Sujet | Nature | Statut |
|---|---|---|
| Asset sans poème lié | Migration + RLS | [HARD-STOP], validation séparée |
| Mots-clés d'ambiance sur `assets` | Migration + contrainte | [HARD-STOP], dépend du vocabulaire à trancher |
| Colonne de validation | Migration | [HARD-STOP], porteur à déterminer |
| Fusion Publications → Atelier | Perte de repères | Redirections obligatoires |
| Vocabulaire d'ambiance | Décision produit | À trancher par Nicolas, engage tout le vivier |

**Risque principal, non technique** : le cadrage a commencé par « simplifier » et a produit un
dashboard, un kanban, un calendrier et un vivier filtrable. La fusion Publications → Atelier est ce
qui maintient le compte à quatre onglets. Si elle est abandonnée en cours de route, la refonte
devient un enrichissement — et l'objectif initial est manqué.

## Découpage en lots

**Lot 1 — sans aucune migration.** Nav à quatre onglets, fusion Publications → Atelier (vue liste
et calendrier d'abord), fiche poème à quatre champs, caption générée, écran d'accueil. Livrable
seul, testable seul. C'est ici que se trouve l'essentiel du gain ressenti.

**Lot 2 — le vivier.** [HARD-STOP] migration asset sans poème + mots-clés. Écran Ressources,
filtres par ambiance, écran de sélection côte à côte. Demande le vocabulaire tranché.

**Lot 3 — la validation.** [HARD-STOP] migration. Colonne `à valider` et kanban complet.

**Lot 4 — hors UX, à ne pas mélanger.** Reprise des jobs bloqués, `MAX_JOBS = 2`, cache Whisper,
générateur de fond « E », carte d'ouverture avec portrait. Cf. `memory.md` § 6.

## → corrige-et-livre

Prêt pour corrige-et-livre : « implémente le **lot 1** de la spec spec-refonte-ux-atelier-2026-08-23 ».

Le lot 1 ne touche ni la base, ni les policies, ni le pipeline — il peut partir immédiatement.
Les lots 2 et 3 sont bloqués par des hard-stops migration et, pour le lot 2, par le vocabulaire
d'ambiance qui reste à trancher.
