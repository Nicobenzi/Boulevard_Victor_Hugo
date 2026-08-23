# Boulevard Victor Hugo — Studio

Studio de production et de publication de poèmes lus, en vidéo verticale (Instagram / TikTok / YouTube).

- **App** : Next.js 15 + Supabase (auth, base, storage) — déployée sur Vercel.
- **Usine de rendu** : GitHub Actions (ce repo) — transcription Whisper, sous-titres
  synchronisés sur le texte de référence, habillage (DA Musée / Galerie), nappe musicale,
  export MP4 1080×1920.

## Fonctionnement du rendu

1. Dans l'app, sur une fiche poème : choisir la bande son + le tableau + la DA → « Générer la vidéo ».
2. Un job est créé dans la table `render_jobs` (statut `queued`).
3. Le workflow `render-videos` tourne toutes les 30 min (ou manuellement : onglet **Actions**
   → *render-videos* → *Run workflow*). Il traite jusqu'à 3 jobs par run.
4. Deux MP4 (avec musique / voix seule) arrivent dans la Bibliothèque, liés au poème.

Le texte du poème (champ « texte » de la fiche, un vers par ligne) sert de référence
pour les sous-titres : c'est lui qui est affiché, pas la transcription brute.

## Mise en route (une fois)

1. **Secrets GitHub** — Settings → Secrets and variables → Actions → New repository secret :
   - `SUPABASE_URL` : `https://cjnnzmfbqybgcmmvrodx.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` : dashboard Supabase → Project Settings → API Keys →
     `service_role` (⚠️ secrète, ne jamais la mettre dans le code).
2. **Vercel** — le projet `boulevard-victor-hugo` doit être lié à ce repo pour
   déployer à chaque push (fait via Claude, ou : vercel.com → Project → Settings → Git).

## Développement local

```bash
npm install
npm run dev
```

## Structure

- `app/` — pages (publications [calendrier + liste], poèmes, bibliothèque)
- `pipeline/render.py` — le pipeline de rendu vidéo
- `.github/workflows/render.yml` — le déclencheur (cron 30 min + manuel)
