-- 1. La contrainte de style n'a jamais connu « cinetique » : tout job dans ce style
--    était rejeté par la base. C'est le blocage qui rendait la DA du 23/08 inexécutable.
alter table public.render_jobs drop constraint if exists render_jobs_style_check;
alter table public.render_jobs add constraint render_jobs_style_check
  check (style = any (array['musee','galerie','cinetique']));

-- 2. Nouveau type d'asset : « broll » — les plans de fond (Pexels / Pixabay).
--    Distinct de « video », qui désigne les vidéos PRODUITES par le pipeline.
alter table public.assets drop constraint if exists assets_kind_check;
alter table public.assets add constraint assets_kind_check
  check (kind = any (array['video','audio','music','image','broll']));

-- 3. Oubli de la migration précédente : les trois autres tables ont ce déclencheur,
--    inspirations avait la colonne updated_at sans rien pour la mettre à jour.
drop trigger if exists inspirations_touch on public.inspirations;
create trigger inspirations_touch before update on public.inspirations
  for each row execute function public.touch_updated_at();

-- Contrôle
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid in ('public.assets'::regclass, 'public.render_jobs'::regclass) and contype='c'
union all
select 'trigger '||tgname, relname from pg_trigger t join pg_class c on c.oid=t.tgrelid
where not tgisinternal and relname='inspirations';
