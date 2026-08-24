-- La caption devient une propriété du POÈME, pas du moment où on le publie.
--
-- Jusqu'ici elle n'existait que comme colonne de `publications` : il fallait donc
-- programmer une date pour avoir le droit d'écrire un texte. Or la caption se pense
-- en lisant le poème, pas en choisissant un créneau.
--
-- Règle de reprise (lib/caption.ts, `captionPour`) : à la programmation, la caption
-- de la publication vaut `poems.caption` si elle est renseignée, sinon le gabarit
-- déterministe. Une caption écrite à la main n'est donc jamais écrasée, et le gabarit
-- reste le défaut — décision du 23/08 reconduite, pas de LLM.
--
-- Une seule colonne, et pas une table dédiée : il n'y a aujourd'hui qu'une caption par
-- poème. Le jour où il en faudrait une par plateforme, on éclatera — pas avant.
alter table public.poems add column if not exists caption text;

comment on column public.poems.caption is
  'Caption écrite à la main pour ce poème. Vide = le gabarit de lib/caption.ts fait foi.';
