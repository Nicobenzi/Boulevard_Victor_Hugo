# Spec — Le vivier se regarde et s'écoute (2026-08-24)

> Cadrage produit. Statut : à implémenter. Handoff : `corrige-et-livre`.
> Espace : app web (Next.js 16, tout en client). Route `/ressources` + panneau de `/atelier`.
> Amont : `brief-design-ressources-2026-08-24.md` et son addendum (palette tranchée, deux réserves).

## Intention

La page Ressources demande de cocher « braise » sur `1756042931_0_IMG_4471.jpg` — **un nom de
fichier, jamais la matière**. Une nappe ne s'écoute pas, un plan ne se voit pas. Le seul moyen de
savoir ce qu'on classe est de télécharger le fichier dans un autre onglet.

Le résultat est mesurable et sans appel : **22 ressources en base, zéro ambiance renseignée**.
Le vocabulaire fermé figé le 23/08 n'a jamais servi. Les facettes d'ambiance existent, sont
correctes, et ne peuvent afficher que du vide.

On voit que c'est résolu quand : les **14 ressources du vivier** (8 métrages, 6 nappes) sont
classées en une seule séance, sans quitter l'écran ni ouvrir un fichier — et quand choisir un
plan au montage ne se fait plus dans un menu déroulant de noms de fichiers.

## Périmètre

**Dans**

- Refonte de `/ressources` : liste vignettée + fiche latérale, en remplacement de la table.
- Composant `Vivier` partagé, monté en `mode="gestion"` (Ressources) et `mode="selection"`
  (panneau de l'Atelier, l. 928-955).
- Vignettes et lecture audio sur place.
- Dépôt avec contrôle **avant** envoi (poids, type, quota restant) et total.
- Jauge de quota lisible, avec seuil.
- Passage de l'app au bleu d'encre (les **quatre** onglets).
- États : vide, filtré à zéro, dépôt, refus, échec, confirmation de suppression, quota haut.

**Hors — explicitement**

- Le **choix automatique** de l'image ou de la musique. Décision du 23/08, inchangée.
- Toute **migration de schéma**. Rien de ce qui suit n'en demande.
- Le **vocabulaire des ambiances** : neuf mots, figés, non négociables ici.
- La purge ou l'archivage automatique du stockage.
- La DA des vidéos (`pipeline/render.py`), qui reste sombre et sans rapport.
- La progression d'envoi fichier par fichier (voir décision 6).

## Règles métier & décisions

1. **Une liste vignettée unique. Pas de grille, pas de bascule.** Ligne de 72 px : la vignette y
   tient, et on garde ce que la table donnait — trier, comparer, voir les trous.
   — *pourquoi* : pour 22 fichiers, deux vues à maintenir seraient une dette pour rien. Le projet
   a déjà payé ce prix avec le tableau à 7 colonnes en `text-xs`.

2. **L'édition sort de la ligne et va dans une fiche latérale persistante.**
   — *pourquoi* : mieux signaler une cellule éditable ne sert à rien, une pastille de 20 px dans
   une ligne de 34 ne sera jamais une bonne cible. Et la fiche qui reste ouverte pendant qu'on
   descend la liste **est** le mode « classer » : pas besoin d'un troisième écran.
   Les `<select autoFocus onBlur>` en cellule disparaissent.

3. **La vignette est générée au dépôt, côté client, et rangée dans `meta.vignette`.**
   Canvas natif → JPEG 152 × 104, qualité 0,7, ~8 Ko, en data-URI.
   Pour une **image** : dessin direct. Pour un **métrage** : `loadedmetadata` → `currentTime = 0.1`
   → `seeked` → capture. Pour une **nappe** : pas de vignette, un aplat `--gold-light` avec ▶.
   — *pourquoi* : c'est la réponse à la réserve d'egress. Afficher les **originaux** en
   `object-fit: cover` sur 76 × 52 ferait, le jour où les images arrivent, 60 Mo par chargement de
   page contre **5 Go d'egress par mois** sur le plan Free — une centaine d'ouvertures et le mois
   est consommé. Une vignette de 8 Ko voyage avec la ligne, ne coûte aucune requête de stockage,
   et ne demande ni bucket ni migration (`meta` est un jsonb `NOT NULL DEFAULT '{}'`).
   **Écarté** : chargement des originaux à l'entrée dans le viewport (repousse le coût sans le
   supprimer, et le rend imprévisible) ; miniatures dans un bucket (deux écritures, deux
   suppressions à tenir cohérentes, des fichiers orphelins garantis).

