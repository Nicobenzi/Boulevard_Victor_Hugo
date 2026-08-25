# Novalis — Studio

Studio de production et de publication de poèmes lus, en vidéo verticale (Instagram / TikTok / YouTube).

- **App** : Next.js 15 + Supabase (auth, base, storage) — déployée sur Vercel.
- **Usine de rendu** : GitHub Actions (ce repo) — transcription Whisper, sous-titres
  synchronisés sur le texte de référence, habillage (DA Musée / Galerie), nappe musicale,
  export MP4 1080×1920.

## Fonctionnement du rendu

1. Dans l'**Atelier**, sur la fiche d'un poème : texte + voix déposés → « Générer la vidéo »
   (image de fond et DA optionnelles, défaut `cinetique`).
2. Un job est créé dans la table `render_jobs` (statut `queued`).
3. Le workflow `render-videos` tourne toutes les 2 h (ou manuellement : onglet **Actions**
   → *render-videos* → *Run workflow*). Il traite jusqu'à 3 jobs par run.
4. Le MP4 arrive dans les Ressources, lié au poème, et le poème passe en « À programmer ».

Le texte du poème (champ « texte » de la fiche, un vers par ligne) sert de référence
pour les sous-titres : c'est lui qui est affiché, pas la transcription brute.

## Mise en route (une fois)

1. **Secrets GitHub** — Settings → Secrets and variables → Actions → New repository secret :
   - `SUPABASE_URL` : `https://cjnnzmfbqybgcmmvrodx.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` : dashboard Supabase → Project Settings → API Keys →
     `service_role` (⚠️ secrète, ne jamais la mettre dans le code).
2. **Vercel** — le projet `novalis` doit être lié à ce repo pour
   déployer à chaque push (fait via Claude, ou : vercel.com → Project → Settings → Git).

## Développement local

```bash
npm install
npm run dev
```

## Structure

- `app/` — pages : accueil (tenue du rythme), atelier (kanban + calendrier), ressources, veille
- `lib/etapes.ts` — l'étape d'un poème, dérivée des données
- `lib/caption.ts` — gabarit de caption (déterministe, sans LLM)
- `pipeline/render.py` — le pipeline de rendu vidéo
- `.github/workflows/render.yml` — le déclencheur (cron 30 min + manuel)
