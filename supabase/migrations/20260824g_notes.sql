-- Travailler à deux en asynchrone. Spec : docs/specs/spec-notes-atelier-2026-08-24.md
--
-- `poems.notes` existait déjà et n'a jamais servi (vide sur les trois poèmes le 24/08) : un
-- champ texte sans auteur, sans date et sans état ne fait pas un échange, et rien ne le
-- rappelait — il fallait ouvrir la fiche du bon poème pour le découvrir. On le laisse en base
-- (on ne migre pas pour cacher, règle du 23/08) et on ouvre une vraie table.
--
-- ⚠ Ne pas réutiliser `poems.notes` en croyant bien faire : ses trois défauts sont la raison
-- d'être de cette table.
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  poem_id     uuid not null references public.poems(id) on delete cascade,
  body        text not null,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id)
);

-- created_by pointe sur profiles et non sur auth.users : c'est ce qui permet de lire
-- display_name en une seule requête depuis le client (`profiles:created_by(display_name)`).
create index if not exists notes_poem_idx on public.notes(poem_id);
-- L'index qui sert l'Accueil : les notes en attente, la plus ancienne d'abord.
create index if not exists notes_ouvertes_idx on public.notes(created_at) where resolved_at is null;

alter table public.notes enable row level security;

drop policy if exists members_all_notes on public.notes;
create policy members_all_notes on public.notes
  for all using (public.is_member()) with check (public.is_member());

comment on table public.notes is
  'Fil de notes par poème, pour le travail asynchrone entre Nicolas et Charley. Une note se résout, elle ne s''efface pas.';
