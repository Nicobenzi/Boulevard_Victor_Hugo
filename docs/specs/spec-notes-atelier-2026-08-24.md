# Spec — travailler à deux en asynchrone : les notes de l'Atelier

- Date : 2026-08-24
- Demandeur / décideur : Nicolas
- Statut : à valider

## Le besoin en trois phrases

Nicolas et Charley ne travaillent pas aux mêmes heures ni sur les mêmes gestes : l'un
enregistre, l'autre monte et publie. Il leur manque un endroit où l'un laisse une demande —
« la nappe est trop douce sur *Bacchanale* », « il me faudrait un plan de feu » — et où l'autre
la retrouve **sans qu'on ait à se le dire ailleurs**. Charley a un compte depuis le 24/08 : la
contrainte « ne pas concevoir de fonctionnalité qui suppose sa présence » (memory.md § 1) tombe,
et c'est ce qui rend cette demande réalisable aujourd'hui.

## Ce qui a déjà échoué, et pourquoi ce n'est pas la même chose

`poems.notes` **existe déjà** — colonne `text`, retirée de l'écran le 23/08 avec ce motif :
« la fiche faisait saisir des champs jamais relus ». Elle est **vide sur les trois poèmes**
(vérifié le 24/08) : personne ne s'en est jamais servi. Trois raisons, qui deviennent trois
exigences :

1. **Aucun auteur, aucune date** — on ne pouvait pas savoir qui demandait quoi, ni quand.
2. **Aucun état** — rien ne distinguait une demande traitée d'une demande en attente.
3. **Rien ne la rappelait** — il fallait ouvrir la fiche du bon poème pour la découvrir.

Une note qui ne réclame rien n'est pas lue. C'est le point dur de cette spec, pas la table.

## Hors périmètre

- **Les notes sur les ressources** (un clip, une musique). Une note appartient à un **poème**,
  décision de Nicolas. Une demande générale (« il nous faut du métrage de feu ») se formule donc
  sur le poème qui la motive — et si le besoin d'un carnet libre se fait sentir, il reviendra
  de lui-même.
- **Toute notification sortante** (mail, push). Elle exigerait une Edge Function, donc un
  serveur, donc la rupture de la règle « tout en client ». Les notes se voient **dans l'app**.
- **Les mentions `@`, les pièces jointes, l'édition d'une note après coup.**
- **La suppression d'une note.** On résout, on n'efface pas : un fil qu'on peut réécrire perd sa
  valeur de trace. Voir les questions ouvertes.
- **La migration de `poems.notes`.** La colonne est vide, il n'y a rien à reprendre. On la laisse
  en base, comme `source` et `status` — on ne migre pas pour cacher (règle du 23/08).

## Parcours cible

**Dans la fiche du poème (Atelier)** — nouveau bloc **« Notes »**, sous les publications.

1. Les notes s'affichent de la plus ancienne à la plus récente, chacune avec **son auteur et sa
   date** (« Charley · 24 août, 14 h 02 »).
2. Une note non traitée porte un liseré or ; une note traitée est atténuée et indique qui l'a
   traitée et quand.
3. Bouton **« traité »** sur chaque note non traitée, **« rouvrir »** sur les autres.
   N'importe quel membre peut le faire : à deux, restreindre ne protège de rien.
4. Champ d'ajout en bas, libellé **« Laisser une note à… »**, bouton **« Envoyer »**.

**Sur les cartes du kanban** — une pastille compte les notes non traitées du poème.
Elle n'apparaît qu'au-dessus de zéro. Elle ne remplace ni le marqueur de forçage ni le
« il manque… » : elle s'ajoute, en fin de carte.

**Sur l'Accueil** — l'écran répond aujourd'hui « tient-on le rythme ? ». Il répondra aussi
**« qu'est-ce qui attend ? »** : un bloc listant les notes non traitées, la plus ancienne
d'abord, avec le titre du poème, l'auteur et le début du texte. Chaque ligne ouvre la fiche.
C'est le premier écran ouvert, donc le seul qu'on ne peut pas manquer — c'est ce qui répond au
troisième échec de `poems.notes`.

## Données et écritures

