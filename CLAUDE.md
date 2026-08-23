# Boulevard Victor Hugo — instructions projet

Studio de production/publication de poèmes lus en vidéo verticale (Insta/TikTok/YouTube).
Projet perso à deux (Nicolas + son frère). Objectif : simplicité, coût zéro, maintenance minimale.

## Stack
- **App** : Next.js 15 App Router, TOUT en client components (`"use client"`) + supabase-js direct.
  Pas de @supabase/ssr, pas de route API sauf nécessité absolue. Tailwind v4 (@tailwindcss/postcss).
- **Base** : Supabase projet `cjnnzmfbqybgcmmvrodx` (org perso, plan Free).
  Tables : profiles, allowed_emails, poems, assets, publications, render_jobs.
  Buckets privés : videos, audios, images.
- **Déploiement** : Vercel (team `nicobenzis-projects`, projet `boulevard-victor-hugo`) — auto à chaque push sur main.
- **Usine de rendu** : `.github/workflows/render.yml` (cron 30 min + manuel) → `pipeline/render.py`
  (faster-whisper + alignement difflib sur poems.body + ffmpeg). Python 3.11, numpy/pillow/supabase.

## Règles dures
- **RLS sur toute nouvelle table**, policy via `public.is_member()`. Accès = allowlist `allowed_emails` + trigger.
- **Aucun secret dans le code.** La clé `service_role` vit uniquement dans GitHub Secrets.
  La clé publishable et l'URL Supabase sont publiques par design (lib/supabase.ts).
- **Pas de nouvelle dépendance** sans justification forte (voir skill `karpathy`).
- UI en **français**, DA fixe : fond #0e0c0a, panel #161311, crème #ece4d4, or #c9a45c,
  serif Cormorant Garamond pour titres/vers. Ne pas inventer d'autres couleurs.
- Les sous-titres vidéo utilisent le **texte canonique** de `poems.body` (un vers par ligne), jamais la transcription brute.
- Migrations : ne jamais modifier une migration appliquée ; toujours une nouvelle migration.

## Commandes
- Dev : `npm run dev` · Build : `npm run build`
- Rendu manuel : `gh workflow run render-videos --repo Nicobenzi/Boulevard_Victor_Hugo`
- Suivi : `gh run watch --repo Nicobenzi/Boulevard_Victor_Hugo`

## Contexte vivant
Lire `memory.md` avant toute session de travail ; le mettre à jour après toute décision structurante.
