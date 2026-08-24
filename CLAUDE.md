# Boulevard Victor Hugo — instructions projet

> ## ⚠ À LIRE EN PREMIER — deux pièges d'ouverture de session
>
> **1. Ce projet n'est PAS Coprovia.** Les plugins `coprovia-*` et l'adresse mail de Nicolas
> pointent vers Coprovia — une plateforme de syndic. **Ici, rien à voir** : Boulevard Victor Hugo
> est un studio de poèmes lus en vidéo verticale, sans copropriété, sans syndic, sans gestionnaire.
> Le 23/08, une session a passé quatre échanges à parler d'AG et de tantièmes avant que Nicolas ne
> la corrige. **Ne rien déduire de l'outillage installé.**
> ⚠ **`.claude/settings.json` ne les désactive PAS** — vérifié le 24/08, inutile de s'en étonner
> ni de le re-signaler. Ces skills sont **attachées côté Claude.ai** (servies depuis un chemin de
> session `…/rpm/plugin_*/skills/`, et `list_plugins` ne renvoie aucun plugin installé
> localement), alors que `enabledPlugins` est un mécanisme Claude Code qui lit la config du projet
> sur disque. **Aucun fichier du dépôt ne peut les éteindre** ; il faut les détacher dans les
> réglages du projet, côté app Claude. Le fichier est conservé comme trace du diagnostic.
> **En attendant : les ignorer.** Les skills `coprovia-*` ne s'appliquent pas ;
> `corrige-et-livre` et `cadre-et-specifie` sont
> utilisables mais écrits pour Coprovia — appliquer les conventions **de ce fichier**, pas les leurs
> (ici : tout en client components, pas de Server Components, pas de design system Paprika,
> repo `Nicobenzi/Boulevard_Victor_Hugo`).
>
> **2. Vérifier l'accès au dossier avant de conclure quoi que ce soit.** Ce fichier est injecté
> automatiquement, mais le dossier n'est pas forcément monté pour les outils. Si `Glob`/`Read`
> ne voient pas le repo, appeler `request_cowork_directory` sur
> `/Users/nicolas/Documents/Claude/Projects/boulevard-victor-hugo`.
> **Ne jamais confondre** ce dossier avec la base de connaissances du projet Claude.ai
> (`.project-cache/…`), qui est **vide** : elle ne contient ni `docs/` ni `files/`, et son absence
> de contenu ne dit rien de l'état du projet. La vérité est dans le dossier, pas dans le cache.

Studio de production et de publication de poèmes lus, en vidéo verticale (Insta/TikTok/YouTube).
Projet perso à deux (Nicolas + son frère). Objectif : simplicité, coût zéro, maintenance minimale.

**Puis lire `memory.md`** (contexte, décisions, état, pièges connus).
Le mettre à jour après toute décision structurante.

## Stack
- **App** : Next.js 16 App Router (`^16.3.2` — le rameau 15 est fermé et traîne des CVE postcss
  et sharp que Vercel finit par refuser au déploiement), Node ≥ 20.9, TOUT en client
  components (`"use client"`) + supabase-js direct. Pas de `@supabase/ssr`, pas de route API sauf
  nécessité réelle. Tailwind v4 (`@tailwindcss/postcss`).
- **Base** : Supabase `cjnnzmfbqybgcmmvrodx` (org perso, Free).
  Tables : `profiles`, `allowed_emails`, `poems`, `assets`, `publications`, `render_jobs`,
  `inspirations`, `notes`. Buckets privés : `videos`, `audios`, `images`.
  ⚠ Le bucket `videos` contient **aussi le métrage** : les plans du vivier et les vidéos finies
  y cohabitent (`bucketFor` envoie tout `video/*` là).
  ⚠ MCP Supabase : `execute_sql` est en **lecture seule**, mais **`apply_migration` écrit — le
  DDL comme les données** (vérifié le 24/08 : trois migrations `INSERT`/`UPDATE` sont passées).
  Écrire des migrations idempotentes. **Aucun accès aux buckets** en revanche : supprimer une
  ligne `assets` depuis une session laisserait le fichier orphelin — passer par le bouton de
  Ressources, qui supprime la ligne **puis** le fichier.
- **Déploiement** : Vercel (team `nicobenzis-projects`), auto à chaque push sur `main`.
- **Usine de rendu** : `.github/workflows/render.yml` (cron 2 h + manuel) → `pipeline/render.py`
  (faster-whisper, alignement difflib sur `poems.body`, ffmpeg). Python 3.11.
  Styles : `cinetique` (à privilégier), `musee`, `galerie`.
  `pipeline/make_music.py` génère la banque de nappes.
- **Nav** : Accueil (tenue du rythme), Atelier (bascule kanban/calendrier — fusion des anciens
  Poèmes + Publications), Ressources, Veille. `/poemes`, `/publications`, `/bibliotheque`,
  `/calendrier` et `/publier` sont des redirections.
  L'étape d'un poème est dérivée dans `lib/etapes.ts` ; la caption vient de `lib/caption.ts`
  (gabarit déterministe, jamais de LLM) mais **`poems.caption` prime si elle est renseignée**.
  **Le plan de fond et la musique se choisissent au montage**, dans la fiche du poème, et sont
  portés par le rendu (`render_jobs.broll_asset_id`, `music_asset_id`) — pas par le poème, pour
  qu'un même plan puisse resservir. Specs dans `docs/specs/` (`…-atelier-2026-08-23`,
  `…-montage-dans-atelier-2026-08-24`, `…-notes-atelier-2026-08-24`).

