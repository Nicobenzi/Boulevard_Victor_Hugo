-- Ambiances du vivier — deuxième versement, animalier (25/08/2026)
--
-- ⚠ À N'APPLIQUER QU'APRÈS le dépôt des 25 clips de `metrage/` via l'onglet Ressources.
-- Une session Claude n'a pas accès aux buckets : elle ne peut ni envoyer les fichiers ni créer
-- les lignes `assets`. Ce fichier ne fait que classer des lignes qui existent déjà.
-- Appliqué trop tôt, il ne fait RIEN (aucun `title` ne correspond) — et n'échoue pas non plus,
-- ce qui est le piège : vérifier le compte après coup, pas l'absence d'erreur.
--
-- Les titres attendus sont les noms RENOMMÉS de `metrage/` (`ambiance-sujet-id.mp4`), parce que
-- `app/ressources/page.tsx` enregistre `title: file.name`. Déposer les fichiers sous leur nom
-- Mixkit brut ferait échouer silencieusement tout l'appariement — c'est exactement ce qui est
-- arrivé au premier versement (cf. 20260825a).
--
-- Le préfixe du nom de fichier n'est qu'un aide-mémoire pour l'humain : la donnée que le Vivier
-- lit, c'est `meta.ambiances`. Les deux doivent rester d'accord.
--
-- Idempotent, et `meta` est fusionné (`||`) : la vignette base64 fabriquée au dépôt survit.

do $$
declare
  t record;
  n int;
begin
  for t in
    select * from (values
      -- braise / mélancolie / orage — le peu de sombre de ce versement
      ('braise-coucher-plage-2168.mp4',        array['braise','melancolie']),
      ('melancolie-mouettes-horizon-15209.mp4', array['melancolie']),
      ('melancolie-cygne-31396.mp4',            array['melancolie']),
      ('orage-mouettes-mer-17972.mp4',          array['orage']),
      -- solennel
      ('solennel-aigle-48726.mp4',              array['solennel']),
      ('solennel-foret-pins-50847.mp4',         array['solennel','vertige']),
      ('solennel-guepard-11400.mp4',            array['solennel']),
      ('solennel-guepards-eau-11146.mp4',       array['solennel']),
      ('solennel-rhinoceros-48885.mp4',         array['solennel']),
      -- vertige
      ('vertige-raie-34713.mp4',                array['vertige']),
      ('vertige-requin-4406.mp4',               array['vertige']),
      ('vertige-collines-100415.mp4',           array['vertige','solennel']),
      -- vide
      ('vide-desert-32730.mp4',                 array['vide']),
      ('vide-plaine-gnous-11174.mp4',           array['vide','apre']),
      ('vide-mouettes-estran-19179.mp4',        array['vide']),
      -- tendresse
      ('tendresse-elephants-3680.mp4',          array['tendresse']),
      ('tendresse-lemuriens-16035.mp4',         array['tendresse']),
      ('tendresse-poisson-clown-8544.mp4',      array['tendresse']),
      ('tendresse-prairie-arbre-4075.mp4',      array['tendresse']),
      -- âpre
      ('apre-jeune-ours-4073.mp4',              array['apre']),
      ('apre-ours-pre-4072.mp4',                array['apre']),
      ('apre-lezard-1473.mp4',                  array['apre']),
      ('apre-oies-45435.mp4',                   array['apre']),
      ('apre-phacochere-16966.mp4',             array['apre']),
      ('apre-scorpion-1467.mp4',                array['apre'])
    ) as v(titre, ambiances)
  loop
    update assets
       set meta = coalesce(meta, '{}'::jsonb)
                  || jsonb_build_object('ambiances', to_jsonb(t.ambiances))
     where kind = 'broll'
       and title = t.titre;
  end loop;

  -- Le contrôle qui manquait au premier versement : on compte, on ne suppose pas.
  select count(*) into n
    from assets
   where kind = 'broll' and meta ? 'ambiances';
  raise notice 'métrages portant une ambiance : %', n;
end $$;
