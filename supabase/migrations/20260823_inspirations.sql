-- Veille : ce que font les autres comptes de poésie.
-- Table volontairement plate — c'est un carnet, pas un CRM.
-- « references » est un mot réservé en SQL, d'où « inspirations ».

create table if not exists public.inspirations (
  id          uuid primary key default gen_random_uuid(),
  url         text not null,
  platform    text not null default 'autre',   -- instagram | tiktok | youtube | autre
  account     text,                            -- @lecompte
  title       text,                            -- de quoi il s'agit
  note        text,                            -- ce qu'on en retient
  tags        text[] not null default '{}',
  rating      int  not null default 0,         -- 0 vu · 1 intéressant · 2 à reprendre
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists inspirations_created_at_idx on public.inspirations (created_at desc);
create index if not exists inspirations_tags_idx        on public.inspirations using gin (tags);

-- Même politique que les autres tables du projet : accès réservé aux membres.
alter table public.inspirations enable row level security;

drop policy if exists members_all_inspirations on public.inspirations;
create policy members_all_inspirations on public.inspirations
  for all using (public.is_member()) with check (public.is_member());

-- Amorce : les comptes relevés pendant la veille du 23/08/2026.
insert into public.inspirations (url, platform, account, title, note, tags, rating)
select * from (values
  ('https://www.instagram.com/poesiefrancaise/', 'instagram', '@poesiefrancaise',
   'Poèmes du répertoire, texte posé sur image fixe',
   'Format le plus proche du nôtre côté fond, mais sans voix ni mouvement. Environ 14 k abonnés.',
   array['texte','classiques'], 1),
  ('https://www.instagram.com/violenteviande/', 'instagram', '@violenteviande',
   'Florian Nardon — punchlines face caméra',
   'Le compte français de poésie le plus suivi (>180 k). Visage, pas d''image. Montre que la voix incarnée porte plus que l''illustration.',
   array['face-camera','contemporain'], 2),
  ('https://www.instagram.com/poesique/', 'instagram', '@poesique',
   'Xavière Hardy — poésie illustrée',
   'Travail graphique soigné, registre personnel.',
   array['texte','illustration'], 1),
  ('https://www.tiktok.com/@vivre_la_poesie', 'tiktok', '@vivre_la_poesie',
   'Lectures de poèmes au programme du bac',
   'Angle scolaire assumé, audience captive (Cahiers de Douai, Rimbaud). Preuve qu''il existe un public pour le classique lu.',
   array['lecture','scolaire','classiques'], 1),
  ('https://www.readpoetry.com/viral-verse-5-spoken-word-accounts-to-follow-on-tiktok/', 'autre', null,
   'Read Poetry — cinq comptes de spoken word sur TikTok',
   'Article de repérage. Constante : imagerie naturelle en mouvement plutôt qu''œuvres figées.',
   array['revue-de-presse','spoken-word'], 1)
) as v(url, platform, account, title, note, tags, rating)
where not exists (select 1 from public.inspirations i where i.url = v.url);