## Règles dures
- **RLS sur toute nouvelle table**, policy via `public.is_member()`. Accès = allowlist `allowed_emails`.
- **Aucun secret dans le code.** `service_role` uniquement dans GitHub Secrets.
  L'URL Supabase et la clé publishable sont publiques par design (`lib/supabase.ts`).
- **Pas de nouvelle dépendance** sans justification forte (skill `karpathy`).
- UI en **français**. **Deux palettes distinctes, ne jamais les confondre :**
  - **DA des vidéos — figée** : `#0e0c0a` / `#161311` / `#ece4d4` / `#c9a45c`, Cormorant Garamond.
    Elle vit dans `pipeline/render.py`. C'est le produit. Ne pas inventer d'autres couleurs.
  - **Palette de l'app — claire** (`app/globals.css`, depuis le 23/08). L'app est un outil ouvert
    en plein jour, pas une vitrine. **Un seul thème, pas de bascule sombre/clair.**
    Toute couleur passe par une variable (`--bg --panel --ink --ink-dim --gold --line --danger`) :
    aucun hexadécimal en dur dans les composants.
  - Contrainte de contraste : texte ≥ 4,5 et **bordures/limites ≥ 3,0** (c'est ce second seuil qui
    manquait — cf. memory.md).
- Sous-titres vidéo = **texte canonique** de `poems.body`, jamais la transcription brute.
  Texte collationné sur une édition de référence, apostrophes typographiques `’`.
  ⚠ Wikisource ne répond pas aux requêtes automatisées (réponses vides) : passer par une source
  secondaire, et le dire.
- **Tout rendu exige un fond fourni**, il n'y a plus de fond de secours. Et **le style détermine
  le type de fond** : seul `cinetique` lit du métrage, `musee` et `galerie` veulent une image
  fixe. Le bouton « Générer » applique cette règle — ne pas la retirer.
- **Toute action qui n'existe qu'au glisser-déposer n'existe pas** pour qui n'a pas de souris :
  lui donner un équivalent clavier.
- **Examiner le `error` de toute écriture Supabase.** Une erreur avalée produit un bouton qui a
  l'air cassé, et fait chercher au mauvais endroit pendant une journée.
- **Un seul export**, avec musique (la voix seule ne servait qu’au flux « ajouter un son » de TikTok, inutilisé — et doublait le stockage).
- Migrations : ne jamais modifier une migration appliquée ; toujours en créer une nouvelle
  dans `supabase/migrations/`. **Écrire le fichier même pour une correction de données** —
  appliquer par `apply_migration` sans fichier rend le geste invisible à qui relit le dépôt.
  ⚠ `supabase db push` **n'est pas utilisable en l'état** : deux migrations du 23/08 sont au
  dépôt sans être dans `schema_migrations` (passées par l'éditeur SQL), il les rejouerait.
- L'avancement d'un poème est **dérivé** des données, pas lu dans `poems.status` (qui dérive).
- Musique : 100 % générée, jamais de sample ni d'enregistrement tiers.
- **Ambiances du vivier : vocabulaire fermé de 9 mots**, figé le 23/08 dans `lib/ambiances.ts`
  (`nuit braise orage vertige melancolie tendresse apre solennel vide`). Identifiants **sans
  accents**, libellés accentués pour l'affichage. Rangées dans `assets.meta.ambiances` (jsonb
  déjà présent, aucune migration). Ne pas ajouter de mot sans décision explicite de Nicolas :
  un vocabulaire qui s'étend au fil de l'eau redevient du texte libre, donc infiltrable.
- **Métrage de fond** : privilégier les sources **verticales** (1080×1920 natif), sinon la plus
  haute résolution disponible. Un 720p horizontal recadré en 9:16 ne garde que 31 % de la largeur
  et agrandit 2,7×. Provenance et licence tenues dans `metrage/SOURCES.md` (dossier hors git).

## Commandes
```bash
npm run dev            # développement
npm run build          # vérification avant push — SUR LE MAC, cf. ci-dessous
gh workflow run render-videos --repo Nicobenzi/Boulevard_Victor_Hugo   # rendu manuel
gh run watch <run-id>  --repo Nicobenzi/Boulevard_Victor_Hugo          # suivi (sans id : menu)
~/.venvs/bvh/bin/python pipeline/make_music.py ~/Desktop/musiques-bvh 120   # banque de nappes
```

## Le bac à sable Linux de la session — trois limites

- ⚠ **Il ne peut pas builder** : les `node_modules` sont installés pour macOS et son disque est
  plein. `npx tsc --noEmit` y fonctionne et valide le typage, mais **`npm run build` doit tourner
  sur le Mac avant tout push**.
- ⚠ **Ne pas y lancer de `git`** : ça laisse un `.git/index.lock` orphelin que la session ne peut
  pas supprimer, et le `git commit` suivant échoue côté Mac (« Another git process seems to be
  running »). Remède : `rm -f .git/index.lock`.
- ⚠ **Toujours `git checkout main` AVANT de modifier des fichiers.** Une branche déjà mergée reste
  sélectionnée après un merge sur GitHub, et les commits partent dessus sans prévenir.
- Python local : `~/.venvs/bvh` (macOS refuse `pip3 install` dans le Python système, PEP 668).
