-- `render_jobs.video_asset_id` était la seule clé étrangère vers `assets` sans clause
-- ON DELETE : donc NO ACTION, donc toute suppression d'une vidéo déjà produite par un job
-- était refusée par la base. C'est ce qui bloquait le bouton « supprimer » de Ressources,
-- et notamment la purge des exports en double des *Conquérants* (memory.md § 6, à-faire).
--
-- SET NULL, comme `image_asset_id` juste à côté et comme `publications.video_asset_id` :
-- un job de rendu reste un fait historique valable même si son résultat a été effacé.
-- La colonne est nullable, rien à migrer sur les données.
--
-- ⚠ Leçon : les trois autres clés vers `assets` portaient une clause explicite, celle-ci
-- non. Un oubli de ce genre ne se voit pas tant que personne n'essaie de supprimer.
alter table public.render_jobs
  drop constraint render_jobs_video_asset_id_fkey;

alter table public.render_jobs
  add constraint render_jobs_video_asset_id_fkey
  foreign key (video_asset_id) references public.assets(id) on delete set null;
