# memory.md — état du projet (mise à jour : 2026-08-23)

## Le projet
Frère de Nicolas = la voix (lectures de poèmes du domaine public). Nicolas = production/tech.
Nom de la chaîne : **Boulevard Victor Hugo**. Signature vidéo : « chaque semaine, un poème ».

## Décisions actées
- **3 DA** (planche validée) : I. Musée (tableau plein écran + Ken Burns/travelling) — défaut ;
  II. Galerie (cadre doré sur noir, pour images basse résolution) ; III. Nocturne (typo seule).
- **Publication v1 = assistée** (fichier + caption à copier, checklist), pas d'API directe :
  IG exige app review Meta (compte Business), TikTok = draft-only sans audit, YouTube = privé sans audit.
  v2 possible plus tard : YouTube auto d'abord (le plus simple), puis Meta/TikTok après reviews.
- **Usine de rendu = GitHub Actions** (gratuit) plutôt que serveur ou Vercel (trop lourd pour ffmpeg/whisper).
- **Déclenchement = bouton « Générer la vidéo »** sur la fiche poème (pas full-auto à l'upload).
- Musique : nappe drone ré mineur générée (100 % libre de droits) ; piano composé à la main
  au cas par cas (pas d'auto-génération, risque qualité). 2 sorties : avec musique + voix seule
  (la voix seule sert aux sons in-app TikTok/Reels).
- Sous-titres : texte canonique, césure à l'hémistiche, coupe du titre lu en intro (hook direct sur le vers 1).
- Voix normalisée loudnorm I=-14 ; audio frère parfois très compressé (26 kbps) → afftdn + à réenregistrer mieux un jour.

## Infra
- App : https://boulevard-victor-hugo.vercel.app (Vercel team nicobenzis-projects, lié au repo GitHub).
- Repo : github.com/Nicobenzi/Boulevard_Victor_Hugo (privé). Secrets Actions posés (SUPABASE_URL + SERVICE_ROLE_KEY).
- Supabase : projet cjnnzmfbqybgcmmvrodx, org perso Free. Site URL auth configurée sur l'app Vercel.
- Membres : nicolas.benzimra@coprovia.fr (allowlist). **Email du frère : à ajouter (en attente).**

## En pause / TODO
- ⚠️ **GitHub Actions bloqué** : facturation du compte GitHub (paiement en échec ou spending limit).
  Choix de Nicolas : attendre le prochain cycle. Si toujours bloqué → régulariser la carte ou passer le repo en public.
  En attendant, les rendus sont faits à la main par Claude (mêmes réglages que pipeline/render.py).
- Ajouter l'email du frère dans allowed_emails.
- v1.1 : upload YouTube auto (privé→public) ; rappel mail le jour d'une publication.
- v2 : app reviews Meta/TikTok pour le direct-post.

## Vidéos déjà produites (à la main, dans la Bibliothèque à uploader)
- Bacchanale (Heredia, 56 s) : version fond généré + version Poussin (travelling), musique piano+nappe ré mineur.
- Hymne à la Beauté (Baudelaire, 1 min 47) : DA Galerie avec Moreau (L'Apparition), nappe+piano la mineur.
  Le Moreau est en 345×500 (basse rés) → si HD trouvée un jour, refaire en Musée plein écran.
