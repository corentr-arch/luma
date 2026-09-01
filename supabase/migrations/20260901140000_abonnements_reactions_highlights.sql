-- ============================================================
-- 1) Abonnements (follow) — profiles.nb_followers/nb_following
--    existaient déjà mais rien ne les alimentait.
-- ============================================================
create table if not exists abonnements (
  id bigint generated always as identity primary key,
  follower_id uuid not null references profiles(id) on delete cascade,
  suivi_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, suivi_id),
  check (follower_id <> suivi_id)
);

alter table abonnements enable row level security;

drop policy if exists "Lecture publique des abonnements" on abonnements;
create policy "Lecture publique des abonnements" on abonnements
  for select using (true);

drop policy if exists "Un utilisateur s'abonne en son nom" on abonnements;
create policy "Un utilisateur s'abonne en son nom" on abonnements
  for insert with check (auth.uid() = follower_id);

drop policy if exists "Un utilisateur se desabonne en son nom" on abonnements;
create policy "Un utilisateur se desabonne en son nom" on abonnements
  for delete using (auth.uid() = follower_id);

create or replace function abonnements_maj_compteurs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update profiles set nb_following = nb_following + 1 where id = new.follower_id;
    update profiles set nb_followers = nb_followers + 1 where id = new.suivi_id;
    return new;
  elsif TG_OP = 'DELETE' then
    update profiles set nb_following = greatest(0, nb_following - 1) where id = old.follower_id;
    update profiles set nb_followers = greatest(0, nb_followers - 1) where id = old.suivi_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trig_abonnements_insert on abonnements;
create trigger trig_abonnements_insert after insert on abonnements
  for each row execute function abonnements_maj_compteurs();

drop trigger if exists trig_abonnements_delete on abonnements;
create trigger trig_abonnements_delete after delete on abonnements
  for each row execute function abonnements_maj_compteurs();

-- ============================================================
-- 2) Réactions rapides sur événements (communautaires ET officiels)
-- ============================================================
create table if not exists evenements_reactions (
  id bigint generated always as identity primary key,
  evenement_id bigint references evenements(id) on delete cascade,
  evenement_officiel_id bigint references evenements_officiels(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  check (
    (evenement_id is not null and evenement_officiel_id is null) or
    (evenement_id is null and evenement_officiel_id is not null)
  )
);

create unique index if not exists uq_reaction_communautaire
  on evenements_reactions (evenement_id, user_id) where evenement_id is not null;
create unique index if not exists uq_reaction_officiel
  on evenements_reactions (evenement_officiel_id, user_id) where evenement_officiel_id is not null;

alter table evenements_reactions enable row level security;

drop policy if exists "Lecture publique des reactions" on evenements_reactions;
create policy "Lecture publique des reactions" on evenements_reactions
  for select using (true);

drop policy if exists "Un utilisateur reagit en son nom" on evenements_reactions;
create policy "Un utilisateur reagit en son nom" on evenements_reactions
  for insert with check (auth.uid() = user_id);

drop policy if exists "Un utilisateur modifie sa reaction" on evenements_reactions;
create policy "Un utilisateur modifie sa reaction" on evenements_reactions
  for update using (auth.uid() = user_id);

drop policy if exists "Un utilisateur supprime sa reaction" on evenements_reactions;
create policy "Un utilisateur supprime sa reaction" on evenements_reactions
  for delete using (auth.uid() = user_id);

-- ============================================================
-- 3) Stories à la une (highlights) — juste un flag pour l'UI.
--    La désactivation automatique (edge function nettoyer-stories,
--    hors dépôt) se base sur expires_at : pour survivre au nettoyage
--    horaire, le client repousse expires_at loin dans le futur au
--    moment d'épingler (cf CompteScreen.js).
-- ============================================================
alter table stories add column if not exists archivee boolean not null default false;
