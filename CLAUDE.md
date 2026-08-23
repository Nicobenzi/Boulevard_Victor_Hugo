# Boulevard Victor Hugo — instructions projet

Studio de production et de publication de poèmes lus, en vidéo verticale (Insta/TikTok/YouTube).
Projet perso à deux (Nicolas + son frère). Objectif : simplicité, coût zéro, maintenance minimale.

**Avant toute session : lire `memory.md`** (contexte, décisions, état, pièges connus).
Le mettre à jour après toute décision structurante.

## Stack
- **App** : Next.js 15 App Router (`^15.5.4` minimum — Vercel refuse 15.1, CVE), TOUT en client
  components (`"use client"`) + supabase-js direct. Pas de `@supabase/ssr`, pas de route API sauf
  nécessité réelle. Tailwind v4 (`@tailwindcss/postcss`).
- **Base** : Supabase `cjnnzmfbqybgcmmvrodx` (org perso, Free).
  Tables : `profiles`, `allowed_emails`, `poems`, `assets`, `publications`, `render_jobs`,
  `inspirations`. Buckets privés : `videos`, `audios`, `images`.
  ⚠ Le MCP Supabase est en **lecture seule** : toute écriture passe par l'éditeur SQL du
  dashboard. Produire des scripts collables et idempotents.
- **Déploiement** : Vercel (team `nicobenzis-projects`), auto à chaque push sur `main`.
- **Usine de rendu** : `.github/workflows/render.yml` (cron 2 h + manuel) → `pipeline/render.py`
  (faster-whisper, alignement difflib sur `poems.body`, ffmpeg). Python 3.11.
  Styles : `cinetique` (à privilégier), `musee`, `galerie`.
  `pipeline/make_music.py` génère la banque de nappes.
- **Nav** : Publications (bascule calendrier/liste), Poèmes, Bibliothèque, Veille.

## Règles dures
- **RLS sur toute nouvelle table**, policy via `public.is_member()`. Accès = allowlist `allowed_emails`.
- **Aucun secret dans le code.** `service_role` uniquement dans GitHub Secrets.
  L'URL Supabase et la clé publishable sont publiques par design (`lib/supabase.ts`).
- **Pas de nouvelle dépendance** sans justification forte (skill `karpathy`).
- UI en **français**. DA figée : `#0e0c0a` / `#161311` / `#ece4d4` / `#c9a45c`, serif Cormorant
  Garamond pour titres et vers. Ne pas inventer d'autres couleurs.
- Sous-titres vidéo = **texte canonique** de `poems.body`, jamais la transcription brute.
  Texte collationné sur Wikisource, apostrophes typographiques `’`.
- Toute vidéo est exportée en **2 versions** : avec musique et voix seule.
- Migrations : ne jamais modifier une migration appliquée ; toujours en créer une nouvelle
  dans `supabase/migrations/`.
- L'avancement d'un poème est **dérivé** des données, pas lu dans `poems.status` (qui dérive).
- Musique : 100 % générée, jamais de sample ni d'enregistrement tiers.

## Commandes
```bash
npm run dev            # développement
npm run build          # vérification avant push
gh workflow run render-videos --repo Nicobenzi/Boulevard_Victor_Hugo   # rendu manuel
gh run watch --repo Nicobenzi/Boulevard_Victor_Hugo                    # suivi
```
