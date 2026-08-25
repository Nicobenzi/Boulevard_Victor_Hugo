-- Ambiances du vivier — rattrapage du premier versement (25/08/2026)
--
-- Constat qui motive ce fichier : `lib/ambiances.ts` fige un vocabulaire de 9 mots depuis le
-- 23/08, mais AUCUNE ligne `assets` ne porte de `meta.ambiances` — les huit métrages déposés
-- ont tous `meta->'ambiances'` à NULL. Le vocabulaire existe, le classement n'a jamais eu lieu.
-- Les ambiances ci-dessous sont celles déjà consignées dans `metrage/SOURCES.md` ; on ne fait
-- que les porter en base, là où le Vivier sait les lire.
--
-- ⚠ L'appariement se fait sur `title`, qui vaut le nom du fichier au dépôt (cf. app/ressources
-- /page.tsx : `title: file.name`). Les huit lignes portent donc les noms BRUTS de Mixkit, pas
-- les noms renommés de `metrage/` — le renommage local n'a jamais atteint la base.
--
-- Idempotent : un `update` sans correspondance ne touche rien, et réappliqué il réécrit la
-- même valeur. `meta` est fusionné (`||`), jamais remplacé : la vignette base64 est préservée.

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('100827-video-720.mp4',                                                        array['vertige']),
      ('mixkit-big-full-moon-on-a-cloudy-night-46898-hd-ready.mp4',                    array['nuit']),
      ('mixkit-candle-lighting-in-the-dark-3458-hd-ready.mp4',                         array['braise']),
      ('mixkit-flying-through-dark-matter-in-space-30563-hd-ready.mp4',                array['vertige','vide']),
      ('mixkit-raining-in-a-cloud-forest-full-of-tall-trees-22728-hd-ready.mp4',       array['apre']),
      ('mixkit-sand-falling-from-an-hourglass-on-a-black-background-28901-hd-ready.mp4', array['melancolie']),
      ('mixkit-smoke-rising-in-the-dark-8461-hd-ready.mp4',                            array['nuit','vide']),
      ('mixkit-waterfall-in-forest-2213-hd-ready.mp4',                                 array['apre'])
    ) as v(titre, ambiances)
  loop
    update assets
       set meta = coalesce(meta, '{}'::jsonb)
                  || jsonb_build_object('ambiances', to_jsonb(t.ambiances))
     where kind = 'broll'
       and title = t.titre;
  end loop;
end $$;