4. **Les 22 ressources déjà en base n'ont pas de vignette : elle se fabrique au premier passage,
   sur geste.** Un bouton « préparer les vignettes (n) » en tête de liste, qui traite la file et
   écrit au fur et à mesure.
   — *pourquoi* : un simple affichage ne doit pas déclencher 22 téléchargements ni 22 écritures en
   base. Le geste est explicite, il ne se répète jamais, et il est interruptible.

5. **La durée s'écrit dans `meta.duree` au même moment que la vignette**, jamais à la lecture.
   — *pourquoi* : la policy `members_all_assets` (ALL, `is_member()`) **autorise** l'écriture — la
   question n'était pas la permission mais l'opportunité. Un affichage qui écrit en base est une
   surprise, et à deux utilisateurs sur la même page c'est une course à l'écriture pour rien.

6. **Le dépôt contrôle avant d'envoyer, et n'affiche pas de progression par fichier.**
   Refus en amont : poids > 50 Mo (plafond Supabase Free), type hors image/audio/vidéo, dépassement
   du 1 Go restant. Le message dit **le poids et la limite**, pas « erreur ».
   — *pourquoi* : `storage.upload()` ne donne pas de progression sans réécrire l'envoi en XHR — du
   code fragile pour un fichier de 8 Mo sur fibre. Le vrai manque n'a jamais été la barre : c'est
   que rien n'était refusé avant l'envoi. Progression globale par fichier terminé, honnête.

7. **La suppression se confirme dans la fiche, pas sous le curseur.** `<dialog>`, focus sur
   *Annuler*, Échap referme, et le bouton destructeur n'est jamais à l'endroit du clic qui a ouvert
   la confirmation.
   — *pourquoi* : aujourd'hui `✕` devient « confirmer ? » au même pixel — un double-clic supprime.
   L'ordre base-puis-stockage et les deux messages d'erreur distincts sont **conservés tels quels**
   (`page.tsx` l. 119-144), ils règlent un vrai incident du 24/08.

8. **Les erreurs vivent dans la ligne concernée**, en `role="alert"` inséré dans le `<li>`.
   — *pourquoi* : un encart en haut de page est hors écran quand l'échec concerne la ligne 18.

9. **La colonne « Poème » reste au premier plan mais cesse d'être un éditeur.** En ligne, c'est un
   lien ; le rattachement se fait dans la fiche. Vivier commun en atténué, lien en encre.
   — *pourquoi* : le vivier commun est la norme (14 des 22), le lien est l'exception. La norme est
   discrète, l'exception se voit.

10. **Le tri quitte les en-têtes** — il n'y a plus de colonnes — et devient un groupe de boutons
    `aria-pressed` intitulé « Trier », dont le résultat est annoncé en `aria-live="polite"`.
    — *pourquoi* : la règle du 24/08 (« le tri reste dans les en-têtes ») était juste **pour une
    table**. Elle devient caduque avec la table. Notée comme telle dans `memory.md`.

11. **La logique de filtrage est reprise au caractère près.** Champ unique couvrant les libellés
    affichés, facettes auto-masquées, comptes évalués **sans** la facette elle-même, facette active
    qui ne disparaît jamais, jetons rassemblés avec « n sur N ».
    — *pourquoi* : c'est du travail déjà payé et documenté. Le `useMemo` actuel se déplace dans
    `useVivier()` **sans être réécrit**. Le vide filtré gagne seulement une phrase : quel filtre le
    cause, et le geste pour l'enlever.

