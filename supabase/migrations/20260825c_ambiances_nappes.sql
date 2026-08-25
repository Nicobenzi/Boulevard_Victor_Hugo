-- Ambiances des nappes (25/08/2026)
--
-- `lib/ambiances.ts` le dit dès son en-tête : le vocabulaire a été choisi en mots d'ATMOSPHÈRE
-- et non de sujet, précisément « parce que le vivier contient des images ET des nappes ».
-- Les six nappes n'étaient pourtant pas classées — elles n'apparaissaient donc à aucun filtre
-- du panneau de montage, où l'on choisit la musique.
--
-- Les ambiances ci-dessous ne sont pas devinées d'après la tonalité : elles reprennent la
-- description que `pipeline/make_music.py` attache à chaque entrée de sa BANQUE. C'est la
-- source la plus proche de l'intention, et elle est citée en regard pour qu'on puisse la
-- contredire en connaissance de cause.
--
-- Les trois `kind='audio'` (les lectures de Charley) ne sont volontairement PAS classées :
-- ce sont des voix rattachées à un poème, pas de la matière de vivier.
--
-- Idempotent, `meta` fusionné (`||`) pour préserver vignette et durée.

do $$
declare
  t record;
begin
  for t in
    select * from (values
      -- « grave et solennel — le defaut historique »
      ('nappe-re-mineur.mp3',  array['solennel']),
      -- « veneneux, tendu — la tierce mord »
      ('nappe-la-mineur.mp3',  array['orage']),
      -- « clair, moins pesant »
      ('nappe-mi-mineur.mp3',  array['tendresse']),
      -- « ample, presque orchestral » — ample est le mot commun aux deux
      ('nappe-sol-mineur.mp3', array['solennel','vertige']),
      -- « lumineux — pour les poemes non tragiques »
      ('nappe-do-majeur.mp3',  array['tendresse']),
      -- « meme nappe, avec un pouls lent sous le texte » : ré mineur, que le pouls densifie
      ('pouls-re-mineur.mp3',  array['solennel','nuit'])
    ) as v(titre, ambiances)
  loop
    update assets
       set meta = coalesce(meta, '{}'::jsonb)
                  || jsonb_build_object('ambiances', to_jsonb(t.ambiances))
     where kind = 'music'
       and title = t.titre;
  end loop;
end $$;
