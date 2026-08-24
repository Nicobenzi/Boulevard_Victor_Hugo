-- Le plan de fond et la musique deviennent des choix du RENDU, plus des propriétés du poème.
-- Spec : docs/specs/spec-montage-dans-atelier-2026-08-24.md
--
-- Jusqu'ici `render.py` les trouvait par `assets.poem_id`. Les rattacher au poème rendait un
-- clip indisponible pour les autres poèmes, alors que le vivier partagé existe précisément
-- pour qu'un même plan resserve. Le choix appartient au rendu : deux rendus du même poème
-- peuvent ainsi avoir des fonds différents, ce qui est le but.
--
-- ON DELETE SET NULL comme les trois autres clés vers `assets` : un job reste un fait
-- historique même si sa source a été effacée. Conséquence voulue : si le plan est supprimé
-- entre la sélection et le rendu, la colonne repasse à NULL et `render.py` échoue franchement
-- au lieu de fabriquer un fond de secours.
alter table public.render_jobs
  add column if not exists broll_asset_id uuid references public.assets(id) on delete set null,
  add column if not exists music_asset_id uuid references public.assets(id) on delete set null;

comment on column public.render_jobs.broll_asset_id is
  'Plan de fond choisi au montage. NULL = repli sur le métrage lié au poème (jobs d''avant le 24/08).';
comment on column public.render_jobs.music_asset_id is
  'Musique choisie au montage. NULL = repli sur la musique liée au poème, puis sur la nappe générée.';