12. **Palette : `--encre #2f3b52` porte tout ce qui est interactif** — sélection, lecture,
    ambiances, filtres actifs, liens. `--gold` redevient un accent d'apparat : titres, libellés,
    dépôt.
    — *pourquoi* : l'or portait quatre rôles à la fois ; quand tout est or, rien ne ressort.
    Ratios : **10,2 contre `--bg`**, 11,2 sur blanc.
    ⚠ **Le nom `--nuit` proposé par Design est refusé** : `nuit` est déjà l'un des neuf identifiants
    d'ambiance. Deux sens pour un mot dans le même fichier, c'est une confusion garantie.
    ⚠ **La teinte descend sur les quatre onglets** (lot 4). Ressources livrée seule détonnerait.

## Données & sécurité

- **Aucune migration.** `meta` est un jsonb `NOT NULL DEFAULT '{}'` : `ambiances`, `vignette` et
  `duree` y cohabitent. `assets.poem_id` est nullable depuis toujours.
- Policy unique sur `assets` : `members_all_assets` (ALL, `is_member()` en `USING` et `WITH CHECK`).
  Lecture et écriture couvertes, rien à ajouter.
- **Écrire `meta` en préservant le reste** — `metaAvecAmbiances()` le fait déjà ; toute nouvelle
  écriture suit le même patron, jamais un remplacement.
- Buckets privés. Les originaux ne sont plus servis à l'affichage : un `createSignedUrl` ne part
  plus qu'à la demande (écoute d'une nappe, ouverture de l'original, téléchargement).
- ⚠ **Ne pas faire grossir `select *`** : les vignettes alourdissent chaque ligne de ~8 Ko.
  Le chargement de la liste sélectionne explicitement ses colonnes ; l'Atelier ne demande
  `meta` que pour ce qu'il affiche.
- **Examiner le `error` de toute écriture.** Règle du projet, née d'une journée perdue.
- Aucune donnée personnelle, aucun secret nouveau.

## Impact app ↔ mobile

Pas d'application mobile. L'app est consultée au téléphone : la ligne devient une carte à deux
colonnes (vignette, puis tout le reste empilé), la fiche passe **en plein écran** avec « précédent
/ suivante » qui enchaîne les ressources du filtre courant — c'est le seul endroit où le mode
« classer » a besoin d'exister comme écran. Aucun scroll horizontal à 390 px.

## Cas limites

- **Vignette impossible à fabriquer** (codec refusé par le navigateur, fichier corrompu) : aplat
  typé, pas de ligne cassée, et on ne réessaie pas à chaque affichage — l'échec se mémorise.
- **Métrage dont la première image est noire** : capture à `0.1 s`, pas à `0`.
- **Nappe de 1 h** : `loadedmetadata` suffit, on ne charge jamais le fichier entier pour la durée.
- **Deux onglets ouverts par les deux frères** : la dernière écriture gagne, sur `meta` entier —
  d'où l'obligation de lire-modifier-écrire, jamais d'écraser.
- **Fichier refusé au dépôt** : rien n'est envoyé pour lui, les autres partent quand même.
- **Échec réseau en cours d'envoi** : le fichier n'existe ni au stockage ni en base ; le dire, et
  proposer de réessayer ce seul fichier.
- **Quota au-dessus de 90 %** : la jauge passe en `--danger` et dit **ce qui reste**, pas ce qui est
  pris. Le dépôt reste possible tant que le fichier tient.