**Migration nécessaire : oui.**

```sql
create table public.notes (
  id          uuid primary key default gen_random_uuid(),
  poem_id     uuid not null references public.poems(id) on delete cascade,
  body        text not null,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id)
);
create index notes_poem_idx on public.notes(poem_id);
-- L'index qui sert l'Accueil : les notes en attente, la plus ancienne d'abord.
create index notes_ouvertes_idx on public.notes(created_at) where resolved_at is null;

alter table public.notes enable row level security;
create policy members_all_notes on public.notes
  for all using (public.is_member()) with check (public.is_member());
```

- `created_by` pointe sur `profiles` et non sur `auth.users` : c'est ce qui permet de lire
  `display_name` en une seule requête (`select *, profiles:created_by(display_name)`).
- `on delete cascade` sur `poem_id` : une note sans poème n'a aucun sens.
- **Point d'écriture** : `insert` et `update` directs depuis le client, comme le reste de l'app.
  Rien ici n'engage de stock, d'argent ni de registre — la règle de la RPC atomique ne
  s'applique pas.
- **Droits** : `is_member()`, comme toutes les autres tables. Nicolas et Charley voient et
  écrivent tout. Pas de notion de note privée.

**`lib/etapes.ts` : aucun changement.** Une note n'est pas une étape, et l'avancement reste
dérivé des faits de production. Ne pas céder à la tentation d'une colonne « en discussion ».

## Cas limites

1. **Une note sur un poème déjà publié.** Autorisée, et souhaitable : c'est le retour
   d'expérience (« la voix est trop compressée »), qui n'a aujourd'hui nulle part où aller.
2. **Les deux écrivent en même temps.** Deux `insert`, deux lignes, aucun écrasement — c'est
   précisément ce qu'un champ texte partagé ne savait pas faire.
3. **On marque « traité » une note qu'on a soi-même écrite.** Autorisé. `resolved_by` garde qui
   a fait le geste, ce qui suffit à relire l'histoire.
4. **Le poème est supprimé.** Les notes partent avec (`cascade`). Aucune note orpheline.
5. **Une note très longue.** L'Accueil n'affiche que les 120 premiers caractères, suivis de « … » ;
   la fiche affiche tout. On ne tronque jamais dans la fiche.
6. **Un membre supprimé de l'allowlist.** `created_by` reste, `profiles` reste : la note garde
   son auteur. On n'anonymise pas une trace de travail à deux.

## Critères d'acceptation

- [ ] Charley, connecté avec son compte, peut écrire une note sur un poème et la voir apparaître
      signée de son nom, sans recharger la page.
- [ ] Nicolas, sur un autre navigateur, la retrouve dans la fiche **et** sur l'Accueil.
- [ ] La carte du poème dans le kanban affiche « 1 note ».
- [ ] Marquer « traité » fait disparaître la note de l'Accueil et la pastille de la carte,
      sans effacer la note dans la fiche.
- [ ] « Rouvrir » la fait revenir aux deux endroits.
- [ ] Supprimer le poème supprime ses notes (vérifiable en base).
- [ ] Une note de 400 caractères est tronquée sur l'Accueil, entière dans la fiche.
- [ ] Contraste : le liseré or d'une note en attente ≥ 3,0 contre la carte.
- [ ] Le bloc est utilisable au clavier de bout en bout — champ, envoi, « traité ».
- [ ] `npm run build` vert sur le Mac.

## Questions restées ouvertes

- **Supprimer une note.** Écarté en v1 au nom de la trace, mais une faute de frappe envoyée
  reste visible pour toujours. Une fenêtre de suppression par l'auteur dans les cinq minutes
  serait un compromis. Décision de Nicolas.
- **Faut-il distinguer ses propres notes de celles de l'autre sur l'Accueil ?** La spec les
  mélange, l'auteur étant affiché. Si l'écran devient bruyant, on filtrera — mais ne pas
  optimiser avant d'avoir vu.
- **`poems.notes`** reste en base, vide et sans écran. À supprimer dans un futur lot de ménage,
  avec `source` et `status`, ou à garder — mais ne pas la réutiliser en croyant bien faire.
