-- supabase-schema.sql — Espace membres du Génie
-- À exécuter une seule fois dans Supabase → SQL Editor → New query → Run.
-- Sans risque de le relancer plus tard : les tables ne sont (re)créées que si elles n'existent pas déjà.

-- 1. Profils (prénom/pseudo affiché aux autres membres)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- 2. Articles / contributions des membres
create table if not exists public.articles (
  id bigint generated always as identity primary key,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  category text not null check (category in ('service','utile','divertissement','conseils','contacts-pro','fournisseurs')),
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

-- 3. Calendrier des repas ("qui mange au Génie ?")
create table if not exists public.meals (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text not null,
  meal_date date not null,
  comment text,
  created_at timestamptz not null default now(),
  unique (user_id, meal_date)
);

-- 4. Messagerie instantanée (canaux fixes : general / covoiturage / bons-plans / annonces-pro)
create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  channel text not null check (channel in ('general','covoiturage','bons-plans','annonces-pro')),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

-- ── Sécurité (Row Level Security) ──
-- Seuls les membres connectés (invités par un admin) peuvent lire/écrire.
-- Personne ne peut modifier ou effacer les messages/articles d'un·e autre membre.

alter table public.profiles enable row level security;
alter table public.articles enable row level security;
alter table public.meals enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "profiles: lecture par tous les membres" on public.profiles;
create policy "profiles: lecture par tous les membres" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles: écriture de son propre profil" on public.profiles;
create policy "profiles: écriture de son propre profil" on public.profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists "profiles: mise à jour de son propre profil" on public.profiles;
create policy "profiles: mise à jour de son propre profil" on public.profiles for update to authenticated using (auth.uid() = id);

drop policy if exists "articles: lecture par tous les membres" on public.articles;
create policy "articles: lecture par tous les membres" on public.articles for select to authenticated using (true);
drop policy if exists "articles: publication par un membre connecté" on public.articles;
create policy "articles: publication par un membre connecté" on public.articles for insert to authenticated with check (auth.uid() = author_id);
drop policy if exists "articles: suppression de son propre article" on public.articles;
create policy "articles: suppression de son propre article" on public.articles for delete to authenticated using (auth.uid() = author_id);

drop policy if exists "meals: lecture par tous les membres" on public.meals;
create policy "meals: lecture par tous les membres" on public.meals for select to authenticated using (true);
drop policy if exists "meals: inscription par un membre connecté" on public.meals;
create policy "meals: inscription par un membre connecté" on public.meals for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "meals: suppression de sa propre inscription" on public.meals;
create policy "meals: suppression de sa propre inscription" on public.meals for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "chat: lecture par tous les membres" on public.chat_messages;
create policy "chat: lecture par tous les membres" on public.chat_messages for select to authenticated using (true);
drop policy if exists "chat: envoi par un membre connecté" on public.chat_messages;
create policy "chat: envoi par un membre connecté" on public.chat_messages for insert to authenticated with check (auth.uid() = user_id);

-- ── Temps réel pour le chat (affichage instantané des nouveaux messages) ──
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;

-- 5. Recommandations "à voir, à faire" (activités et sorties hors du Génie)
create table if not exists public.activities (
  id bigint generated always as identity primary key,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  title text not null,
  description text not null,
  link text,
  event_date date,
  created_at timestamptz not null default now()
);

alter table public.activities enable row level security;

drop policy if exists "activities: lecture par tous les membres" on public.activities;
create policy "activities: lecture par tous les membres" on public.activities for select to authenticated using (true);
drop policy if exists "activities: proposition par un membre connecté" on public.activities;
create policy "activities: proposition par un membre connecté" on public.activities for insert to authenticated with check (auth.uid() = author_id);
drop policy if exists "activities: suppression de sa propre proposition" on public.activities;
create policy "activities: suppression de sa propre proposition" on public.activities for delete to authenticated using (auth.uid() = author_id);