- **Ressource utilisée par un rendu** : la suppression échoue en `23503` — message existant conservé.
- **Zéro ambiance sur tout le vivier** (l'état d'aujourd'hui) : les facettes d'ambiance sont
  absentes, et c'est correct. Elles apparaîtront d'elles-mêmes au premier classement.

## Critères d'acceptation

- [ ] Les 14 ressources du vivier peuvent être classées en une séance, sans quitter la page ni
      télécharger un fichier.
- [ ] Une nappe s'écoute sur place ; un seul son joue à la fois.
- [ ] Un métrage affiche sa première image ; aucune vignette ne coûte le téléchargement de
      l'original après la première fabrication.
- [ ] Le sélecteur de fond et de musique de l'Atelier n'est plus un `<select>` de noms de fichiers
      et partage son code avec `/ressources`.
- [ ] Toutes les cibles interactives font au moins 32 × 32 px (`.btn-icone`).
- [ ] La liste est un `<ul>`/`<li>`, parcourable au clavier : la liste est **un** arrêt de
      tabulation, ↑↓ change de ressource, Entrée ouvre la fiche, Échap la referme et rend le focus.
- [ ] L'ordre de tri est annoncé ; une ambiance cochée annonce « nuit, coché ».
- [ ] Une erreur de ligne s'affiche dans la ligne.
- [ ] Un double-clic ne peut pas supprimer.
- [ ] Un fichier de plus de 50 Mo ou d'un type non pris en charge est refusé **avant** l'envoi, avec
      son poids et la limite.
- [ ] La jauge de quota change d'aspect au-dessus de 90 % et affiche ce qui reste.
- [ ] Utilisable en portrait à 390 px sans scroll horizontal.
- [ ] Champ unique, facettes auto-masquées et comptes sans la facette : inchangés.
- [ ] Aucun hexadécimal en dur dans les composants ; `--encre` est une variable de `globals.css`.
- [ ] Les quatre onglets partagent la même palette.
- [ ] Aucune dépendance ajoutée. `npm run build` passe **sur le Mac**.

## Risques / hard-stops

| Sujet | Nature | Statut |
|---|---|---|
| Migration | — | **Aucune.** Tout tient dans `meta` jsonb |
| Egress des vignettes | Coût plan Free | Réglé par la décision 3 (vignette au dépôt, ~8 Ko) |
| Écriture au survol | Surprise utilisateur | Réglé par les décisions 4 et 5 (écriture sur geste) |
| Poids de `meta` dans `select *` | Performance | À surveiller : sélection de colonnes explicite |
| Palette sur quatre onglets | Cohérence visuelle | Lot 4 **obligatoire**, pas optionnel |
| Perte de la logique de filtrage | Régression | Le `useMemo` se **déplace**, ne se réécrit pas |

**Risque principal, non technique** : la refonte touche la page **et** la palette **et** l'Atelier.
Si le lot 4 est repoussé, l'app vit avec deux identités. Si le lot 3 est repoussé, on aura rendu le
vivier visible là où on ne choisit pas — exactement le défaut qu'on corrige.

## Découpage en lots

**Lot 1 — le composant et la liste vignettée.** `components/Vivier.tsx`, `useVivier()` (le `useMemo`
déplacé), `<Vignette>`, `<LecteurAudio>`, `<ChipsAmbiances>`, la fiche latérale, la fabrique de
vignettes au dépôt et le bouton de rattrapage. C'est ici que se trouve tout le gain ressenti.

**Lot 2 — le dépôt et le quota.** Contrôle pré-vol, total, refus explicites, jauge à seuil.

**Lot 3 — le panneau de l'Atelier.** `mode="selection"`, `kinds={['broll']}` puis `['music']`,
dépôt sur place, remplacement du `<select>` (l. 928-955).

**Lot 4 — la palette.** `--encre` dans `globals.css` et passage des quatre onglets. Livrable seul,
peut passer en premier ou en dernier, mais doit passer.

## → corrige-et-livre

Prêt : « implémente le **lot 1** de la spec `spec-vivier-visible-2026-08-24` ».
Aucun lot ne touche la base, les policies ni le pipeline. Les quatre peuvent partir à la suite.
