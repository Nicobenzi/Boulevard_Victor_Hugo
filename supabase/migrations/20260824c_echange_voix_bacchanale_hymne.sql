-- CORRECTION DE DONNÉES, pas de schéma — appliquée le 24/08, fichier écrit après coup lors de
-- la consolidation du soir. Conservée au dépôt pour que l'historique dise ce qui a eu lieu :
-- une base reconstruite sans elle n'aurait aucune trace du geste.
--
-- Les deux enregistrements avaient été rattachés au mauvais poème à l'upload. Identifié par la
-- durée, confirmé par le poids : le fichier sans numéro dure 1 min 50 (l'Hymne), celui qui porte
-- le 3 dure 56 s (Bacchanale). Le dictaphone nomme tout « Boulevard Victor Hugo N.m4a » et le N
-- ne dit rien du poème — cf. memory.md § 3.
--
-- Sans cet échange, l'alignement difflib aurait calé un texte de 14 vers sur 110 s de voix et
-- inversement. ⚠ Il n'aurait pas protesté : il retombe sur une répartition proportionnelle et
-- sort une vidéo *plausible mais fausse*.
update public.assets
set poem_id = case
  when storage_path like '%Boulevard_Victor_Hugo.m4a'   then '039504b8-ae7e-4c62-bd4d-95e0dff19d6e'::uuid  -- Hymne à la Beauté
  when storage_path like '%Boulevard_Victor_Hugo_3.m4a' then '5e908456-b506-4330-8546-bf6bc9778e00'::uuid  -- Bacchanale
end
where kind = 'audio'
  and (storage_path like '%Boulevard_Victor_Hugo.m4a' or storage_path like '%Boulevard_Victor_Hugo_3.m4a')
  and poem_id in ('039504b8-ae7e-4c62-bd4d-95e0dff19d6e', '5e908456-b506-4330-8546-bf6bc9778e00');
