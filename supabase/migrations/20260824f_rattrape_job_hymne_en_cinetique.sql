-- CORRECTION DE DONNÉES, pas de schéma — appliquée le 24/08, fichier écrit après coup lors de
-- la consolidation du soir.
--
-- Un job en file pour l'Hymne portait le style 'musee' AVEC un plan de métrage choisi :
-- combinaison impossible, `render.py` n'ouvre le métrage que sous `if style == "cinetique"`.
-- Le job serait parti au cron suivant pour échouer sur « aucun fond », deux heures plus tard.
-- Avoir choisi un plan est une intention claire de métrage, donc de cinétique.
--
-- La cause a été corrigée dans l'écran le même jour (PR #22) : le bouton « Générer » exige
-- désormais le type de fond que le style sait lire. Cette migration ne rattrape que le job déjà
-- en file — elle ne devrait plus jamais avoir d'effet.
update public.render_jobs
set style = 'cinetique'
where status = 'queued' and style <> 'cinetique'
  and broll_asset_id is not null and image_asset_id is null;
