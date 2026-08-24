-- Rattrapage des profils manquants.
--
-- `handle_new_user` ne crée un profil que si l'adresse est DÉJÀ dans `allowed_emails`
-- au moment de l'inscription. Un compte auth créé avant l'ajout à l'allowlist n'a donc
-- jamais de profil — et comme `is_member()` interroge `profiles` et non l'allowlist,
-- la personne est rejetée par RLS sur toutes les tables, sans message compréhensible.
-- C'est ce qui est arrivé à Charley : compte créé le 23/08 à 20 h 37, ajout à
-- l'allowlist après coup.
--
-- Idempotent : ne crée que les profils manquants d'adresses présentes dans l'allowlist.
-- Rejouable sans risque après chaque ajout à `allowed_emails`.
insert into public.profiles (id, email, display_name)
select u.id, u.email, split_part(u.email, '@', 1)
from auth.users u
join public.allowed_emails a on lower(a.email) = lower(u.email)
left join public.profiles p on p.id = u.id
where p.id is null;
