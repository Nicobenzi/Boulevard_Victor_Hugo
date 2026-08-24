-- Étape forcée à la main sur le kanban de l'Atelier.
-- NULL = l'étape reste calculée depuis les données (le cas normal).
--
-- Volontairement SÉPARÉE de `poems.status`, qui a dérivé et ne fait plus foi : on ne
-- ressuscite pas ce champ, on en crée un dont la nature est explicite.
--
-- La contrainte n'est pas cosmétique : sans elle, une faute de frappe créerait une septième
-- colonne fantôme dans le kanban, que personne ne verrait jamais.
--
-- Appliquée le 23/08/2026 via apply_migration (MCP Supabase).
-- Pour annuler : alter table public.poems drop column etape_manuelle;

alter table public.poems
  add column if not exists etape_manuelle text;

alter table public.poems
  drop constraint if exists poems_etape_manuelle_check;

alter table public.poems
  add constraint poems_etape_manuelle_check
  check (etape_manuelle is null or etape_manuelle in
    ('preparer','rendre','rendu','programmer','programme','publie'));
